// Cross-course / cross-industry duplicate detection for AI Search candidates.
//
// The search route already drops candidates that collide with saved companies in the
// SAME course+industry (that's what `existingNames` does). What it can't see is the same
// company already saved under a *different* industry or course - "Siemens AG" in
// Manufacturing when you're searching Construction. Those aren't errors (a company can
// legitimately be a prospect for several courses), but silently adding a second row means
// duplicate entries in CSV exports and the CRM. So: detect, annotate, let the user decide.
//
// Matching is deliberately conservative - a false "duplicate" badge on a genuinely new
// company is worse than a missed one, because it trains the user to ignore the badge.

export type DuplicateMatch = {
  companyName: string;
  courseSlug: string;
  industrySlug: string;
};

export type ExistingCompany = {
  companyName: string;
  courseSlug: string;
  industrySlug: string;
  website?: string;
};

/**
 * Normalize a company name for comparison: lowercase, strip punctuation, and drop the
 * common legal-form suffixes that the same company is inconsistently listed with
 * ("Siemens AG" / "Siemens" / "Siemens A.G."). Collapses whitespace last so a stripped
 * suffix doesn't leave a trailing space.
 */
const LEGAL_SUFFIXES = [
  "incorporated", "corporation", "limited", "holdings", "holding", "group",
  "company", "and co", "co", "inc", "corp", "ltd", "llc", "llp", "plc",
  "gmbh", "ag", "sa", "se", "nv", "bv", "ab", "as", "oy", "spa", "srl", "pty", "pvt",
];

export function normalizeCompanyName(name: string): string {
  let s = name
    .toLowerCase()
    .replace(/[.,''`"()]/g, "")
    .replace(/[-/&+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Strip trailing legal forms repeatedly ("Foo Group Ltd" -> "foo").
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL_SUFFIXES) {
      if (s.endsWith(` ${suffix}`)) {
        s = s.slice(0, -(suffix.length + 1)).trim();
        changed = true;
      }
    }
  }
  return s;
}

/**
 * Registrable-ish hostname for comparison: lowercase, strip "www.". Returns "" for
 * anything that isn't a parseable absolute URL, which never matches (see findDuplicate).
 */
export function normalizeWebsite(website?: string): string {
  if (!website) return "";
  try {
    return new URL(website).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Find an already-saved company matching this candidate, EXCLUDING the course+industry
 * being searched (the route's own dedupe owns that case and removes those outright).
 * Matches on normalized name, or on website hostname when both sides have one - a company
 * renamed between listings ("Facebook" / "Meta Platforms") still shares a domain.
 */
export function findDuplicate(
  candidate: { companyName: string; website?: string },
  existing: ExistingCompany[],
  scope: { courseSlug: string; industrySlug: string },
): DuplicateMatch | null {
  const name = normalizeCompanyName(candidate.companyName);
  const host = normalizeWebsite(candidate.website);
  if (!name) return null;

  for (const e of existing) {
    if (e.courseSlug === scope.courseSlug && e.industrySlug === scope.industrySlug) continue;
    const nameHit = name === normalizeCompanyName(e.companyName);
    const hostHit = host !== "" && host === normalizeWebsite(e.website);
    if (nameHit || hostHit) {
      return { companyName: e.companyName, courseSlug: e.courseSlug, industrySlug: e.industrySlug };
    }
  }
  return null;
}
