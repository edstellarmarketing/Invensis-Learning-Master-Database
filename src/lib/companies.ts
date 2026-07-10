// Company records. Persistence: Upstash Redis when configured, local JSON file
// otherwise - see lib/storage.ts.
import { readDataset, writeDataset, mutateDataset, friendlyWriteError } from "./storage.ts";
import { sanitizeHttpUrl } from "./url.ts";

export { friendlyWriteError };

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

export async function readCompanies(): Promise<Company[]> {
  return readDataset<Company[]>("companies", []);
}

export async function writeCompanies(companies: Company[]): Promise<void> {
  await writeDataset("companies", companies);
}

// Atomic read-modify-write for the whole companies list - use this (not
// read+writeCompanies as two separate calls) for any mutation, so concurrent callers
// don't clobber each other. See mutateDataset in lib/storage.ts.
export async function mutateCompanies(
  fn: (all: Company[]) => Company[] | Promise<Company[]>,
): Promise<Company[]> {
  return mutateDataset<Company[]>("companies", [], fn);
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
  const company: Company = {
    id: input.id ?? `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    addedAt: input.addedAt ?? new Date().toISOString(),
    courseSlug: input.courseSlug,
    industrySlug: input.industrySlug,
    companyName: input.companyName,
    country: input.country,
    website: sanitizeHttpUrl(input.website),
    annualReportUrls: (input.annualReportUrls ?? []).map(sanitizeHttpUrl).filter(Boolean),
    aiInsight: input.aiInsight ?? [],
    source: input.source,
  };
  await mutateCompanies((all) => [...all, company]);
  return company;
}

export async function updateCompany(
  id: string,
  patch: Partial<Omit<Company, "id" | "addedAt">>,
): Promise<Company> {
  const sanitizedPatch: typeof patch = {
    ...patch,
    ...(patch.website !== undefined ? { website: sanitizeHttpUrl(patch.website) } : {}),
    ...(patch.annualReportUrls !== undefined
      ? { annualReportUrls: patch.annualReportUrls.map(sanitizeHttpUrl).filter(Boolean) }
      : {}),
  };
  let updated: Company | undefined;
  await mutateCompanies((all) => {
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Company not found");
    const next = [...all];
    next[idx] = { ...next[idx], ...sanitizedPatch, id: next[idx].id, addedAt: next[idx].addedAt };
    updated = next[idx];
    return next;
  });
  return updated!;
}

export async function deleteCompany(id: string): Promise<void> {
  await mutateCompanies((all) => {
    const next = all.filter((c) => c.id !== id);
    if (next.length === all.length) throw new Error("Company not found");
    return next;
  });
}
