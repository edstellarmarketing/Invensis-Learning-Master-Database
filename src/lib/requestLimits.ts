// Shared request-body guard for every API route. Without a cap, POST/PUT/DELETE bodies
// were parsed with no size limit and array fields (companies[], industries[], etc.) were
// processed with no length limit - a large payload could exhaust server memory/CPU or
// blow up the single-key Redis dataset it gets merged into.
export const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024; // 5MB - this dataset is small JSON.
export const MAX_BULK_ROWS = 5000;

export type JsonBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response };

export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: Response.json({ error: "Invalid request body" }, { status: 400 }) };
  }
  if (text.length > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: Response.json(
        { error: `Request body too large (max ${MAX_JSON_BODY_BYTES / (1024 * 1024)}MB)` },
        { status: 413 },
      ),
    };
  }
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) throw new Error("not an object");
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: Response.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
}

// Caps an incoming array field (companies[], industries{}, ids[], etc.) so one request
// can't force unbounded processing/storage. Returns an error Response when over the cap.
export function tooManyRows(count: number, max = MAX_BULK_ROWS): Response | null {
  if (count <= max) return null;
  return Response.json({ error: `Too many rows: ${count} (max ${max} per request)` }, { status: 413 });
}
