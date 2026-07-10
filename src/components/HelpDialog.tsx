"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
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
      "Report links show a 'FY20XX' badge for the financial year the report was pulled from.",
      "Filter by text, country, or annual-report presence. Paginate with the controls below the table.",
      "Edit (pencil) or delete (trash) a row; select rows to bulk-delete.",
      "Export the filtered rows to CSV, or bulk-import companies from a CSV (download the sample first).",
    ],
  },
  {
    title: "AI Search",
    points: [
      "Discovers real companies for the industry with websites, annual reports, and training insights.",
      "Pick provider (Claude / OpenRouter / Groq / Auto). OpenRouter offers model families (Claude Sonnet, GLM 5.2, Gemini, GPT, DeepSeek, Free) and token tiers (Low / Medium / High). GLM 5.2 is the cheapest model that still does live-search-grounded research.",
      "Token tier: Low = cheapest, no live search; Medium = live web search; High = deep per-company research from verified reports.",
      "'Full research preset' checks every field and picks a live-search provider in one click - the full discover -> verify website -> verify report -> grounded insights pipeline.",
      "When Website + Annual Reports + AI Insights are all checked, insights are staged behind verification: a candidate only keeps them once its website (and, on a live-search provider, its report) checks out. Dead links are removed automatically.",
      "'Cross-check figures against a second source' (shown once AI Insights is checked) re-verifies every numeric claim against an independent source and drops anything that can't be corroborated - costs one extra call per company with a figure.",
      "Candidates already saved under a different course/industry are badged 'Already saved' with an 'Add anyway' option, and 'Add N new' skips them - so re-running a search elsewhere doesn't silently create duplicate rows.",
      "'Compare two providers' runs the same query on two providers side by side with a scorecard, useful for checking a cheaper model against an expensive one before trusting it at scale.",
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y(open, () => setOpen(false), dialogRef);

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

      {open && createPortal(
        <div
          style={{ overflowAnchor: "none" }}
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
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
        </div>,
        document.body
      )}
    </>
  );
}
