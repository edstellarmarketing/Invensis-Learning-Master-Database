// Industries per course + file-backed persistence (same Phase-1 JSON-store pattern
// as lib/companies.ts). Shape: Record<courseSlug, Industry[]>.
import { promises as fs } from "fs";
import path from "path";
import { slugify } from "./slug";
import { readCompanies, writeCompanies } from "./companies";

export type Industry = { name: string; icon: string; rationale: string };

const DATA_FILE = path.join(process.cwd(), "src", "data", "industries.json");

export async function readAllIndustries(): Promise<Record<string, Industry[]>> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, Industry[]>;
  } catch {
    return {};
  }
}

async function writeAllIndustries(data: Record<string, Industry[]>): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function getIndustriesForCourse(courseSlug: string): Promise<Industry[]> {
  const all = await readAllIndustries();
  return all[courseSlug] ?? [];
}

export async function addIndustry(courseSlug: string, industry: Industry): Promise<Industry> {
  const all = await readAllIndustries();
  const list = all[courseSlug] ?? [];
  if (list.some((i) => slugify(i.name) === slugify(industry.name))) {
    throw new Error(`Industry "${industry.name}" already exists for this course`);
  }
  list.push(industry);
  all[courseSlug] = list;
  await writeAllIndustries(all);
  return industry;
}

export async function updateIndustry(
  courseSlug: string,
  industrySlug: string,
  patch: Partial<Industry>,
): Promise<Industry> {
  const all = await readAllIndustries();
  const list = all[courseSlug] ?? [];
  const idx = list.findIndex((i) => slugify(i.name) === industrySlug);
  if (idx === -1) throw new Error("Industry not found");

  const updated: Industry = { ...list[idx], ...patch };
  const newSlug = slugify(updated.name);
  if (
    newSlug !== industrySlug &&
    list.some((i, j) => j !== idx && slugify(i.name) === newSlug)
  ) {
    throw new Error(`Industry "${updated.name}" already exists for this course`);
  }
  list[idx] = updated;
  all[courseSlug] = list;
  await writeAllIndustries(all);

  // Renaming an industry re-slugs it: move its companies to the new slug.
  if (newSlug !== industrySlug) {
    const companies = await readCompanies();
    let changed = false;
    for (const c of companies) {
      if (c.courseSlug === courseSlug && c.industrySlug === industrySlug) {
        c.industrySlug = newSlug;
        changed = true;
      }
    }
    if (changed) await writeCompanies(companies);
  }
  return updated;
}

export async function deleteIndustry(courseSlug: string, industrySlug: string): Promise<void> {
  const all = await readAllIndustries();
  const list = all[courseSlug] ?? [];
  const next = list.filter((i) => slugify(i.name) !== industrySlug);
  if (next.length === list.length) throw new Error("Industry not found");
  all[courseSlug] = next;
  await writeAllIndustries(all);

  // Cascade: remove companies attached to the deleted industry.
  const companies = await readCompanies();
  const remaining = companies.filter(
    (c) => !(c.courseSlug === courseSlug && c.industrySlug === industrySlug),
  );
  if (remaining.length !== companies.length) await writeCompanies(remaining);
}
