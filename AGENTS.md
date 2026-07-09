# AGENTS.md - Invensis Learning Master Database

## Overview
Sales/marketing target-account research dashboard. For each Invensis Learning course it shows
the top target industries, and for each industry a table of prospect companies with their
country, website, annual-report PDF links, and a collapsible AI insight on the training they
ran last financial year.

## Stack
- Next.js 16.2.9 (App Router), React 19, TypeScript (strict)
- Tailwind CSS v4 (CSS-variable theming, no `dark:` classes - toggle `data-theme`)
- `lucide-react` icons
- `@anthropic-ai/sdk` for the optional AI company-search route

## Run / build
```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint
```

## Env vars
Copy `.env.example` → `.env.local`. All optional:
- `ANTHROPIC_API_KEY` - enables `/api/companies/search` via Claude (web-search tool).
  **Paid** (Anthropic API usage). `ANTHROPIC_MODEL` defaults to `claude-sonnet-5`. Must be
  a real Anthropic key (starts `sk-ant-`) - an OpenRouter key here 401s, use
  `OPENROUTER_API_KEY` instead.
- `OPENROUTER_API_KEY` - AI Search via OpenRouter (openrouter.ai). `OPENROUTER_MODEL`
  defaults to `anthropic/claude-3.5-sonnet:online` (the `:online` suffix enables
  OpenRouter's paid web-search plugin, live-verified like the direct Claude provider); swap
  for any `:free` model slug for $0 cost with no live search. Called via plain fetch
  (OpenAI-compatible), no SDK dep.
- `GROQ_API_KEY` - Groq fallback for the same route (free tier). Used when neither Claude
  nor OpenRouter keys are set, or the user picks Groq in the UI. `GROQ_MODEL` defaults to
  `llama-3.3-70b-versatile` (answers from model knowledge, no live browsing - reliable on
  the free tier; `groq/compound` has web search but its agentic tool chain exhausts the
  free 30k TPM limit on a single call). Called via plain fetch (OpenAI-compatible), no SDK
  dep.
- Auto order: Claude -> OpenRouter -> Groq. Prompt is provider-aware via `liveSearch`
  (true for Claude/OpenRouter, false for Groq): non-live-search results are hedged
  ("Likely:" prefix, empty report URLs unless confident) since they aren't verified.
- Search route accepts `provider` ("auto"|"claude"|"groq"), `count` (1-100), `size`, and
  excludes already-saved companies for the course+industry (server-side dedupe).
  Without any key the dashboard, seed data, CSV import, and manual Add Company all still work.

## Layout
```
src/
  app/
    layout.tsx                       # Sidebar + main
    page.tsx                         # landing
    [courseSlug]/page.tsx            # industries grid
    [courseSlug]/[industrySlug]/page.tsx   # industries + companies table
    api/companies/route.ts           # GET list / POST add
    api/companies/[id]/route.ts      # PUT edit / DELETE
    api/companies/bulk/route.ts      # POST bulk add (CSV import) / DELETE bulk by ids
    api/companies/search/route.ts    # POST AI discovery (needs API key)
    api/industries/route.ts          # GET / POST / PUT / DELETE per course
    api/export/route.ts              # GET full-DB JSON download
    api/import/route.ts              # POST restore/merge an export (merge|replace)
  components/  Sidebar, IndustryTabs (tabs + manage CRUD), CompaniesTable (filters,
               CSV export, row edit/delete), AddCompanyForm (add + edit modes),
               CompanySearch, DataTools (export/import UI)
  lib/         courses.ts, courseSummaries.ts, industries.ts, slug.ts, companies.ts,
               csv.ts (quote-aware parser + sample; tested in tests/csv.test.ts)
  data/        companies.json, industries.json   # file-backed stores (Phase 1; not a DB)
```

## Data model
- **Courses** (`lib/courses.ts`): 6 categories × 59 courses (authoritative, from the sibling
  "Invensis Learning Course Content Generator" `category_db.py`, cross-checked vs the live
  sitemap). Drives the sidebar.
- **Industries** (`data/industries.json`): Record<courseSlug, Industry[]> - 5 curated
  industries per course, all 59 seeded. CRUD via `/api/industries` or the "Manage" toggle
  on any course page. Renaming an industry re-slugs it and migrates its companies;
  deleting cascades to its companies. Names are slugified for URLs via `lib/slug.ts`.
- **Companies** (`data/companies.json`): keyed by `courseSlug` + `industrySlug`. Full CRUD:
  add (form or AI Search), edit (pencil icon), delete (trash icon, confirm prompt).

## How to extend
- **Add/edit/delete a company or industry**: use the UI, or the REST routes above.
- **Add a course/category**: edit `CATEGORIES` in `lib/courses.ts`, then add its 5 industries
  to `src/data/industries.json`.

## Gotchas (Next 16 / Vercel)
- Route `params` are async - `const { courseSlug } = await params;`.
- Data stores use Node `fs`, so API routes set `runtime = "nodejs"`.
- **Storage adapter** (`lib/storage.ts`): Upstash Redis when `UPSTASH_REDIS_REST_URL`/`TOKEN`
  are set (Vercel Storage integration - required for writes in production), local JSON files in
  `src/data/` otherwise. Datasets stored whole under `invensis-master-db:companies` /
  `:industries`; first KV read seeds from the bundled JSON. Read-only deploys without the
  integration get a clear "connect a database" error on writes (friendlyWriteError).
- Home + course pages are `force-dynamic` (stats and redirects reflect live JSON data).

## Out of scope (later phases)
Automated bulk scraping across all 59 courses, a real database, auth, deployment.
