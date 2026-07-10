import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.INVENSIS_TEST_DATA_DIR = mkdtempSync(path.join(tmpdir(), "invensis-test-industries-"));

const { addIndustry, updateIndustry, deleteIndustry, getIndustriesForCourse } = await import(
  "../src/lib/industries.ts"
);
const { addCompany, readCompanies } = await import("../src/lib/companies.ts");

const co = {
  country: "",
  website: "",
  annualReportUrls: [] as string[],
  aiInsight: [] as string[],
};

test("addIndustry rejects a name that re-slugs to an existing one for the same course", async () => {
  await addIndustry("demo-course", { name: "Banking & Finance", icon: "Cpu", rationale: "" });
  await assert.rejects(
    () => addIndustry("demo-course", { name: "Banking and Finance", icon: "Cpu", rationale: "" }),
    /already exists/i,
  );
});

// Regression: renaming an industry re-slugs it, and its companies must move with it -
// otherwise they'd point at an industrySlug that no longer exists in the industry list.
test("renaming an industry re-slugs it and migrates its companies", async () => {
  await addIndustry("course-b", { name: "Retail", icon: "Store", rationale: "" });
  await addCompany({ ...co, courseSlug: "course-b", industrySlug: "retail", companyName: "ShopCo" });

  await updateIndustry("course-b", "retail", { name: "Retail & E-commerce" });

  const companies = await readCompanies();
  const moved = companies.find((c) => c.companyName === "ShopCo");
  assert.ok(moved);
  assert.equal(moved.industrySlug, "retail-and-e-commerce");
});

test("deleteIndustry cascades to its companies", async () => {
  await addIndustry("course-c", { name: "Energy", icon: "Zap", rationale: "" });
  await addCompany({ ...co, courseSlug: "course-c", industrySlug: "energy", companyName: "Volt" });

  await deleteIndustry("course-c", "energy");

  const companies = await readCompanies();
  assert.ok(!companies.some((c) => c.companyName === "Volt"));
  assert.equal((await getIndustriesForCourse("course-c")).length, 0);
});

test("deleteIndustry throws for an unknown industry", async () => {
  await assert.rejects(() => deleteIndustry("course-c", "does-not-exist"), /not found/i);
});
