"use client";

import { useState, useMemo, Fragment, useRef } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Company } from "@/lib/companies";
import { csvToCompanies, sampleCsv } from "@/lib/csv";
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
  const [countryFilter, setCountryFilter] = useState("");
  const [reportFilter, setReportFilter] = useState<"" | "with" | "without">("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [rawPage, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const countries = useMemo(
    () => [...new Set(companies.map((c) => c.country).filter(Boolean))].sort(),
    [companies],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (q && !c.companyName.toLowerCase().includes(q) && !c.country.toLowerCase().includes(q))
        return false;
      if (countryFilter && c.country !== countryFilter) return false;
      if (reportFilter === "with" && c.annualReportUrls.length === 0) return false;
      if (reportFilter === "without" && c.annualReportUrls.length > 0) return false;
      return true;
    });
  }, [companies, query, countryFilter, reportFilter]);

  // Pagination over the filtered set. The stored page is clamped at render time so
  // shrinking the list (filters, deletes) snaps back without a state cascade.
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(rawPage, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const exportCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [
      ["Company Name", "Country", "Website", "Annual Report URLs", "AI Insights", "Source"],
      ...filtered.map((c) => [
        c.companyName,
        c.country,
        c.website,
        c.annualReportUrls.join(" | "),
        c.aiInsight.join(" | "),
        c.source ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${courseSlug}_${industrySlug}_companies.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSample = () => {
    const blob = new Blob(["﻿" + sampleCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-companies.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsvFile = async (file: File) => {
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        throw new Error(
          'Excel workbooks are not supported directly. In Excel use File > Save As > "CSV UTF-8", then import that file.',
        );
      }
      const { rows, skipped } = csvToCompanies(await file.text());
      if (rows.length === 0) throw new Error("No valid rows found (need a Company Name column).");
      const res = await fetch("/api/companies/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, industrySlug, companies: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Import failed (${res.status})`);
      setCompanies((prev) => [...prev, ...(data.companies as Company[])]);
      setNotice(
        `Imported ${data.added} ${data.added === 1 ? "company" : "companies"}` +
          (skipped > 0 ? ` (${skipped} row${skipped > 1 ? "s" : ""} skipped, no name)` : "") +
          ".",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const allPageSelected = pageRows.length > 0 && pageRows.every((c) => selected.has(c.id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageRows.forEach((c) => next.delete(c.id));
      else pageRows.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected ${ids.length === 1 ? "company" : "companies"}?`))
      return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/companies/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Delete failed (${res.status})`);
      const idSet = new Set(ids);
      setCompanies((prev) => prev.filter((c) => !idSet.has(c.id)));
      setSelected(new Set());
      setNotice(`Deleted ${data.removed} ${data.removed === 1 ? "company" : "companies"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

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
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          aria-label="Filter by country"
          className="rounded-lg border bg-surface px-2.5 py-2 text-sm text-text-muted outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={reportFilter}
          onChange={(e) => setReportFilter(e.target.value as "" | "with" | "without")}
          aria-label="Filter by annual report availability"
          className="rounded-lg border bg-surface px-2.5 py-2 text-sm text-text-muted outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          <option value="">All reports</option>
          <option value="with">Has annual report</option>
          <option value="without">Missing report</option>
        </select>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          aria-label="Export filtered rows as CSV"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-surface px-3.5 py-2 text-sm font-medium text-text-muted transition-colors hover:border-[var(--primary)] hover:text-primary disabled:opacity-50"
        >
          <Download size={15} /> CSV
        </button>
        <button
          onClick={() => csvInputRef.current?.click()}
          disabled={importing}
          aria-label="Bulk import companies from CSV"
          title='Import a CSV (Excel: save as "CSV UTF-8" first)'
          className="inline-flex items-center gap-1.5 rounded-lg border bg-surface px-3.5 py-2 text-sm font-medium text-text-muted transition-colors hover:border-[var(--primary)] hover:text-primary disabled:opacity-60"
        >
          {importing ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
          Import CSV
        </button>
        <button
          onClick={downloadSample}
          aria-label="Download sample CSV template"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-surface px-3 py-2 text-sm text-text-muted transition-colors hover:border-[var(--primary)] hover:text-primary"
        >
          <FileDown size={15} /> Sample
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importCsvFile(f);
          }}
        />
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
          className="btn-gradient inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.02]"
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

      {error && <p className="border-b px-4 py-2 text-sm text-danger">{error}</p>}
      {notice && <p className="border-b px-4 py-2 text-sm text-accent">{notice}</p>}

      {selected.size > 0 && (
        <div className="flex items-center justify-between border-b bg-primary-soft px-4 py-2">
          <p className="text-sm font-medium text-primary">
            {selected.size} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:text-text"
            >
              Clear
            </button>
            <button
              onClick={bulkDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--danger)] px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-bg"
            >
              <Trash2 size={14} /> Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-2/40 text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all visible companies"
                  checked={allPageSelected}
                  onChange={toggleSelectAll}
                  className="size-4 cursor-pointer accent-[var(--primary)]"
                />
              </th>
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
                <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                  {companies.length === 0 ? (
                    <>
                      No companies yet. Use <span className="font-medium text-text">AI Search</span>{" "}
                      or <span className="font-medium text-text">Add Company</span> to populate this
                      industry.
                    </>
                  ) : query.trim() ? (
                    <>No companies match &ldquo;{query}&rdquo;.</>
                  ) : (
                    <>No companies match the current filters.</>
                  )}
                </td>
              </tr>
            )}
            {pageRows.map((c) => {
              const open = expanded[c.id];
              return (
                <Fragment key={c.id}>
                  <tr
                    className={`border-b align-top transition-colors last:border-b-0 hover:bg-surface-2/40 ${
                      selected.has(c.id) ? "bg-primary-soft/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.companyName}`}
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="size-4 cursor-pointer accent-[var(--primary)]"
                      />
                    </td>
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
                        <span className="text-text-muted">-</span>
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
                          className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b bg-surface-2/50">
                      <td colSpan={6} className="px-4 py-4">
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

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-surface-2/40 px-4 py-2.5">
          <p className="text-xs text-text-muted">
            Showing{" "}
            <span className="font-semibold tabular-nums">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)}
            </span>{" "}
            of <span className="font-semibold tabular-nums">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
              className="rounded-md border bg-surface px-2 py-1 text-xs text-text-muted outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              aria-label="First page"
              className="rounded-md border bg-surface p-1.5 text-text-muted transition-colors hover:text-primary disabled:opacity-40"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="rounded-md border bg-surface p-1.5 text-text-muted transition-colors hover:text-primary disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-1 text-xs font-medium tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
              className="rounded-md border bg-surface p-1.5 text-text-muted transition-colors hover:text-primary disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              aria-label="Last page"
              className="rounded-md border bg-surface p-1.5 text-text-muted transition-colors hover:text-primary disabled:opacity-40"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
