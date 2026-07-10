import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHttpUrl, safeHref } from "../src/lib/url.ts";

test("sanitizeHttpUrl accepts http and https URLs", () => {
  assert.equal(sanitizeHttpUrl("https://example.com"), "https://example.com");
  assert.equal(sanitizeHttpUrl("http://example.com/path"), "http://example.com/path");
});

// Regression: javascript:/data: URIs stored as a company website/report link and
// rendered as a raw href would execute on click (stored XSS) - see lib/url.ts.
test("sanitizeHttpUrl rejects javascript:, data:, and vbscript: URIs", () => {
  assert.equal(sanitizeHttpUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeHttpUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(sanitizeHttpUrl("vbscript:msgbox(1)"), "");
});

test("sanitizeHttpUrl rejects empty and malformed input", () => {
  assert.equal(sanitizeHttpUrl(""), "");
  assert.equal(sanitizeHttpUrl("   "), "");
  assert.equal(sanitizeHttpUrl("not a url"), "");
});

test("safeHref returns undefined for unsafe/empty values and the URL for safe ones", () => {
  assert.equal(safeHref(null), undefined);
  assert.equal(safeHref(""), undefined);
  assert.equal(safeHref("javascript:alert(1)"), undefined);
  assert.equal(safeHref("https://ok.example"), "https://ok.example");
});
