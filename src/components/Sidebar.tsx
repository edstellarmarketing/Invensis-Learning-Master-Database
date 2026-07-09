"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Database, Menu, Search, Settings2, X } from "lucide-react";
import type { Category } from "@/lib/courses";
import { getCategoryMeta } from "@/lib/categoryMeta";
import IconByName from "./IconByName";
import CoursesManager from "./CoursesManager";

export default function Sidebar({ categories }: { categories: Category[] }) {
  const pathname = usePathname();
  const activeCourseSlug = pathname?.split("/")[1] ?? "";
  const [query, setQuery] = useState("");
  const [showAdditional, setShowAdditional] = useState(false);
  const [managing, setManaging] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Below md (768px) the sidebar is an off-canvas drawer, closed by default and
  // auto-closing on navigation, so it doesn't eat ~80% of a phone's width permanently.
  // Adjusted during render (React's recommended pattern for "reset state when a prop
  // changes") rather than in an effect, which would cost an extra commit.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  const q = query.trim().toLowerCase();

  // Featured view (default): only featured courses, in categories that have them.
  // Additional view / search: everything.
  const view = useMemo(() => {
    const pick = (predicate: (featured: boolean) => boolean) =>
      categories
        .map((cat) => ({
          ...cat,
          courses: cat.courses.filter(
            (c) => predicate(Boolean(c.featured)) && (!q || c.name.toLowerCase().includes(q)),
          ),
        }))
        .filter((cat) => cat.courses.length > 0);
    return {
      featured: pick((f) => f),
      additional: pick((f) => !f),
    };
  }, [categories, q]);

  const toggle = (slug: string) => setCollapsed((prev) => ({ ...prev, [slug]: !prev[slug] }));

  const renderCategory = (cat: Category, autoOpen: boolean) => {
    const isCollapsed = collapsed[cat.slug] ?? !(autoOpen || cat.courses.some((c) => c.slug === activeCourseSlug));
    const meta = getCategoryMeta(cat.slug);
    const catColor = `light-dark(${meta.color}, ${meta.darkColor})`;
    const catSoft = `light-dark(${meta.soft}, ${meta.darkSoft})`;
    return (
      <div key={cat.slug} className="mb-1.5">
        <button
          onClick={() => toggle(cat.slug)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <span className="grid place-items-center rounded-md p-1" style={{ background: catSoft, color: catColor }}>
            <IconByName name={meta.icon} size={13} />
          </span>
          <span className="flex-1 text-left">{cat.name}</span>
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: catSoft, color: catColor }}>
            {cat.courses.length}
          </span>
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        {!isCollapsed && (
          <ul className="mb-1.5 mt-0.5 ml-3.5 space-y-px border-l pl-2">
            {cat.courses.map((course) => {
              const active = course.slug === activeCourseSlug;
              return (
                <li key={course.slug}>
                  <Link
                    href={`/${course.slug}`}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-1.5 transition-colors duration-150 ${
                      active ? "font-semibold" : "text-text-muted hover:bg-surface-2 hover:text-text"
                    }`}
                    style={active ? { background: catSoft, color: catColor } : undefined}
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
  };

  const nothingMatches = q && view.featured.length === 0 && view.additional.length === 0;

  return (
    <>
      {/* Mobile-only hamburger trigger. Fixed so it's reachable regardless of scroll. */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open course navigation"
        aria-expanded={mobileOpen}
        className="fixed left-3 top-3 z-40 grid size-10 place-items-center rounded-lg border bg-surface text-text shadow-sm md:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Backdrop: only rendered (and only intercepts clicks) while the drawer is open. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 flex-col border-r bg-surface transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="border-b px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="group flex items-center gap-2.5 font-semibold">
            <span className="btn-gradient grid place-items-center rounded-xl p-2 shadow-sm transition-transform duration-150 group-hover:scale-105">
              <Database size={17} />
            </span>
            <span className="leading-tight">
              Invensis Learning
              <span className="block text-xs font-normal text-text-muted">Master Database</span>
            </span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close course navigation"
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 md:hidden"
          >
            <X size={18} />
          </button>
        </div>
        <div className="relative mt-3.5">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter courses..."
            className="w-full rounded-lg border bg-bg py-2 pl-8 pr-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 text-sm">
        {/* When searching, show all matches (featured + additional) flat. */}
        {q ? (
          <>
            {[...view.featured, ...view.additional].map((cat) => renderCategory(cat, true))}
            {nothingMatches && <p className="px-3 py-4 text-text-muted">No courses match &ldquo;{query}&rdquo;.</p>}
          </>
        ) : (
          <>
            {view.featured.map((cat) => renderCategory(cat, true))}
            {view.featured.length === 0 && (
              <p className="px-3 py-2 text-xs text-text-muted">No featured courses. Use Manage to feature some.</p>
            )}

            <button
              onClick={() => setShowAdditional((s) => !s)}
              className="mt-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-[var(--primary)] hover:text-primary"
            >
              {showAdditional ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {showAdditional ? "Hide additional courses" : `Additional courses (${view.additional.reduce((n, c) => n + c.courses.length, 0)})`}
            </button>

            {showAdditional && <div className="mt-2">{view.additional.map((cat) => renderCategory(cat, false))}</div>}
          </>
        )}
      </nav>

      <div className="border-t px-2 py-2">
        <button
          onClick={() => setManaging(true)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Settings2 size={15} /> Manage courses
        </button>
      </div>

      {managing && <CoursesManager categories={categories} onClose={() => setManaging(false)} />}
      </aside>
    </>
  );
}
