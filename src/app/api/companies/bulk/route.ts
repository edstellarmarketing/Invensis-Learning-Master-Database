import { mutateCompanies, type Company } from "@/lib/companies";
import { isAdminAuthorized, adminAuthRequiredResponse } from "@/lib/adminAuth";
import { readJsonBody, tooManyRows } from "@/lib/requestLimits";
import { sanitizeHttpUrl } from "@/lib/url";

export const runtime = "nodejs";

// POST: add many companies at once (CSV/Excel import).
// Body: { courseSlug, industrySlug, companies: [{companyName, country?, website?,
//         annualReportUrls?, aiInsight?, source?}] }
export async function POST(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const courseSlug = String(body.courseSlug ?? "");
  const industrySlug = String(body.industrySlug ?? "");
  if (!courseSlug || !industrySlug || !Array.isArray(body.companies)) {
    return Response.json(
      { error: "courseSlug, industrySlug and companies[] are required" },
      { status: 400 },
    );
  }
  const tooMany = tooManyRows(body.companies.length);
  if (tooMany) return tooMany;

  const now = Date.now();
  const added: Company[] = [];
  for (const [i, raw] of (body.companies as unknown[]).entries()) {
    if (typeof raw !== "object" || raw === null) continue;
    const c = raw as Record<string, unknown>;
    const companyName = String(c.companyName ?? "").trim();
    if (!companyName) continue;
    added.push({
      id: `c_${now.toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      courseSlug,
      industrySlug,
      companyName,
      country: String(c.country ?? "").trim(),
      website: sanitizeHttpUrl(String(c.website ?? "")),
      annualReportUrls: Array.isArray(c.annualReportUrls)
        ? (c.annualReportUrls as unknown[]).map(String).map(sanitizeHttpUrl).filter(Boolean)
        : [],
      aiInsight: Array.isArray(c.aiInsight)
        ? (c.aiInsight as unknown[]).map(String).filter(Boolean)
        : [],
      source: c.source ? String(c.source) : undefined,
      addedAt: new Date().toISOString(),
    });
  }

  if (added.length === 0) {
    return Response.json(
      { error: "No valid rows (each row needs at least a companyName)" },
      { status: 400 },
    );
  }

  try {
    await mutateCompanies((all) => [...all, ...added]);
    return Response.json({ ok: true, added: added.length, companies: added }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Bulk add failed" },
      { status: 500 },
    );
  }
}

// DELETE: remove many companies by id. Body: { ids: string[] }
export async function DELETE(request: Request) {
  if (!isAdminAuthorized(request)) return adminAuthRequiredResponse();
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String) : [];
  if (ids.length === 0) {
    return Response.json({ error: "ids[] is required" }, { status: 400 });
  }
  const tooMany = tooManyRows(ids.length);
  if (tooMany) return tooMany;

  try {
    let removed = 0;
    await mutateCompanies((all) => {
      const idSet = new Set(ids);
      const remaining = all.filter((c) => !idSet.has(c.id));
      removed = all.length - remaining.length;
      return remaining;
    });
    if (removed === 0) {
      return Response.json({ error: "No matching companies" }, { status: 404 });
    }
    return Response.json({ ok: true, removed });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Bulk delete failed" },
      { status: 500 },
    );
  }
}
