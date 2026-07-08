# Invensis Learning Master Database

Target-account research dashboard for Invensis Learning's training portfolio.

- **Sidebar** — all 59 courses across 6 categories (Project Management, Agile, ITSM, Quality
  Management, DevOps, IT Governance), filterable.
- **Course view** — top target industries for the selected course, each with a rationale.
- **Industry view** — a table of prospect companies: name, country, website, annual-report PDF
  links, and a collapsible **AI insight** on the training they ran last financial year.
- **Add companies** — manually via a form, or via **AI Search** (Anthropic web search) that
  discovers real companies and drafts insights for review.

Ships with 5 real seed companies under **PMP → IT/Technology**.

## Quick start
```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for AI Search
npm run dev                  # http://localhost:3000
```

See [AGENTS.md](AGENTS.md) for architecture, data model, and how to extend.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · lucide-react · @anthropic-ai/sdk

## Status
Phase 1: dashboard + industries + company table + search/add + 5 seed companies.
Later: automated bulk company scraping across all courses, a real database, auth, deployment.
