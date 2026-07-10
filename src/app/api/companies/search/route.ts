import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";
import Anthropic from "@anthropic-ai/sdk";
import { readAllCourses } from "@/lib/courses";
import { readCompanies } from "@/lib/companies";
import { cacheGet, cacheSet, incrementWithExpiry } from "@/lib/storage";
import { readJsonBody } from "@/lib/requestLimits";
import {
  gateInsightsOnVerification,
  mergeResearched,
  partitionForGroundedInsights,
} from "@/lib/insightGate";

// Unauthenticated route that calls paid provider APIs with server-held keys - without a
// cap, anyone can hammer it to run up billing or exhaust Vercel function concurrency.
// Per-IP, not global, so one busy user can't lock everyone else out. No-ops in local dev
// (no Redis to hold a shared counter against).
const SEARCH_RATE_LIMIT = 30;
const SEARCH_RATE_WINDOW_SECONDS = 60;

async function checkSearchRateLimit(request: Request): Promise<Response | null> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const count = await incrementWithExpiry(`search:${ip}`, SEARCH_RATE_WINDOW_SECONDS);
  if (count !== null && count > SEARCH_RATE_LIMIT) {
    return Response.json(
      { error: "Too many search requests from this network. Wait a minute and try again." },
      { status: 429 },
    );
  }
  return null;
}

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
  // Same idea for the website, tracked separately from the `website` field itself: a
  // caller can ask to verify a website without asking to have its value echoed back
  // (fields.website: false) - e.g. "Refresh reports & insights" re-researches a saved
  // company's reports/insights without touching its saved website. websiteVerified lets
  // the staged-insights gate (hasVerifiedWebsite) work correctly in that case instead of
  // silently never triggering.
  websiteVerified?: boolean;
};

type Fields = {
  country: boolean;
  website: boolean;
  annualReportUrls: boolean;
  aiInsight: boolean;
};

type Provider = "claude" | "openrouter" | "groq";
type TokenUsage = "low" | "medium" | "high";
type ModelFamily = "claude" | "glm" | "gemini" | "gpt" | "deepseek" | "free" | "other";

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
  // GLM 5.2 (Z-AI/Zhipu): ~3x cheaper than Sonnet on input, ~4x cheaper on output, same
  // 1M context window, benchmarks at or above Sonnet on tool-use/agentic tasks - the best
  // "cheaper than Claude, equal or better quality" pick on OpenRouter as of this writing.
  // Only one z-ai model is published right now, so unlike other families there's no
  // separate low-tier model to step down to - low/medium/high all resolve to glm-5.2 and
  // differ only by the :online suffix and token budget.
  glm: {
    low: "z-ai/glm-5.2",
    medium: "z-ai/glm-5.2:online",
    high: "z-ai/glm-5.2:online",
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

// ---------------------------------------------------------------------------
// Shared prompt fragments. All three prompt sites (buildPrompt for discovery,
// enrichCompanies, deepResearch) must ask for the SAME thing, or the same company
// researched via two different paths comes back with differently-shaped insights.
// ---------------------------------------------------------------------------

// The report we want is the most recent *completed* financial year - i.e. the latest one
// actually published, not a partial/current-year filing. Fiscal calendars vary (Japanese
// FY ends in March, many US firms in Sept/Dec), so name the target year rather than a
// hard rule and let the model reconcile. Computed per-request so this doesn't go stale.
function lastCompletedFinancialYear(): number {
  return new Date().getFullYear() - 1;
}

function reportRule(liveSearch: boolean): string {
  const fy = lastCompletedFinancialYear();
  return liveSearch
    ? `- annualReportUrls: a real URL to the annual report for the LAST COMPLETED financial year (FY${fy}, or the company's nearest equivalent - fiscal calendars vary). Prefer the direct PDF, else the investor-relations page for THAT year. Do NOT return an older archived year when FY${fy} exists, and do NOT return a current/partial-year filing. Empty array if none exists.`
    : `- annualReportUrls: you do NOT have live web access. Only include a URL if you are highly confident it is correct AND is the FY${fy} (last completed financial year) report; otherwise return an empty array rather than guessing a URL or a year.`;
}

// What an insight bullet must actually contain. The sales use-case is: can Invensis
// Learning sell this company corporate training? So the bullets are ordered by how
// directly they support that pitch. The anti-hallucination rules are the important part -
// a fabricated training-spend figure is worse than no figure, because it will get quoted
// into a real sales conversation.
const INSIGHT_TOPICS = [
  "1. How many employees were trained / upskilled (headcount, training hours, or % of workforce) - ONLY if the report states it.",
  "2. Which technologies, skills, or competencies the training focused on most (e.g. cloud, data/AI, agile/project management, leadership, safety).",
  "3. Training / L&D spend or investment - ONLY if an explicit figure appears in the report. Never estimate, extrapolate, or convert an unrelated number into one.",
  "4. Existing L&D infrastructure worth naming: corporate university, academies, LMS platform, certification or apprenticeship programmes, external training partners.",
  "5. Any other concrete factor that would help sell corporate training to them - upcoming transformation/restructuring, a stated reskilling commitment, PMO/project-delivery maturity, certification targets, or large-scale hiring.",
].join("\n  ");

function insightRule(liveSearch: boolean): string {
  return liveSearch
    ? `- aiInsight: 4-5 concise bullets on their training / learning & development / upskilling activity in the LAST COMPLETED financial year, drawn from the annual report (or ESG/sustainability report, or official press releases). Cover, in this priority order:
  ${INSIGHT_TOPICS}
  HARD RULES: every figure must appear verbatim in a real disclosure you actually read. If a number is not stated, describe the fact qualitatively instead - NEVER invent, estimate, or infer a figure. If a topic above is not disclosed at all, SKIP that bullet rather than filling it with an assumption. Fewer, true bullets beat five padded ones.`
    : `- aiInsight: you do NOT have live web access, so you cannot verify any figure. Give 4-5 qualitative bullets on their LIKELY L&D / upskilling posture, based on general knowledge of the company and its industry, covering roughly:
  ${INSIGHT_TOPICS}
  HARD RULES: state NO specific numbers, amounts, dates, or headcounts as fact - you cannot verify them. Prefix every bullet with "Likely:" so it reads as an unverified estimate. Omit the training-spend bullet entirely (never guess a cost). If you do not actually know something about this specific company, say so qualitatively rather than inventing detail.`;
}

function sourceRule(liveSearch: boolean): string {
  const fy = lastCompletedFinancialYear();
  return liveSearch
    ? `- source: the exact document the insights came from, naming the financial year (e.g. "FY${fy} Annual Report, p.42" or "FY${fy} Sustainability Report").`
    : `- source: "AI estimate, not verified".`;
}

export async function POST(request: Request) {
  const rateLimited = await checkSearchRateLimit(request);
  if (rateLimited) return rateLimited;

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

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
  const modelFamily: ModelFamily = [
    "claude",
    "glm",
    "gemini",
    "gpt",
    "deepseek",
    "free",
    "other",
  ].includes(String(body.model))
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

  // Multi-course targeting: name every selected course in the prompt so the discovered
  // companies are prospects for all of them at once. Falls back to the single course.
  const courseSlugs =
    Array.isArray(body.courseSlugs) && body.courseSlugs.length > 0
      ? (body.courseSlugs as unknown[]).map(String)
      : [courseSlug];
  const allCourses = await readAllCourses();
  const nameOf = (slug: string) => allCourses.find((c) => c.slug === slug)?.name ?? slug;
  const courseName =
    courseSlugs.length === 1
      ? nameOf(courseSlugs[0])
      : courseSlugs.map(nameOf).join(", ");

  // Extra exclusions from the client (batched searches pass earlier batches' names so
  // batch N+1 keeps discovering new companies).
  const excludeNames = Array.isArray(body.excludeNames)
    ? (body.excludeNames as unknown[]).map(String).filter(Boolean)
    : [];

  // Research quality: exclude companies already saved for this course+industry so
  // repeated searches keep discovering NEW prospects. Cap the list so it can't blow
  // up the prompt (and the Groq per-request token ceiling) on a well-populated table.
  let existingNames: string[] = [...excludeNames];
  try {
    const all = await readCompanies();
    const targetSlugs = new Set(courseSlugs);
    existingNames.push(
      ...all
        .filter((c) => targetSlugs.has(c.courseSlug) && (!industrySlug || c.industrySlug === industrySlug))
        .map((c) => c.companyName),
    );
  } catch {
    // Non-fatal: search still works without the exclusion list.
  }
  existingNames = existingNames.slice(0, provider === "groq" ? 40 : 150);

  // 24h result cache (Redis; no-op locally). Only for first-batch requests - once
  // exclusions accumulate, results are inherently unique per call.
  // CACHE_SCHEMA_VERSION: bump this whenever the response *shape* for the same request
  // params changes (e.g. the staged AI-Insights verification gate added here) - without
  // it, an old cached response written by pre-change code keeps serving for up to 24h
  // after a deploy, silently bypassing whatever the change was supposed to fix.
  const CACHE_SCHEMA_VERSION = 2; // v2: AI Insights staged behind website/report verification
  const cacheKey = createHash("sha1")
    .update(
      JSON.stringify({
        v: CACHE_SCHEMA_VERSION,
        courseSlug,
        courseSlugs: [...courseSlugs].sort(),
        industrySlug,
        country,
        size,
        query,
        count,
        requested,
        modelFamily,
        customModel,
        tokenUsage,
        fields,
      }),
    )
    .digest("hex");
  if (excludeNames.length === 0) {
    const hit = await cacheGet<{ candidates: Candidate[]; provider: Provider; model?: string }>(cacheKey);
    if (hit && Array.isArray(hit.candidates) && hit.candidates.length > 0) {
      return Response.json({ ...hit, cached: true });
    }
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

  // Enrich mode: the client sends known companies (typically website-only discoveries)
  // and asks for the remaining fields per company - no discovery phase at all.
  const enrichTargets = Array.isArray(body.enrich)
    ? (body.enrich as unknown[])
        .map((t) => {
          const o = (t ?? {}) as Record<string, unknown>;
          return { companyName: String(o.companyName ?? "").trim(), website: String(o.website ?? "").trim() };
        })
        .filter((t) => t.companyName)
        .slice(0, 25)
    : [];

  const errors: string[] = [];

  if (enrichTargets.length > 0) {
    for (const p of chain) {
      const orModel =
        resolvedModel ?? OPENROUTER_MODELS[modelFamily][tokenUsage] ?? "anthropic/claude-sonnet-5:online";
      const liveSearch = p === "claude" || (p === "openrouter" && orModel.endsWith(":online"));
      // Mirror discovery's staged pipeline (see the main loop below): don't keep insights
      // for a company whose website/report couldn't be verified, even in enrich mode.
      // Deliberately NOT gated on fields.website - "Refresh reports & insights" (the
      // companies table's bulk action) always sends fields.website: false since it doesn't
      // want the saved website re-researched/overwritten, but verifyLinks checks a present
      // website regardless of that flag, so the gate must too, or it silently never
      // triggers for that call site (a bug that shipped once - see AGENTS.md).
      const staged = fields.annualReportUrls && fields.aiInsight;
      // With live search, skip insights in the first pass and earn them in a second,
      // report-grounded one (deepResearch) - same as discovery. Without it, there's no
      // grounded pass to run, so the first-pass (hedged) insights are just gated.
      const deep = staged && liveSearch;
      const phase1Fields: Fields = deep ? { ...fields, aiInsight: false } : fields;
      try {
        let candidates = await enrichCompanies(
          enrichTargets,
          p,
          orModel,
          tokenUsage,
          phase1Fields,
          courseName,
          liveSearch,
        );
        if (fields.annualReportUrls || fields.website) {
          candidates = await verifyLinks(candidates, fields);
        }
        if (deep) {
          candidates = await researchQualified(candidates, p, orModel, courseName);
        } else if (staged) {
          candidates = gateInsightsOnVerification(candidates);
        }
        return Response.json({
          candidates,
          provider: p,
          model: p === "openrouter" ? orModel : undefined,
          enriched: true,
          deep,
        });
      } catch (err) {
        errors.push(`${p}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    return Response.json(
      { error: errors.join(" | ").replace(/RATE_LIMITED: /g, "") || "Enrichment failed", provider },
      { status: 502 },
    );
  }

  for (const p of chain) {
    const orModel =
      resolvedModel ??
      OPENROUTER_MODELS[modelFamily][tokenUsage] ??
      "anthropic/claude-sonnet-5:online";
    const liveSearch = p === "claude" || (p === "openrouter" && orModel.endsWith(":online"));
    // Staged workflow: when Website + Annual Reports + AI Insights are ALL requested
    // together, gate insights on verification instead of generating them blind - find
    // the company and its website, verify the website, verify the annual report, and
    // only then spend anything on insights. An unverified company might not be real, so
    // insight text for it would be unfounded no matter how plausible it reads.
    // With a live-search provider this is a real second pass (deepResearch, grounded in
    // the verified report) - previously gated to High tier only; now it runs whenever
    // all three fields are checked, since the point is correctness, not depth. Without
    // live search there's no way to do a grounded second pass, so unqualified
    // candidates just lose their (still-hedged) insights - see gateInsightsOnVerification.
    const staged = fields.website && fields.annualReportUrls && fields.aiInsight;
    const deep = staged && liveSearch;
    const phase1Fields: Fields = deep ? { ...fields, aiInsight: false } : fields;
    // Rebuild per provider so the live-search framing matches what actually runs.
    const prompt = buildPrompt({
      courseName,
      industryName,
      country,
      size,
      query,
      count,
      existingNames,
      fields: phase1Fields,
      liveSearch,
    });
    try {
      const run = () =>
        p === "claude"
          ? runClaude(prompt, count)
          : p === "openrouter"
            ? runOpenRouter(prompt, count, orModel, tokenUsage)
            : runGroq(prompt, count, phase1Fields);

      let text = await run();
      let candidates = parseCandidates(text, phase1Fields);
      if (candidates.length === 0 && text) {
        // One strict retry: some models wrap the array in prose despite instructions.
        text = await run();
        candidates = parseCandidates(text, phase1Fields);
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
      // annual-report URL (and website) and drop the dead ones instead of shipping 404s.
      if (fields.annualReportUrls || fields.website) {
        candidates = await verifyLinks(candidates, fields);
      }

      // Deep research phase 2: read each VERIFIED company's report (or search the web
      // for its L&D disclosures) in its own small call - grounded, per-company insights.
      // Only for candidates that passed the website+report verification gate; the rest
      // get a clear "skipped" note instead of an ungrounded guess.
      if (deep) {
        candidates = await researchQualified(candidates, p, orModel, courseName);
      } else if (staged) {
        candidates = gateInsightsOnVerification(candidates);
      }

      const payload = {
        candidates,
        provider: p,
        model: p === "openrouter" ? orModel : undefined,
        deep,
      };
      if (excludeNames.length === 0 && candidates.length > 0) {
        await cacheSet(cacheKey, payload, 86400);
      }
      return Response.json(payload);
    } catch (err) {
      errors.push(`${p}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  return Response.json(
    { error: errors.join(" | ").replace(/RATE_LIMITED: /g, "") || "AI search failed", provider },
    { status: 502 },
  );
}

// Enrich known companies (usually website-only discoveries): one small call per company
// asking only for the requested fields. Pool of 3; a failed company comes back with its
// original data plus a note in source, never dropped.
async function enrichCompanies(
  targets: { companyName: string; website: string }[],
  p: Provider,
  orModel: string,
  tokenUsage: TokenUsage,
  fields: Fields,
  courseName: string,
  liveSearch: boolean,
): Promise<Candidate[]> {
  const wanted: string[] = [];
  const rules: string[] = [];
  if (fields.website) {
    wanted.push("website (string)");
    rules.push("- website: the official corporate site URL.");
  }
  if (fields.country) {
    wanted.push("country (string)");
    rules.push("- country: headquarters country name.");
  }
  if (fields.annualReportUrls) {
    wanted.push("annualReportUrls (string[])");
    rules.push(reportRule(liveSearch));
  }
  if (fields.aiInsight) {
    wanted.push("aiInsight (string[] of 4-5 items)", "source (string)");
    rules.push(insightRule(liveSearch), sourceRule(liveSearch));
  }

  const enrichOne = async (t: { companyName: string; website: string }): Promise<Candidate> => {
    const prompt = `You are a B2B sales-research assistant for Invensis Learning ("${courseName}" corporate training).

Research the company "${t.companyName}"${t.website ? ` (website: ${t.website})` : ""}.${liveSearch ? "" : " You do NOT have live web access - answer from general knowledge, conservatively."}

Find:
${rules.join("\n")}

Respond with ONLY a JSON object (no fences, no prose) with keys: ${wanted.join(", ")}.`;
    const base: Candidate = {
      companyName: t.companyName,
      country: "",
      website: t.website,
      annualReportUrls: [],
      aiInsight: [],
    };
    try {
      const text =
        p === "claude"
          ? await runClaude(prompt, 2)
          : p === "openrouter"
            ? await runOpenRouter(prompt, 2, orModel, tokenUsage)
            : await runGroq(prompt, 2, fields);
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end <= start) throw new Error("no JSON");
      const o = JSON.parse(text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1")) as Record<string, unknown>;
      return {
        ...base,
        country: fields.country ? String(o.country ?? "") : "",
        website: t.website || (fields.website ? String(o.website ?? "") : ""),
        annualReportUrls:
          fields.annualReportUrls && Array.isArray(o.annualReportUrls)
            ? (o.annualReportUrls as unknown[]).map(String).filter(Boolean)
            : [],
        aiInsight:
          fields.aiInsight && Array.isArray(o.aiInsight)
            ? (o.aiInsight as unknown[]).map(String).slice(0, 5)
            : [],
        source: fields.aiInsight && o.source ? String(o.source) : undefined,
      };
    } catch {
      return { ...base, source: "Enrichment failed for this company - retry or fill manually" };
    }
  };

  const out: Candidate[] = [];
  const POOL = 3;
  for (let i = 0; i < targets.length; i += POOL) {
    out.push(...(await Promise.all(targets.slice(i, i + POOL).map(enrichOne))));
  }
  return out;
}

// Deep research: one small live-search call per company, grounded in its verified
// report URL when available. Pool of 3 to stay inside the route deadline; failures
// degrade to an empty insight list rather than dropping the company.
async function deepResearch(
  candidates: Candidate[],
  p: Provider,
  orModel: string,
  courseName: string,
): Promise<Candidate[]> {
  const fy = lastCompletedFinancialYear();
  const researchOne = async (c: Candidate): Promise<Candidate> => {
    const grounding =
      c.reportVerified && c.annualReportUrls[0]
        ? `Read their annual report at ${c.annualReportUrls[0]} (verified live). Confirm it covers the last completed financial year (FY${fy} or their nearest equivalent); if it turns out to be an older year, say so in "source".`
        : `Search the web for their FY${fy} (last completed financial year) annual report, ESG/sustainability report, or L&D press coverage.`;
    const prompt = `Research the company "${c.companyName}"${c.website ? ` (${c.website})` : ""} as a corporate-training prospect for "${courseName}".

${grounding}

Extract 4-5 concise bullets on their training / learning & development / upskilling activity in that financial year. Cover, in this priority order:
  ${INSIGHT_TOPICS}

HARD RULES: every figure must appear verbatim in the document you actually read. If a number is not stated there, describe the fact qualitatively instead - NEVER invent, estimate, extrapolate, or infer a figure (especially training spend). If a topic above is not disclosed at all, SKIP that bullet rather than filling it with an assumption. Fewer, true bullets beat five padded ones.

Respond with ONLY a JSON object (no fences, no prose): {"aiInsight": string[4-5], "source": string}
"source" must name the document and its financial year, e.g. "FY${fy} Annual Report".`;
    try {
      const text =
        p === "claude" ? await runClaude(prompt, 2) : await runOpenRouter(prompt, 2, orModel, "medium");
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end <= start) throw new Error("no JSON");
      const obj = JSON.parse(text.slice(start, end + 1).replace(/,\s*([\]}])/g, "$1")) as {
        aiInsight?: unknown;
        source?: unknown;
      };
      return {
        ...c,
        aiInsight: Array.isArray(obj.aiInsight) ? obj.aiInsight.map(String).slice(0, 5) : [],
        source: obj.source ? String(obj.source) : c.source,
      };
    } catch {
      return { ...c, aiInsight: [], source: "Deep research failed for this company - retry or edit manually" };
    }
  };

  const out: Candidate[] = [...candidates];
  const POOL = 3;
  for (let i = 0; i < out.length; i += POOL) {
    const chunk = await Promise.all(out.slice(i, i + POOL).map(researchOne));
    for (let j = 0; j < chunk.length; j++) out[i + j] = chunk[j];
  }
  return out;
}

// The pure gate logic (which candidate qualifies for insights, and the skip notes) lives
// in lib/insightGate.ts so it can be unit tested - see tests/insightGate.test.ts.
// Runs deepResearch only on candidates with BOTH a verified website and a verified
// report - live search can actually confirm a report exists before spending a grounded
// research call on it, so hold it to the higher bar. The rest get a clear "skipped" note
// instead of an ungrounded guess. Preserves the original candidate order.
async function researchQualified(
  candidates: Candidate[],
  p: Provider,
  orModel: string,
  courseName: string,
): Promise<Candidate[]> {
  const { qualifies, toResearch } = partitionForGroundedInsights(candidates);
  const researched = await deepResearch(toResearch, p, orModel, courseName);
  return mergeResearched(candidates, qualifies, researched);
}

// Fetch each annual-report URL and website (HEAD, falling back to a ranged GET when HEAD
// is blocked) and remove URLs that are definitively dead (404/410, DNS failure, timeout).
// Ambiguous responses (403 bot-blocks, 405) are kept - better an occasional challenge
// page than a dropped real report. Capped concurrency; ~6s per URL.
// Blocks SSRF: a malicious "website"/annual-report URL (attacker-controlled via enrich
// mode, CSV import, or Add Company) must not make this server probe internal/cloud
// infrastructure (loopback, RFC1918, link-local incl. the 169.254.169.254 metadata IP,
// unique-local IPv6). Checks the literal hostname (if it's already an IP) and every
// address the hostname resolves to - a public hostname that resolves to a private IP
// (DNS rebinding) is rejected too.
function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 0) return true; // "this network"
    return false;
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true; // loopback
    if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true; // link-local
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // unique-local (fc00::/7)
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // not a parseable IP - treat as unsafe rather than risk a bypass
}

async function isSafeToFetch(url: string): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  if (isIP(hostname)) return !isPrivateIp(hostname);
  try {
    const addrs = await dnsLookup(hostname, { all: true });
    if (addrs.length === 0) return false;
    return addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false; // DNS failure - treat as unsafe, checkUrl's caller already handles dead links
  }
}

// Thrown when isSafeToFetch rejects a URL (DNS failure, resolves to a private/link-local/
// metadata IP, or malformed) - distinct from a generic fetch() failure so checkUrl never
// mistakes "we refused to even try this" for one of the ambiguous-but-real-site cases
// (bot-protection 403, redirect loop, timeout) it's supposed to give the benefit of the
// doubt to. Without this distinction, isSafeToFetch's rejection surfaced as a plain Error
// with no `.cause.code`, so isDnsFailure never matched it and it fell into the "ambiguous,
// keep" bucket - meaning a URL that doesn't resolve at all (or resolves to an SSRF target)
// was reported as VERIFIED, defeating both the dead-link check and the staged-insights
// gate that depends on it.
class UnsafeUrlError extends Error {}

async function verifyLinks(candidates: Candidate[], fields: Fields): Promise<Candidate[]> {
  const checkUrl = async (url: string): Promise<boolean> => {
    if (!/^https?:\/\//i.test(url)) return false;
    // redirect: "manual" + re-validating each hop closes an SSRF bypass where a public
    // URL 3xx-redirects the fetch into a private/metadata address after the initial check.
    const probe = async (method: "HEAD" | "GET") => {
      let current = url;
      for (let hop = 0; hop < 5; hop++) {
        if (!(await isSafeToFetch(current))) throw new UnsafeUrlError(current);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        let res: Response;
        try {
          res = await fetch(current, {
            method,
            redirect: "manual",
            signal: ctrl.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; InvensisMasterDB/1.0; link-check)",
              ...(method === "GET" ? { Range: "bytes=0-2047" } : {}),
            },
          });
        } finally {
          clearTimeout(timer);
        }
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          current = new URL(res.headers.get("location")!, current).toString();
          continue;
        }
        return res;
      }
      throw new Error("too many redirects");
    };
    // DNS resolution failure (ENOTFOUND) is the one network-level error that reliably
    // means "this domain does not exist" - a typo'd or fabricated hostname. Everything
    // else that throws (timeout, redirect loop, connection reset, TLS error,
    // bot-protection dropping the connection) is ambiguous and, per the policy above,
    // should be KEPT rather than treated as dead. UnsafeUrlError is neither of those - it
    // means we never even attempted the request, so it's always treated as dead below.
    const isDnsFailure = (err: unknown): boolean =>
      (err as { cause?: { code?: string } })?.cause?.code === "ENOTFOUND";

    try {
      let res = await probe("HEAD");
      if (res.status === 405 || res.status === 501) res = await probe("GET");
      if (res.status === 404 || res.status === 410) return false;
      return true;
    } catch (err1) {
      if (err1 instanceof UnsafeUrlError || isDnsFailure(err1)) return false;
      try {
        const res = await probe("GET");
        return res.status !== 404 && res.status !== 410;
      } catch (err2) {
        // Real example that surfaced this: ovhcloud.com redirects "/" -> "" -> "/" -> ...
        // forever (too-many-redirects) - a live site our probe couldn't resolve, not a
        // dead one. Only a confirmed DNS failure (or an UnsafeUrlError - meaning we never
        // even tried) counts as dead here.
        return !(err2 instanceof UnsafeUrlError) && !isDnsFailure(err2);
      }
    }
  };

  // Flatten all URLs, verify with bounded parallelism, then map results back. Website is
  // checked whenever one is present, regardless of fields.website - a caller asking to
  // verify reports/insights on an already-known company (fields.website: false) still
  // needs a real verification result for the staged-insights gate, even though it isn't
  // asking to have the website value itself re-researched or echoed back.
  const urls = new Set<string>();
  for (const c of candidates) {
    if (fields.annualReportUrls) for (const url of c.annualReportUrls.slice(0, 3)) urls.add(url);
    if (c.website) urls.add(c.website);
  }
  const jobs = [...urls];
  const results = new Map<string, boolean>();
  const POOL = 8;
  for (let i = 0; i < jobs.length; i += POOL) {
    await Promise.all(
      jobs.slice(i, i + POOL).map(async (url) => {
        results.set(url, await checkUrl(url));
      }),
    );
  }

  return candidates.map((c) => {
    let next = c;
    if (fields.annualReportUrls && c.annualReportUrls.length > 0) {
      const alive = c.annualReportUrls.filter((u) => results.get(u) === true);
      next = { ...next, annualReportUrls: alive, reportVerified: alive.length > 0 };
    }
    if (next.website) {
      const alive = results.get(next.website) === true;
      next = { ...next, websiteVerified: alive };
      // Dead corporate site: blank it rather than dropping the company - but only when
      // the caller actually asked for the website field back; otherwise leave the saved
      // value untouched (websiteVerified above still reflects the real check result).
      if (fields.website && !alive) next = { ...next, website: "" };
    }
    return next;
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
    rules.push(reportRule(p.liveSearch));
  }
  if (p.fields.aiInsight) {
    fieldSpecs.push("aiInsight (string[] of 4-5 items)");
    fieldSpecs.push("source (string)");
    rules.push(insightRule(p.liveSearch), sourceRule(p.liveSearch));
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
