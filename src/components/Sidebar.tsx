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
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r bg-surface">
      <div className="border-b px-4 py-4">
        <Link href="/" className="group flex items-center gap-2.5 font-semibold">
          <span className="grid place-items-center rounded-lg bg-primary-soft p-2 text-primary transition-transform duration-150 group-hover:scale-105">
            <Database size={17} />
          </span>
          <span className="leading-tight">
            Invensis Learning
            <span className="block text-xs font-normal text-text-muted">Master Database</span>
          </span>
        </Link>
        <div className="relative mt-3.5">
          <Search
            size={15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter courses..."
            className="w-full rounded-lg border bg-bg py-2 pl-8 pr-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-[var(--ring)]"
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
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span className="flex-1 text-left">{cat.name}</span>
                <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium">
                  {cat.courses.length}
                </span>
              </button>
              {!isCollapsed && (
                <ul className="mb-1.5 mt-0.5 space-y-px border-l pl-2 ml-3.5">
                  {cat.courses.map((course) => {
                    const active = course.slug === activeCourseSlug;
                    return (
                      <li key={course.slug}>
                        <Link
                          href={`/${course.slug}`}
                          aria-current={active ? "page" : undefined}
                          className={`block rounded-md px-3 py-1.5 transition-colors duration-150 ${
                            active
                              ? "bg-primary-soft font-medium text-primary"
                              : "text-text-muted hover:bg-surface-2 hover:text-text"
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
