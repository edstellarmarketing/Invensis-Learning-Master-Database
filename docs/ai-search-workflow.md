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
   paying for the expensive fields.
5. Click **Search**. Review the candidate list.
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
5. **Verified**: spot-checked all 50 report URLs with a direct HTTP request. 46/50
   returned `200`; the remaining 4 (Unilever, Bayer, Boehringer Ingelheim, Bouygues)
   returned `403` from bot-protection on their own real corporate domains - not dead
   links. This matches the app's own link-verification policy already documented in
   `AGENTS.md`: only a confirmed DNS failure counts as dead; everything else (including a
   403 bot-block) is ambiguous and kept rather than dropped.

### Result

| Industry | Companies | Countries used |
|---|---|---|
| Manufacturing | 10 | Germany, Japan, France, Switzerland, UK, Netherlands, Sweden |
| IT | 10 (+5 pre-existing) | Germany, Finland, Sweden, Netherlands, France, Spain, Switzerland |
| ITES | 10 | France, US, UK, Sweden, Germany, Italy |
| Pharma | 10 | Switzerland, Germany, France, UK, Denmark, Japan |
| Construction | 10 | France, Spain, Sweden, Germany, US, UK, Austria, Netherlands |

All 50 use countries from `src/lib/countries.ts`, verified programmatically (zero
off-list countries).

## 4. When to use which approach

| Need | Use |
|---|---|
| A few candidates for one industry, reviewed before saving | Manual AI Search UI |
| Fill in missing report/insight data on a handful of saved rows | "Refresh reports & insights" (companies table) |
| Add a known, curated list of companies fast (no AI discovery) | `seed-course-companies.mjs` |
| Bulk-fill AI-search enrich data on a large curated set, roughly | `seed-course-companies.mjs --enrich` (use a paid live-search provider for real report URLs) |
| Citable, research-grade report URLs + insights at scale | Parallel research agents → `apply-research-enrichment.mjs` (this doc's §3) |
