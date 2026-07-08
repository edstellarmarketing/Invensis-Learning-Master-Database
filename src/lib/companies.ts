// Company records + file-backed persistence (Phase 1 uses a JSON file, not a DB).
import { promises as fs } from "fs";
import path from "path";

export type Company = {
  id: string;
  courseSlug: string;
  industrySlug: string;
  companyName: string;
  country: string;
  website: string;
  annualReportUrls: string[];
  aiInsight: string[];
  source?: string;
  addedAt: string; // ISO
};

const DATA_FILE = path.join(process.cwd(), "src", "data", "companies.json");

export async function readCompanies(): Promise<Company[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as Company[];
  } catch {
    return [];
  }
}

export async function writeCompanies(companies: Company[]): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(companies, null, 2) + "\n", "utf-8");
}

export async function listCompanies(
  courseSlug?: string,
  industrySlug?: string,
): Promise<Company[]> {
  const all = await readCompanies();
  return all.filter(
    (c) =>
      (!courseSlug || c.courseSlug === courseSlug) &&
      (!industrySlug || c.industrySlug === industrySlug),
  );
}

export async function addCompany(
  input: Omit<Company, "id" | "addedAt"> & { id?: string; addedAt?: string },
): Promise<Company> {
  const all = await readCompanies();
  const company: Company = {
    id: input.id ?? `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    addedAt: input.addedAt ?? new Date().toISOString(),
    courseSlug: input.courseSlug,
    industrySlug: input.industrySlug,
    companyName: input.companyName,
    country: input.country,
    website: input.website,
    annualReportUrls: input.annualReportUrls ?? [],
    aiInsight: input.aiInsight ?? [],
    source: input.source,
  };
  all.push(company);
  await writeCompanies(all);
  return company;
}
