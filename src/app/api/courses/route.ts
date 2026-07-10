import { readCategories, addCourse, updateCourse, deleteCourse } from "@/lib/courses";
import { readJsonBody } from "@/lib/requestLimits";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await readCategories());
}

export async function POST(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const categorySlug = String(body.categorySlug ?? "");
  const name = String(body.name ?? "").trim();
  if (!categorySlug || !name) {
    return Response.json({ error: "categorySlug and name are required" }, { status: 400 });
  }
  try {
    const course = await addCourse(
      categorySlug,
      name,
      body.slug ? String(body.slug) : undefined,
      Boolean(body.featured),
    );
    return Response.json(course, { status: 201 });
  } catch (err) {
    return Response.json({ error: msg(err) }, { status: 409 });
  }
}

export async function PUT(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const slug = String(body.slug ?? "");
  if (!slug) return Response.json({ error: "slug is required" }, { status: 400 });
  const patch: { name?: string; featured?: boolean; categorySlug?: string } = {};
  if (body.name !== undefined) patch.name = String(body.name);
  if (body.featured !== undefined) patch.featured = Boolean(body.featured);
  if (body.categorySlug !== undefined) patch.categorySlug = String(body.categorySlug);
  try {
    return Response.json(await updateCourse(slug, patch));
  } catch (err) {
    return Response.json({ error: msg(err) }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slug) return Response.json({ error: "slug is required" }, { status: 400 });
  try {
    await deleteCourse(slug);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: msg(err) }, { status: 404 });
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}
