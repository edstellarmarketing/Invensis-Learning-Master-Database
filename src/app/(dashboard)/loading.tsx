import { Loader2 } from "lucide-react";

// Shown while force-dynamic pages (dashboard, industry pages) wait on their server
// data fetch (Redis/company/industry reads) - without this, a slow backend would
// otherwise render nothing but a blank white page until the fetch resolves.
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-text-muted">
      <Loader2 size={28} className="animate-spin text-primary" />
      <p className="text-sm">Loading...</p>
    </div>
  );
}
