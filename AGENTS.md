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

## Layout
```
src/
  app/
    layout.tsx                       # server component: reads categories, renders Sidebar + TopBar + main
    loading.tsx                      # fallback while force-dynamic pages fetch (Redis can be slow)
    not-found.tsx                    # themed 404
    page.tsx                         # dashboard: stats, coverage, recent companies, Data tools, category cards
    [courseSlug]/page.tsx            # redirects to the course's first industry
    [courseSlug]/[industrySlug]/page.tsx   # course header + industry tabs + companies table
    api/companies/route.ts           # GET list / POST add
    api/companies/[id]/route.ts      # PUT edit / DELETE
    api/companies/bulk/route.ts      # POST bulk add (CSV import) / DELETE bulk by ids
    api/companies/search/route.ts    # POST AI discovery + enrich (needs a provider key)
    api/industries/route.ts          # GET / POST / PUT / DELETE per course
    api/courses/route.ts             # POST add course / PUT rename+feature+move / DELETE
    api/categories/route.ts          # GET all / POST add / PUT rename / DELETE
    api/export/route.ts              # GET full-DB JSON download (v2: includes categories)
    api/import/route.ts              # POST restore/merge an export (merge|replace)
  components/
    Sidebar.tsx           # featured/additional course tree; mobile off-canvas drawer below md
    TopBar.tsx             # Help + theme toggle
    HelpDialog.tsx / ThemeToggle.tsx
    CoursesManager.tsx     # course/category CRUD modal, opened from Sidebar's "Manage courses"
    IndustryTabs.tsx       # industry tabs + inline manage CRUD
    CompaniesTable.tsx     # filters (search/country/report), pagination, bulk select/delete, CSV
    CountryFilter.tsx      # searchable multi-select country popover (50-country master list)
    CompanySearch.tsx      # AI Search panel: provider/model/tier, fields, multi-course, enrich
    AddCompanyForm.tsx     # add + edit modes
    DataTools.tsx           # full-DB JSON export/import
  lib/
    courses.ts             # ASYNC Redis/JSON-backed courses+categories CRUD (see Data model)
    industries.ts           # ASYNC Redis/JSON-backed industries CRUD
    companies.ts             # ASYNC Redis/JSON-backed companies CRUD
    storage.ts               # the actual Redis-vs-local-file adapter both of the above call
    courseSummaries.ts, popularIndustries.ts, countries.ts, categoryMeta.ts, slug.ts
    csv.ts                    # quote-aware parser + sample; tested in tests/csv.test.ts
    useDialogA11y.ts          # shared modal hook: Escape closes, body-scroll lock, focus restore
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
  delete (row selection).

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

## Testing
`tests/csv.test.ts` covers the CSV parser (quoting, header detection, sample round-trip).
No component tests yet. When testing AI Search manually, default to a free provider
(Groq, or OpenRouter's "Free open models" family) unless the task specifically calls for
verifying paid-provider behavior.

## Out of scope (not yet built)
Auth (single shared deployment, no login), automated background/scheduled scraping,
per-user data isolation.
