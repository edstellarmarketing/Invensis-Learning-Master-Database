import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INSIGHTS_SKIPPED_WEBSITE,
  INSIGHTS_SKIPPED_WEBSITE_OR_REPORT,
  gateInsightsOnVerification,
  hasVerifiedReport,
  hasVerifiedWebsite,
  mergeResearched,
  partitionForGroundedInsights,
  qualifiesForGroundedInsights,
  type GateCandidate,
} from "../src/lib/insightGate.ts";

function candidate(over: Partial<GateCandidate> = {}): GateCandidate {
  return { companyName: "Acme", aiInsight: ["a", "b"], ...over };
}

// The whole point of these two: `undefined` (nothing was verified) must NOT pass. This is
// the exact distinction that broke once - a URL the SSRF guard refused to even fetch came
// back looking verified. See AGENTS.md.
test("hasVerifiedWebsite requires exactly true, not truthy or undefined", () => {
  assert.equal(hasVerifiedWebsite(candidate({ websiteVerified: true })), true);
  assert.equal(hasVerifiedWebsite(candidate({ websiteVerified: false })), false);
  assert.equal(hasVerifiedWebsite(candidate({})), false); // undefined
});

test("hasVerifiedReport requires exactly true, not truthy or undefined", () => {
  assert.equal(hasVerifiedReport(candidate({ reportVerified: true })), true);
  assert.equal(hasVerifiedReport(candidate({ reportVerified: false })), false);
  assert.equal(hasVerifiedReport(candidate({})), false); // undefined
});

test("qualifiesForGroundedInsights needs BOTH website and report verified", () => {
  assert.equal(
    qualifiesForGroundedInsights(candidate({ websiteVerified: true, reportVerified: true })),
    true,
  );
  assert.equal(
    qualifiesForGroundedInsights(candidate({ websiteVerified: true, reportVerified: false })),
    false,
  );
  assert.equal(
    qualifiesForGroundedInsights(candidate({ websiteVerified: false, reportVerified: true })),
    false,
  );
  assert.equal(qualifiesForGroundedInsights(candidate({})), false);
});

test("gateInsightsOnVerification keeps insights only for a verified website", () => {
  const input = [
    candidate({ companyName: "Real", websiteVerified: true }),
    candidate({ companyName: "Fake", websiteVerified: false }),
    candidate({ companyName: "Unchecked" }),
  ];
  const out = gateInsightsOnVerification(input);

  assert.deepEqual(out[0].aiInsight, ["a", "b"]);
  assert.equal(out[0].source, undefined);

  for (const i of [1, 2]) {
    assert.deepEqual(out[i].aiInsight, []);
    assert.equal(out[i].source, INSIGHTS_SKIPPED_WEBSITE);
  }
});

// A gated candidate keeps its report even though it loses its insights - only aiInsight
// and source are touched, never the rest of the record.
test("gateInsightsOnVerification does not mutate input and preserves other fields", () => {
  const input = [candidate({ companyName: "Fake", websiteVerified: false, reportVerified: true })];
  const out = gateInsightsOnVerification(input);

  assert.deepEqual(input[0].aiInsight, ["a", "b"], "input must not be mutated");
  assert.equal(out[0].companyName, "Fake");
  assert.equal(out[0].reportVerified, true);
});

test("partitionForGroundedInsights selects only fully-verified candidates, in order", () => {
  const input = [
    candidate({ companyName: "Skip", websiteVerified: true }),
    candidate({ companyName: "Keep1", websiteVerified: true, reportVerified: true }),
    candidate({ companyName: "Skip2" }),
    candidate({ companyName: "Keep2", websiteVerified: true, reportVerified: true }),
  ];
  const { qualifies, toResearch } = partitionForGroundedInsights(input);

  assert.deepEqual(qualifies, [false, true, false, true]);
  assert.deepEqual(
    toResearch.map((c) => c.companyName),
    ["Keep1", "Keep2"],
  );
});

test("mergeResearched stitches researched results back into original positions", () => {
  const input = [
    candidate({ companyName: "Skip", websiteVerified: true }),
    candidate({ companyName: "Keep1", websiteVerified: true, reportVerified: true }),
    candidate({ companyName: "Keep2", websiteVerified: true, reportVerified: true }),
  ];
  const qualifies = [false, true, true];
  const researched = [
    candidate({ companyName: "Keep1", aiInsight: ["grounded1"], source: "FY2025 Annual Report" }),
    candidate({ companyName: "Keep2", aiInsight: ["grounded2"], source: "FY2025 Annual Report" }),
  ];

  const out = mergeResearched(input, qualifies, researched);

  assert.equal(out[0].companyName, "Skip");
  assert.deepEqual(out[0].aiInsight, []);
  assert.equal(out[0].source, INSIGHTS_SKIPPED_WEBSITE_OR_REPORT);

  assert.deepEqual(out[1].aiInsight, ["grounded1"]);
  assert.equal(out[1].source, "FY2025 Annual Report");
  assert.deepEqual(out[2].aiInsight, ["grounded2"]);
});

// Defensive: if deepResearch ever returns fewer rows than it was handed, we must not
// silently shift the wrong insights onto the wrong company.
test("mergeResearched degrades safely when researched is short", () => {
  const input = [
    candidate({ companyName: "Keep1", websiteVerified: true, reportVerified: true }),
    candidate({ companyName: "Keep2", websiteVerified: true, reportVerified: true }),
  ];
  const out = mergeResearched(input, [true, true], [candidate({ companyName: "Keep1", aiInsight: ["ok"] })]);

  assert.deepEqual(out[0].aiInsight, ["ok"]);
  assert.deepEqual(out[1].aiInsight, []);
  assert.equal(out[1].source, INSIGHTS_SKIPPED_WEBSITE_OR_REPORT);
});

test("empty candidate list is handled by every gate function", () => {
  assert.deepEqual(gateInsightsOnVerification([]), []);
  const { qualifies, toResearch } = partitionForGroundedInsights([]);
  assert.deepEqual(qualifies, []);
  assert.deepEqual(toResearch, []);
  assert.deepEqual(mergeResearched([], [], []), []);
});
