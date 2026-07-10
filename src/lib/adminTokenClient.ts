"use client";

// Client-side helper for the two admin-gated routes (replace-import, bulk-delete - see
// src/lib/adminAuth.ts). Most deployments run with ADMIN_API_TOKEN unset, so this is a
// no-op there. When it IS set, the first 401 prompts for the token once per tab and
// remembers it in sessionStorage so the operator isn't asked again this session.
const STORAGE_KEY = "invensis-admin-token";

export async function fetchAdminGated(input: string, init: RequestInit): Promise<Response> {
  const cached = sessionStorage.getItem(STORAGE_KEY);
  const withToken = (token: string | null): RequestInit => ({
    ...init,
    headers: { ...init.headers, ...(token ? { "x-admin-token": token } : {}) },
  });

  let res = await fetch(input, withToken(cached));
  if (res.status !== 401) return res;

  const entered = window.prompt(
    "This is an admin-protected action. Enter the admin token to continue:",
  );
  if (!entered) return res;

  res = await fetch(input, withToken(entered));
  if (res.ok) sessionStorage.setItem(STORAGE_KEY, entered);
  return res;
}
