import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Points lib/storage.ts's local-file fallback at a throwaway directory instead of the
// app's real seed files under src/data - must be set before lib/companies.ts is
// imported, since storage.ts reads it lazily per-call but we don't want any chance of
// touching real data.
process.env.INVENSIS_TEST_DATA_DIR = mkdtempSync(path.join(tmpdir(), "invensis-test-companies-"));

const { addCompany, updateCompany, deleteCompany, readCompanies } = await import(
  "../src/lib/companies.ts"
);

const base = {
  courseSlug: "pmp",
  industrySlug: "it",
  country: "United States",
  annualReportUrls: [] as string[],
  aiInsight: [] as string[],
};

test("addCompany sanitizes non-http(s) URLs to empty/dropped (XSS guard)", async () => {
  const c = await addCompany({
    ...base,
    companyName: "Acme",
    website: "javascript:alert(1)",
    annualReportUrls: ["javascript:alert(2)", "https://ok.example/report.pdf"],
  });
  assert.equal(c.website, "");
  assert.deepEqual(c.annualReportUrls, ["https://ok.example/report.pdf"]);
});

test("addCompany keeps valid http(s) URLs", async () => {
  const c = await addCompany({ ...base, companyName: "Beta", website: "https://beta.example" });
  assert.equal(c.website, "https://beta.example");
});

test("updateCompany applies a patch and sanitizes an updated website", async () => {
  const c = await addCompany({ ...base, companyName: "Gamma", website: "" });
  const updated = await updateCompany(c.id, { companyName: "Gamma Inc", website: "javascript:evil()" });
  assert.equal(updated.companyName, "Gamma Inc");
  assert.equal(updated.website, "");
});

test("updateCompany throws for an unknown id", async () => {
  await assert.rejects(() => updateCompany("does-not-exist", { companyName: "x" }), /not found/i);
});

test("deleteCompany removes the row and throws on a second delete", async () => {
  const c = await addCompany({ ...base, companyName: "Delta", website: "" });
  await deleteCompany(c.id);
  const all = await readCompanies();
  assert.ok(!all.some((x) => x.id === c.id));
  await assert.rejects(() => deleteCompany(c.id), /not found/i);
});

// Regression for the read-modify-write race: every mutation used to read the whole
// dataset, mutate in memory, and overwrite it - so N concurrent addCompany calls could
// silently lose all but the last write. mutateDataset's lock (lib/storage.ts) closes
// this window.
test("concurrent addCompany calls don't lose writes", async () => {
  const before = (await readCompanies()).length;
  await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      addCompany({ ...base, courseSlug: "race", industrySlug: "race", companyName: `Racer ${i}`, website: "" }),
    ),
  );
  const after = await readCompanies();
  assert.equal(after.length, before + 25);
  const names = new Set(after.map((c) => c.companyName));
  for (let i = 0; i < 25; i++) assert.ok(names.has(`Racer ${i}`));
});
