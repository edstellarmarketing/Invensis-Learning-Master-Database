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
  // repeated searches keep discovering NEW prospects.
  let existingNames: string[] = [];
  try {
    const all = await readCompanies();
    existingNames = all
      .filter((c) => c.courseSlug === courseSlug && (!industrySlug || c.industrySlug === industrySlug))
      .map((c) => c.companyName);
  } catch {
    // Non-fatal: search still works without the exclusion list.
  }

  const prompt = buildPrompt({ courseName, industryName, country, size, query, count, existingNames });

  try {
    const text =
      provider === "claude" ? await runClaude(prompt, count) : await runGroq(prompt, count);
    let candidates = parseCandidates(text);

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
}): string {
  const exclusions =
    p.existingNames.length > 0
      ? `\nEXCLUDE these companies (already in our database): ${p.existingNames.slice(0, 200).join(", ")}.`
      : "";
  return `You are a B2B sales-research assistant for Invensis Learning, which sells "${p.courseName}" corporate training.

Find ${p.count} REAL companies in the "${p.industryName}" industry${
    p.country ? ` based in ${p.country}` : ""
  }${p.size ? `, company size: ${p.size}` : ""} that are strong prospects for this training${
    p.query ? `. Extra criteria: ${p.query}` : ""
  }.${exclusions}

Research rules:
- Prefer companies that publish annual reports (listed companies, large private firms) so training activity is verifiable.
- Mix well-known leaders with less obvious mid-tier prospects; do not pad with subsidiaries of the same group.
- website: the official corporate site URL (https, no tracking params).
- annualReportUrls: a real URL to the most recent annual report (PDF preferred, else the investor-relations annual-report page). Empty array if none exists.
- aiInsight: 4-5 concise bullets on the training / learning & development / upskilling activity in their most recent financial year. Base every bullet on real disclosures (annual report, ESG/sustainability report, press releases). If a figure is not verifiable, phrase qualitatively - NEVER invent numbers.
- country: the company's headquarters country name.
- source: where the insight came from (e.g. "FY2025 annual report", "2025 ESG report").

Respond with ONLY a JSON array (no markdown fences, no prose before or after) of ${p.count} objects with keys:
companyName (string), country (string), website (string), annualReportUrls (string[]), aiInsight (string[] of 4-5 items), source (string).`;
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
// Default model groq/compound has built-in web search for live verification.
async function runGroq(prompt: string, count: number): Promise<string> {
  const model = process.env.GROQ_MODEL || "groq/compound";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: Math.min(16000, 1500 + count * 400),
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

function parseCandidates(text: string): Candidate[] {
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
      country: String(c.country ?? ""),
      website: String(c.website ?? ""),
      annualReportUrls: Array.isArray(c.annualReportUrls)
        ? (c.annualReportUrls as unknown[]).map(String)
        : [],
      aiInsight: Array.isArray(c.aiInsight) ? (c.aiInsight as unknown[]).map(String) : [],
      source: c.source ? String(c.source) : undefined,
    }));
  } catch {
    return [];
  }
}
