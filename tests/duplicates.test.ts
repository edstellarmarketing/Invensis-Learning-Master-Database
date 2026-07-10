import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findDuplicate,
  normalizeCompanyName,
  normalizeWebsite,
  type ExistingCompany,
} from "../src/lib/duplicates.ts";

test("normalizeCompanyName strips punctuation and legal suffixes", () => {
  assert.equal(normalizeCompanyName("Siemens AG"), "siemens");
  assert.equal(normalizeCompanyName("Siemens A.G."), "siemens");
  assert.equal(normalizeCompanyName("Acme Group Ltd."), "acme");
  assert.equal(normalizeCompanyName("Tata Consultancy Services"), "tata consultancy services");
});

test("normalizeCompanyName strips a chained 'and co' before bare 'co'", () => {
  assert.equal(normalizeCompanyName("Baker and Co"), "baker");
});

test("normalizeWebsite drops www and lowercases; invalid input yields empty string", () => {
  assert.equal(normalizeWebsite("https://WWW.Infosys.com/investors"), "infosys.com");
  assert.equal(normalizeWebsite("not a url"), "");
  assert.equal(normalizeWebsite(undefined), "");
});

const existing: ExistingCompany[] = [
  { companyName: "Siemens AG", courseSlug: "pmp", industrySlug: "manufacturing", website: "https://siemens.com" },
  { companyName: "Meta Platforms", courseSlug: "itil", industrySlug: "it", website: "https://facebook.com" },
];

test("findDuplicate matches across a different industry by normalized name", () => {
  const hit = findDuplicate({ companyName: "Siemens" }, existing, {
    courseSlug: "pmp",
    industrySlug: "construction",
  });
  assert.equal(hit?.companyName, "Siemens AG");
  assert.equal(hit?.industrySlug, "manufacturing");
});

test("findDuplicate matches by website hostname when names differ", () => {
  const hit = findDuplicate({ companyName: "Facebook", website: "https://www.facebook.com" }, existing, {
    courseSlug: "pmp",
    industrySlug: "it",
  });
  assert.equal(hit?.companyName, "Meta Platforms");
});

test("findDuplicate ignores a match in the exact course+industry being searched", () => {
  const hit = findDuplicate({ companyName: "Siemens AG" }, existing, {
    courseSlug: "pmp",
    industrySlug: "manufacturing",
  });
  assert.equal(hit, null);
});

test("findDuplicate returns null for a genuinely new company", () => {
  assert.equal(
    findDuplicate({ companyName: "Novartis" }, existing, { courseSlug: "pmp", industrySlug: "pharma" }),
    null,
  );
});

test("findDuplicate does not match on an empty website hostname", () => {
  // Both sides have unparseable websites - must not collapse to "" === "" and match.
  const list: ExistingCompany[] = [
    { companyName: "Alpha", courseSlug: "c", industrySlug: "i", website: "junk" },
  ];
  assert.equal(
    findDuplicate({ companyName: "Beta", website: "also junk" }, list, {
      courseSlug: "c",
      industrySlug: "other",
    }),
    null,
  );
});

test("findDuplicate returns null for a blank candidate name", () => {
  assert.equal(findDuplicate({ companyName: "  " }, existing, { courseSlug: "x", industrySlug: "y" }), null);
});
