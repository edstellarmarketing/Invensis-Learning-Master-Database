"use client";

import { useEffect, useState } from "react";
import { Info, Loader2, Plus, PlusCircle, Sparkles } from "lucide-react";
import type { Company } from "@/lib/companies";
import { COUNTRIES } from "@/lib/countries";
import { safeHref } from "@/lib/url";
import { extractReportYear } from "@/lib/reportYear";

type Candidate = {
  companyName: string;
  country: string;
  website: string;
  annualReportUrls: string[];
  aiInsight: string[];
  source?: string;
  reportVerified?: boolean;
};

// Stable per-candidate key (company name), used instead of array index so that adding
// or removing one row can never mis-target a different row after the array reflows.
function keyOf(cand: Candidate): string {
  return cand.companyName.toLowerCase().trim();
}

type Fields = { website: boolean; country: boolean; annualReportUrls: boolean; aiInsight: boolean };
type Provider = "auto" | "claude" | "openrouter" | "groq";
type ModelFamily = "claude" | "glm" | "gemini" | "gpt" | "deepseek" | "free" | "other";
type TokenUsage = "low" | "medium" | "high";

// Which provider/tier actually earns each field, so the picks above the checkboxes are
// grounded in what the backend does (route.ts): free/no-live-search tiers answer from
// training data ("Likely:" hedged); annual-report URLs need live web search to find a
// real one; AI Insights are staged behind website/report verification when all three of
// Website + Annual Reports + AI Insights are checked (any tier, not just High - keep
// this in sync with the `staged`/`deep` logic in api/companies/search/route.ts).
function fieldModelAdvice(fields: Fields): string {
  if (fields.aiInsight) {
    if (fields.website && fields.annualReportUrls) {
      return "AI Insights are staged behind verification: a candidate only keeps insights once its website (and, with a live-search provider, its report) checks out. Claude or a live-search OpenRouter tier does real grounded research on verified reports; Groq/free tiers keep their hedged (\"Likely:\") guess only for companies with a real website.";
    }
    return "AI Insights needs a live-search provider (Claude, or OpenRouter Medium/High) for grounded research - free tiers only guess (\"Likely:\" hedge). Tip: also check Website + Annual Reports to stage insights behind real verification instead of a blind guess.";
  }
  if (fields.annualReportUrls) {
    return "Annual Reports needs live web search to find a real URL: pick Claude, or OpenRouter Medium/High. Free/Low tiers often can't locate one.";
  }
  return "Only Website/Country selected - any provider works, including Groq (Free) or OpenRouter Low. No live search needed for these fields.";
}

// Rough per-batch wall-clock estimate from the backend's actual call shape: a live-search
// LLM call (Claude, or OpenRouter with a ":online" model) runs noticeably slower than a
// no-search one; the staged deep-research pass (Website + Annual Reports + AI Insights
// all checked, with a live-search provider - see `staged`/`deep` in
// api/companies/search/route.ts, tier-independent) adds one extra grounded call PER
// company, 3 at a time; link verification (website/annualReportUrls) adds a bounded pass
// over up to 8 URLs at once. Batches of up to 15 run sequentially.
function estimateSeconds(
  fields: Fields,
  provider: Provider,
  model: ModelFamily,
  tokenUsage: TokenUsage,
  count: number,
): number {
  const BATCH_SIZE = 15;
  const batches = Math.ceil(Math.max(1, count) / BATCH_SIZE);
  const perBatchCount = Math.min(BATCH_SIZE, count);

  // Approximation: "auto" tries Claude/OpenRouter before Groq, so treat it as live-search
  // for estimation purposes even though it can fall back to Groq if neither is configured.
  const liveSearch =
    provider === "claude" ||
    provider === "auto" ||
    (provider === "openrouter" && (model !== "free" ? tokenUsage !== "low" : false));

  let perBatch = liveSearch ? 22 : 8; // base discovery call

  if (fields.website || fields.annualReportUrls) {
    perBatch += Math.ceil(perBatchCount / 8) * 4; // link verification pass
  }

  const staged = fields.website && fields.annualReportUrls && fields.aiInsight;
  const deep = staged && liveSearch;
  if (deep) {
    perBatch += Math.ceil(perBatchCount / 3) * 12; // one grounded call per company, pool of 3
  }

  return perBatch * batches;
}

function formatSeconds(s: number): string {
  if (s < 60) return `~${s}s`;
  const m = Math.round(s / 60);
  return `~${m} min`;
}

function CostBadge({ free }: { free: boolean }) {
  return (
    <span
      className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        free
          ? "bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-success"
          : "bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] text-warning"
      }`}
    >
      {free ? "Free" : "Paid"}
    </span>
  );
}

export default function CompanySearch({
  courseSlug,
  industrySlug,
  industryName,
  onAdded,
  onResultsChange,
}: {
  courseSlug: string;
  industrySlug: string;
  industryName: string;
  onAdded: (c: Company) => void;
  // Lets the parent warn before discarding un-added AI results (e.g. switching to
  // Edit/Add Company would otherwise unmount this panel and silently drop them).
  onResultsChange?: (count: number) => void;
}) {
  const [country, setCountry] = useState("");
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(5);
  const [size, setSize] = useState("");
  // Default to a free provider/model/tier so opening AI Search and hitting "Search"
  // without touching anything never silently costs money. Paid options (Claude, OpenRouter
  // Medium/High) stay fully available - just not pre-selected.
  const [provider, setProvider] = useState<"auto" | "claude" | "openrouter" | "groq">("groq");
  const [model, setModel] = useState<
    "claude" | "glm" | "gemini" | "gpt" | "deepseek" | "free" | "other"
  >("free");
  const [customModel, setCustomModel] = useState("");
  const [tokenUsage, setTokenUsage] = useState<"low" | "medium" | "high">("low");
  const [fields, setFields] = useState({
    website: true,
    country: true,
    annualReportUrls: true,
    aiInsight: true,
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [results, setResults] = useState<Candidate[]>([]);
  const [usedProvider, setUsedProvider] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);
  const [wasCached, setWasCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  // Multi-course targeting: all courses as checkboxes, current one pre-selected.
  const [allCourses, setAllCourses] = useState<{ name: string; slug: string }[]>([]);
  const [targetCourses, setTargetCourses] = useState<Set<string>>(new Set([courseSlug]));
  const [showCourses, setShowCourses] = useState(false);
  // null = still checking. Lets the UI steer users to a configured provider instead of
  // letting them pick one, wait for a full round-trip, and get a dead-end "not configured"
  // error - the old failure mode.
  const [providerStatus, setProviderStatus] = useState<{
    claude: boolean;
    openrouter: boolean;
    groq: boolean;
  } | null>(null);

  useEffect(() => {
    onResultsChange?.(results.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/courses")
      .then((r) => r.json())
      .then((cats) => {
        if (cancelled || !Array.isArray(cats)) return;
        setAllCourses(cats.flatMap((c: { courses: { name: string; slug: string }[] }) => c.courses));
      })
      .catch(() => {});
    fetch("/api/ai-providers")
      .then((r) => r.json())
      .then((status) => {
        if (cancelled) return;
        setProviderStatus(status);
        // Steer the default off Groq only if Groq genuinely isn't configured - keeps the
        // "opens free by default" guarantee when it IS available.
        if (!status.groq) {
          if (status.claude) setProvider("claude");
          else if (status.openrouter) setProvider("openrouter");
        }
      })
      .catch(() => {
        if (!cancelled) setProviderStatus({ claude: false, openrouter: false, groq: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const noProviderConfigured =
    providerStatus !== null && !providerStatus.claude && !providerStatus.openrouter && !providerStatus.groq;

  // Large counts run as sequential batches: each batch excludes everything found so
  // far, results append live, and one failed batch keeps earlier batches' results.
  const BATCH_SIZE = 15;

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !isFree &&
      count >= 25 &&
      !window.confirm(
        `This runs a paid search for ${count} companies (~${Math.ceil(count / BATCH_SIZE)} API call${count > BATCH_SIZE ? "s" : ""}). Continue?`,
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    setResults([]);
    setUsedProvider(null);
    setUsedModel(null);
    setWasCached(false);
    setProgress(null);
    setSelected(new Set());
    setLoading(true);

    const totalBatches = Math.ceil(count / BATCH_SIZE);
    const found: Candidate[] = [];
    try {
      for (let b = 0; b < totalBatches; b++) {
        const batchCount = Math.min(BATCH_SIZE, count - b * BATCH_SIZE);
        if (totalBatches > 1) {
          setProgress({
            label: `Batch ${b + 1} of ${totalBatches} · ${found.length} found so far...`,
            pct: Math.round((b / totalBatches) * 100),
          });
        }
        const res = await fetch("/api/companies/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseSlug,
            industrySlug,
            industryName,
            country,
            query,
            count: batchCount,
            size,
            provider,
            fields,
            model,
            customModel,
            tokenUsage,
            courseSlugs: [...targetCourses],
            excludeNames: found.map((c) => c.companyName),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Search failed (${res.status})`);
        found.push(...((data.candidates ?? []) as Candidate[]));
        setResults([...found]);
        setUsedProvider(data.provider ?? null);
        setUsedModel(data.model ?? null);
        if (data.cached) setWasCached(true);
      }
      if (found.length === 0) setError("No candidates returned.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed";
      setError(found.length > 0 ? `Stopped after ${found.length} companies: ${msg}` : msg);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  // Enrich selected rows: re-research just those companies for the currently-checked
  // fields. Typical flow: search with only Website checked (cheap), then tick the other
  // field boxes, select rows, and enrich.
  const enrichSelected = async () => {
    const targets = results
      .filter((c) => selected.has(keyOf(c)))
      .map((c) => ({ companyName: c.companyName, website: c.website }));
    if (targets.length === 0) return;
    setEnriching(true);
    setError(null);
    try {
      const res = await fetch("/api/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          industrySlug,
          industryName,
          provider,
          fields,
          model,
          customModel,
          tokenUsage,
          enrich: targets,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Enrichment failed (${res.status})`);
      const byName = new Map(
        ((data.candidates ?? []) as Candidate[]).map((c) => [c.companyName.toLowerCase().trim(), c]),
      );
      setResults((prev) =>
        prev.map((c) => byName.get(c.companyName.toLowerCase().trim()) ?? c),
      );
      setUsedProvider(data.provider ?? null);
      setUsedModel(data.model ?? null);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  };

  // Save under every selected target course (same industry slug). The current course's
  // saved copies update the visible table; others just persist.
  const saveTo = [...targetCourses].length > 0 ? [...targetCourses] : [courseSlug];

  const addAll = async () => {
    if (results.length === 0) return;
    setAddingAll(true);
    setError(null);
    const succeeded: string[] = [];
    try {
      for (const cs of saveTo) {
        const res = await fetch("/api/companies/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseSlug: cs, industrySlug, companies: results }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
        succeeded.push(cs);
        if (cs === courseSlug) for (const saved of data.companies as Company[]) onAdded(saved);
      }
      setResults([]);
      if (saveTo.length > 1) setNotice(`Added to ${saveTo.length} courses.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      // Partial failure: some courses already got the companies. Don't clear results
      // (so nothing is lost) but warn clearly so a retry doesn't duplicate the ones
      // that already succeeded.
      setError(
        succeeded.length > 0
          ? `Saved to ${succeeded.length} of ${saveTo.length} course(s) (${succeeded.join(", ")}), then failed: ${msg}. Uncheck those courses in Target courses before retrying to avoid duplicates.`
          : msg,
      );
    } finally {
      setAddingAll(false);
    }
  };

  const addCandidate = async (cand: Candidate) => {
    const key = keyOf(cand);
    setAddingKey(key);
    const succeeded: string[] = [];
    try {
      for (const cs of saveTo) {
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseSlug: cs, industrySlug, ...cand }),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        const saved = (await res.json()) as Company;
        succeeded.push(cs);
        if (cs === courseSlug) onAdded(saved);
      }
      setResults((prev) => prev.filter((c) => keyOf(c) !== key));
      setSelected((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      // Partial failure: some courses already got this company. Keep it in the results
      // (nothing lost) but warn clearly so a retry doesn't duplicate the ones that
      // already succeeded - mirrors addAll's partial-failure handling below.
      setError(
        succeeded.length > 0
          ? `Saved "${cand.companyName}" to ${succeeded.length} of ${saveTo.length} course(s) (${succeeded.join(", ")}), then failed: ${msg}. Uncheck those courses in Target courses before retrying to avoid duplicates.`
          : msg,
      );
    } finally {
      setAddingKey(null);
    }
  };

  const field = "rounded-md border bg-bg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]";

  // Free path: Groq, or OpenRouter with the free open-model family. Everything else bills.
  // (Auto prefers paid Claude/OpenRouter first, so it is not free.)
  const isFree = provider === "groq" || (provider === "openrouter" && model === "free");

  const providerLabel = (name: "claude" | "openrouter" | "groq", label: string) => {
    if (providerStatus === null) return label;
    return providerStatus[name] ? label : `${label} - not configured`;
  };

  return (
    <div className="space-y-3">
      {noProviderConfigured && (
        <p className="rounded-lg border border-dashed border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2 text-xs text-text">
          No AI provider is configured (no <code>ANTHROPIC_API_KEY</code>,{" "}
          <code>OPENROUTER_API_KEY</code>, or <code>GROQ_API_KEY</code>) - AI Search can&apos;t
          run. Add one of those keys, or use Add Company / bulk CSV import instead.
        </p>
      )}

      <div className="rounded-lg border bg-bg/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Search criteria
        </p>
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
              list="ai-country-options"
            />
            <datalist id="ai-country-options">
              {COUNTRIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
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
            disabled={loading || noProviderConfigured}
            className="btn-solid inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
        <p aria-live="polite" className="mt-1.5 text-xs text-text-muted">
          Estimated time: {formatSeconds(estimateSeconds(fields, provider, model, tokenUsage, count))}
          {count > 15 ? ` (${Math.ceil(count / 15)} batches)` : ""}
        </p>
      </div>

      <div className="rounded-lg border bg-bg/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          AI provider &amp; cost
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48">
            <label className="flex items-center text-xs font-medium text-text-muted mb-1">
              Provider <CostBadge free={isFree} />
            </label>
            <select
              className={`${field} w-full`}
              value={provider}
              onChange={(e) => setProvider(e.target.value as "auto" | "claude" | "openrouter" | "groq")}
            >
              <option value="auto">Auto</option>
              <option value="claude" disabled={providerStatus?.claude === false}>
                {providerLabel("claude", "Claude (Paid)")}
              </option>
              <option value="openrouter" disabled={providerStatus?.openrouter === false}>
                {providerLabel("openrouter", "OpenRouter")}
              </option>
              <option value="groq" disabled={providerStatus?.groq === false}>
                {providerLabel("groq", "Groq (Free)")}
              </option>
            </select>
          </div>

      {(provider === "openrouter" || provider === "auto") && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed bg-bg/60 p-2.5">
          <div className="w-52">
            <label className="flex items-center text-xs font-medium text-text-muted mb-1">
              OpenRouter model <CostBadge free={model === "free"} />
            </label>
            <select
              className={`${field} w-full`}
              value={model}
              onChange={(e) => setModel(e.target.value as typeof model)}
            >
              <option value="claude">Claude Sonnet (Paid)</option>
              <option value="glm">GLM 5.2 (Paid, cheaper than Claude)</option>
              <option value="gemini">Gemini Flash (Paid)</option>
              <option value="gpt">ChatGPT / GPT-4o (Paid)</option>
              <option value="deepseek">DeepSeek (Paid)</option>
              <option value="free">Free open models (Llama/Qwen)</option>
              <option value="other">Other model slug...</option>
            </select>
          </div>
          {model === "other" && (
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-text-muted mb-1">
                Model slug (openrouter.ai/models)
              </label>
              <input
                className={`${field} w-full`}
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="e.g. meta-llama/llama-3.1-405b-instruct"
              />
            </div>
          )}
          <div className="w-40">
            <label className="block text-xs font-medium text-text-muted mb-1">
              Token usage
            </label>
            <select
              className={`${field} w-full`}
              value={tokenUsage}
              onChange={(e) => setTokenUsage(e.target.value as typeof tokenUsage)}
            >
              <option value="low">Low (fast, cheapest)</option>
              <option value="medium">Medium (live search)</option>
              <option value="high">High (deepest)</option>
            </select>
          </div>
          <p className="w-full text-xs text-text-muted">
            {model === "free"
              ? "Free open models answer from model knowledge (no live web search) at $0 cost; results are marked \"Likely:\" for you to verify. Higher tiers just use a larger free model."
              : tokenUsage === "low"
                ? "Low uses a lighter model with no live web search - fastest and cheapest, insights are estimates."
                : tokenUsage === "medium"
                  ? "Medium enables OpenRouter's live web-search plugin for verified results at a moderate cost."
                  : "High runs deep research: the family's strongest model lists companies, then reads each company's verified annual report in its own pass - most thorough, most expensive."}
          </p>
        </div>
      )}
        </div>
      </div>

      <div className="rounded-lg border bg-bg/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Fields &amp; target courses
        </p>
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-0 p-0">
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
        {/* Announced: this text changes as the user toggles field checkboxes, and it's
            the primary guidance for which provider/tier to pick. */}
        <p aria-live="polite" className="mt-1.5 text-xs text-text-muted">
          {fieldModelAdvice(fields)}
        </p>

        {allCourses.length > 1 && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setShowCourses((s) => !s)}
              aria-expanded={showCourses}
              aria-controls="target-courses-panel"
              className="text-xs font-medium text-primary hover:underline"
            >
              {showCourses ? "Hide target courses" : `Target courses (${targetCourses.size} selected)`}
            </button>
            {showCourses && (
              <div
                id="target-courses-panel"
                role="region"
                ref={(el) => {
                  if (el) el.scrollTop = 0;
                }}
                className="mt-1.5 max-h-40 overflow-y-auto rounded-md border bg-bg p-2"
              >
                <p className="mb-1.5 text-xs text-text-muted">
                  Discovered companies are saved as prospects under every checked course (same
                  industry).
                </p>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                {allCourses.map((c) => (
                  <label key={c.slug} className="inline-flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={targetCourses.has(c.slug)}
                      onChange={() =>
                        setTargetCourses((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.slug)) next.delete(c.slug);
                          else next.add(c.slug);
                          return next;
                        })
                      }
                      className="size-3.5 accent-[var(--primary)]"
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      <details className="text-xs text-text-muted">
        <summary className="cursor-pointer select-none font-medium text-primary hover:underline">
          How provider/model selection works
        </summary>
        <p className="mt-1.5">
          With OpenRouter, pick the underlying model and how much token budget (search depth) to
          spend per search. Claude uses Anthropic directly with live web search. Groq answers from
          model knowledge (no browsing) and marks insights &quot;Likely:&quot; for you to verify.
          Auto tries Claude (<code>ANTHROPIC_API_KEY</code>), then OpenRouter
          (<code>OPENROUTER_API_KEY</code>), then Groq (<code>GROQ_API_KEY</code>). Already-saved
          companies are excluded automatically. Large counts (50+) can take a few minutes;
          Groq&apos;s free tier has a low rate limit, so retry after a minute if it says to wait.
        </p>
      </details>

      {progress && (
        <div className="mt-2">
          <p className="mb-1 inline-flex items-center gap-1.5 text-sm text-primary">
            <Loader2 size={14} className="animate-spin" /> {progress.label}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" aria-live="assertive" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" aria-live="polite" className="mt-2 text-sm text-accent">
          {notice}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-muted">
            {results.length} candidate{results.length > 1 ? "s" : ""}
            {usedProvider
              ? ` · via ${
                  usedProvider === "claude" ? "Claude" : usedProvider === "openrouter" ? "OpenRouter" : "Groq"
                }${usedModel ? ` (${usedModel})` : ""}`
              : ""}
            {wasCached ? " · from cache (no tokens spent)" : ""}
          </p>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={enrichSelected}
                disabled={enriching}
                title="Re-research the selected companies for the currently checked fields"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary)] px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft disabled:opacity-60"
              >
                {enriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {enriching ? "Enriching..." : `Enrich selected (${selected.size})`}
              </button>
            )}
            <button
              onClick={addAll}
              disabled={addingAll || enriching}
              className="btn-solid inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
            >
              {addingAll ? <Loader2 size={13} className="animate-spin" /> : <PlusCircle size={13} />}
              Add all {results.length}
            </button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <ul className="mt-2 space-y-2">
          {results.map((cand) => {
            const key = keyOf(cand);
            return (
            <li key={key} className="rounded-md border bg-bg p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${cand.companyName} for enrichment`}
                    checked={selected.has(key)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                    className="mt-1 size-3.5 shrink-0 cursor-pointer accent-[var(--primary)]"
                  />
                  <div className="min-w-0">
                  <p className="font-medium">
                    {cand.companyName}
                    {fields.country && cand.country && (
                      <span className="text-text-muted font-normal"> · {cand.country}</span>
                    )}
                    {fields.annualReportUrls && cand.reportVerified === true && (
                      <span className="ml-1.5 rounded bg-[color-mix(in_srgb,var(--success)_18%,transparent)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                        Report link verified
                      </span>
                    )}
                    {fields.annualReportUrls && cand.reportVerified === false && (
                      <span className="ml-1.5 rounded bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                        Report link removed (dead)
                      </span>
                    )}
                    {fields.annualReportUrls && extractReportYear(cand.source) && (
                      <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
                        {extractReportYear(cand.source)}
                      </span>
                    )}
                  </p>
                  {fields.website && safeHref(cand.website) && (
                    <a
                      href={safeHref(cand.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      {cand.website}
                    </a>
                  )}
                  </div>
                </div>
                <button
                  onClick={() => addCandidate(cand)}
                  disabled={addingKey === key}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-surface-2 disabled:opacity-60"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
              {fields.aiInsight && cand.aiInsight?.length > 0 && (
                <>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-text-muted">
                    {cand.aiInsight.slice(0, 5).map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                  {cand.source && (
                    <p className="mt-1.5 pl-5 text-[11px] italic text-text-muted">
                      Source: {cand.source}
                    </p>
                  )}
                </>
              )}
              {/* Insights were requested but the staged verification gate cleared them.
                  Without this the card just looks like the AI silently returned nothing,
                  which is indistinguishable from a provider failure. */}
              {fields.aiInsight && cand.aiInsight?.length === 0 && cand.source && (
                <p className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2 py-1.5 text-[11px] text-text-muted">
                  <Info size={12} className="mt-px shrink-0 text-warning" />
                  <span>{cand.source}</span>
                </p>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
