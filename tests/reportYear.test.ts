import { test } from "node:test";
import assert from "node:assert/strict";
import { extractReportYear } from "../src/lib/reportYear.ts";

test("extracts FY-prefixed year", () => {
  assert.equal(extractReportYear("Accenture FY2024 Form 10-K (SEC EDGAR)"), "FY2024");
});

test("extracts year from fiscal range", () => {
  assert.equal(
    extractReportYear("Infosys Integrated Annual Report 2024-25 (investor relations)"),
    "FY2024",
  );
});

test("extracts bare year when no FY prefix", () => {
  assert.equal(extractReportYear("Novartis Annual Report 2025 (PDF)"), "FY2025");
});

test("prefers first FY match over a later bare year", () => {
  assert.equal(
    extractReportYear("Novartis Annual Report 2025 (PDF); SEC Form 20-F FY2025"),
    "FY2025",
  );
});

test("returns null when no year is present", () => {
  assert.equal(extractReportYear("AI estimate, not verified"), null);
});

test("returns null for undefined/empty source", () => {
  assert.equal(extractReportYear(undefined), null);
  assert.equal(extractReportYear(""), null);
});
