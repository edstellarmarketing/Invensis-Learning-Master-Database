import Link from "next/link";
import {
  ArrowRight,
  Building,
  FolderKanban,
  GraduationCap,
  Target,
} from "lucide-react";
import { CATEGORIES, ALL_COURSES, findCourse } from "@/lib/courses";
import { readCompanies } from "@/lib/companies";
import { readAllIndustries } from "@/lib/industries";
import { slugify } from "@/lib/slug";
import DataTools from "@/components/DataTools";

// Stats reflect live JSON data, so render on demand.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [companies, industries] = await Promise.all([readCompanies(), readAllIndustries()]);

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
    { label: "Courses", value: ALL_COURSES.length, icon: GraduationCap },
    { label: "Categories", value: CATEGORIES.length, icon: FolderKanban },
    { label: "Target industries", value: industryCount, icon: Target },
    { label: "Companies", value: companies.length, icon: Building },
  ];

  const industryDisplayName = (courseSlug: string, industrySlug: string) =>
    (industries[courseSlug] ?? []).find((i) => slugify(i.name) === industrySlug)?.name ??
    industrySlug;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold">Invensis Learning — Master Database</h1>
      <p className="mt-2 max-w-3xl text-text-muted">
        Target-account research across the full course portfolio. Pick a course from the sidebar,
        choose an industry, and work the prospect table: websites, annual reports, and AI insights
        on last financial year&rsquo;s training activity.
      </p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-text-muted">
              <Icon size={16} />
              <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
            </div>
            <p className="mt-1.5 text-3xl font-bold tabular-nums">{value}</p>
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
                        {findCourse(c.courseSlug)?.name ?? c.courseSlug}
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
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={`/${cat.courses[0].slug}`}
            className="rounded-xl border bg-surface p-4 shadow-sm transition-all duration-150 hover:border-[var(--primary)] hover:shadow-md"
          >
            <p className="font-semibold">{cat.name}</p>
            <p className="mt-0.5 text-sm text-text-muted">{cat.courses.length} courses</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
