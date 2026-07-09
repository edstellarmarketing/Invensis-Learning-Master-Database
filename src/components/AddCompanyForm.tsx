"use client";

import { useState } from "react";
import type { Company } from "@/lib/companies";
import { COUNTRIES } from "@/lib/countries";

export default function AddCompanyForm({
  courseSlug,
  industrySlug,
  onAdded,
  onCancel,
  initial,
}: {
  courseSlug: string;
  industrySlug: string;
  onAdded: (c: Company) => void;
  onCancel: () => void;
  initial?: Partial<Company>;
}) {
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [reports, setReports] = useState((initial?.annualReportUrls ?? []).join("\n"));
  const [insight, setInsight] = useState((initial?.aiInsight ?? []).join("\n"));
  const [source, setSource] = useState(initial?.source ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initial?.id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/companies/${initial!.id}` : "/api/companies", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          industrySlug,
          companyName: companyName.trim(),
          country: country.trim(),
          website: website.trim(),
          annualReportUrls: reports
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          aiInsight: insight
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          source: source.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const saved = (await res.json()) as Company;
      onAdded(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-md border bg-bg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";
  const label = "block text-xs font-medium text-text-muted mb-1";

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className={label}>Company name *</label>
        <input className={field} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
      </div>
      <div>
        <label className={label}>Country</label>
        <input
          className={field}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          list="country-options"
        />
        <datalist id="country-options">
          {COUNTRIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Website</label>
        <input className={field} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Annual report URLs (one per line)</label>
        <textarea className={field} rows={2} value={reports} onChange={(e) => setReports(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>AI insight bullets (one per line)</label>
        <textarea className={field} rows={4} value={insight} onChange={(e) => setInsight(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Source (optional)</label>
        <input className={field} value={source} onChange={(e) => setSource(e.target.value)} />
      </div>
      {error && <p className="sm:col-span-2 text-sm text-danger">{error}</p>}
      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="btn-solid rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : isEdit ? "Update company" : "Save company"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
