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

export async function updateCompany(
  id: string,
  patch: Partial<Omit<Company, "id" | "addedAt">>,
): Promise<Company> {
  const all = await readCompanies();
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Company not found");
  all[idx] = { ...all[idx], ...patch, id: all[idx].id, addedAt: all[idx].addedAt };
  await writeCompanies(all);
  return all[idx];
}

export async function deleteCompany(id: string): Promise<void> {
  const all = await readCompanies();
  const next = all.filter((c) => c.id !== id);
  if (next.length === all.length) throw new Error("Company not found");
  await writeCompanies(next);
}
