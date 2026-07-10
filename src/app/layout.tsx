import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { readCategories } from "@/lib/courses";

// Catalog is runtime-editable, so the layout must render dynamically.
export const dynamic = "force-dynamic";

// Applies the saved theme before first paint to avoid a flash of the wrong theme.
const NO_FLASH = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Invensis Learning Master Database",
  description:
    "Target-account research dashboard: courses, top target industries, and prospect companies with annual-report training insights.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const categories = await readCategories();
  // Set by middleware.ts (production only) so this inline script - and Next's own
  // RSC-hydration scripts - pass the nonce-based CSP instead of getting blocked
  // outright. undefined in dev, where middleware skips the CSP entirely.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en">
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body>
        <div className="flex min-h-screen">
          <Sidebar categories={categories} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="min-w-0 flex-1 px-6 py-6 md:px-10 md:py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
