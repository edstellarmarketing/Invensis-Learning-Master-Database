# Project Log - Invensis Learning Master Database

Chronological record of what was built and why. Newest first.

## 2026-07-09 - Session 8: AI research overhaul (audit fixes applied)
- Deep research (High token tier + live-search models): phase 1 lists companies + links,
  phase 2 reads each company's VERIFIED annual report in its own small call for grounded
  insights - the productized version of how the original 5 PMP seed rows were researched.
- Link verification extended to websites (dead corporate site -> blanked, company kept);
  report URLs already verified server-side with dead ones removed.
- Client-side batching: counts over 15 run as sequential batches with live progress
  ("Batch 2 of 5 - 18 found"), accumulated exclusions so batches never overlap, and
  partial results survive a failed batch.
- 24h Redis result cache (first-batch requests only): repeat searches cost zero tokens;
  UI shows "from cache".
- Free-pool resilience: rotation through 4 verified :free models on 429/503; explicit
  Free-family requests fall through to Groq automatically when the whole pool is
  saturated (same $0 cost expectation).
- Earlier in session: OpenRouter provider (model families Claude/Gemini/GPT/DeepSeek/
  Free/custom slug x low/medium/high token tiers with Paid/Free labels), Gemini
  response-shape parsing fix, auto provider cascade, field-selection checkboxes.
- Backlog note: EDGAR/Companies House enrichment for registry-accurate report URLs.

## 2026-07-08 - Session 6: Upstash Redis backend (writes on Vercel)
- Storage adapter (`src/lib/storage.ts`): Upstash Redis when env is configured, local JSON
  files otherwise. Both datasets stored whole under two keys; first read seeds Redis from the
  bundled JSON. Enables ALL mutations on Vercel: CRUD, CSV bulk import, bulk delete, JSON import.
- companies.ts / industries.ts rewired onto the adapter (public API unchanged).
- Setup: Vercel > Storage > Upstash Redis integration (free tier) auto-injects
  UPSTASH_REDIS_REST_URL/TOKEN; redeploy after connecting.

## 2026-07-08 - Session 5: Vivid design system, icons everywhere, richer summaries
- Palette upgrade: tinted app background, indigo→violet gradient tokens
  (--gradient / --gradient-soft), semantic success/warning/info hues, deeper shadows.
- Per-category visual identity (`src/lib/categoryMeta.ts`): 6 color pairs + icons
  (light-dark() aware) used in the sidebar, course header, and dashboard.
- Icons everywhere: central `IconByName` registry; industry tabs now show their
  industry icon; sidebar categories get colored icon chips + count pills; stat
  cards get colored icon chips; gradient brand mark, gradient CTAs.
- Course header redesigned: category icon tile, colored accent orb, gradient band,
  gradient "View course page" button.
- Course summaries expanded from one line to 3-4 sentences (~4 lines) for all 59
  courses: what it is (correct governing body), skills, audience, employer value.

## 2026-07-08 - Session 4: Course headers, bulk CSV import, bulk delete
- Course header card (gradient, modern): one-line summary for every course
  (`src/lib/courseSummaries.ts`, all 59) + "View course page" link to
  invensislearning.com/<slug>/.
- Bulk company addition: CSV import in the table toolbar with downloadable sample
  template; quote-aware zero-dependency parser (`src/lib/csv.ts`, unit-tested via
  `npm test`, Node built-in runner). Export CSV format round-trips through import.
  Excel workbooks: save as "CSV UTF-8" first (clear error message otherwise).
- Bulk delete: checkbox column + select-all (visible rows), selection bar with
  Delete selected (confirm) / Clear. API: `/api/companies/bulk` POST + DELETE.
- First push to GitHub: edstellarmarketing/Invensis-Learning-Master-Database,
  git identity pinned to edstellarmarketing for this repo.

## 2026-07-08 - Session 3: Dashboard, filters, export/import, Vercel prep
- Dashboard home: stat cards (courses / categories / industries / companies), research-coverage
  list (populated course × industry combos), recently-added companies, category quick links.
- Companies table: country dropdown filter, annual-report presence filter, CSV export of the
  currently filtered rows (Excel-safe, BOM + quoted).
- Global data tools on the dashboard: full-DB JSON export (`GET /api/export`) and validated
  import (`POST /api/import`) with merge (upsert by id / dedupe by name) or replace modes.
- Vercel readiness: write failures on read-only filesystems (EROFS/EACCES/EPERM) now return a
  clear actionable error instead of a 500; deployment notes added to README.
- New docs: this PROJECTLOG.md; README rewritten with features + deploy guide.

## 2026-07-08 - Session 2: CRUD, per-course industries, design refresh
- Industries moved to `src/data/industries.json`: 5 curated target industries for each of the
  59 courses (tailored per course, agent-researched, programmatically verified).
- Industries CRUD: `/api/industries` (GET/POST/PUT/DELETE) + inline "Manage" mode on the tabs.
  Rename migrates company slugs; delete cascades to companies; duplicates rejected.
- Companies CRUD completed: `/api/companies/[id]` (PUT/DELETE) + per-row edit/delete UI.
- Design system: slate + indigo semantic tokens (WCAG AA in light and dark), focus rings,
  elevation scale, tabular numerals, reduced-motion support.

## 2026-07-08 - Session 1: Phase-1 dashboard
- Next.js 16 (App Router, TS strict, Tailwind v4) scaffold.
- Sidebar: 59 courses across 6 categories (catalog sourced from the sibling
  "Invensis Learning Course Content Generator" project's `category_db.py`, cross-checked
  against the live invensislearning.com sitemap), filterable.
- Layout per reference sketch: industry tabs on top, companies table below
  (Company Name / Country / Annual Report / Insights with collapsible AI-insight rows).
- Manual Add Company form + optional AI Search (Anthropic web-search) behind
  `ANTHROPIC_API_KEY`.
- Seeded 5 real companies under PMP → IT/Technology (Infosys, TCS, Accenture, Wipro,
  Capgemini) with real annual-report URLs and FY training insights.

## Planned / backlog
- Automated bulk company scraping across all courses (see playbook below).
- Auth for team use.
- ANTHROPIC_API_KEY on Vercel to enable AI Search in production (optional, paid).

## Data-scraping playbook (future reference, free-first)

Recommended pipeline: ranking lists / registries -> normalize to the sample CSV format ->
bulk Import CSV per course x industry -> batch AI job fills the 4-5 insight bullets from
each annual report.

1. **AI Search (built in, live)** - Anthropic web search per course x industry with count +
   size inputs. Highest quality per effort; a few cents per search. Best for curated batches.
2. **Official registries (best for Annual Report PDFs, all free)**
   - SEC EDGAR API (US listed companies, 10-K filings)
   - UK Companies House API
   - AnnualReports.com / ResponsibilityReports.com (aggregated PDFs, scrapable)
   - India: MCA / NSE / BSE filings
3. **Magazine and ranking lists (best for company names by industry, scrapable HTML)**
   - Fortune 500 / Global 500, Forbes Global 2000, Inc 5000, FT rankings,
     Economic Times 500 (India), industry association member lists
4. **Directories / enrichment APIs**
   - Apollo.io (free tier) and Hunter.io for company + website + size by industry
   - Clutch / GoodFirms (IT services, scrapable); D&B / ZoomInfo paid - skip unless needed
5. **Apify actors** - ready-made scrapers (Google Maps, directories); free monthly credit,
   pay per result. Middle ground when a site is hard to scrape.
   - Google Maps API itself: skipped by decision (needs GCP billing; no company size /
     annual-report data). Geographic discovery is covered free by the Overpass script below.
   - IMPLEMENTED: `scripts/discover-companies.mjs` - OpenStreetMap Overpass discovery
     (free, no key). `node scripts/discover-companies.mjs --industry it --city "Bengaluru"
     --country India` -> import-ready CSV. 10 industry presets + raw --tag escape hatch,
     mirror fallback, dedupe, --help.
6. **Custom scrapers (fully free)** - Node/Playwright or Python script per source, output
   in the sample CSV format, then bulk Import CSV. The CSV format was designed for this.
7. **Search APIs** - SerpAPI / Google Programmable Search for
   "annual report 2025 filetype:pdf {company}" to backfill the report column.

Compliance note: LinkedIn, ZoomInfo, and Crunchbase prohibit scraping in their ToS - use
official APIs/exports or skip them. Registries + ranking lists cover most needs cleanly.
