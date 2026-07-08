import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORIES, ALL_COURSES } from "@/lib/courses";

export default function Home() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Invensis Learning — Master Database</h1>
      <p className="mt-2 text-text-muted">
        Target-account research for {ALL_COURSES.length} courses across {CATEGORIES.length}{" "}
        categories. Pick a course from the sidebar to see its top target industries, then drill
        into an industry to view prospect companies, their annual reports, and AI insights on the
        training they ran last financial year.
      </p>

      <div className="mt-6 rounded-xl border bg-surface p-5 shadow-sm">
        <p className="text-sm font-medium text-text-muted">Start here</p>
        <Link
          href="/pmp-certification-training"
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast shadow-sm transition-opacity hover:opacity-90"
        >
          Open PMP Certification <ArrowRight size={15} />
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
