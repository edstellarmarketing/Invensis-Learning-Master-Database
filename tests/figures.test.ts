import { test } from "node:test";
import assert from "node:assert/strict";
import { hasNumericClaim, reassembleVerified, splitNumericBullets } from "../src/lib/figures.ts";

test("hasNumericClaim detects headcounts, percentages, currency and multipliers", () => {
  assert.equal(hasNumericClaim("Trained 12,000 employees"), true);
  assert.equal(hasNumericClaim("45% of the workforce upskilled"), true);
  assert.equal(hasNumericClaim("Invested $4.2m in L&D"), true);
  assert.equal(hasNumericClaim("Invested €3 million in training"), true);
  assert.equal(hasNumericClaim("Doubled training hours 2x year over year"), true);
});

test("hasNumericClaim ignores bullets whose only digits are a year", () => {
  assert.equal(hasNumericClaim("Launched a corporate academy in 2024"), false);
  assert.equal(hasNumericClaim("Per the FY2025 annual report, runs an internal LMS"), false);
});

test("hasNumericClaim is false for purely qualitative bullets", () => {
  assert.equal(hasNumericClaim("Operates a corporate university"), false);
  assert.equal(hasNumericClaim("Partners with external training providers"), false);
});

test("splitNumericBullets partitions and preserves within-group order", () => {
  const { numeric, qualitative } = splitNumericBullets([
    "Trained 500 staff",
    "Runs an academy",
    "Spent $1m",
  ]);
  assert.deepEqual(numeric, ["Trained 500 staff", "Spent $1m"]);
  assert.deepEqual(qualitative, ["Runs an academy"]);
});

test("reassembleVerified drops unconfirmed numeric bullets, keeps order and qualitative ones", () => {
  const original = ["Trained 500 staff", "Runs an academy", "Spent $1m"];
  const numeric = ["Trained 500 staff", "Spent $1m"];
  const kept = ["Spent $1m"];
  assert.deepEqual(reassembleVerified(original, numeric, kept), ["Runs an academy", "Spent $1m"]);
});

test("reassembleVerified fails closed when the verifier paraphrases (nothing matches)", () => {
  const original = ["Trained 500 staff", "Runs an academy"];
  assert.deepEqual(
    reassembleVerified(original, ["Trained 500 staff"], ["Trained ~500 staff members"]),
    ["Runs an academy"],
  );
});

test("reassembleVerified keeps everything when all numeric bullets are confirmed", () => {
  const original = ["Trained 500 staff", "Runs an academy"];
  assert.deepEqual(reassembleVerified(original, ["Trained 500 staff"], ["Trained 500 staff"]), original);
});
