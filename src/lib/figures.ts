// Cross-source figure verification support.
//
// The grounded-research pass (deepResearch) already forbids inventing figures, but a
// single model reading a single document can still misread a table, attribute a
// group-level number to a subsidiary, or quote a prior-year comparative as current. A
// fabricated training-spend figure is the worst possible output here, because it gets
// quoted verbatim into a real sales conversation. So when the user opts in, every bullet
// carrying a numeric claim gets re-checked against an independent source before it ships.
//
// Only bullets with an actual figure are worth the extra call - qualitative bullets
// ("runs a corporate university") have nothing to cross-check.

// A "numeric claim" is a digit that carries quantitative meaning. Bare years (FY2024,
// "in 2024") are excluded: they're provenance, not a claim about the company, and every
// bullet tends to carry one - treating them as claims would send every bullet to the
// expensive verification pass and defeat the point of filtering.
const YEAR_ONLY = /^(?:fy)?(?:19|20)\d{2}$/i;

export function hasNumericClaim(bullet: string): boolean {
  // Percentages, currency, and multipliers are claims regardless of surrounding text.
  if (/[$£€₹¥]\s?\d|\d\s?%|\d+(?:\.\d+)?\s?(?:x|×)\b/i.test(bullet)) return true;

  // Otherwise look for a number token that isn't just a year.
  const tokens = bullet.match(/(?:fy)?\d[\d,.]*/gi) ?? [];
  return tokens.some((t) => !YEAR_ONLY.test(t.replace(/[,.]$/, "")));
}

export function splitNumericBullets(bullets: string[]): {
  numeric: string[];
  qualitative: string[];
} {
  const numeric: string[] = [];
  const qualitative: string[] = [];
  for (const b of bullets) (hasNumericClaim(b) ? numeric : qualitative).push(b);
  return { numeric, qualitative };
}

/**
 * Reassemble a bullet list after verification, preserving the ORIGINAL order of the
 * bullets that survived. `kept` is the subset of `numeric` the verifier confirmed;
 * anything in `numeric` but not in `kept` is dropped. Qualitative bullets always survive.
 *
 * Matching is by exact string, since the verifier is instructed to echo bullets verbatim.
 * A verifier that paraphrases loses those bullets - which fails closed (drops an
 * unconfirmed figure) rather than open, and that's the correct direction to fail here.
 */
export function reassembleVerified(
  original: string[],
  numeric: string[],
  kept: string[],
): string[] {
  const numericSet = new Set(numeric);
  const keptSet = new Set(kept);
  return original.filter((b) => !numericSet.has(b) || keptSet.has(b));
}
