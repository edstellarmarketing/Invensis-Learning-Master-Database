// Report year is not stored as a structured field - it's embedded in the free-text
// `source` string the AI returns (e.g. "Novartis Annual Report 2025 (PDF); ..."). This
// parses the first plausible financial-year year out of that string for display as a
// "FY20XX" badge next to report links, instead of asking users to read the full source line.
const FY_PATTERN = /FY\s?(20\d{2})/i;
const YEAR_RANGE_PATTERN = /(20\d{2})-\d{2}\b/;
const BARE_YEAR_PATTERN = /(20\d{2})\b/;

export function extractReportYear(source?: string | null): string | null {
  if (!source) return null;
  const fy = source.match(FY_PATTERN);
  if (fy) return `FY${fy[1]}`;
  const range = source.match(YEAR_RANGE_PATTERN);
  if (range) return `FY${range[1]}`;
  const bare = source.match(BARE_YEAR_PATTERN);
  if (bare) return `FY${bare[1]}`;
  return null;
}
