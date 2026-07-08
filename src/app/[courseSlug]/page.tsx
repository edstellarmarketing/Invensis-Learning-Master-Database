import { notFound, redirect } from "next/navigation";
import { findCourse, ALL_COURSES } from "@/lib/courses";
import { getIndustriesForCourse } from "@/lib/industries";
import { slugify } from "@/lib/slug";

export function generateStaticParams() {
  return ALL_COURSES.map((c) => ({ courseSlug: c.slug }));
}

// Per the reference layout there is no standalone course page: selecting a course
// lands directly on its first industry tab (industry tabs + companies table).
export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const course = findCourse(courseSlug);
  if (!course) notFound();

  const industries = getIndustriesForCourse(courseSlug);
  if (industries.length === 0) notFound();

  redirect(`/${courseSlug}/${slugify(industries[0].name)}`);
}
