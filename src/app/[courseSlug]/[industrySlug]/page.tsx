import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { findCourse, findCategoryForCourse } from "@/lib/courses";
import { getCategoryMeta } from "@/lib/categoryMeta";
import IconByName from "@/components/IconByName";
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
  const meta = getCategoryMeta(category?.slug);
  const catColor = `light-dark(${meta.color}, ${meta.darkColor})`;
  const catSoft = `light-dark(${meta.soft}, ${meta.darkSoft})`;

  return (
    <div>
      {/* Course header */}
      <div className="band-gradient-soft relative overflow-hidden rounded-2xl border p-6 shadow-sm">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-20"
          style={{ background: catColor }}
        />
        <div className="flex items-start gap-4">
          <span
            className="mt-0.5 grid shrink-0 place-items-center rounded-2xl p-3 shadow-sm"
            style={{ background: catSoft, color: catColor }}
          >
            <IconByName name={meta.icon} size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: catColor }}
            >
              {category?.name}
            </p>
            <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{course.name}</h1>
              <a
                href={courseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gradient inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.02]"
              >
                View course page <ExternalLink size={14} />
              </a>
            </div>
            {summary && (
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-text-muted">{summary}</p>
            )}
          </div>
        </div>
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
