#!/usr/bin/env node
// Seed a course's industries with a curated set of real prospect companies, then
// (optionally) use the app's AI Search enrich API to fill annual reports + AI insights.
//
// This is the automated equivalent of the manual "AI Search -> Enrich -> Add all" UI
// flow documented in docs/ai-search-workflow.md - it bulk-adds discovered companies and
// can enrich them, driving the same REST routes the UI does.
//
// Idempotent: re-running skips companies already saved (name match, case-insensitive)
// for each course x industry, so it never creates duplicates.
//
// Prereq: the app running locally (npm run dev) or any deployment URL via --base.
//
// Usage:
//   node scripts/seed-course-companies.mjs                       # add PMP companies (localhost)
//   node scripts/seed-course-companies.mjs --enrich              # add, then fill reports + insights
//   node scripts/seed-course-companies.mjs --base https://... --course pmp-certification-training
//   node scripts/seed-course-companies.mjs --dry-run             # show what would be added, no writes
//   node scripts/seed-course-companies.mjs --help
//
// The curated dataset below uses only countries from src/lib/countries.ts (the 50-country
// target list - note it does NOT include India) and real corporate websites. Reports and
// insights are intentionally left blank; the --enrich pass (or the UI "Refresh reports &
// insights" action) fills them, and gives the best results with a live-web-search provider
// (Claude or OpenRouter medium/high) rather than the no-browsing free tiers.

// courseSlug -> industrySlug -> [{ companyName, country, website }]
const DATASETS = {
  "pmp-certification-training": {
    manufacturing: [
      { companyName: "Siemens", country: "Germany", website: "https://www.siemens.com" },
      { companyName: "Volkswagen Group", country: "Germany", website: "https://www.volkswagen-group.com" },
      { companyName: "Toyota Motor Corporation", country: "Japan", website: "https://global.toyota" },
      { companyName: "Airbus", country: "France", website: "https://www.airbus.com" },
      { companyName: "Robert Bosch", country: "Germany", website: "https://www.bosch.com" },
      { companyName: "Nestlé", country: "Switzerland", website: "https://www.nestle.com" },
      { companyName: "Unilever", country: "United Kingdom", website: "https://www.unilever.com" },
      { companyName: "Koninklijke Philips", country: "Netherlands", website: "https://www.philips.com" },
      { companyName: "Volvo Group", country: "Sweden", website: "https://www.volvogroup.com" },
      { companyName: "Michelin", country: "France", website: "https://www.michelin.com" },
    ],
    it: [
      { companyName: "SAP", country: "Germany", website: "https://www.sap.com" },
      { companyName: "Nokia", country: "Finland", website: "https://www.nokia.com" },
      { companyName: "Ericsson", country: "Sweden", website: "https://www.ericsson.com" },
      { companyName: "ASML", country: "Netherlands", website: "https://www.asml.com" },
      { companyName: "Dassault Systèmes", country: "France", website: "https://www.3ds.com" },
      { companyName: "Amadeus IT Group", country: "Spain", website: "https://www.amadeus.com" },
      { companyName: "Atos", country: "France", website: "https://www.atos.net" },
      { companyName: "Sopra Steria", country: "France", website: "https://www.soprasteria.com" },
      { companyName: "Temenos", country: "Switzerland", website: "https://www.temenos.com" },
      { companyName: "TeamViewer", country: "Germany", website: "https://www.teamviewer.com" },
    ],
    ites: [
      { companyName: "Teleperformance", country: "France", website: "https://www.teleperformance.com" },
      { companyName: "Concentrix", country: "United States", website: "https://www.concentrix.com" },
      { companyName: "Capita", country: "United Kingdom", website: "https://www.capita.com" },
      { companyName: "Serco", country: "United Kingdom", website: "https://www.serco.com" },
      { companyName: "Transcom", country: "Sweden", website: "https://www.transcom.com" },
      { companyName: "Foundever", country: "United States", website: "https://www.foundever.com" },
      { companyName: "Arvato", country: "Germany", website: "https://www.arvato.com" },
      { companyName: "TTEC", country: "United States", website: "https://www.ttec.com" },
      { companyName: "Comdata", country: "Italy", website: "https://www.comdatagroup.com" },
      { companyName: "Webhelp", country: "France", website: "https://www.webhelp.com" },
    ],
    pharma: [
      { companyName: "Novartis", country: "Switzerland", website: "https://www.novartis.com" },
      { companyName: "Roche", country: "Switzerland", website: "https://www.roche.com" },
      { companyName: "Bayer", country: "Germany", website: "https://www.bayer.com" },
      { companyName: "Sanofi", country: "France", website: "https://www.sanofi.com" },
      { companyName: "GSK", country: "United Kingdom", website: "https://www.gsk.com" },
      { companyName: "AstraZeneca", country: "United Kingdom", website: "https://www.astrazeneca.com" },
      { companyName: "Novo Nordisk", country: "Denmark", website: "https://www.novonordisk.com" },
      { companyName: "Merck KGaA", country: "Germany", website: "https://www.merckgroup.com" },
      { companyName: "Takeda Pharmaceutical", country: "Japan", website: "https://www.takeda.com" },
      { companyName: "Boehringer Ingelheim", country: "Germany", website: "https://www.boehringer-ingelheim.com" },
    ],
    construction: [
      { companyName: "Vinci", country: "France", website: "https://www.vinci.com" },
      { companyName: "Bouygues", country: "France", website: "https://www.bouygues.com" },
      { companyName: "ACS Group", country: "Spain", website: "https://www.grupoacs.com" },
      { companyName: "Ferrovial", country: "Spain", website: "https://www.ferrovial.com" },
      { companyName: "Skanska", country: "Sweden", website: "https://www.skanska.com" },
      { companyName: "Hochtief", country: "Germany", website: "https://www.hochtief.com" },
      { companyName: "Bechtel", country: "United States", website: "https://www.bechtel.com" },
      { companyName: "Balfour Beatty", country: "United Kingdom", website: "https://www.balfourbeatty.com" },
      { companyName: "Strabag", country: "Austria", website: "https://www.strabag.com" },
      { companyName: "Royal BAM Group", country: "Netherlands", website: "https://www.bam.com" },
    ],
  },
};

function parseArgs(argv) {
  const args = { base: "http://localhost:3000", course: "pmp-certification-training" };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--help" || k === "-h") return { help: true };
    if (k === "--enrich") args.enrich = true;
    else if (k === "--dry-run") args.dryRun = true;
    else if (k === "--base") args.base = argv[++i];
    else if (k === "--course") args.course = argv[++i];
  }
  return args;
}

const ENRICH_CHUNK = 25; // matches the enrich route's per-call cap

async function existingNames(base, courseSlug, industrySlug) {
  const url = `${base}/api/companies?courseSlug=${encodeURIComponent(courseSlug)}&industrySlug=${encodeURIComponent(industrySlug)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET companies failed (${res.status})`);
  const list = await res.json();
  return new Set(list.map((c) => c.companyName.toLowerCase().trim()));
}

async function bulkAdd(base, courseSlug, industrySlug, companies) {
  const res = await fetch(`${base}/api/companies/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseSlug, industrySlug, companies }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `bulk add failed (${res.status})`);
  return data.companies;
}

// Fill annual reports + AI insights for the given saved companies via the AI Search enrich
// API, then PUT the results back. Skips any company the provider returned nothing for so a
// miss never overwrites existing data - identical to the UI's "Refresh reports & insights".
async function enrichCompanies(base, courseSlug, industrySlug, industryName, companies) {
  let updated = 0;
  for (let i = 0; i < companies.length; i += ENRICH_CHUNK) {
    const chunk = companies.slice(i, i + ENRICH_CHUNK);
    const res = await fetch(`${base}/api/companies/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug,
        industrySlug,
        industryName,
        provider: "auto",
        fields: { website: false, country: false, annualReportUrls: true, aiInsight: true },
        enrich: chunk.map((c) => ({ companyName: c.companyName, website: c.website })),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `enrich failed (${res.status})`);
    const byName = new Map((data.candidates ?? []).map((c) => [c.companyName.toLowerCase().trim(), c]));
    for (const c of chunk) {
      const cand = byName.get(c.companyName.toLowerCase().trim());
      const reports = cand?.annualReportUrls ?? [];
      const insights = cand?.aiInsight ?? [];
      if (reports.length === 0 && insights.length === 0) continue;
      const put = await fetch(`${base}/api/companies/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annualReportUrls: reports, aiInsight: insights, ...(cand.source ? { source: cand.source } : {}) }),
      });
      if (put.ok) updated += 1;
    }
  }
  return updated;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(
      [
        "Seed a course's industries with curated prospect companies (idempotent).",
        "",
        "Options:",
        "  --base <url>     app base URL (default http://localhost:3000)",
        "  --course <slug>  course slug (default pmp-certification-training)",
        "  --enrich         after adding, fill reports + insights via AI Search enrich",
        "  --dry-run        print planned additions without writing",
        "",
        `Available datasets: ${Object.keys(DATASETS).join(", ")}`,
      ].join("\n"),
    );
    return;
  }

  const dataset = DATASETS[args.course];
  if (!dataset) {
    console.error(`No dataset for course "${args.course}". Available: ${Object.keys(DATASETS).join(", ")}`);
    process.exit(1);
  }

  let totalAdded = 0;
  for (const [industrySlug, companies] of Object.entries(dataset)) {
    const seen = await existingNames(args.base, args.course, industrySlug);
    const toAdd = companies.filter((c) => !seen.has(c.companyName.toLowerCase().trim()));
    if (toAdd.length === 0) {
      console.log(`${industrySlug}: already has all ${companies.length} - skipping`);
      continue;
    }
    if (args.dryRun) {
      console.log(`${industrySlug}: would add ${toAdd.length} -> ${toAdd.map((c) => c.companyName).join(", ")}`);
      continue;
    }
    const saved = await bulkAdd(args.base, args.course, industrySlug, toAdd);
    totalAdded += saved.length;
    console.log(`${industrySlug}: added ${saved.length} (now ${seen.size + saved.length} total)`);

    if (args.enrich) {
      const industryName = industrySlug.toUpperCase();
      const n = await enrichCompanies(args.base, args.course, industrySlug, industryName, saved);
      console.log(`${industrySlug}: enriched ${n}/${saved.length} with reports + insights`);
    }
  }

  if (!args.dryRun) console.log(`\nDone. Added ${totalAdded} companies to ${args.course}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
