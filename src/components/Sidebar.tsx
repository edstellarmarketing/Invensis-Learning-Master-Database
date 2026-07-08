"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Search, Database } from "lucide-react";
import { CATEGORIES } from "@/lib/courses";

export default function Sidebar() {
  const pathname = usePathname();
  const activeCourseSlug = pathname?.split("/")[1] ?? "";
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map((cat) => ({
      ...cat,
      courses: q
        ? cat.courses.filter((c) => c.name.toLowerCase().includes(q))
        : cat.courses,
    })).filter((cat) => cat.courses.length > 0);
  }, [query]);

  const toggle = (slug: string) =>
    setCollapsed((prev) => ({ ...prev, [slug]: !prev[slug] }));

  return (
    <aside className="w-72 shrink-0 border-r bg-surface flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Database size={18} className="text-primary" />
          <span className="leading-tight">
            Invensis Learning
            <span className="block text-xs font-normal text-text-muted">Master Database</span>
          </span>
        </Link>
        <div className="mt-3 relative">
          <Search
            size={15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter courses..."
            className="w-full rounded-md border bg-bg pl-8 pr-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 text-sm">
        {filtered.map((cat) => {
          const isCollapsed = collapsed[cat.slug] && !query;
          return (
            <div key={cat.slug} className="mb-1">
              <button
                onClick={() => toggle(cat.slug)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-text-muted hover:bg-surface-2 font-medium uppercase tracking-wide text-[11px]"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="flex-1 text-left">{cat.name}</span>
                <span className="text-[10px] opacity-70">{cat.courses.length}</span>
              </button>
              {!isCollapsed && (
                <ul className="mt-0.5 mb-1">
                  {cat.courses.map((course) => {
                    const active = course.slug === activeCourseSlug;
                    return (
                      <li key={course.slug}>
                        <Link
                          href={`/${course.slug}`}
                          className={`block rounded-md px-3 py-1.5 ml-2 ${
                            active
                              ? "bg-primary text-primary-contrast"
                              : "hover:bg-surface-2 text-text"
                          }`}
                        >
                          {course.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-text-muted">No courses match &ldquo;{query}&rdquo;.</p>
        )}
      </nav>
    </aside>
  );
}
