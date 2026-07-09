"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: "Courses & sidebar",
    points: [
      "The sidebar lists featured courses by default. Click 'Additional courses' to reveal the full catalog.",
      "Use 'Manage courses' to add, rename, delete, or feature/unfeature courses and categories. Changes save live.",
      "Selecting a course opens its first industry with the companies table.",
    ],
  },
  {
    title: "Industries",
    points: [
      "Each course shows its target industries as tabs across the top.",
      "'Manage' next to the tabs lets you add, rename, or delete industries. Renaming migrates its companies; deleting removes them.",
      "Adding an industry offers popular industries as quick suggestions.",
    ],
  },
  {
    title: "Companies table",
    points: [
      "Columns: Company Name (links to site), Country, Annual Report, Insights (collapsible).",
      "Filter by text, country, or annual-report presence. Paginate with the controls below the table.",
      "Edit (pencil) or delete (trash) a row; select rows to bulk-delete.",
      "Export the filtered rows to CSV, or bulk-import companies from a CSV (download the sample first).",
    ],
  },
  {
    title: "AI Search",
    points: [
      "Discovers real companies for the industry with websites, annual reports, and training insights.",
      "Pick provider (Claude / OpenRouter / Groq / Auto). OpenRouter offers model families (Claude, Gemini, GPT, DeepSeek, Free) and token tiers (Low / Medium / High).",
      "Token tier: Low = cheapest, no live search; Medium = live web search; High = deep per-company research from verified reports.",
      "Choose which fields to fetch. Dead report/website links are verified and removed automatically.",
      "Search with only Website checked (fast), then select rows and 'Enrich selected' to fill the rest.",
      "Target multiple courses at once with the course checkboxes; large counts run in batches with progress.",
    ],
  },
  {
    title: "Backup & restore",
    points: [
      "Dashboard 'Data tools': export the whole database to JSON, or import a previous export (merge or replace).",
      "On Vercel, data lives in the database; use Export JSON for backups.",
    ],
  },
];

export default function HelpDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="How to use this tool"
        title="How to use this tool"
        className="inline-flex items-center gap-1.5 rounded-lg border bg-surface px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:border-[var(--primary)] hover:text-primary"
      >
        <HelpCircle size={16} /> Help
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-8 w-full max-w-2xl rounded-2xl border bg-surface shadow-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="How to use the Invensis Master Database"
          >
            <div className="band-gradient-soft flex items-center justify-between rounded-t-2xl border-b px-6 py-4">
              <h2 className="text-lg font-bold">How to use this tool</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
              {SECTIONS.map((s) => (
                <section key={s.title}>
                  <h3 className="mb-1.5 text-sm font-semibold text-primary">{s.title}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">
                    {s.points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
