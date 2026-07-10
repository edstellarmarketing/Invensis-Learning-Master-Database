import { NextResponse, type NextRequest } from "next/server";

// Per-request nonce-based CSP, production only. A static `script-src 'self'` (the old
// next.config.ts approach) blocks ALL inline scripts unconditionally - including ones
// Next.js itself injects (RSC-hydration payload scripts, the streaming bootstrap) and
// this app's own theme-flash-prevention script in layout.tsx. That's not a config we
// control away; the supported fix is a nonce Next.js reads off this header and applies
// to its own inline scripts automatically, plus whatever we pass explicitly via the
// `nonce` prop (see layout.tsx's NO_FLASH script). This is a `proxy.ts` file (Next.js
// 16's replacement for `middleware.ts` - same mechanism, renamed convention).
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: [
    // Every route except static assets/images - matches the old next.config.ts scope.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
