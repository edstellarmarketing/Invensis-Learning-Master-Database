"use client";

// Client-side helper for the two admin-gated routes (replace-import, bulk-delete - see
// src/lib/adminAuth.ts). Most deployments run with ADMIN_API_TOKEN unset, so this is a
// no-op there. When it IS set, the first 401 prompts for the token once per tab and
// remembers it in sessionStorage so the operator isn't asked again this session. The
// Settings page (AdminTokenSettings.tsx) lets an operator save it ahead of time instead
// of waiting for the first 401 prompt.
const STORAGE_KEY = "invensis-admin-token";

export function getStoredAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setStoredAdminToken(token: string): void {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearStoredAdminToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function fetchAdminGated(input: string, init: RequestInit): Promise<Response> {
  const cached = getStoredAdminToken();
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
  if (res.ok) setStoredAdminToken(entered);
  return res;
}
