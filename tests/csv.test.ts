import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, csvToCompanies, sampleCsv } from "../src/lib/csv.ts";

test("parseCsv handles quotes, escaped quotes, commas and CRLF", () => {
  const rows = parseCsv('"a,b","say ""hi""",c\r\nd,e,f\n');
  assert.deepEqual(rows, [
    ["a,b", 'say "hi"', "c"],
    ["d", "e", "f"],
  ]);
});

test("parseCsv handles newlines inside quoted fields and skips blank lines", () => {
  const rows = parseCsv('"line1\nline2",x\n\n,\ny,z');
  assert.deepEqual(rows, [
    ["line1\nline2", "x"],
    ["y", "z"],
  ]);
});

test("csvToCompanies maps header row and splits multi-value fields", () => {
  const csv = [
    "Company Name,Country,Website,Annual Report URLs,AI Insights,Source",
    '"Acme, Inc.",US,https://acme.com,https://a.pdf | https://b.pdf,one | two | three,note',
  ].join("\r\n");
  const { rows, skipped } = csvToCompanies(csv);
  assert.equal(skipped, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].companyName, "Acme, Inc.");
  assert.deepEqual(rows[0].annualReportUrls, ["https://a.pdf", "https://b.pdf"]);
  assert.deepEqual(rows[0].aiInsight, ["one", "two", "three"]);
  assert.equal(rows[0].source, "note");
});

test("csvToCompanies works without a header row (positional)", () => {
  const { rows } = csvToCompanies("NoHeader Co,India,https://x.com,,insight a | insight b,");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].companyName, "NoHeader Co");
  assert.equal(rows[0].country, "India");
  assert.deepEqual(rows[0].aiInsight, ["insight a", "insight b"]);
});

test("csvToCompanies skips rows missing companyName and counts them", () => {
  const csv = [
    "Company Name,Country,Website,Annual Report URLs,AI Insights,Source",
    ",India,,,,",
    "Real Co,UK,,,,",
  ].join("\n");
  const { rows, skipped } = csvToCompanies(csv);
  assert.equal(rows.length, 1);
  assert.equal(skipped, 1);
});

test("sampleCsv round-trips through the parser", () => {
  const { rows, skipped } = csvToCompanies(sampleCsv());
  assert.equal(skipped, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].companyName, "Acme Technologies");
  assert.equal(rows[1].annualReportUrls.length, 2);
});
