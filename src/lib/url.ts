// Only http(s) URLs are safe to store or render as a clickable link. Without this,
// an attacker-controlled `website`/`annualReportUrls` value (via Add Company, CSV
// bulk import, JSON import, or AI Search enrich) could be a `javascript:`/`data:` URI
// that executes when a user clicks the rendered link (stored XSS).
export function sanitizeHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:" ? trimmed : "";
  } catch {
    return "";
  }
}

// Defense-in-depth for rendering: even already-stored data (seeded before this guard
// existed, or written by a code path that missed it) never becomes a live href unless
// it passes the same check.
export function safeHref(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  return sanitizeHttpUrl(value) || undefined;
}
