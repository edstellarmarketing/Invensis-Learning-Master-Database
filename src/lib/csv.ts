// Minimal quote-aware CSV helpers (no dependency). Column layout matches the
// table's CSV export, so an exported file can be re-imported as-is.
// For Excel files: save as "CSV UTF-8" first.

export const CSV_HEADERS = [
  "Company Name",
  "Country",
  "Website",
  "Annual Report URLs",
  "AI Insights",
  "Source",
] as const;

export type CsvCompanyRow = {
  companyName: string;
  country: string;
  website: string;
  annualReportUrls: string[];
  aiInsight: string[];
  source?: string;
};

export function sampleCsv(): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [
    [...CSV_HEADERS],
    [
      "Acme Technologies",
      "United States",
      "https://www.acme.com",
      "https://www.acme.com/investors/annual-report-2025.pdf",
      "Ran 1.2M learning hours in FY25 | Upskilled 5,000 PMs on agile delivery | Launched internal PM academy | Partnered with external cert providers",
      "Acme FY25 annual report",
    ],
    [
      "Globex Corporation",
      "Germany",
      "https://www.globex.example",
      "https://www.globex.example/ir/ar-2025.pdf | https://www.globex.example/ir/sustainability-2025.pdf",
      "Invested EUR 40M in workforce training | Certified 800 engineers | Digital transformation upskilling program",
      "Globex annual + sustainability reports",
    ],
  ];
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

// Parse CSV text into rows of fields, handling quoted fields, escaped quotes and newlines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // Strip BOM
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// Map parsed CSV rows to company rows. Header row is matched case-insensitively;
// if absent, columns are assumed to be in CSV_HEADERS order.
export function csvToCompanies(text: string): { rows: CsvCompanyRow[]; skipped: number } {
  const parsed = parseCsv(text);
  if (parsed.length === 0) return { rows: [], skipped: 0 };

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const headerCandidates: Record<string, number> = {};
  parsed[0].forEach((h, i) => (headerCandidates[norm(h)] = i));

  const hasHeader =
    headerCandidates[norm("Company Name")] !== undefined ||
    headerCandidates[norm("companyName")] !== undefined;

  const col = (key: string, fallback: number) => {
    if (!hasHeader) return fallback;
    return headerCandidates[norm(key)] ?? fallback;
  };

  const iName = col("Company Name", 0);
  const iCountry = col("Country", 1);
  const iWebsite = col("Website", 2);
  const iReports = col("Annual Report URLs", 3);
  const iInsights = col("AI Insights", 4);
  const iSource = col("Source", 5);

  const dataRows = hasHeader ? parsed.slice(1) : parsed;
  const splitMulti = (s: string) =>
    s
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);

  const rows: CsvCompanyRow[] = [];
  let skipped = 0;
  for (const r of dataRows) {
    const companyName = (r[iName] ?? "").trim();
    if (!companyName) {
      skipped++;
      continue;
    }
    rows.push({
      companyName,
      country: (r[iCountry] ?? "").trim(),
      website: (r[iWebsite] ?? "").trim(),
      annualReportUrls: splitMulti(r[iReports] ?? ""),
      aiInsight: splitMulti(r[iInsights] ?? ""),
      source: (r[iSource] ?? "").trim() || undefined,
    });
  }
  return { rows, skipped };
}
