// Guards the most destructive routes (full-DB replace-import, bulk delete) with an
// optional shared-secret header. Unset ADMIN_API_TOKEN keeps the zero-config local-dev
// experience working, but any production deployment should set it - see .env.example.
export function isAdminAuthorized(request: Request): boolean {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return true;
  return request.headers.get("x-admin-token") === token;
}

export function adminAuthRequiredResponse(): Response {
  return Response.json(
    { error: "Unauthorized: this operation requires a valid x-admin-token header" },
    { status: 401 },
  );
}
