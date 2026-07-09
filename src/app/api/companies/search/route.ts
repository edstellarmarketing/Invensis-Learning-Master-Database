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
};

type Fields = {
  country: boolean;
  website: boolean;
  annualReportUrls: boolean;
  aiInsight: boolean;
};

type Provider = "claude" | "groq";

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
  const requested = String(body.provider ?? "auto"); // "auto" | "claude" | "groq"

  const rawFields = (body.fields ?? {}) as Partial<Record<keyof Fields, unknown>>;
  const fields: Fields = {
    country: rawFields.country !== false,
    website: rawFields.website !== false,
    annualReportUrls: rawFields.annualReportUrls !== false,
    aiInsight: rawFields.aiInsight !== false,
  };

  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasGroq = Boolean(process.env.GROQ_API_KEY);

  let provider: Provider;
  if (requested === "claude") {
    if (!hasClaude)
      return Response.json({ error: "Claude is not configured (set ANTHROPIC_API_KEY)." }, { status: 400 });
    provider = "claude";
  } else if (requested === "groq") {
    if (!hasGroq)
      return Response.json({ error: "Groq is not configured (set GROQ_API_KEY)." }, { status: 400 });
    provider = "groq";
  } else {
    if (hasClaude) provider = "claude";
    else if (hasGroq) provider = "groq";
    else
      return Response.json(
        {
          error:
            "AI search is disabled. Set ANTHROPIC_API_KEY (Claude) or GROQ_API_KEY (Groq) to enable live discovery, or use Add Company / Import CSV.",
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
      .slice(0, provider === "groq" ? 40 : 200);
  } catch {
    // Non-fatal: search still works without the exclusion list.
  }

  const prompt = buildPrompt({
    courseName,
    industryName,
    country,
    size,
    query,
    count,
    existingNames,
    fields,
    liveSearch: provider === "claude",
  });

  try {
    const text =
      provider === "claude" ? await runClaude(prompt, count) : await runGroq(prompt, count, fields);
    let candidates = parseCandidates(text, fields);

    // Server-side dedupe: drop rows that match saved companies or repeat within the batch.
    const seen = new Set(existingNames.map((n) => n.toLowerCase().trim()));
    candidates = candidates.filter((c) => {
      const key = c.companyName.toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return Response.json({ candidates, provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI search failed";
    return Response.json({ error: message, provider }, { status: 502 });
  }
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
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return (data.choices?.[0]?.message?.content ?? "").trim();
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

function parseCandidates(text: string, fields: Fields): Candidate[] {
  // Strip code fences if present, then extract the first JSON array.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
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
