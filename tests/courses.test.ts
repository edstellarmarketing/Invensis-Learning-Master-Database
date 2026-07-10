import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.INVENSIS_TEST_DATA_DIR = mkdtempSync(path.join(tmpdir(), "invensis-test-courses-"));

const { addCategory, addCourse, deleteCourse, deleteCategory, readCategories } = await import(
  "../src/lib/courses.ts"
);
const { addIndustry, getIndustriesForCourse } = await import("../src/lib/industries.ts");
const { addCompany, readCompanies } = await import("../src/lib/companies.ts");

const co = {
  country: "",
  website: "",
  annualReportUrls: [] as string[],
  aiInsight: [] as string[],
};

test("addCategory rejects a duplicate name case-insensitively", async () => {
  await addCategory("Project Management");
  await assert.rejects(() => addCategory("project management"), /already exists/i);
});

test("addCourse rejects a duplicate course name across categories", async () => {
  const cat = await addCategory("IT Certifications");
  await addCourse(cat.slug, "ITIL 4");
  await assert.rejects(() => addCourse(cat.slug, "itil 4"), /already exists/i);
});

// Regression: deleteCourse used to only unlink the course from its category, leaving
// its industries/companies orphaned in storage - so recreating a course with the same
// name (same slug) silently resurrected the old data. It must now cascade like
// deleteIndustry does.
test("deleteCourse cascades to its industries and companies, and recreating it starts clean", async () => {
  const cat = await addCategory("Cascade Category");
  const course = await addCourse(cat.slug, "Cascade Course");
  await addIndustry(course.slug, { name: "Manufacturing", icon: "Factory", rationale: "" });
  await addCompany({ ...co, courseSlug: course.slug, industrySlug: "manufacturing", companyName: "Acme" });

  await deleteCourse(course.slug);

  assert.equal((await getIndustriesForCourse(course.slug)).length, 0);
  assert.ok(!(await readCompanies()).some((c) => c.courseSlug === course.slug));

  const recreated = await addCourse(cat.slug, "Cascade Course");
  assert.equal(recreated.slug, course.slug);
  assert.equal((await getIndustriesForCourse(recreated.slug)).length, 0);
  assert.ok(!(await readCompanies()).some((c) => c.courseSlug === recreated.slug));
});

test("deleteCategory cascades through every course it contains", async () => {
  const cat = await addCategory("Doomed Category");
  const c1 = await addCourse(cat.slug, "Doomed Course A");
  const c2 = await addCourse(cat.slug, "Doomed Course B");
  await addIndustry(c1.slug, { name: "Pharma", icon: "Pill", rationale: "" });
  await addCompany({ ...co, courseSlug: c2.slug, industrySlug: "x", companyName: "Zeta" });

  await deleteCategory(cat.slug);

  assert.equal((await getIndustriesForCourse(c1.slug)).length, 0);
  assert.ok(!(await readCompanies()).some((c) => c.courseSlug === c2.slug));
  assert.ok(!(await readCategories()).some((c) => c.slug === cat.slug));
});

test("deleteCourse throws for an unknown slug", async () => {
  await assert.rejects(() => deleteCourse("does-not-exist"), /not found/i);
});
