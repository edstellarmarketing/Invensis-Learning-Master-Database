# Project Log — Invensis Learning Master Database

Chronological record of what was built and why. Newest first.

## 2026-07-08 — Session 3: Dashboard, filters, export/import, Vercel prep
- Dashboard home: stat cards (courses / categories / industries / companies), research-coverage
  list (populated course × industry combos), recently-added companies, category quick links.
- Companies table: country dropdown filter, annual-report presence filter, CSV export of the
  currently filtered rows (Excel-safe, BOM + quoted).
- Global data tools on the dashboard: full-DB JSON export (`GET /api/export`) and validated
  import (`POST /api/import`) with merge (upsert by id / dedupe by name) or replace modes.
- Vercel readiness: write failures on read-only filesystems (EROFS/EACCES/EPERM) now return a
  clear actionable error instead of a 500; deployment notes added to README.
- New docs: this PROJECTLOG.md; README rewritten with features + deploy guide.

## 2026-07-08 — Session 2: CRUD, per-course industries, design refresh
- Industries moved to `src/data/industries.json`: 5 curated target industries for each of the
  59 courses (tailored per course, agent-researched, programmatically verified).
- Industries CRUD: `/api/industries` (GET/POST/PUT/DELETE) + inline "Manage" mode on the tabs.
  Rename migrates company slugs; delete cascades to companies; duplicates rejected.
- Companies CRUD completed: `/api/companies/[id]` (PUT/DELETE) + per-row edit/delete UI.
- Design system: slate + indigo semantic tokens (WCAG AA in light and dark), focus rings,
  elevation scale, tabular numerals, reduced-motion support.

## 2026-07-08 — Session 1: Phase-1 dashboard
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
- Database backend (required for writes on Vercel; likely Vercel Postgres or Turso).
- Automated bulk company scraping across all courses (directories, magazines, databases).
- Auth for team use.
