import { notFound } from "next/navigation";
import { findCourse, findCategoryForCourse } from "@/lib/courses";
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

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-text-muted">{category?.name}</p>
      <h1 className="mt-1 text-2xl font-semibold">{course.name}</h1>

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
