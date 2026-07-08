import Anthropic from "@anthropic-ai/sdk";
import { findCourse } from "@/lib/courses";

export const runtime = "nodejs";
export const maxDuration = 60;

type Candidate = {
  companyName: string;
  country: string;
  website: string;
  annualReportUrls: string[];
  aiInsight: string[];
  source?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "AI search is disabled. Set ANTHROPIC_API_KEY in .env.local to enable live discovery, or use Add Company to enter records manually.",
      },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const courseSlug = String(body.courseSlug ?? "");
  const industryName = String(body.industryName ?? "");
  const country = String(body.country ?? "").trim();
  const query = String(body.query ?? "").trim();
  const size = String(body.size ?? "").trim(); // e.g. "Enterprise (1000+ employees)"
  const count = Math.min(20, Math.max(1, Number(body.count) || 5));
  const course = findCourse(courseSlug);
  const courseName = course?.name ?? courseSlug;

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const client = new Anthropic({ apiKey });

  const prompt = `You are a B2B sales-research assistant for Invensis Learning, which sells "${courseName}" corporate training.

Find ${count} REAL companies in the "${industryName}" industry${
    country ? ` based in ${country}` : ""
  }${size ? `, company size: ${size}` : ""} that are strong prospects for this training${
    query ? `. Extra criteria: ${query}` : ""
  }.

For each company use web search to verify:
- official corporate website URL
- a real URL to their most recent annual report (PDF preferred, else the investor-relations annual-report page)
- 4-5 concise bullet points on the training / learning & development / upskilling activity they reported in their most recent financial year (base on real disclosures; if a specific figure is not verifiable, phrase the bullet qualitatively, do NOT invent numbers)

Respond with ONLY a JSON array (no markdown fences, no prose) of objects with keys:
companyName (string), country (string), website (string), annualReportUrls (string[]), aiInsight (string[] of 4-5 items), source (string).`;

  try {
    const resp = await client.messages.create({
      model,
      // Scale output budget and search allowance with the requested company count.
      max_tokens: Math.min(8000, 1000 + count * 550),
      // Server-side web search tool. Cast: older SDK type defs don't list server tools,
      // but the API accepts the JSON passthrough.
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: Math.min(12, count + 3),
        } as unknown as Anthropic.Tool,
      ],
      messages: [{ role: "user", content: prompt }],
    });

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const candidates = parseCandidates(text);
    return Response.json({ candidates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI search failed";
    return Response.json({ error: message }, { status: 502 });
  }
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
