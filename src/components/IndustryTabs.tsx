import Link from "next/link";
import { getIndustriesForCourse } from "@/lib/industries";
import { slugify } from "@/lib/slug";

export default function IndustryTabs({
  courseSlug,
  activeIndustrySlug,
}: {
  courseSlug: string;
  activeIndustrySlug?: string;
}) {
  const industries = getIndustriesForCourse(courseSlug);
  if (industries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {industries.map((ind) => {
        const iSlug = slugify(ind.name);
        const active = iSlug === activeIndustrySlug;
        return (
          <Link
            key={iSlug}
            href={`/${courseSlug}/${iSlug}`}
            title={ind.rationale}
            className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-[var(--primary)] bg-primary text-primary-contrast"
                : "bg-surface hover:border-[var(--primary)]"
            }`}
          >
            {ind.name}
          </Link>
        );
      })}
    </div>
  );
}
