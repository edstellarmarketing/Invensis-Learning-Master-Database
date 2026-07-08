import { notFound } from "next/navigation";
import { findCourse, findCategoryForCourse, ALL_COURSES } from "@/lib/courses";
import IndustryGrid from "@/components/IndustryGrid";

export function generateStaticParams() {
  return ALL_COURSES.map((c) => ({ courseSlug: c.slug }));
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const course = findCourse(courseSlug);
  if (!course) notFound();
  const category = findCategoryForCourse(courseSlug);

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-text-muted">{category?.name}</p>
      <h1 className="mt-1 text-2xl font-semibold">{course.name}</h1>
      <p className="mt-2 text-text-muted">
        Top target industries for this course. Select one to view prospect companies.
      </p>
      <div className="mt-6">
        <IndustryGrid courseSlug={courseSlug} />
      </div>
    </div>
  );
}
