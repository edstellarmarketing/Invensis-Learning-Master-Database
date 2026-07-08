import { notFound } from "next/navigation";
import { findCourse, findCategoryForCourse } from "@/lib/courses";
import { getIndustriesForCourse } from "@/lib/industries";
import { slugify } from "@/lib/slug";
import IndustryGrid from "@/components/IndustryGrid";
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

  const industry = getIndustriesForCourse(courseSlug).find(
    (i) => slugify(i.name) === industrySlug,
  );
  if (!industry) notFound();

  const companies = await listCompanies(courseSlug, industrySlug);

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-text-muted">{category?.name}</p>
      <h1 className="mt-1 text-2xl font-semibold">{course.name}</h1>
      <div className="mt-5">
        <IndustryGrid courseSlug={courseSlug} activeIndustrySlug={industrySlug} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">
          {industry.name} — prospect companies
        </h2>
        <p className="text-sm text-text-muted">
          Companies to target, with annual reports and AI insight on the training they ran last
          financial year.
        </p>
        <div className="mt-4">
          <CompaniesTable
            courseSlug={courseSlug}
            industrySlug={industrySlug}
            industryName={industry.name}
            initialCompanies={companies}
          />
        </div>
      </div>
    </div>
  );
}
