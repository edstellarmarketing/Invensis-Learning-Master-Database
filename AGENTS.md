# AGENTS.md — Invensis Learning Master Database

## Overview
Sales/marketing target-account research dashboard. For each Invensis Learning course it shows
the top target industries, and for each industry a table of prospect companies with their
country, website, annual-report PDF links, and a collapsible AI insight on the training they
ran last financial year.

## Stack
- Next.js 16.2.9 (App Router), React 19, TypeScript (strict)
- Tailwind CSS v4 (CSS-variable theming, no `dark:` classes — toggle `data-theme`)
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
- `ANTHROPIC_API_KEY` — enables `/api/companies/search` (AI discovery). Without it the dashboard,
  seed data, and manual Add Company all still work. **Paid** (Anthropic API usage).
- `ANTHROPIC_MODEL` — defaults to `claude-sonnet-5`.

## Layout
```
src/
  app/
    layout.tsx                       # Sidebar + main
    page.tsx                         # landing
    [courseSlug]/page.tsx            # industries grid
    [courseSlug]/[industrySlug]/page.tsx   # industries + companies table
    api/companies/route.ts           # GET list / POST add -> src/data/companies.json
    api/companies/search/route.ts    # POST AI discovery (needs API key)
  components/  Sidebar, IndustryGrid, CompaniesTable, AddCompanyForm, CompanySearch
  lib/         courses.ts, industries.ts, slug.ts, companies.ts
  data/        companies.json        # file-backed store (Phase 1; not a DB)
```

## Data model
- **Courses** (`lib/courses.ts`): 6 categories × 59 courses (authoritative, from the sibling
  "Invensis Learning Course Content Generator" `category_db.py`, cross-checked vs the live
  sitemap). Drives the sidebar.
- **Industries** (`lib/industries.ts`): one curated default set per category + optional
  per-course overrides. Industry names are slugified for URLs via `lib/slug.ts`.
- **Companies** (`data/companies.json`): keyed by `courseSlug` + `industrySlug`.

## How to extend
- **Add a company**: use the UI (Add Company / AI Search) or append to `src/data/companies.json`.
- **Change a course's industries**: edit `INDUSTRIES_BY_COURSE` override in `lib/industries.ts`.
- **Add a course/category**: edit `CATEGORIES` in `lib/courses.ts`.

## Gotchas (Next 16)
- Route `params` are async — `const { courseSlug } = await params;`.
- Company store uses Node `fs`, so those API routes set `runtime = "nodejs"`. Writes work in
  `next dev` / node runtime; not on edge or read-only serverless FS.

## Out of scope (later phases)
Automated bulk scraping across all 59 courses, a real database, auth, deployment.
