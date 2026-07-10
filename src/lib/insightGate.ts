// Staged AI-Insights verification gate. Extracted from api/companies/search/route.ts so
// this branch logic (candidate qualifies vs. not; undefined vs. false vs. true) is unit
// testable - it's exactly the kind of thing that breaks silently, and it already has
// (see the AGENTS.md gotcha about isSafeToFetch's rejection being read as "verified").
//
// The route keeps the network/LLM work; everything here is pure.

// Shape this module needs. The route's own Candidate type is structurally compatible.
export type GateCandidate = {
  companyName: string;
  aiInsight: string[];
  source?: string;
  // Set by verifyLinks: true = at least one report URL fetched OK; false = URLs were dead
  // and removed; undefined = nothing to verify (no report URL was ever found).
  reportVerified?: boolean;
  // Set by verifyLinks whenever a website was present to check, independent of whether the
  // caller asked for the website field back (e.g. "Refresh reports & insights" sends
  // fields.website: false but still needs a real verification result for this gate).
  websiteVerified?: boolean;
};

export const INSIGHTS_SKIPPED_WEBSITE =
  "AI Insights skipped: website couldn't be verified.";
export const INSIGHTS_SKIPPED_WEBSITE_OR_REPORT =
  "AI Insights skipped: website/annual report couldn't be verified.";

// Exactly true, never just truthy. Our own HTTP check, not something the LLM has to get
// right - so it's the one bar every candidate can realistically pass, live-search or not.
export function hasVerifiedWebsite(c: GateCandidate): boolean {
  return c.websiteVerified === true;
}

// Exactly true - `undefined` means nothing to verify (no report URL found at all), which
// must fail this too. Only meaningful to require from a live-search provider: a
// non-live-search one is told to leave annualReportUrls empty rather than guess, so it
// would almost never find a verifiable report and this bar would fail nearly every real
// candidate - hence the two separate qualification levels below.
export function hasVerifiedReport(c: GateCandidate): boolean {
  return c.reportVerified === true;
}

// The strict bar, for live-search providers: they can actually confirm a report exists
// before we spend a grounded per-company research call reading it.
export function qualifiesForGroundedInsights(c: GateCandidate): boolean {
  return hasVerifiedWebsite(c) && hasVerifiedReport(c);
}

// Clears insights (with a reason) on any candidate that fails `qualifies`, leaving the
// rest untouched. Pure; preserves order and never mutates its input.
export function gateInsights<T extends GateCandidate>(
  candidates: T[],
  qualifies: (c: T) => boolean,
  skipNote: string,
): T[] {
  return candidates.map((c) => (qualifies(c) ? c : { ...c, aiInsight: [], source: skipNote }));
}

// Fallback gate for providers with no live web search: require only a verified WEBSITE,
// not a verified report. Deliberate - see hasVerifiedReport. The insights being gated here
// already came back in the same call as discovery (hedged either way for a non-live-search
// provider), so this just drops them for candidates we couldn't confirm are real.
export function gateInsightsOnVerification<T extends GateCandidate>(candidates: T[]): T[] {
  return gateInsights(candidates, hasVerifiedWebsite, INSIGHTS_SKIPPED_WEBSITE);
}

// Splits candidates into the ones worth spending a grounded research call on and the ones
// to skip, so the caller can research only the former and stitch the results back in order.
export function partitionForGroundedInsights<T extends GateCandidate>(
  candidates: T[],
): { qualifies: boolean[]; toResearch: T[] } {
  const qualifies = candidates.map((c) => qualifiesForGroundedInsights(c));
  return { qualifies, toResearch: candidates.filter((_, i) => qualifies[i]) };
}

// Stitches researched results back into their original positions, marking the rest skipped.
export function mergeResearched<T extends GateCandidate>(
  candidates: T[],
  qualifies: boolean[],
  researched: T[],
): T[] {
  let ri = 0;
  return candidates.map((c, i) =>
    qualifies[i]
      ? (researched[ri++] ?? { ...c, aiInsight: [], source: INSIGHTS_SKIPPED_WEBSITE_OR_REPORT })
      : { ...c, aiInsight: [], source: INSIGHTS_SKIPPED_WEBSITE_OR_REPORT },
  );
}
