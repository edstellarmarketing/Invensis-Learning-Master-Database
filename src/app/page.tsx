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

      <div className="mt-6 rounded-lg border bg-surface p-4">
        <p className="text-sm font-medium text-text-muted">Start here</p>
        <Link
          href="/pmp-certification-training"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-contrast"
        >
          Open PMP Certification <ArrowRight size={15} />
        </Link>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((cat) => (
          <div key={cat.slug} className="rounded-lg border bg-surface p-4">
            <p className="font-medium">{cat.name}</p>
            <p className="text-sm text-text-muted">{cat.courses.length} courses</p>
          </div>
        ))}
      </div>
    </div>
  );
}
