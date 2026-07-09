import Link from "next/link";
import { CompassIcon } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <CompassIcon size={26} />
      </span>
      <h1 className="mt-4 text-xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-text-muted">
        That course or industry doesn&apos;t exist, or it may have been renamed. Pick another
        course from the sidebar or head back to the dashboard.
      </p>
      <Link
        href="/"
        className="btn-solid mt-5 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
