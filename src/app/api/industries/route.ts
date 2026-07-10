import {
  getIndustriesForCourse,
  addIndustry,
  updateIndustry,
  deleteIndustry,
} from "@/lib/industries";
import { findCourse } from "@/lib/courses";
import { readJsonBody } from "@/lib/requestLimits";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseSlug = searchParams.get("courseSlug");
  if (!courseSlug) {
    return Response.json({ error: "courseSlug is required" }, { status: 400 });
  }
  return Response.json(await getIndustriesForCourse(courseSlug));
}

export async function POST(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const courseSlug = String(body.courseSlug ?? "");
  const name = String(body.name ?? "").trim();
  if (!courseSlug || !name) {
    return Response.json({ error: "courseSlug and name are required" }, { status: 400 });
  }
  if (!(await findCourse(courseSlug))) {
    return Response.json({ error: "Unknown course" }, { status: 404 });
  }

  try {
    const industry = await addIndustry(courseSlug, {
      name,
      icon: String(body.icon ?? "Briefcase"),
      rationale: String(body.rationale ?? ""),
    });
    return Response.json(industry, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Add failed" },
      { status: 409 },
    );
  }
}

export async function PUT(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const courseSlug = String(body.courseSlug ?? "");
  const industrySlug = String(body.industrySlug ?? "");
  if (!courseSlug || !industrySlug) {
    return Response.json(
      { error: "courseSlug and industrySlug are required" },
      { status: 400 },
    );
  }

  const patch: Record<string, string> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.icon !== undefined) patch.icon = String(body.icon);
  if (body.rationale !== undefined) patch.rationale = String(body.rationale);

  try {
    const updated = await updateIndustry(courseSlug, industrySlug, patch);
    return Response.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return Response.json(
      { error: message },
      { status: message === "Industry not found" ? 404 : 409 },
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseSlug = searchParams.get("courseSlug") ?? "";
  const industrySlug = searchParams.get("industrySlug") ?? "";
  if (!courseSlug || !industrySlug) {
    return Response.json(
      { error: "courseSlug and industrySlug are required" },
      { status: 400 },
    );
  }
  try {
    await deleteIndustry(courseSlug, industrySlug);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 404 },
    );
  }
}

