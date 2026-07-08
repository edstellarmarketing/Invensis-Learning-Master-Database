import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

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
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 px-6 py-6 md:px-10 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
