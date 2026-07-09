"use client";

import { useState } from "react";
import { Loader2, Plus, PlusCircle } from "lucide-react";
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
  const [count, setCount] = useState(5);
  const [size, setSize] = useState("");
  const [provider, setProvider] = useState<"auto" | "claude" | "openrouter" | "groq">("auto");
  const [fields, setFields] = useState({
    website: true,
    country: true,
    annualReportUrls: true,
    aiInsight: true,
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Candidate[]>([]);
  const [usedProvider, setUsedProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingIdx, setAddingIdx] = useState<number | null>(null);
  const [addingAll, setAddingAll] = useState(false);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults([]);
    setUsedProvider(null);
    setLoading(true);
    try {
      const res = await fetch("/api/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          industrySlug,
          industryName,
          country,
          query,
          count,
          size,
          provider,
          fields,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Search failed (${res.status})`);
      setResults(data.candidates ?? []);
      setUsedProvider(data.provider ?? null);
      if ((data.candidates ?? []).length === 0) setError("No candidates returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const addAll = async () => {
    if (results.length === 0) return;
    setAddingAll(true);
    setError(null);
    try {
      const res = await fetch("/api/companies/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, industrySlug, companies: results }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      for (const saved of data.companies as Company[]) onAdded(saved);
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setAddingAll(false);
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
        <div className="w-36">
          <label className="block text-xs font-medium text-text-muted mb-1">Country</label>
          <input
            className={`${field} w-full`}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Any"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-text-muted mb-1">Companies</label>
          <select
            className={`${field} w-full`}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {[3, 5, 10, 15, 20, 25, 50, 75, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-xs font-medium text-text-muted mb-1">AI provider</label>
          <select
            className={`${field} w-full`}
            value={provider}
            onChange={(e) => setProvider(e.target.value as "auto" | "claude" | "openrouter" | "groq")}
          >
            <option value="auto">Auto</option>
            <option value="claude">Claude</option>
            <option value="openrouter">OpenRouter</option>
            <option value="groq">Groq</option>
          </select>
        </div>
        <div className="w-44">
          <label className="block text-xs font-medium text-text-muted mb-1">Company size</label>
          <select
            className={`${field} w-full`}
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            <option value="">Any size</option>
            <option value="Enterprise (5000+ employees)">Enterprise (5000+)</option>
            <option value="Large (1000-5000 employees)">Large (1000-5000)</option>
            <option value="Mid-market (200-1000 employees)">Mid-market (200-1000)</option>
            <option value="SMB (under 200 employees)">SMB (&lt;200)</option>
          </select>
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

      <fieldset className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-0 p-0">
        <legend className="mb-1 w-full text-xs font-medium text-text-muted sm:mb-0 sm:w-auto">
          Fields to fetch:
        </legend>
        {(
          [
            ["website", "Website"],
            ["country", "Country"],
            ["annualReportUrls", "Annual Reports"],
            ["aiInsight", "AI Insights"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={fields[key]}
              onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.checked }))}
              className="size-3.5 cursor-pointer accent-[var(--primary)]"
            />
            {label}
          </label>
        ))}
      </fieldset>

      <p className="mt-2 text-xs text-text-muted">
        Claude and OpenRouter use live web search with verified annual-report links. Groq answers
        from model knowledge (no browsing) and marks insights &quot;Likely:&quot; for you to
        verify. Auto tries Claude (<code>ANTHROPIC_API_KEY</code>), then OpenRouter
        (<code>OPENROUTER_API_KEY</code>), then Groq (<code>GROQ_API_KEY</code>). Already-saved
        companies are excluded automatically. Large counts (50+) can take a few minutes;
        Groq&apos;s free tier has a low rate limit, so retry after a minute if it says to wait.
      </p>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {results.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {results.length} candidate{results.length > 1 ? "s" : ""}
            {usedProvider
              ? ` · via ${
                  usedProvider === "claude" ? "Claude" : usedProvider === "openrouter" ? "OpenRouter" : "Groq"
                }`
              : ""}
          </p>
          <button
            onClick={addAll}
            disabled={addingAll}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-contrast disabled:opacity-60"
          >
            {addingAll ? <Loader2 size={13} className="animate-spin" /> : <PlusCircle size={13} />}
            Add all {results.length}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <ul className="mt-2 space-y-2">
          {results.map((cand, idx) => (
            <li key={idx} className="rounded-md border bg-bg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {cand.companyName}
                    {fields.country && cand.country && (
                      <span className="text-text-muted font-normal"> · {cand.country}</span>
                    )}
                  </p>
                  {fields.website && cand.website && (
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
              {fields.aiInsight && cand.aiInsight?.length > 0 && (
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
