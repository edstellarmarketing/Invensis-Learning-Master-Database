import Link from "next/link";
import {
  ArrowRight,
  Building,
  FolderKanban,
  GraduationCap,
  Target,
} from "lucide-react";
import { readCategories } from "@/lib/courses";
import { getCategoryMeta } from "@/lib/categoryMeta";
import IconByName from "@/components/IconByName";
import { readCompanies } from "@/lib/companies";
import { readAllIndustries } from "@/lib/industries";
import { slugify } from "@/lib/slug";
import DataTools from "@/components/DataTools";

// Stats reflect live JSON data, so render on demand.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [companies, industries, categories] = await Promise.all([
    readCompanies(),
    readAllIndustries(),
    readCategories(),
  ]);
  const allCourses = categories.flatMap((c) => c.courses);
  const courseName = (slug: string) => allCourses.find((c) => c.slug === slug)?.name ?? slug;

  const industryCount = Object.values(industries).reduce((n, list) => n + list.length, 0);

  // Coverage: course+industry combos that actually have companies.
  const coverage = new Map<string, { courseSlug: string; industrySlug: string; count: number }>();
  for (const c of companies) {
    const key = `${c.courseSlug}/${c.industrySlug}`;
    const entry = coverage.get(key) ?? {
      courseSlug: c.courseSlug,
      industrySlug: c.industrySlug,
      count: 0,
    };
    entry.count += 1;
    coverage.set(key, entry);
  }
  const coveredCombos = [...coverage.values()].sort((a, b) => b.count - a.count);

  const recent = [...companies]
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .slice(0, 5);

  const stats = [
    { label: "Courses", value: allCourses.length, icon: GraduationCap, color: "#4f46e5", darkColor: "#a5b4fc", soft: "#eef2ff", darkSoft: "#272a55" },
    { label: "Categories", value: categories.length, icon: FolderKanban, color: "#9333ea", darkColor: "#d8b4fe", soft: "#faf5ff", darkSoft: "#3b2154" },
    { label: "Target industries", value: industryCount, icon: Target, color: "#d97706", darkColor: "#fcd34d", soft: "#fffbeb", darkSoft: "#42300b" },
    { label: "Companies", value: companies.length, icon: Building, color: "#059669", darkColor: "#6ee7b7", soft: "#ecfdf5", darkSoft: "#0d3b2e" },
  ];

  const industryDisplayName = (courseSlug: string, industrySlug: string) =>
    (industries[courseSlug] ?? []).find((i) => slugify(i.name) === industrySlug)?.name ??
    industrySlug;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold">Invensis Learning Master Database</h1>
      <p className="mt-2 max-w-3xl text-text-muted">
        Target-account research across the full course portfolio. Pick a course from the sidebar,
        choose an industry, and work the prospect table: websites, annual reports, and AI insights
        on last financial year&rsquo;s training activity.
      </p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, darkColor, soft, darkSoft }) => (
          <div key={label} className="rounded-2xl border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-2.5">
              <span
                className="grid place-items-center rounded-xl p-2"
                style={{
                  background: `light-dark(${soft}, ${darkSoft})`,
                  color: `light-dark(${color}, ${darkColor})`,
                }}
              >
                <Icon size={18} />
              </span>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {label}
              </p>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Research coverage */}
        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold">Research coverage</p>
            <p className="text-xs text-text-muted">
              {coveredCombos.length} course × industry {coveredCombos.length === 1 ? "combo" : "combos"} populated
            </p>
          </div>
          {coveredCombos.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">
              No companies yet. Open a course and add prospects.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {coveredCombos.slice(0, 8).map((c) => (
                <li key={`${c.courseSlug}/${c.industrySlug}`}>
                  <Link
                    href={`/${c.courseSlug}/${c.industrySlug}`}
                    className="group flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-[var(--primary)]"
                  >
                    <span>
                      <span className="font-medium">
                        {courseName(c.courseSlug)}
                      </span>
                      <span className="text-text-muted">
                        {" "}
                        → {industryDisplayName(c.courseSlug, c.industrySlug)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-text-muted group-hover:text-primary">
                      <span className="tabular-nums">{c.count}</span>
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recently added */}
        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <p className="font-semibold">Recently added companies</p>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">Nothing yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/${c.courseSlug}/${c.industrySlug}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:border-[var(--primary)]"
                  >
                    <span className="font-medium">{c.companyName}</span>
                    <span className="text-xs text-text-muted">{c.country}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Export / import */}
      <div className="mt-4">
        <DataTools />
      </div>

      {/* Categories */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => {
          const meta = getCategoryMeta(cat.slug);
          // Categories can be empty (freshly created, or all courses removed) -
          // fall back to the dashboard itself rather than crashing on courses[0].
          const href = cat.courses[0] ? `/${cat.courses[0].slug}` : "/";
          return (
            <Link
              key={cat.slug}
              href={href}
              aria-disabled={cat.courses.length === 0}
              className={`group flex items-center gap-3 rounded-2xl border bg-surface p-4 shadow-sm transition-all duration-150 ${
                cat.courses.length === 0
                  ? "cursor-default opacity-60"
                  : "hover:border-[var(--primary)] hover:shadow-md"
              }`}
            >
              <span
                className="grid shrink-0 place-items-center rounded-xl p-2.5 transition-transform duration-150 group-hover:scale-110"
                style={{
                  background: `light-dark(${meta.soft}, ${meta.darkSoft})`,
                  color: `light-dark(${meta.color}, ${meta.darkColor})`,
                }}
              >
                <IconByName name={meta.icon} size={20} />
              </span>
              <span>
                <p className="font-semibold">{cat.name}</p>
                <p className="mt-0.5 text-sm text-text-muted">{cat.courses.length} courses</p>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
