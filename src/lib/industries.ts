// Industries per course. Shape: Record<courseSlug, Industry[]>.
// Persistence: Upstash Redis when configured, local JSON file otherwise - see lib/storage.ts.
import { slugify } from "./slug.ts";
import { mutateCompanies } from "./companies.ts";
import { readDataset, writeDataset, mutateDataset } from "./storage.ts";

export type Industry = { name: string; icon: string; rationale: string };

export async function readAllIndustries(): Promise<Record<string, Industry[]>> {
  return readDataset<Record<string, Industry[]>>("industries", {});
}

export async function writeAllIndustries(data: Record<string, Industry[]>): Promise<void> {
  await writeDataset("industries", data);
}

// Atomic read-modify-write - see mutateCompanies in lib/companies.ts for why.
export async function mutateIndustries(
  fn: (all: Record<string, Industry[]>) => Record<string, Industry[]> | Promise<Record<string, Industry[]>>,
): Promise<Record<string, Industry[]>> {
  return mutateDataset<Record<string, Industry[]>>("industries", {}, fn);
}

export async function getIndustriesForCourse(courseSlug: string): Promise<Industry[]> {
  const all = await readAllIndustries();
  return all[courseSlug] ?? [];
}

export async function addIndustry(courseSlug: string, industry: Industry): Promise<Industry> {
  await mutateIndustries((all) => {
    const list = all[courseSlug] ?? [];
    if (list.some((i) => slugify(i.name) === slugify(industry.name))) {
      throw new Error(`Industry "${industry.name}" already exists for this course`);
    }
    return { ...all, [courseSlug]: [...list, industry] };
  });
  return industry;
}

export async function updateIndustry(
  courseSlug: string,
  industrySlug: string,
  patch: Partial<Industry>,
): Promise<Industry> {
  let updated: Industry | undefined;
  let newSlug = industrySlug;
  await mutateIndustries((all) => {
    const list = all[courseSlug] ?? [];
    const idx = list.findIndex((i) => slugify(i.name) === industrySlug);
    if (idx === -1) throw new Error("Industry not found");

    updated = { ...list[idx], ...patch };
    newSlug = slugify(updated.name);
    if (newSlug !== industrySlug && list.some((i, j) => j !== idx && slugify(i.name) === newSlug)) {
      throw new Error(`Industry "${updated.name}" already exists for this course`);
    }
    const nextList = [...list];
    nextList[idx] = updated;
    return { ...all, [courseSlug]: nextList };
  });

  // Renaming an industry re-slugs it: move its companies to the new slug.
  if (newSlug !== industrySlug) {
    await mutateCompanies((companies) =>
      companies.map((c) =>
        c.courseSlug === courseSlug && c.industrySlug === industrySlug
          ? { ...c, industrySlug: newSlug }
          : c,
      ),
    );
  }
  return updated!;
}

export async function deleteIndustry(courseSlug: string, industrySlug: string): Promise<void> {
  await mutateIndustries((all) => {
    const list = all[courseSlug] ?? [];
    const next = list.filter((i) => slugify(i.name) !== industrySlug);
    if (next.length === list.length) throw new Error("Industry not found");
    return { ...all, [courseSlug]: next };
  });

  // Cascade: remove companies attached to the deleted industry.
  await mutateCompanies((companies) =>
    companies.filter((c) => !(c.courseSlug === courseSlug && c.industrySlug === industrySlug)),
  );
}
