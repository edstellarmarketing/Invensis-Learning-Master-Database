// Shared slugify used for industry names in URLs and company records.
// "IT/Technology" -> "it-technology", "BFSI (Banking & Finance)" -> "bfsi-banking-finance"
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
