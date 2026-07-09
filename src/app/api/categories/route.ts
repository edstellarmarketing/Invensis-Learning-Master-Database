import { readCategories, addCategory, updateCategory, deleteCategory } from "@/lib/courses";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await readCategories());
}

export async function POST(request: Request) {
  const body = await safeJson(request);
  const name = String(body?.name ?? "").trim();
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });
  try {
    return Response.json(await addCategory(name), { status: 201 });
  } catch (err) {
    return Response.json({ error: msg(err) }, { status: 409 });
  }
}

export async function PUT(request: Request) {
  const body = await safeJson(request);
  const slug = String(body?.slug ?? "");
  const name = String(body?.name ?? "").trim();
  if (!slug || !name) return Response.json({ error: "slug and name are required" }, { status: 400 });
  try {
    return Response.json(await updateCategory(slug, name));
  } catch (err) {
    return Response.json({ error: msg(err) }, { status: 404 });
  }
}

export async function DELETE(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slug) return Response.json({ error: "slug is required" }, { status: 400 });
  try {
    await deleteCategory(slug);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: msg(err) }, { status: 404 });
  }
}

async function safeJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
function msg(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}
