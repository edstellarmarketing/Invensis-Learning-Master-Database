# Invensis Learning Master Database

Target-account research dashboard for Invensis Learning's training portfolio. For every course:
who to sell to (top industries) and which companies to target, with annual-report evidence of
their training activity.

## Features

- **Dashboard** — stat cards (59 courses, 6 categories, industries, companies), research
  coverage (which course × industry combos are populated), recently added companies.
- **Sidebar navigation** — all 59 courses grouped by category, collapsible, filterable.
- **Industry tabs per course** — 5 curated target industries for every course, each with a
  rationale (hover). Full inline CRUD via the "Manage" toggle.
- **Course header** — one-line course summary plus a direct link to the live
  invensislearning.com course page.
- **Companies table** — Company Name (links to website) · Country · Annual Report PDFs ·
  collapsible AI Insights (4–5 bullets on last FY's training). Per-row edit/delete.
- **Bulk operations** — CSV import (sample template downloadable; Excel: save as CSV UTF-8),
  select-all checkboxes with bulk delete.
- **Filters** — text search, country dropdown, annual-report presence.
- **Export / import**
  - Table → CSV of the currently filtered rows (re-importable format).
  - Full database → JSON export (`/api/export`) and validated import (`/api/import`)
    with merge or replace modes.
- **Add companies** — manual form, or **AI Search** (Anthropic web search) that discovers real
  companies and drafts insights for review before adding.

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
2. Optionally set `ANTHROPIC_API_KEY` (and `ANTHROPIC_MODEL`) in Project → Settings →
   Environment Variables to enable AI Search.
3. Deploy. Reads work fully; the seeded data ships inside the build.

> **Important limitation:** the Phase-1 data store is two JSON files
> (`src/data/companies.json`, `src/data/industries.json`). Vercel's serverless filesystem is
> **read-only**, so add/edit/delete/import will return a clear "saving is disabled" error in
> production. Workflow for now: edit data locally (or via JSON import locally), commit, and
> redeploy. A database backend (Vercel Postgres / Turso) is the planned fix — see
> [PROJECTLOG.md](PROJECTLOG.md) backlog.

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

- [AGENTS.md](AGENTS.md) — architecture, data model, conventions, gotchas (read first if you're
  an AI agent or new contributor).
- [PROJECTLOG.md](PROJECTLOG.md) — session-by-session build history and backlog.
