"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { Company } from "@/lib/companies";

type Candidate = {
  companyName: string;
  country: string;
  website: string;
  annualReportUrls: string[];
  aiInsight: string[];
  source?: string;
};

export default function CompanySearch({
  courseSlug,
  industrySlug,
  industryName,
  onAdded,
}: {
  courseSlug: string;
  industrySlug: string;
  industryName: string;
  onAdded: (c: Company) => void;
}) {
  const [country, setCountry] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingIdx, setAddingIdx] = useState<number | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults([]);
    setLoading(true);
    try {
      const res = await fetch("/api/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, industryName, country, query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Search failed (${res.status})`);
      setResults(data.candidates ?? []);
      if ((data.candidates ?? []).length === 0) setError("No candidates returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const addCandidate = async (cand: Candidate, idx: number) => {
    setAddingIdx(idx);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, industrySlug, ...cand }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const saved = (await res.json()) as Company;
      onAdded(saved);
      setResults((prev) => prev.filter((_, i) => i !== idx));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setAddingIdx(null);
    }
  };

  const field = "rounded-md border bg-bg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

  return (
    <div>
      <form onSubmit={run} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-text-muted mb-1">
            Keywords (optional)
          </label>
          <input
            className={`${field} w-full`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`e.g. large ${industryName} firms hiring PMs`}
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-text-muted mb-1">Country</label>
          <input
            className={`${field} w-full`}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Any"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-contrast disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : null}
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      <p className="mt-2 text-xs text-text-muted">
        AI discovery finds real companies + annual reports and drafts training insights. Requires{" "}
        <code>ANTHROPIC_API_KEY</code>; review each result before adding.
      </p>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((cand, idx) => (
            <li key={idx} className="rounded-md border bg-bg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {cand.companyName}{" "}
                    <span className="text-text-muted font-normal">· {cand.country}</span>
                  </p>
                  {cand.website && (
                    <a
                      href={cand.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      {cand.website}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => addCandidate(cand, idx)}
                  disabled={addingIdx === idx}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-surface-2 disabled:opacity-60"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
              {cand.aiInsight?.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-text-muted">
                  {cand.aiInsight.slice(0, 5).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
