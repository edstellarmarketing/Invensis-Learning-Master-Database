import { updateCompany, deleteCompany } from "@/lib/companies";
import { readJsonBody } from "@/lib/requestLimits";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const patch: Record<string, unknown> = {};
  if (body.companyName !== undefined) patch.companyName = String(body.companyName).trim();
  if (body.country !== undefined) patch.country = String(body.country);
  if (body.website !== undefined) patch.website = String(body.website);
  if (body.source !== undefined) patch.source = String(body.source);
  if (Array.isArray(body.annualReportUrls))
    patch.annualReportUrls = (body.annualReportUrls as unknown[]).map(String);
  if (Array.isArray(body.aiInsight))
    patch.aiInsight = (body.aiInsight as unknown[]).map(String);

  try {
    const updated = await updateCompany(id, patch);
    return Response.json(updated);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 404 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteCompany(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 404 },
    );
  }
}
