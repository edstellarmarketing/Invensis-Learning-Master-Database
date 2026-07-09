"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { useDialogA11y } from "@/lib/useDialogA11y";

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
  useDialogA11y(open, () => setOpen(false));

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
          style={{ overflowAnchor: "none" }}
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-8 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border bg-surface shadow-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="How to use the Invensis Master Database"
          >
            <div className="band-gradient-soft flex shrink-0 items-center justify-between rounded-t-2xl border-b px-6 py-4">
              <h2 className="text-lg font-bold">How to use this tool</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <X size={18} />
              </button>
            </div>
            {/* The card itself is height-capped (max-h-[85vh] above) and this is its
                only scroll region, so header+content can never together exceed the
                viewport with no way to reach the rest - the previous version capped
                only this inner div, leaving the card's total height (header + 70vh +
                margins) free to overflow the viewport on shorter screens. */}
            <div
              style={{ overflowAnchor: "none" }}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5"
            >
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
