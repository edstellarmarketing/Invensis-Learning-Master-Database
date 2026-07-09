import { notFound, redirect } from "next/navigation";
import { findCourse } from "@/lib/courses";
import { getIndustriesForCourse } from "@/lib/industries";
import { slugify } from "@/lib/slug";

// Rendered on demand (no generateStaticParams): industries are editable at runtime,
// so the first-industry redirect must always reflect current data.
export const dynamic = "force-dynamic";

// Per the reference layout there is no standalone course page: selecting a course
// lands directly on its first industry tab (industry tabs + companies table).
export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const course = await findCourse(courseSlug);
  if (!course) notFound();

  const industries = await getIndustriesForCourse(courseSlug);
  if (industries.length === 0) notFound();

  redirect(`/${courseSlug}/${slugify(industries[0].name)}`);
}
