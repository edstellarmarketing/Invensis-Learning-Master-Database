import { listCompanies, addCompany } from "@/lib/companies";
import { readJsonBody } from "@/lib/requestLimits";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseSlug = searchParams.get("courseSlug") ?? undefined;
  const industrySlug = searchParams.get("industrySlug") ?? undefined;
  const companies = await listCompanies(courseSlug, industrySlug);
  return Response.json(companies);
}

export async function POST(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const courseSlug = String(body.courseSlug ?? "");
  const industrySlug = String(body.industrySlug ?? "");
  const companyName = String(body.companyName ?? "").trim();

  if (!courseSlug || !industrySlug || !companyName) {
    return Response.json(
      { error: "courseSlug, industrySlug and companyName are required" },
      { status: 400 },
    );
  }

  try {
    const company = await addCompany({
      courseSlug,
      industrySlug,
      companyName,
      country: String(body.country ?? ""),
      website: String(body.website ?? ""),
      annualReportUrls: Array.isArray(body.annualReportUrls)
        ? (body.annualReportUrls as unknown[]).map(String)
        : [],
      aiInsight: Array.isArray(body.aiInsight)
        ? (body.aiInsight as unknown[]).map(String)
        : [],
      source: body.source ? String(body.source) : undefined,
    });
    return Response.json(company, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 },
    );
  }
}
