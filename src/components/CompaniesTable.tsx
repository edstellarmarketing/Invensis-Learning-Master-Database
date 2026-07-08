"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Sparkles,
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

  return (
    <div className="rounded-lg border bg-surface">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies..."
            className="w-full rounded-md border bg-bg pl-8 pr-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <button
          onClick={() => {
            setShowSearch((s) => !s);
            setShowAdd(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-surface-2"
        >
          <Sparkles size={15} /> AI Search
        </button>
        <button
          onClick={() => {
            setShowAdd((s) => !s);
            setShowSearch(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-contrast"
        >
          <Plus size={15} /> Add Company
        </button>
      </div>

      {showSearch && (
        <div className="border-b p-3">
          <CompanySearch
            courseSlug={courseSlug}
            industrySlug={industrySlug}
            industryName={industryName}
            onAdded={onAdded}
          />
        </div>
      )}
      {showAdd && (
        <div className="border-b p-3">
          <AddCompanyForm
            courseSlug={courseSlug}
            industrySlug={industrySlug}
            onAdded={onAdded}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted border-b">
              <th className="px-4 py-2.5 font-medium">Company Name</th>
              <th className="px-4 py-2.5 font-medium">Country</th>
              <th className="px-4 py-2.5 font-medium">Annual Report</th>
              <th className="px-4 py-2.5 font-medium">Insights</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  No companies yet. Use{" "}
                  <span className="font-medium">AI Search</span> or{" "}
                  <span className="font-medium">Add Company</span> to populate this industry.
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const open = expanded[c.id];
              return (
                <Fragment key={c.id}>
                  <tr className="border-b align-top last:border-b-0">
                    <td className="px-4 py-3">
                      {c.website ? (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium hover:text-primary hover:underline"
                        >
                          {c.companyName} <ExternalLink size={13} className="text-text-muted" />
                        </a>
                      ) : (
                        <span className="font-medium">{c.companyName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{c.country}</td>
                    <td className="px-4 py-3">
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
                              className="inline-flex items-center gap-1 text-accent hover:underline"
                            >
                              <FileText size={13} /> Report{" "}
                              {c.annualReportUrls.length > 1 ? i + 1 : ""}
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          setExpanded((p) => ({ ...p, [c.id]: !p[c.id] }))
                        }
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {open ? "Hide" : `View (${c.aiInsight.length})`}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b bg-surface-2/50">
                      <td colSpan={4} className="px-4 py-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                          Training conducted last financial year
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-text">
                          {c.aiInsight.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                        {c.source && (
                          <p className="mt-2 text-xs text-text-muted">Source: {c.source}</p>
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
