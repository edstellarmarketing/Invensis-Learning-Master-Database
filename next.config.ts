import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Turbopack/webpack dev mode relies on eval() and blob:/worker chunk loading for HMR -
    // a strict CSP blocks these as browser-level violations (not catchable JS errors),
    // silently breaking all client interactivity with nothing in the console to point at
    // it. Skip the CSP in dev entirely; enforce it only for production, which is the
    // deployment this guards (see the security-audit note in agents.md).
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        headers: [
          // No inline-script or third-party script origins are used anywhere in the
          // app, so a strict script-src closes off the blast radius of any future
          // markup-injection bug (see lib/url.ts's sanitizeHttpUrl for the current one).
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
