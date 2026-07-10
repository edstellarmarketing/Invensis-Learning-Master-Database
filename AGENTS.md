# AGENTS.md - Invensis Learning Master Database

## Overview
Sales/marketing target-account research dashboard. The sidebar lists Invensis Learning's
courses (featured by default, full catalog under "Additional courses"); each course shows
its top target industries as tabs, and each industry has a table of prospect companies with
country, website, annual-report PDF links, and a collapsible AI insight on the training they
ran last financial year. Courses, categories, industries, and companies are all fully CRUD
via the UI and REST routes - nothing is a hardcoded static list anymore.

## Stack
- Next.js 16.2.9 (App Router), React 19, TypeScript (strict)
- Tailwind CSS v4 (CSS-variable theming; light/dark via `data-theme` on `<html>`, no
  Tailwind `dark:` prefix anywhere)
- `lucide-react` icons
- `@anthropic-ai/sdk` for the optional Claude AI-search path (OpenRouter/Groq use plain
  `fetch`, no SDK)

## Run / build
```bash
npm install
npm run dev        # http://localhost:3000 (or --port N)
npm run build
npm run lint
npm test           # node --experimental-strip-types --test tests/*.test.ts
```

Relative imports **within `src/lib/*.ts`** (e.g. `companies.ts` importing `./storage`) must
carry an explicit `.ts` extension (`./storage.ts`) - `tsconfig.json` has
`allowImportingTsExtensions: true` for this. Node's native ESM loader (used by `npm test`,
which imports these modules directly rather than through Next's bundler) requires explicit
extensions for relative specifiers; Next/Turbopack accepts either form, so this only matters
inside `src/lib`, not in components/routes that import via the `@/*` path alias.

## Env vars
Copy `.env.example` -> `.env.local`. All optional - the app works with zero keys (manual
Add Company, CSV import, and everything except AI Search). **Never commit `.env.local`**
(gitignored); if a user pastes a key in chat, write it straight to `.env.local`, confirm
`git check-ignore` before doing anything else, and never echo the key back.

- `ANTHROPIC_API_KEY` - enables `/api/companies/search` via Claude (web-search tool).
  **Paid** (Anthropic API usage). `ANTHROPIC_MODEL` defaults to `claude-sonnet-5`. Must be
  a real Anthropic key (starts `sk-ant-`) - an OpenRouter key here 401s, use
  `OPENROUTER_API_KEY` instead.
- `OPENROUTER_API_KEY` - AI Search via OpenRouter (openrouter.ai). The UI exposes a model
  family picker (Claude Sonnet / Gemini Flash / ChatGPT / DeepSeek / Free open models /
  Other with a custom slug field) crossed with a token-usage tier (Low/Medium/High) -
  resolved via `OPENROUTER_MODELS[family][tier]` in the route. Low = cheaper same-family
  model, no `:online` (answers from training knowledge, hedged). Medium/High = bigger model
  + `:online` web search (live-verified, paid, billed by OpenRouter). The "Free" family
  (Llama/Qwen `:free` slugs) rotates through `FREE_MODEL_POOL` on 429/503 and falls back to
  Groq automatically if the whole free pool is saturated - genuinely $0.
- `GROQ_API_KEY` - Groq fallback (free tier). Used when neither Claude nor OpenRouter keys
  are set, when the user picks Groq explicitly, or when the OpenRouter free pool is
  saturated. `GROQ_MODEL` defaults to `llama-3.3-70b-versatile` (answers from model
  knowledge, no live browsing - reliable on the free tier; `groq/compound` has web search
  but its agentic tool chain exhausts the free 30k TPM limit on a single call).
- Auto order: Claude -> OpenRouter -> Groq (whichever keys exist). Prompt is provider-aware
  via `liveSearch`: non-live-search results are hedged ("Likely:" prefix, empty report URLs
  unless confident) since they aren't verified.
- Search route also supports: `courseSlugs[]` (multi-course targeting - one search saves
  under every selected course), `enrich: [{companyName, website}]` (re-research known
  companies for just the checked fields instead of discovering new ones), and excludes
  already-saved companies for the course+industry automatically.
- `ADMIN_API_TOKEN` - optional. Guards the two truly destructive routes (`/api/import` with
  `mode: "replace"`, and `DELETE /api/companies/bulk`) behind an `x-admin-token` header
  (see `lib/adminAuth.ts`). Unset = those routes stay open, matching local-dev zero-config
  default. **Set this in any real (Redis-backed) deployment** - the app has no login, so an
  unset token leaves full-DB wipe reachable by anyone with the URL. The two UI actions that
  hit these routes (`DataTools` replace-import, `CompaniesTable` bulk-delete) call through
  `lib/adminTokenClient.ts`, which prompts once per browser tab on a 401 and remembers the
  token in `sessionStorage` - no separate admin UI needed.

## Layout
```
src/
  app/
    layout.tsx                       # server component: reads categories, renders Sidebar + TopBar + main
    loading.tsx                      # fallback while force-dynamic pages fetch (Redis can be slow)
    not-found.tsx                    # themed 404
    page.tsx                         # dashboard: stats, coverage, recent companies, category cards,
                                      # link to Settings (data tools moved there - see below)
    [courseSlug]/page.tsx            # redirects to the course's first industry
    [courseSlug]/[industrySlug]/page.tsx   # course header + industry tabs + companies table
    settings/page.tsx                # theme, AI-provider status, storage (Redis vs local-file)
                                      # status, admin token (AdminTokenSettings.tsx), data tools
                                      # (DataTools.tsx) - all read-only status except the admin
                                      # token and data tools, which are live controls. Reachable
                                      # from Sidebar's "Settings" link (below "Manage courses")
                                      # and a card on the dashboard.
    api/companies/route.ts           # GET list / POST add
    api/companies/[id]/route.ts      # PUT edit / DELETE
    api/companies/bulk/route.ts      # POST bulk add (CSV import) / DELETE bulk by ids
    api/companies/search/route.ts    # POST AI discovery + enrich (needs a provider key)
    api/ai-providers/route.ts        # GET {claude, openrouter, groq} booleans - which keys are set
    api/industries/route.ts          # GET / POST / PUT / DELETE per course
    api/courses/route.ts             # POST add course / PUT rename+feature+move / DELETE
    api/categories/route.ts          # GET all / POST add / PUT rename / DELETE
    api/export/route.ts              # GET full-DB JSON download (v2: includes categories)
    api/import/route.ts              # POST restore/merge an export (merge|replace)
  components/
    Sidebar.tsx           # featured/additional course tree; mobile off-canvas drawer below md
    TopBar.tsx             # Help + theme toggle
    HelpDialog.tsx / ThemeToggle.tsx
    CoursesManager.tsx     # course/category CRUD modal, opened from Sidebar's "Manage courses".
                            # Rename/delete are inline (edit-in-place, two-click delete-confirm),
                            # not window.prompt()/confirm() - those read as broken/disconnected
                            # from the app. Has a filter box (name substring match on
                            # category+course, case-insensitive) for the 59-course catalog.
    IndustryTabs.tsx       # industry tabs + inline manage CRUD
    CompaniesTable.tsx     # filters (search/country/report), pagination (default 20/page),
                            # bulk select/delete, CSV. Bulk toolbar also has "Refresh reports
                            # & insights": re-researches the SELECTED saved rows via the enrich
                            # API (fields = annualReportUrls + aiInsight only, provider auto),
                            # PUTs the result back, and SKIPS any company enrichment returned
                            # empty for so a provider miss never overwrites existing data with
                            # blanks. Chunks at 25 (the enrich route's per-call cap).
    CountryFilter.tsx      # searchable multi-select country popover (50-country master list)
    CompanySearch.tsx      # AI Search panel: provider/model/tier, fields, multi-course, enrich.
                            # Fetches /api/ai-providers on mount to disable unconfigured
                            # providers in the dropdown (labeled "- not configured") instead of
                            # letting the user pick one and hit a dead-end error after a full
                            # round-trip; shows a banner instead of the form if none are
                            # configured. Confirms before a paid run of 25+ companies.
    AddCompanyForm.tsx     # add + edit modes
    DataTools.tsx           # full-DB JSON export/import - lives on the Settings page
    AdminTokenSettings.tsx  # save/clear the admin token ahead of a 401 - Settings page only
  lib/
    courses.ts             # ASYNC Redis/JSON-backed courses+categories CRUD (see Data model)
    industries.ts           # ASYNC Redis/JSON-backed industries CRUD
    companies.ts             # ASYNC Redis/JSON-backed companies CRUD
    storage.ts               # Redis-vs-local-file adapter + mutateDataset (locked read-modify-write)
    adminAuth.ts / adminTokenClient.ts   # ADMIN_API_TOKEN guard (server) + prompt-and-retry (client)
    requestLimits.ts          # shared request-body size cap + row-count cap for API routes
    url.ts                    # sanitizeHttpUrl/safeHref - only http(s) URLs get stored or linked
    courseSummaries.ts, popularIndustries.ts, countries.ts, categoryMeta.ts, slug.ts
    csv.ts                    # quote-aware parser + sample + companiesToCsv; tested in tests/csv.test.ts
    useDialogA11y.ts          # shared modal hook: Escape, body-scroll lock, focus restore + Tab trap
  data/
    courses.json, industries.json, companies.json   # local-dev-only seed/fallback (see storage.ts)
```

## Data model
Everything below is **runtime-editable** via the UI or REST routes, and persists to Upstash
Redis in production (Vercel) or the JSON files in `src/data/` in local dev - see
`lib/storage.ts`. None of it is a hardcoded static export anymore.
- **Categories & courses** (`lib/courses.ts`): `readCategories()` returns
  `{name, slug, courses: {name, slug, featured?}[]}[]`. 6 categories / 59 courses seeded, 6
  marked `featured` (PMP, PRINCE2 F&P, LSS Green/Black Belt, ITIL 4, ITIL V5) - the sidebar
  shows featured by default with an "Additional courses" expander for the rest. CRUD via
  `/api/categories` + `/api/courses` or the Sidebar's "Manage courses" modal
  (`CoursesManager.tsx`). Add/rename checks collide by both slug AND name (case-insensitive)
  since seeded items carry legacy slugs a freshly-typed name won't reproduce via `slugify()`.
- **Industries** (`lib/industries.ts` / `data/industries.json` shape): `Record<courseSlug,
  Industry[]>` - 5 curated industries per course (the 6 featured courses use a fixed
  Manufacturing/IT/ITES/Pharma/Construction set; the rest have course-tailored picks). CRUD
  via `/api/industries` or the "Manage" toggle on the industry tabs. Renaming re-slugs and
  migrates its companies; deleting cascades to its companies.
- **Companies** (`lib/companies.ts`): keyed by `courseSlug` + `industrySlug`. Full CRUD: add
  (manual form or AI Search), edit, delete, bulk add (CSV import or AI "Add all"), bulk
  delete (row selection). `website`/`annualReportUrls` are run through `sanitizeHttpUrl`
  (`lib/url.ts`) on every write path (single add/edit, bulk, JSON import) - non-http(s)
  values (`javascript:`, `data:`, etc.) are dropped rather than stored.
- **Deleting a course or category cascades** (`lib/courses.ts` `deleteCourse`/
  `deleteCategory`): removes the course's/category's industries and companies too, not just
  the course/category entry itself - matches `deleteIndustry`'s cascade. This is
  load-bearing: without it, recreating a course with the same name (same slug) would
  silently resurrect the old industries/companies.
- **All dataset mutations go through `mutateDataset`** (`lib/storage.ts`) via the
  `mutateCompanies`/`mutateIndustries`/`mutateCategories` wrappers in the three lib files
  above - never call `readX()` + mutate-in-memory + `writeX()` as two separate calls for a
  new CRUD path; that reintroduces the lost-update race `mutateDataset`'s lock (Redis
  `SET NX` in prod, an in-process mutex in local dev) exists to close.

## How to extend
- **Add/edit/delete anything (course, category, industry, company)**: use the UI, or the
  matching REST route - never hand-edit `src/data/*.json` for anything meant to reach
  production (that file is bundled at build time as the *initial* seed only; once Redis has
  been seeded once, editing the JSON file does nothing further - use Export/Import JSON on
  the dashboard, or the CRUD APIs, to change live data).
- **Change the design system**: `src/app/globals.css` (CSS custom properties) +
  `lib/categoryMeta.ts` (per-category icon/color pairs, used via `light-dark()` in inline
  styles) + `lib/popularIndustries.ts` / `lib/IconByName` icon registry.

## Gotchas (Next 16 / Vercel / this codebase specifically)
- Route `params` are async - `const { courseSlug } = await params;`.
- Data stores use Node `fs`, so API routes set `runtime = "nodejs"`.
- **Storage adapter** (`lib/storage.ts`): Upstash Redis when `UPSTASH_REDIS_REST_URL`/`TOKEN`
  (or `KV_REST_API_URL`/`TOKEN`, whichever Vercel's Upstash integration injects) are set -
  required for writes in production - local JSON files in `src/data/` otherwise. Datasets
  stored whole under `invensis-master-db:companies` / `:industries` / `:courses`; first KV
  read seeds from the bundled JSON. Read-only deploys without the integration get a clear
  "connect a database" error on writes (`friendlyWriteError`).
- Home, course, and industry pages are `force-dynamic` (data is live, not static); `layout.tsx`
  is too (it reads categories for the sidebar). `loading.tsx` covers the fallback UI.
- **Any category can have zero courses** (freshly created, or all courses removed/moved
  out) - never index `cat.courses[0]` without checking it exists first; the dashboard
  crashed on exactly this until it was fixed.
- **Link verification** (`verifyLinks`/`checkUrl` in the search route): only a confirmed DNS
  failure (`err.cause.code === "ENOTFOUND"`) counts as a dead link. Every other network
  failure (timeout, redirect loop, bot-protection connection drop, TLS error) is treated as
  ambiguous and the URL is KEPT - real sites can fail a scripted HEAD/GET for reasons that
  have nothing to do with being dead (e.g. ovhcloud.com self-redirects "/" <-> "" forever).
  Don't "tighten" this without a specific reason; it was already too aggressive once.
- **Modals** (`CoursesManager`, `HelpDialog`): the dialog card itself must carry the height
  cap (`max-h-[85vh] flex flex-col`) with exactly one scroll region inside
  (`flex-1 min-h-0 overflow-y-auto`) - capping only the inner content div and leaving the
  card unbounded lets header+content+margins exceed the viewport on shorter screens. Also
  set `overflowAnchor: "none"` on scrollable overlay containers (Chrome's scroll anchoring
  otherwise silently repositions them after mount) and avoid `backdrop-blur` on `fixed`
  overlays combined with programmatic scroll (produced a stale-compositor-frame artifact in
  Chromium). Use the shared `useDialogA11y(open, onClose)` hook for Escape/body-lock/focus-
  restore rather than reimplementing it.
- **Sidebar is a responsive off-canvas drawer** below `md` (768px) - fixed `w-72`, hidden by
  `-translate-x-full` unless `mobileOpen`, hamburger trigger + backdrop, auto-closes on
  route change. Don't revert to a permanently-visible fixed column; that ate ~80% of a
  phone screen with no way to collapse it.
- AI Search state (results/selection) lives in `CompanySearch`, not `CompaniesTable` - it
  reports its result count up via `onResultsChange` so the parent can confirm before
  discarding un-added results when the user switches to Edit/Add Company (both unmount the
  search panel).
- **Link verification is SSRF-guarded** (`verifyLinks`/`checkUrl` in
  `api/companies/search/route.ts`): before fetching any user-supplied `website` or
  `annualReportUrls` value (attacker-controllable via enrich mode, CSV import, or Add
  Company), the hostname - and every hop of any 3xx redirect it returns, since redirects
  are followed manually and re-checked - must resolve to a public IP. Loopback, RFC1918,
  link-local (including the `169.254.169.254` cloud metadata address), and IPv6
  unique-local/link-local are rejected. Don't switch `redirect` back to `"follow"`; that
  reopens the redirect-based bypass this closes.
- **CSP lives in `src/proxy.ts`, not `next.config.ts`** - `next.config.ts` has no
  `headers()` at all. `proxy.ts` is Next.js 16's file-convention rename of what used to be
  `middleware.ts` (same mechanism: exports a function - here named `proxy` - that runs
  before rendering); don't recreate a `middleware.ts`, Next 16 warns it's deprecated. Two
  reasons the CSP has to live here instead of `next.config.ts`:
  1. **Production needs a per-request nonce.** `script-src 'self'` alone blocks every
     inline script unconditionally, including ones Next.js itself injects (the RSC-
     hydration payload scripts, the streaming bootstrap) and this app's own theme-flash
     script in `layout.tsx` - a static `headers()` CSP can't hand out a fresh nonce per
     request, only `proxy.ts` can. It puts the nonce on an `x-nonce` request header;
     `layout.tsx` reads it via `headers()` (`next/headers`) and passes it to the `nonce`
     prop on its inline `<script>` - Next.js then automatically applies that same nonce to
     its own inline scripts once it sees the nonce'd CSP response header. If you add
     another inline `<script>` anywhere, it needs the same `nonce={nonce}` treatment or
     it'll get blocked in production the same way (this exact bug shipped once already:
     `script-src 'self'` with no nonce broke the deployed site's own hydration scripts).
  2. **Dev needs the CSP skipped entirely** (`proxy.ts` returns early when
     `NODE_ENV !== "production"`). Turbopack/webpack dev-mode relies on `eval()`/blob-
     worker chunk loading for HMR that ANY CSP here blocks as a browser-level violation -
     invisible to `console.*`-hook-based log capture (not a catchable JS error) - and
     presents as: page paints fine, but **zero** clicks/state updates do anything, with no
     console error to point at. If you ever need to debug "app looks fine but nothing is
     clickable" again with no errors in sight, check for a CSP header first. Don't try to
     scope a dev CSP down to just `'unsafe-eval'`; that alone wasn't sufficient last time
     (still broke) and chasing every dev-mode CSP requirement isn't worth it - the header
     only needs to protect the deployed (production) app.
- **All mutating API routes go through `readJsonBody`** (`lib/requestLimits.ts`) instead of
  raw `request.json()` - caps body size (5MB) and returns a friendly 400/413 instead of
  throwing. Routes that accept arrays (`companies[]`, bulk `ids[]`, import's
  categories/industries) also check `tooManyRows` (5,000/request cap) before processing.
- **`/api/companies/search` is per-IP rate-limited** (30 req/60s, `checkSearchRateLimit` in
  the route, backed by `incrementWithExpiry` in `lib/storage.ts`) - it's unauthenticated and
  calls paid provider APIs with server-held keys. No-ops without Redis (local dev has no
  shared counter to rate-limit against).

## Testing
`tests/csv.test.ts` covers the CSV parser (quoting, header detection, sample round-trip).
`tests/slug.test.ts` and `tests/url.test.ts` cover their respective pure helpers.
`tests/companies.test.ts`, `tests/courses.test.ts`, `tests/industries.test.ts` exercise the
real read/write/lock path (via `INVENSIS_TEST_DATA_DIR`, an env override in
`lib/storage.ts`'s `dataFile()` that points local-file storage at a throwaway `mkdtemp`
directory instead of the app's real `src/data/*.json` seed files - never remove that
override or these tests will start mutating real seed data). They cover the regressions
that motivated them: concurrent writes not losing data (the `mutateDataset` lock),
cascading delete on course/category removal (not leaving orphaned industries/companies),
and industry-rename migrating its companies. No component/UI tests yet.

When testing AI Search manually, default to a free provider (Groq, or OpenRouter's "Free
open models" family) unless the task specifically calls for verifying paid-provider
behavior.

## Scripts (`scripts/`)
CLI helpers that drive the same REST API the UI does - see `docs/ai-search-workflow.md`
for the full AI Search / Enrich workflow write-up and a worked example.
- `discover-companies.mjs` - free, no-key geographic discovery via OpenStreetMap
  Overpass; writes a CSV in the app's Import CSV format.
- `seed-course-companies.mjs` - idempotent bulk-add of a curated (name/country/website)
  company list per course+industry (`DATASETS` in the script), via
  `POST /api/companies/bulk`; `--enrich` optionally follows up with the AI-search enrich
  API. `--dry-run` to preview.
- `apply-research-enrichment.mjs` - writes pre-researched `annualReportUrls`/`aiInsight`/
  `source` directly via `PUT /api/companies/:id` (bypassing the AI enrich call) - used
  when the data came from actual research (e.g. parallel web-research agents) rather
  than an LLM guessing from training data. Matches companies by name per industry.

`seed-course-companies.mjs` and `apply-research-enrichment.mjs` accept `--base <url>`
(default `http://localhost:3000`) to target a deployment instead of local dev.
`discover-companies.mjs` doesn't call the app at all - it writes a standalone CSV for
manual Import CSV.

## Out of scope (not yet built)
Auth (single shared deployment, no login), automated background/scheduled scraping,
per-user data isolation.
