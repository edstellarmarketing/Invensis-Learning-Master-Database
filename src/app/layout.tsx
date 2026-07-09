import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

// Applies the saved theme before first paint to avoid a flash of the wrong theme.
const NO_FLASH = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Invensis Learning Master Database",
  description:
    "Target-account research dashboard: courses, top target industries, and prospect companies with annual-report training insights.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="min-w-0 flex-1 px-6 py-6 md:px-10 md:py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
