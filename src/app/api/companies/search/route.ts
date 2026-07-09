import Anthropic from "@anthropic-ai/sdk";
import { findCourse } from "@/lib/courses";
import { readCompanies } from "@/lib/companies";

export const runtime = "nodejs";
// Large counts take a while; Vercel clamps this to the plan's ceiling.
export const maxDuration = 300;

type Candidate = {
  companyName: string;
  country: string;
  website: string;
  annualReportUrls: string[];
  aiInsight: string[];
  source?: string;
  // Set by server-side link verification (same bar as the hand-verified seed rows):
  // true = at least one report URL fetched OK; false = URLs were dead and removed;
  // undefined = nothing to verify.
  reportVerified?: boolean;
};

type Fields = {
  country: boolean;
  website: boolean;
  annualReportUrls: boolean;
  aiInsight: boolean;
};

type Provider = "claude" | "openrouter" | "groq";
type TokenUsage = "low" | "medium" | "high";
type ModelFamily = "claude" | "gemini" | "gpt" | "deepseek" | "free" | "other";

// OpenRouter model catalog: family -> token-usage tier -> model slug. Verified live
// against GET https://openrouter.ai/api/v1/models (no auth needed) - re-check there
// before changing, OpenRouter deprecates/renames slugs over time.
// "low" skips the :online web-search plugin (cheaper, answers from training knowledge);
// "medium"/"high" enable it for live-verified results, "high" also steps up to a larger
// model in the family and a bigger token budget.
const OPENROUTER_MODELS: Record<ModelFamily, Record<TokenUsage, string>> = {
  claude: {
    low: "anthropic/claude-haiku-4.5",
    medium: "anthropic/claude-sonnet-5:online",
    high: "anthropic/claude-opus-4.8:online",
  },
  gemini: {
    low: "google/gemini-3.1-flash-lite",
    medium: "google/gemini-3.5-flash:online",
    high: "google/gemini-2.5-pro:online",
  },
  gpt: {
    low: "openai/gpt-4o-mini",
    medium: "openai/gpt-4o:online",
    high: "openai/gpt-4-turbo:online",
  },
  deepseek: {
    low: "deepseek/deepseek-chat",
    medium: "deepseek/deepseek-chat-v3.1:online",
    high: "deepseek/deepseek-r1:online",
  },
  // Genuinely $0 open models (:free). No :online web search (that plugin is billable),
  // so results are model-knowledge only and get hedged like Groq.
  free: {
    low: "meta-llama/llama-3.2-3b-instruct:free",
    medium: "meta-llama/llama-3.3-70b-instruct:free",
    high: "qwen/qwen3-next-80b-a3b-instruct:free",
  },
  other: {
    low: "",
    medium: "",
    high: "",
  },
};

// Rotation pool for the free family: OpenRouter's :free models share a heavily
// rate-limited pool per model, so on a 429 we hop to the next free model instead of
// failing. Ordered by capability. All slugs verified against /api/v1/models.
const FREE_MODEL_POOL = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

const TOKEN_BUDGETS: Record<TokenUsage, (count: number) => number> = {
  low: (count) => Math.min(4000, 500 + count * 200),
  medium: (count) => Math.min(12000, 1200 + count * 400),
  high: (count) => Math.min(24000, 2000 + count * 600),
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const courseSlug = String(body.courseSlug ?? "");
  const industrySlug = String(body.industrySlug ?? "");
  const industryName = String(body.industryName ?? "");
  const country = String(body.country ?? "").trim();
  const query = String(body.query ?? "").trim();
  const size = String(body.size ?? "").trim();
  const count = Math.min(100, Math.max(1, Number(body.count) || 5));
  const requested = String(body.provider ?? "auto"); // "auto" | "claude" | "openrouter" | "groq"

  const rawFields = (body.fields ?? {}) as Partial<Record<keyof Fields, unknown>>;
  const fields: Fields = {
    country: rawFields.country !== false,
    website: rawFields.website !== false,
    annualReportUrls: rawFields.annualReportUrls !== false,
    aiInsight: rawFields.aiInsight !== false,
  };

  // Only meaningful when provider resolves to "openrouter" - which model family + how
  // much token budget (and whether the paid :online web-search plugin is on).
  const tokenUsage: TokenUsage = ["low", "medium", "high"].includes(String(body.tokenUsage))
    ? (body.tokenUsage as TokenUsage)
    : "medium";
  const modelFamily: ModelFamily = ["claude", "gemini", "gpt", "deepseek", "free", "other"].includes(
    String(body.model),
  )
    ? (body.model as ModelFamily)
    : "claude";
  const customModel = String(body.customModel ?? "").trim();

  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  let provider: Provider;
  if (requested === "claude") {
    if (!hasClaude)
      return Response.json({ error: "Claude is not configured (set ANTHROPIC_API_KEY)." }, { status: 400 });
    provider = "claude";
  } else if (requested === "openrouter") {
    if (!hasOpenRouter)
      return Response.json({ error: "OpenRouter is not configured (set OPENROUTER_API_KEY)." }, { status: 400 });
    provider = "openrouter";
  } else if (requested === "groq") {
    if (!hasGroq)
      return Response.json({ error: "Groq is not configured (set GROQ_API_KEY)." }, { status: 400 });
    provider = "groq";
  } else {
    // Auto: Claude -> OpenRouter -> Groq.
    if (hasClaude) provider = "claude";
    else if (hasOpenRouter) provider = "openrouter";
    else if (hasGroq) provider = "groq";
    else
      return Response.json(
        {
          error:
            "AI search is disabled. Set ANTHROPIC_API_KEY (Claude), OPENROUTER_API_KEY (OpenRouter), or GROQ_API_KEY (Groq) to enable live discovery, or use Add Company / Import CSV.",
        },
        { status: 400 },
      );
  }

  const course = findCourse(courseSlug);
  const courseName = course?.name ?? courseSlug;

  // Research quality: exclude companies already saved for this course+industry so
  // repeated searches keep discovering NEW prospects. Cap the list so it can't blow
  // up the prompt (and the Groq per-request token ceiling) on a well-populated table.
  let existingNames: string[] = [];
  try {
    const all = await readCompanies();
    existingNames = all
      .filter((c) => c.courseSlug === courseSlug && (!industrySlug || c.industrySlug === industrySlug))
      .map((c) => c.companyName)
      .slice(0, provider === "groq" ? 40 : 150);
  } catch {
    // Non-fatal: search still works without the exclusion list.
  }

  let resolvedModel: string | undefined;
  if (provider === "openrouter") {
    resolvedModel =
      modelFamily === "other"
        ? customModel || process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5:online"
        : OPENROUTER_MODELS[modelFamily][tokenUsage];
    if (!resolvedModel) {
      return Response.json(
        { error: "Pick a model or provide a custom OpenRouter model slug." },
        { status: 400 },
      );
    }
  }

  // Auto mode cascades through every configured provider on failure; an explicit
  // provider choice fails fast with that provider's error - with one exception:
  // the free OpenRouter family falls through to Groq (also $0) when the whole free
  // pool is rate-limited, since the user's cost expectation is identical.
  const chain: Provider[] =
    requested === "auto"
      ? ([
          hasClaude ? "claude" : null,
          hasOpenRouter ? "openrouter" : null,
          hasGroq ? "groq" : null,
        ].filter(Boolean) as Provider[])
      : provider === "openrouter" && modelFamily === "free" && hasGroq
        ? ["openrouter", "groq"]
        : [provider];

  const errors: string[] = [];
  for (const p of chain) {
    const orModel =
      resolvedModel ??
      OPENROUTER_MODELS[modelFamily][tokenUsage] ??
      "anthropic/claude-sonnet-5:online";
    // Rebuild per provider so the live-search framing matches what actually runs.
    const prompt = buildPrompt({
      courseName,
      industryName,
      country,
      size,
      query,
      count,
      existingNames,
      fields,
      liveSearch: p === "claude" || (p === "openrouter" && orModel.endsWith(":online")),
    });
    try {
      const run = () =>
        p === "claude"
          ? runClaude(prompt, count)
          : p === "openrouter"
            ? runOpenRouter(prompt, count, orModel, tokenUsage)
            : runGroq(prompt, count, fields);

      let text = await run();
      let candidates = parseCandidates(text, fields);
      if (candidates.length === 0 && text) {
        // One strict retry: some models wrap the array in prose despite instructions.
        text = await run();
        candidates = parseCandidates(text, fields);
      }
      if (candidates.length === 0) {
        throw new Error(
          `Model returned no parseable results${text ? ` (started with: "${text.slice(0, 120)}...")` : " (empty response)"}`,
        );
      }

      // Server-side dedupe: drop rows that match saved companies or repeat within the batch.
      const seen = new Set(existingNames.map((n) => n.toLowerCase().trim()));
      candidates = candidates.filter((c) => {
        const key = c.companyName.toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Link verification - the same bar the hand-verified seed rows met: fetch every
      // annual-report URL and drop the dead ones instead of shipping 404s to the table.
      if (fields.annualReportUrls) {
        candidates = await verifyReportLinks(candidates);
      }

      return Response.json({ candidates, provider: p, model: p === "openrouter" ? orModel : undefined });
    } catch (err) {
      errors.push(`${p}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  return Response.json(
    { error: errors.join(" | ").replace(/RATE_LIMITED: /g, "") || "AI search failed", provider },
    { status: 502 },
  );
}

// Fetch each annual-report URL (HEAD, falling back to a ranged GET when HEAD is blocked)
// and remove URLs that are definitively dead (404/410, DNS failure, timeout). Ambiguous
// responses (403 bot-blocks, 405) are kept - better an occasional challenge page than a
// dropped real report. Capped concurrency; ~6s per URL.
async function verifyReportLinks(candidates: Candidate[]): Promise<Candidate[]> {
  const checkUrl = async (url: string): Promise<boolean> => {
    if (!/^https?:\/\//i.test(url)) return false;
    const probe = async (method: "HEAD" | "GET") => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        return await fetch(url, {
          method,
          redirect: "follow",
          signal: ctrl.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; InvensisMasterDB/1.0; link-check)",
            ...(method === "GET" ? { Range: "bytes=0-2047" } : {}),
          },
        });
      } finally {
        clearTimeout(timer);
      }
    };
    try {
      let res = await probe("HEAD");
      if (res.status === 405 || res.status === 501) res = await probe("GET");
      if (res.status === 404 || res.status === 410) return false;
      return true;
    } catch {
      try {
        const res = await probe("GET");
        return res.status !== 404 && res.status !== 410;
      } catch {
        return false; // unreachable host / timeout twice
      }
    }
  };

  // Flatten all URLs, verify with bounded parallelism, then map results back.
  const jobs: { c: Candidate; url: string }[] = [];
  for (const c of candidates) for (const url of c.annualReportUrls.slice(0, 3)) jobs.push({ c, url });
  const results = new Map<string, boolean>();
  const POOL = 8;
  for (let i = 0; i < jobs.length; i += POOL) {
    await Promise.all(
      jobs.slice(i, i + POOL).map(async ({ url }) => {
        if (!results.has(url)) results.set(url, await checkUrl(url));
      }),
    );
  }

  return candidates.map((c) => {
    if (c.annualReportUrls.length === 0) return c;
    const alive = c.annualReportUrls.filter((u) => results.get(u) === true);
    return {
      ...c,
      annualReportUrls: alive,
      reportVerified: alive.length > 0 ? true : false,
    };
  });
}

function buildPrompt(p: {
  courseName: string;
  industryName: string;
  country: string;
  size: string;
  query: string;
  count: number;
  existingNames: string[];
  fields: Fields;
  liveSearch: boolean;
}): string {
  const exclusions =
    p.existingNames.length > 0
      ? `\nEXCLUDE these companies (already in our database): ${p.existingNames.join(", ")}.`
      : "";

  const fieldSpecs: string[] = ["companyName (string, required)"];
  const rules: string[] = [];
  if (p.fields.website) {
    fieldSpecs.push("website (string)");
    rules.push("- website: the official corporate site URL (https, no tracking params).");
  }
  if (p.fields.country) {
    fieldSpecs.push("country (string)");
    rules.push("- country: the company's headquarters country name.");
  }
  if (p.fields.annualReportUrls) {
    fieldSpecs.push("annualReportUrls (string[])");
    rules.push(
      p.liveSearch
        ? "- annualReportUrls: a real URL to the most recent annual report (PDF preferred, else the investor-relations annual-report page). Empty array if none exists."
        : "- annualReportUrls: you do NOT have live web access. Only include a URL if you are highly confident it is correct (e.g. a well-known investor-relations domain pattern); otherwise return an empty array rather than guessing a URL.",
    );
  }
  if (p.fields.aiInsight) {
    fieldSpecs.push("aiInsight (string[] of 4-5 items)");
    fieldSpecs.push("source (string)");
    rules.push(
      p.liveSearch
        ? "- aiInsight: 4-5 concise bullets on the training / learning & development / upskilling activity in their most recent financial year. Base every bullet on real disclosures (annual report, ESG/sustainability report, press releases). If a figure is not verifiable, phrase qualitatively - NEVER invent numbers."
        : "- aiInsight: you do NOT have live web access. Give 4-5 plausible, qualitatively-phrased bullets on likely L&D / upskilling activity based on general knowledge of the company and industry. NEVER state specific figures or dates as fact - phrase everything as general characterization, and prefix each bullet with \"Likely:\" so it reads as an estimate, not a verified disclosure.",
      '- source: where the insight came from (e.g. "FY2025 annual report") if live search, or "AI estimate, not verified" if not.',
    );
  }

  return `You are a B2B sales-research assistant for Invensis Learning, which sells "${p.courseName}" corporate training.
${p.liveSearch ? "" : "\nYou do NOT have live web search in this mode - answer from general knowledge and be conservative about anything you cannot verify.\n"}

Find ${p.count} REAL companies in the "${p.industryName}" industry${
    p.country ? ` based in ${p.country}` : ""
  }${p.size ? `, company size: ${p.size}` : ""} that are strong prospects for this training${
    p.query ? `. Extra criteria: ${p.query}` : ""
  }.${exclusions}

Research rules:
- Prefer companies that publish annual reports (listed companies, large private firms) so training activity is verifiable.
- Mix well-known leaders with less obvious mid-tier prospects; do not pad with subsidiaries of the same group.
${rules.join("\n")}

Respond with ONLY a JSON array (no markdown fences, no prose before or after) of ${p.count} objects with keys:
${fieldSpecs.join(", ")}.`;
}

async function runClaude(prompt: string, count: number): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const resp = await client.messages.create({
    model,
    // Scale output budget and search allowance with the requested company count.
    max_tokens: Math.min(24000, 1500 + count * 500),
    // Server-side web search tool. Cast: older SDK type defs don't list server tools,
    // but the API accepts the JSON passthrough.
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: Math.min(20, Math.ceil(count / 2) + 4),
      } as unknown as Anthropic.Tool,
    ],
    messages: [{ role: "user", content: prompt }],
  });
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// OpenRouter via its OpenAI-compatible REST API (no SDK dependency). Model + token budget
// are resolved by the caller from the model-family/token-usage picker (OPENROUTER_MODELS /
// TOKEN_BUDGETS above). A ":online" suffix on the model turns on OpenRouter's built-in web
// search plugin (paid, billed by OpenRouter) for live-verified results.
async function runOpenRouter(
  prompt: string,
  count: number,
  model: string,
  tokenUsage: TokenUsage,
): Promise<string> {
  const isFreeModel = model.endsWith(":free");
  // Free family: rotate through the whole free pool on 429s - each :free model has its
  // own rate bucket, so the next one usually has capacity when the first is saturated.
  const modelQueue = isFreeModel
    ? [model, ...FREE_MODEL_POOL.filter((m) => m !== model)]
    : [model, model]; // paid models: one retry on the same slug after a short wait

  let lastStatus = 0;
  let lastBody = "";
  let lastModel = model;
  for (let i = 0; i < modelQueue.length; i++) {
    const currentModel = modelQueue[i];
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://invensis-learning-master-database.vercel.app",
        "X-Title": "Invensis Learning Master Database",
      },
      body: JSON.stringify({
        model: currentModel,
        max_tokens: TOKEN_BUDGETS[tokenUsage](count),
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (res.ok) {
      return extractOpenAIContent(await res.json());
    }
    lastStatus = res.status;
    lastBody = await res.text().catch(() => "");
    lastModel = currentModel;
    if ((res.status === 429 || res.status === 503) && i < modelQueue.length - 1) {
      await new Promise((r) => setTimeout(r, isFreeModel ? 1500 : 3000));
      continue; // next model in the queue (or same model once, for paid)
    }
    break;
  }
  if (lastStatus === 429 || lastStatus === 503) {
    // Marker prefix lets the caller know a free-tier fallback to Groq is appropriate.
    throw new Error(
      `RATE_LIMITED: OpenRouter ${isFreeModel ? "free model pool is" : "rate limits are"} saturated right now (tried ${modelQueue.length} model${modelQueue.length > 1 ? "s" : ""}).`,
    );
  }
  throw new Error(`OpenRouter API error ${lastStatus} (model ${lastModel}): ${lastBody.slice(0, 300)}`);
}

// Groq fallback via its OpenAI-compatible REST API (no SDK dependency).
// Default model is a standard (non-agentic) chat model. groq/compound (Groq's built-in
// web-search orchestrator) was tried first but its internal multi-model tool chain burns
// 10-20k+ tokens per request even for 2-3 companies, exhausting the free tier's 30k
// tokens-per-minute limit on a single call - retries just collide with themselves.
// llama-3.3-70b-versatile answers from model knowledge instead of live browsing, which
// is far more reliable on the free tier; the tradeoff is that annual report URLs and
// insights should be spot-checked (the UI copy says so). Handle both failure modes:
// - 413 (request_too_large): retry once with a smaller completion budget.
// - 429 (rate limit): Groq's error names the exact wait; sleep that long and retry once.
async function runGroq(prompt: string, count: number, fields: Fields): Promise<string> {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const perCompany = 120 + (fields.aiInsight ? 220 : 0) + (fields.annualReportUrls ? 40 : 0);
  const budgets = [
    Math.min(4096, 500 + count * perCompany),
    Math.min(2048, 300 + count * Math.round(perCompany * 0.6)),
  ];

  let lastErr = "";
  let ratedLimited = false;
  for (let i = 0; i < budgets.length; i++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({ model, max_tokens: budgets[i], messages: [{ role: "user", content: prompt }] }),
    });
    if (res.ok) {
      return extractOpenAIContent(await res.json());
    }
    const errBody = await res.text().catch(() => "");
    lastErr = `Groq API error ${res.status}: ${errBody.slice(0, 400)}`;

    if (res.status === 429) {
      ratedLimited = true;
      const waitMatch = errBody.match(/try again in ([\d.]+)s/i);
      const waitMs = Math.min(30000, Math.ceil((waitMatch ? Number(waitMatch[1]) : 8) * 1000) + 500);
      await new Promise((r) => setTimeout(r, waitMs));
      continue; // retry same budget after waiting
    }
    if (res.status === 413) continue; // next (smaller) budget
    break; // other errors: don't retry
  }

  if (ratedLimited) {
    throw new Error(
      "Groq's free tier rate limit was hit twice in a row. Wait about a minute and try again, request fewer companies, or switch the provider to Claude.",
    );
  }
  if (lastErr.includes("413") || lastErr.includes("request_too_large")) {
    throw new Error(
      "Groq rejected the request as too large for this model. Try a lower company count, fewer fields, or switch the provider to Claude.",
    );
  }
  throw new Error(lastErr || "Groq API request failed");
}

// OpenAI-compatible responses differ per model: content may be a plain string, an array
// of typed parts (some Gemini routes), or empty with the real output in a "reasoning"
// field (DeepSeek R1 style). Missing these shapes is why some models "returned nothing".
function extractOpenAIContent(data: unknown): string {
  const msg = (data as { choices?: { message?: Record<string, unknown> }[] })?.choices?.[0]?.message;
  if (!msg) return "";
  const { content, reasoning } = msg as { content?: unknown; reasoning?: unknown };
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const joined = content
      .map((part) =>
        typeof part === "string" ? part : String((part as { text?: string })?.text ?? ""),
      )
      .join("\n")
      .trim();
    if (joined) return joined;
  }
  if (typeof reasoning === "string" && reasoning.trim()) return reasoning.trim();
  return "";
}

function parseCandidates(text: string, fields: Fields): Candidate[] {
  // Strip code fences if present, then extract the first JSON array.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    // Repair the most common model JSON slip: trailing commas before ] or }.
    const slice = cleaned.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1");
    const parsed = JSON.parse(slice);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c: Record<string, unknown>) => ({
      companyName: String(c.companyName ?? ""),
      country: fields.country ? String(c.country ?? "") : "",
      website: fields.website ? String(c.website ?? "") : "",
      annualReportUrls:
        fields.annualReportUrls && Array.isArray(c.annualReportUrls)
          ? (c.annualReportUrls as unknown[]).map(String)
          : [],
      aiInsight:
        fields.aiInsight && Array.isArray(c.aiInsight) ? (c.aiInsight as unknown[]).map(String) : [],
      source: fields.aiInsight && c.source ? String(c.source) : undefined,
    }));
  } catch {
    return [];
  }
}
