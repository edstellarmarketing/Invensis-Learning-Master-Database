import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { findCourse, findCategoryForCourse } from "@/lib/courses";
import { COURSE_SUMMARIES } from "@/lib/courseSummaries";
import { getIndustriesForCourse } from "@/lib/industries";
import { slugify } from "@/lib/slug";
import IndustryTabs from "@/components/IndustryTabs";
import CompaniesTable from "@/components/CompaniesTable";
import { listCompanies } from "@/lib/companies";

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ courseSlug: string; industrySlug: string }>;
}) {
  const { courseSlug, industrySlug } = await params;
  const course = findCourse(courseSlug);
  if (!course) notFound();
  const category = findCategoryForCourse(courseSlug);

  const industries = await getIndustriesForCourse(courseSlug);
  const industry = industries.find((i) => slugify(i.name) === industrySlug);
  if (!industry) notFound();

  const companies = await listCompanies(courseSlug, industrySlug);
  const summary = COURSE_SUMMARIES[courseSlug];
  const courseUrl = `https://www.invensislearning.com/${courseSlug}/`;

  return (
    <div>
      {/* Course header */}
      <div className="rounded-2xl border bg-gradient-to-br from-[var(--primary-soft)] via-[var(--surface)] to-[var(--surface)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {category?.name}
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
          <a
            href={courseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:border-[var(--primary)] hover:text-primary"
          >
            View course page <ExternalLink size={14} />
          </a>
        </div>
        {summary && <p className="mt-2 max-w-3xl text-sm text-text-muted">{summary}</p>}
      </div>

      {/* Industry tabs across the top, per reference layout */}
      <div className="mt-4">
        <IndustryTabs
          courseSlug={courseSlug}
          industries={industries}
          activeIndustrySlug={industrySlug}
        />
      </div>

      {/* Full-width companies table below */}
      <div className="mt-4">
        <CompaniesTable
          courseSlug={courseSlug}
          industrySlug={industrySlug}
          industryName={industry.name}
          initialCompanies={companies}
        />
      </div>
    </div>
  );
}
