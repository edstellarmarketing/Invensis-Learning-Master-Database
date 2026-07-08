"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Company } from "@/lib/companies";
import AddCompanyForm from "./AddCompanyForm";
import CompanySearch from "./CompanySearch";

export default function CompaniesTable({
  courseSlug,
  industrySlug,
  industryName,
  initialCompanies,
}: {
  courseSlug: string;
  industrySlug: string;
  industryName: string;
  initialCompanies: Company[];
}) {
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q),
    );
  }, [companies, query]);

  const onAdded = (c: Company) => {
    setCompanies((prev) => [...prev, c]);
    setShowAdd(false);
    setShowSearch(false);
  };

  const onUpdated = (c: Company) => {
    setCompanies((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    setEditing(null);
  };

  const remove = async (c: Company) => {
    if (!window.confirm(`Delete "${c.companyName}" from this list?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/companies/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Delete failed (${res.status})`);
      }
      setCompanies((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-surface shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-surface-2/60 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies..."
            className="w-full rounded-lg border bg-surface pl-8 pr-2 py-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <button
          onClick={() => {
            setShowSearch((s) => !s);
            setShowAdd(false);
            setEditing(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-surface px-3.5 py-2 text-sm font-medium text-text-muted transition-colors hover:border-[var(--primary)] hover:text-primary"
        >
          <Sparkles size={15} /> AI Search
        </button>
        <button
          onClick={() => {
            setShowAdd((s) => !s);
            setShowSearch(false);
            setEditing(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-contrast shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus size={15} /> Add Company
        </button>
      </div>

      {showSearch && (
        <div className="border-b p-4">
          <CompanySearch
            courseSlug={courseSlug}
            industrySlug={industrySlug}
            industryName={industryName}
            onAdded={onAdded}
          />
        </div>
      )}
      {showAdd && !editing && (
        <div className="border-b p-4">
          <AddCompanyForm
            courseSlug={courseSlug}
            industrySlug={industrySlug}
            onAdded={onAdded}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}
      {editing && (
        <div className="border-b p-4">
          <p className="mb-3 text-sm font-semibold">Edit {editing.companyName}</p>
          <AddCompanyForm
            key={editing.id}
            courseSlug={courseSlug}
            industrySlug={industrySlug}
            initial={editing}
            onAdded={onUpdated}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {error && <p className="border-b px-4 py-2 text-sm text-red-500">{error}</p>}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-2/40 text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-semibold">Company Name</th>
              <th className="px-4 py-3 font-semibold">Country</th>
              <th className="px-4 py-3 font-semibold">Annual Report</th>
              <th className="px-4 py-3 font-semibold">Insights</th>
              <th className="w-20 px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text-muted">
                  {companies.length === 0 ? (
                    <>
                      No companies yet. Use <span className="font-medium text-text">AI Search</span>{" "}
                      or <span className="font-medium text-text">Add Company</span> to populate this
                      industry.
                    </>
                  ) : (
                    <>No companies match &ldquo;{query}&rdquo;.</>
                  )}
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const open = expanded[c.id];
              return (
                <Fragment key={c.id}>
                  <tr className="border-b align-top transition-colors last:border-b-0 hover:bg-surface-2/40">
                    <td className="px-4 py-3.5">
                      {c.website ? (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-semibold text-text transition-colors hover:text-primary"
                        >
                          {c.companyName}
                          <ExternalLink size={13} className="text-text-muted" />
                        </a>
                      ) : (
                        <span className="font-semibold">{c.companyName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-text-muted">{c.country}</td>
                    <td className="px-4 py-3.5">
                      {c.annualReportUrls.length === 0 ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {c.annualReportUrls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-accent transition-colors hover:underline"
                            >
                              <FileText size={13} /> Report{" "}
                              {c.annualReportUrls.length > 1 ? i + 1 : ""}
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))}
                        aria-expanded={open}
                        className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:underline"
                      >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {open ? "Hide" : `View (${c.aiInsight.length})`}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditing(c);
                            setShowAdd(false);
                            setShowSearch(false);
                          }}
                          aria-label={`Edit ${c.companyName}`}
                          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-primary"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => remove(c)}
                          aria-label={`Delete ${c.companyName}`}
                          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b bg-surface-2/50">
                      <td colSpan={5} className="px-4 py-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          Training conducted last financial year
                        </p>
                        <ul className="list-disc space-y-1.5 pl-5 text-text">
                          {c.aiInsight.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                        {c.source && (
                          <p className="mt-2.5 text-xs text-text-muted">Source: {c.source}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
