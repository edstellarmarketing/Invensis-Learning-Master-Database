import { mutateCompanies, type Company } from "@/lib/companies";
import { mutateIndustries, type Industry } from "@/lib/industries";
import { mutateCategories, type Category } from "@/lib/courses";
import { isAdminAuthorized, adminAuthRequiredResponse } from "@/lib/adminAuth";
import { readJsonBody, tooManyRows } from "@/lib/requestLimits";
import { sanitizeHttpUrl } from "@/lib/url";

export const runtime = "nodejs";

// Import a previously exported JSON file.
// mode "merge" (default): upsert companies by id, merge industry lists per course (dedupe by name).
// mode "replace": overwrite both stores with the imported data.
export async function POST(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  if (body.format !== "invensis-master-db") {
    return Response.json(
      { error: 'Unrecognized file: expected an export with format "invensis-master-db"' },
      { status: 400 },
    );
  }

  const mode = body.mode === "replace" ? "replace" : "merge";
  if (mode === "replace" && !isAdminAuthorized(request)) return adminAuthRequiredResponse();

  const industryRowCount =
    typeof body.industries === "object" && body.industries !== null && !Array.isArray(body.industries)
      ? Object.values(body.industries as Record<string, unknown>).reduce(
          (n: number, list) => n + (Array.isArray(list) ? list.length : 0),
          0,
        )
      : 0;
  const rowCap =
    tooManyRows(Array.isArray(body.companies) ? body.companies.length : 0) ??
    tooManyRows(Array.isArray(body.categories) ? body.categories.length : 0) ??
    tooManyRows(industryRowCount);
  if (rowCap) return rowCap;

  const inCompanies = sanitizeCompanies(body.companies);
  const inIndustries = sanitizeIndustries(body.industries);
  const inCategories = sanitizeCategories(body.categories);
  if (inCompanies === null && inIndustries === null && inCategories === null) {
    return Response.json(
      { error: "File contains no valid companies, industries, or categories" },
      { status: 400 },
    );
  }

  try {
    let companiesResult = 0;
    let industriesResult = 0;
    let categoriesResult = 0;

    // Categories: merge upserts by slug (course lists merged by slug); replace overwrites.
    if (inCategories !== null) {
      await mutateCategories((existing) => {
        if (mode === "replace") return inCategories;
        const bySlug = new Map(existing.map((c) => [c.slug, c]));
        for (const cat of inCategories) {
          const cur = bySlug.get(cat.slug);
          if (!cur) bySlug.set(cat.slug, cat);
          else {
            const seen = new Set(cur.courses.map((c) => c.slug));
            for (const co of cat.courses) if (!seen.has(co.slug)) cur.courses.push(co);
          }
        }
        return [...bySlug.values()];
      });
      categoriesResult = inCategories.length;
    }

    if (inCompanies !== null) {
      const result = await mutateCompanies((existing) => {
        if (mode === "replace") return inCompanies;
        const byId = new Map(existing.map((c) => [c.id, c]));
        for (const c of inCompanies) byId.set(c.id, c);
        return [...byId.values()];
      });
      companiesResult = result.length;
    }

    if (inIndustries !== null) {
      const result = await mutateIndustries((existing) => {
        if (mode === "replace") return inIndustries;
        const next = { ...existing };
        for (const [slug, list] of Object.entries(inIndustries)) {
          const current = next[slug] ?? [];
          const names = new Set(current.map((i) => i.name.toLowerCase()));
          const merged = [...current];
          for (const ind of list) {
            if (!names.has(ind.name.toLowerCase())) {
              merged.push(ind);
              names.add(ind.name.toLowerCase());
            }
          }
          next[slug] = merged;
        }
        return next;
      });
      industriesResult = Object.keys(result).length;
    }

    return Response.json({
      ok: true,
      mode,
      companies: companiesResult,
      courseIndustrySets: industriesResult,
      categories: categoriesResult,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 },
    );
  }
}

function sanitizeCompanies(input: unknown): Company[] | null {
  if (!Array.isArray(input)) return null;
  const out: Company[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) continue;
    const c = raw as Record<string, unknown>;
    if (!c.id || !c.companyName || !c.courseSlug || !c.industrySlug) continue;
    out.push({
      id: String(c.id),
      courseSlug: String(c.courseSlug),
      industrySlug: String(c.industrySlug),
      companyName: String(c.companyName),
      country: String(c.country ?? ""),
      website: sanitizeHttpUrl(String(c.website ?? "")),
      annualReportUrls: Array.isArray(c.annualReportUrls)
        ? (c.annualReportUrls as unknown[]).map(String).map(sanitizeHttpUrl).filter(Boolean)
        : [],
      aiInsight: Array.isArray(c.aiInsight) ? (c.aiInsight as unknown[]).map(String) : [],
      source: c.source ? String(c.source) : undefined,
      addedAt: String(c.addedAt ?? new Date().toISOString()),
    });
  }
  return out.length > 0 || input.length === 0 ? out : null;
}

function sanitizeCategories(input: unknown): Category[] | null {
  if (!Array.isArray(input)) return null;
  const out: Category[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) continue;
    const c = raw as Record<string, unknown>;
    if (!c.slug || !c.name || !Array.isArray(c.courses)) continue;
    const courses = (c.courses as unknown[])
      .map((cc) => {
        const o = (cc ?? {}) as Record<string, unknown>;
        if (!o.slug || !o.name) return null;
        return {
          name: String(o.name),
          slug: String(o.slug),
          ...(o.featured ? { featured: true } : {}),
        };
      })
      .filter(Boolean) as Category["courses"];
    out.push({ name: String(c.name), slug: String(c.slug), courses });
  }
  return out.length > 0 ? out : null;
}

function sanitizeIndustries(input: unknown): Record<string, Industry[]> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const out: Record<string, Industry[]> = {};
  for (const [slug, list] of Object.entries(input as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const clean: Industry[] = [];
    for (const raw of list) {
      if (typeof raw !== "object" || raw === null) continue;
      const i = raw as Record<string, unknown>;
      if (!i.name) continue;
      clean.push({
        name: String(i.name),
        icon: String(i.icon ?? "Briefcase"),
        rationale: String(i.rationale ?? ""),
      });
    }
    if (clean.length > 0) out[slug] = clean;
  }
  return Object.keys(out).length > 0 ? out : null;
}
