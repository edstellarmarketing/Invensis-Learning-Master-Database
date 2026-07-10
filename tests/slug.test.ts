import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/lib/slug.ts";

test("slugify lowercases and dashes non-alphanumeric runs", () => {
  assert.equal(slugify("IT/Technology"), "it-technology");
});

test("slugify expands & to 'and'", () => {
  assert.equal(slugify("BFSI (Banking & Finance)"), "bfsi-banking-and-finance");
});

test("slugify trims whitespace and strips leading/trailing dashes", () => {
  assert.equal(slugify("  --Weird Name!!--  "), "weird-name");
});
