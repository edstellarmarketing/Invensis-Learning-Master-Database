# AI Search & Enrich Workflow

How to use AI Search / Enrich to populate a course's industries with prospect companies,
and how to automate that at scale via `scripts/`. Written after actually running this
workflow end-to-end for **PMP Certification**: 5 industries × 10+ real companies each,
all headquartered in countries from the 50-country target list (`src/lib/countries.ts`),
each with a verified annual-report URL + 5 PMP-relevant training insights + a source.

## 1. The manual UI workflow (per industry, ad hoc)

Use this when you're populating one industry at a time and want to review results before
saving.

1. Open a course → industry tab → click **AI Search**.
2. **Search criteria**: optional keywords/country/company-size, and how many companies to
   discover (batches of 15 above 15).
3. **AI provider & cost**: pick a provider. `Auto` tries Claude → OpenRouter → Groq,
   whichever has a key configured (see Settings page for status). Free options exist
   (Groq, or OpenRouter's "Free open models" family) but don't do live web search, so
   results are hedged ("Likely:" prefix) - fine for a first pass, not for final data.
4. **Fields & target courses**: tick which fields to fetch. **Key move**: search with
   only **Website** ticked first - it's cheap/fast and lets you screen candidates before
   paying for the expensive fields. Two live-updating hints sit right below the
   checkboxes to help this decision:
   - **Model recommendation** - a one-line steer on which provider/tier actually earns
     the fields you've checked: AI Insights needs a live-search provider (grounded,
     per-company research); Annual Reports needs live search to find a real URL;
     Website/Country alone works fine with any provider, including free ones.
   - **Estimated time** - a rough ETA under the Search button, recalculated from the
     actual backend call shape (base discovery call, live-search vs. not, the link-
     verification pass, and deep research's one grounded call per company when it
     runs - see the staged-verification note below), scaled across batches for counts
     over 15. It's a heuristic, not a guarantee - live web search and per-company
     research both have real latency variance.
5. Click **Search**. Review the candidate list.

### Staged verification: Website → Report → AI Insights

When **Website**, **Annual Reports**, and **AI Insights** are all three checked at once,
the backend doesn't generate insights blind - it stages them behind verification, so you
never end up with a paragraph of confident-sounding training insights for a company that
turns out not to be real:

1. Discover candidates (company name, website, country, report URL).
2. Verify the website and the report URL for real (a direct HTTP check on the server -
   see `verifyLinks` / the SSRF-guard gotcha above).
3. Only a candidate whose checks passed gets AI Insights. On the rest, `aiInsight` comes
   back empty with a `source` explaining why it was skipped, instead of a guess.

What "passed" requires depends on whether the provider can browse the live web:

- **Claude, or OpenRouter with a live-search model**: requires a verified website **and**
  a verified report. Since the provider can actually confirm a report exists, a
  qualifying candidate gets a real second research call that reads that verified report
  and writes grounded insights from it - this used to only happen at the High token-usage
  tier; it now runs at any tier once all three fields are checked, because the point is
  correctness, not depth.
- **Groq, or OpenRouter's free-model family** (no live browsing): requires only a
  verified **website**. These providers are explicitly told not to guess report URLs, so
  they almost never return a verifiable one - requiring a verified report from them too
  would gate out nearly every real candidate, not just fake ones. A qualifying candidate
  keeps the (still-hedged, "Likely:"/"AI estimate") insights it already produced during
  discovery; a candidate with no verifiable website loses them.

Same gate in enrich mode (re-researching known companies), not just fresh discovery -
including the grounded second research pass, when the provider does live search.

### What you get back

**Annual Reports** target the **last completed financial year** - in 2026 that means
FY2025, and it advances automatically each year. The prompt explicitly rejects both an
older archived report (when the target year exists) and a current/partial-year filing.

**AI Insights** answer one question - *can we sell this company corporate training?* - in
priority order:

1. How many employees were trained (headcount, training hours, or % of workforce)
2. Which technologies / skills / competencies the training focused on
3. Training or L&D spend
4. Existing L&D infrastructure (corporate university, LMS, academies, certification or
   apprenticeship programmes, external training partners)
5. Any other deal-relevant factor - upcoming transformation, a stated reskilling
   commitment, PMO/project-delivery maturity, certification targets, large-scale hiring

**Nothing is invented.** Every figure must appear verbatim in a document the model
actually read. If a number isn't stated, the bullet describes the fact qualitatively; if
a topic isn't disclosed at all, the bullet is skipped rather than padded - fewer true
bullets beat five padded ones. Providers without live web search state **no figures at
all**, prefix every bullet `"Likely:"`, and **omit the training-spend bullet entirely**
(never guess a cost). The `source` field names the document and its financial year.
6. To fetch only report + insights for specific candidates (the "enrich" step): tick
   **Annual Reports** and **AI Insights** in Fields, tick the candidate rows, click
   **Enrich selected (N)**. This re-researches only those two fields for only the
   selected rows - it does not touch Website/Country and does not re-run discovery.
7. Click **Add all** (or **Add** per row) to save into the table.

### Refreshing already-saved companies

Once companies are saved, use the companies table itself, not AI Search:

1. Tick the checkbox on one or more saved rows.
2. Click **Refresh reports & insights** in the bulk-action bar.
3. Confirm the cost warning. It re-researches only reports + insights (via the same
   enrich API) and writes the result back - skipping any company the provider returned
   nothing for, so a miss never overwrites existing good data with blanks.

This is the same underlying `POST /api/companies/search` (`enrich`) + `PUT
/api/companies/:id` pair the scripts below drive programmatically.

## 2. The automated workflow (bulk, scriptable)

For populating many industries/companies at once - like "every industry in a course,
10+ companies each" - driving the UI by hand doesn't scale. Two scripts wrap the same
REST API the UI uses:

### `scripts/seed-course-companies.mjs` - bulk add

Adds a curated list of real companies (name/country/website) to a course's industries via
`POST /api/companies/bulk`. Idempotent - re-running skips companies already saved by name.

```bash
node scripts/seed-course-companies.mjs --dry-run          # preview, no writes
node scripts/seed-course-companies.mjs                    # add (localhost:3000)
node scripts/seed-course-companies.mjs --enrich            # add, then AI-enrich reports+insights
node scripts/seed-course-companies.mjs --base https://your-deploy.vercel.app
```

The company list is a hand-curated dataset embedded in the script (`DATASETS`), not AI
discovery - use this when you already know which companies you want and just need them
in the database quickly. Add more courses by adding another entry to `DATASETS`.

The `--enrich` flag calls the *same* enrich API as the UI's "Refresh reports & insights",
so with a free/no-browsing provider (Groq) it produces hedged, unverified insights and
usually no report URLs. For real citable data, do proper research instead (next section)
or re-run with a paid live-search provider (`ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY`
with a `:online` model).

### `scripts/apply-research-enrichment.mjs` - apply researched data

Writes real, pre-researched `annualReportUrls` + `aiInsight` + `source` to companies
already saved by the seed script, via `PUT /api/companies/:id` per company (bypassing
the AI enrich call entirely - useful when the data came from actual research rather than
an LLM call). The `RESEARCH` object is the dataset; matches companies by name per
industry and skips ones it can't find (logs a warning, doesn't fail the run).

```bash
node scripts/apply-research-enrichment.mjs
node scripts/apply-research-enrichment.mjs --base https://your-deploy.vercel.app
```

Idempotent by construction - it's a direct overwrite, so re-running just re-applies the
same values.

### Getting the data onto a live deployment

**A `git push` alone does not update an already-deployed site's data.** Both scripts
default to `--base http://localhost:3000`, so running them without `--base` only writes
to whatever's running locally. This bit the PMP run: the data was committed and pushed to
`src/data/companies.json`, but the live deployment's Upstash Redis had already been
seeded once from an earlier build - and per `AGENTS.md`, once Redis has data, the bundled
JSON is never consulted again on startup. The fix is to run the scripts a **second time**
against the live URL:

```bash
node scripts/seed-course-companies.mjs --base https://your-deploy.vercel.app
node scripts/apply-research-enrichment.mjs --base https://your-deploy.vercel.app
```

Before doing this, check `/settings` on that deployment - the **Storage** card shows
"Connected" (Redis, writes persist) vs. "Local JSON files" (a serverless deployment
without the Redis integration; writes won't survive the next cold start either way).
After running, verify from the outside with a plain `curl` against the live API rather
than trusting local state:

```bash
curl -s "https://your-deploy.vercel.app/api/companies?courseSlug=<slug>&industrySlug=<slug>" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).length))"
```

## 3. How the PMP dataset was actually built (worked example)

This is what actually happened, as a template for repeating it on another course:

1. **Scope**: `pmp-certification-training`'s 5 industries (Manufacturing, IT, ITES,
   Pharma, Construction), 10 companies each, headquartered in the 50-country list (which
   does **not** include India - the 5 pre-existing seed companies used India and were
   left as-is, not touched).
2. **Company selection**: chose real, recognizable multinational companies per industry
   with real HQ countries from the list and verified `https://` websites, written into
   `seed-course-companies.mjs`'s `DATASETS`, then ran it to bulk-add all 50 via
   `POST /api/companies/bulk`.
3. **Research**: rather than relying on a single AI-search call (which, on a free
   no-browsing provider, produces hedged/unverified insights), dispatched 5 parallel
   research agents (one per industry), each independently using web search + page fetch
   against each company's actual investor-relations pages to find a real annual-report
   URL and ground 5 training/L&D-relevant insights in real facts.
4. **Applied**: compiled the 50 results into `apply-research-enrichment.mjs`'s `RESEARCH`
   object and ran it, writing directly via `PUT /api/companies/:id` per company.
5. **Verified**: spot-checked all 50 report URLs with a direct HTTP request. Most
   returned `200`; a handful (Bayer, Boehringer Ingelheim, Bouygues, Ericsson, Concentrix,
   TTEC) returned `403` from bot-protection on their own real corporate domains - not dead
   links. This matches the app's own link-verification policy already documented in
   `AGENTS.md`: only a confirmed DNS failure counts as dead; everything else (including a
   403 bot-block) is ambiguous and kept rather than dropped. (A later re-audit found
   Unilever's dated-PDF path had since 404'd and swapped it for its IR landing page - see
   §3a.)
6. **Deployed**: committed and pushed `src/data/companies.json` - which populates a
   *fresh* Redis, but didn't touch the already-seeded live deployment (see "Getting the
   data onto a live deployment" above). Re-ran both scripts with `--base
   https://<live-url>` to actually write the 50 companies through the real API, then
   re-verified counts per industry with a direct `curl` against the live site (not local
   state) before calling it done.

### Result

| Industry | Companies | Countries used |
|---|---|---|
| Manufacturing | 10 | Germany, Japan, France, Switzerland, UK, Netherlands, Sweden |
| IT | 10 (+5 pre-existing) | Germany, Finland, Sweden, Netherlands, France, Spain, Switzerland |
| ITES | 10 | France, US, UK, Sweden, Germany, Italy |
| Pharma | 10 | Switzerland, Germany, France, UK, Denmark, Japan |
| Construction | 10 | France, Spain, Sweden, Germany, US, UK, Austria, Netherlands |

All 50 use countries from `src/lib/countries.ts`, verified programmatically (zero
off-list countries). Live on the production deployment, verified via direct `curl`
against the deployed API (not just local state) after re-running both scripts with
`--base <live-url>`.

## 3a. Keeping the data healthy (periodic audit)

Company data ages. A quick audit worth re-running now and then (locally against
`src/data/companies.json`, and against the live API for what users actually see):

- **Dead report links.** Report URLs rot - a PDF path that resolved during research can
  later 404 when the company reorganises its site. Re-check every URL with a direct HTTP
  request and classify by the app's own policy: a hard `404`/`410`/DNS failure is dead and
  must be fixed; a `403` bot-block on a real corporate domain is *ambiguous and kept*, not
  dead. When a specific dated-PDF path dies, replace it with the company's canonical
  investor-relations annual-reports **landing page** (far more durable than a dated
  filename). Then fix it in three places: `src/data/companies.json`, the `RESEARCH` object
  in `apply-research-enrichment.mjs` (so a re-run doesn't reintroduce it), and the live
  deployment (re-run `apply-research-enrichment.mjs --base <live-url>`, which is
  idempotent). *Example: Unilever's dated-PDF report path 404'd post-research and was
  swapped for its IR annual-reports landing page.*
- **Report-year staleness.** The prompts target the last completed financial year
  (`FY<currentYear-1>`), but data researched in a prior year will cite the older year
  (e.g. a batch researched in 2025 cites FY2024 even after FY2025 reports publish).
  Re-running "Refresh reports & insights" (or the enrich script) with a live-search
  provider pulls the newer year - but it's a real paid operation per company, so do it
  when the freshness matters for a pitch, not reflexively.
- **Off-target-list countries.** The 5 pre-existing IT seed companies (Infosys, TCS,
  Wipro) are India-based, which is *not* in the 50-country list. Left intentionally as the
  original seed; flag but don't silently drop them.

## 4. When to use which approach

| Need | Use |
|---|---|
| A few candidates for one industry, reviewed before saving | Manual AI Search UI |
| Not sure which model/tier a set of fields needs, or how long it'll take | Check the Fields to fetch hints (model recommendation + ETA) before hitting Search |
| Want AI Insights only for companies that actually check out, not guesses for everything | Check Website + Annual Reports + AI Insights together - the staged verification gate (§1) handles the rest automatically |
| Fill in missing report/insight data on a handful of saved rows | "Refresh reports & insights" (companies table) |
| Add a known, curated list of companies fast (no AI discovery) | `seed-course-companies.mjs` |
| Bulk-fill AI-search enrich data on a large curated set, roughly | `seed-course-companies.mjs --enrich` (use a paid live-search provider for real report URLs) |
| Citable, research-grade report URLs + insights at scale | Parallel research agents → `apply-research-enrichment.mjs` (this doc's §3) |
| Getting any of the above onto an already-deployed site | Re-run the script(s) with `--base <live-url>` - a `git push` alone won't do it once Redis has been seeded (§2, "Getting the data onto a live deployment") |
| Keeping existing data healthy (dead links, stale report years) | Periodic audit (§3a) - re-check report URLs, distinguish real 404s from 403 bot-blocks, refresh stale years only when a pitch needs it |
