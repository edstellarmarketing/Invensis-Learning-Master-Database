# Invensis Learning Master Database

Target-account research dashboard for Invensis Learning's training portfolio. For every course:
who to sell to (top industries) and which companies to target, with annual-report evidence of
their training activity.

## Features

- **Dashboard** - stat cards (59 courses, 6 categories, industries, companies), research
  coverage (which course × industry combos are populated), recently added companies.
- **Sidebar navigation** - all 59 courses grouped by category, collapsible, filterable.
- **Industry tabs per course** - 5 curated target industries for every course, each with a
  rationale (hover). Full inline CRUD via the "Manage" toggle.
- **Course header** - one-line course summary plus a direct link to the live
  invensislearning.com course page.
- **Companies table** - Company Name (links to website) · Country · Annual Report PDFs ·
  collapsible AI Insights (4–5 bullets on last FY's training). Per-row edit/delete.
- **Bulk operations** - CSV import (sample template downloadable; Excel: save as CSV UTF-8),
  select-all checkboxes with bulk delete.
- **Filters** - text search, country dropdown, annual-report presence.
- **Export / import**
  - Table → CSV of the currently filtered rows (re-importable format).
  - Full database → JSON export (`/api/export`) and validated import (`/api/import`)
    with merge or replace modes.
- **Add companies** - manual form, or **AI Search** that discovers real companies and drafts
  insights for review before adding. Up to 100 companies per search with keywords, country,
  and company-size filters; already-saved companies are auto-excluded; add results one by one
  or all at once. Providers: **Claude** (Anthropic web search) with **Groq** as fallback -
  selectable in the UI (Auto / Claude / Groq).

Ships seeded with 5 real companies under PMP → IT/Technology (Infosys, TCS, Accenture, Wipro,
Capgemini) with real annual-report URLs.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: ANTHROPIC_API_KEY enables AI Search
npm run dev                  # http://localhost:3000
```

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel (framework auto-detected: Next.js).
2. **Enable saving (required for CRUD/CSV import in production):** in the Vercel project go to
   **Storage → Create Database → Upstash (Redis)** (free tier), and connect it to the project.
   This auto-injects `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
3. Optionally set `ANTHROPIC_API_KEY` (Claude) and/or `GROQ_API_KEY` (Groq, free tier at
   console.groq.com) to enable AI Search. With both set, Auto prefers Claude and the UI can
   switch per search. Optional model overrides: `ANTHROPIC_MODEL`, `GROQ_MODEL`.
4. Deploy (or redeploy after adding the integration).

**How storage works** (`src/lib/storage.ts`): with Upstash configured, both datasets live in
Redis (keys `invensis-master-db:companies` / `:industries`) and every feature - add/edit/delete,
CSV bulk import, bulk delete, industry CRUD, JSON import - works on Vercel. On first run the
database is seeded from the bundled JSON. Without the integration, local dev reads/writes the
JSON files in `src/data/`, and a read-only deploy shows a clear "connect a database" message
on writes.

## Geographic discovery (free, no key)

Find companies by industry + city via OpenStreetMap and import them:

```bash
node scripts/discover-companies.mjs --industry it --city "Bengaluru" --country India
# -> discovered-companies.csv  (then: course page -> Import CSV)
```

Presets: it, software, construction, healthcare, bfsi, logistics, manufacturing, telecom,
education, energy. Raw OSM filters via `--tag key=value`. Names/websites come from OSM;
fill annual reports + insights afterwards with AI Search.

## API

| Route | Methods | Purpose |
|---|---|---|
| `/api/companies` | GET, POST | List (by `courseSlug`+`industrySlug`) / add |
| `/api/companies/[id]` | PUT, DELETE | Edit / remove a company |
| `/api/companies/bulk` | POST, DELETE | Bulk add (CSV import) / bulk delete by ids |
| `/api/companies/search` | POST | AI company discovery (needs `ANTHROPIC_API_KEY`) |
| `/api/industries` | GET, POST, PUT, DELETE | Per-course industry CRUD |
| `/api/export` | GET | Full-DB JSON download |
| `/api/import` | POST | Restore/merge a previous export |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 (semantic CSS-variable
theme, light/dark) · lucide-react · @anthropic-ai/sdk

## Docs

- [AGENTS.md](AGENTS.md) - architecture, data model, conventions, gotchas (read first if you're
  an AI agent or new contributor).
- [PROJECTLOG.md](PROJECTLOG.md) - session-by-session build history and backlog.
