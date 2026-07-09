#!/usr/bin/env node
// Geographic company discovery via OpenStreetMap Overpass API (free, no key).
// Emits a CSV in the app's Import CSV format: use the Import CSV button on any
// course x industry table to load the results, then let AI Search / manual research
// fill annual reports and insights.
//
// Usage:
//   node scripts/discover-companies.mjs --industry it --city "Bengaluru" --country India
//   node scripts/discover-companies.mjs --tag office=lawyer --city "London" --country "United Kingdom"
//   node scripts/discover-companies.mjs --help
//
// Options:
//   --industry <preset>   one of: it, software, construction, healthcare, bfsi,
//                         logistics, manufacturing, telecom, education, energy
//   --tag <key=value>     raw OSM tag filter (overrides --industry)
//   --city <name>         city/area name as it appears in OSM (required)
//   --country <name>      country label written into the CSV rows (required)
//   --limit <n>           max companies in the CSV (default 100)
//   --out <file>          output path (default ./discovered-companies.csv)

const PRESETS = {
  it: ["office=it"],
  software: ["office=software", "office=it"],
  construction: ["office=construction_company", "office=construction"],
  healthcare: ["amenity=hospital", "healthcare=hospital"],
  bfsi: ["office=financial", "office=insurance", "amenity=bank"],
  logistics: ["office=logistics", "industrial=warehouse"],
  manufacturing: ["industrial=factory", "man_made=works"],
  telecom: ["office=telecommunication"],
  education: ["office=educational_institution", "amenity=college"],
  energy: ["office=energy_supplier", "power=plant"],
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--help" || key === "-h") return { help: true };
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = argv[i + 1];
    i++;
  }
  return args;
}

function csvEscape(s) {
  return `"${String(s ?? "").replace(/"/g, '""')}"`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.industry && !args.tag) || !args.city || !args.country) {
    console.log(
      [
        "Discover companies by location via OpenStreetMap (free).",
        "",
        "Required: --city <name> --country <name> and one of:",
        `  --industry <${Object.keys(PRESETS).join("|")}>`,
        "  --tag <key=value>",
        "Optional: --limit <n=100> --out <file=./discovered-companies.csv>",
        "",
        'Example: node scripts/discover-companies.mjs --industry it --city "Bengaluru" --country India',
      ].join("\n"),
    );
    process.exit(args.help ? 0 : 1);
  }

  const tags = args.tag ? [args.tag] : PRESETS[String(args.industry).toLowerCase()];
  if (!tags) {
    console.error(`Unknown industry preset "${args.industry}". Presets: ${Object.keys(PRESETS).join(", ")}`);
    process.exit(1);
  }
  const limit = Math.max(1, Number(args.limit) || 100);
  const out = args.out || "./discovered-companies.csv";

  const tagFilters = tags
    .map((t) => {
      const [k, v] = t.split("=");
      return ["node", "way", "relation"].map((el) => `${el}["${k}"="${v}"](area.a);`).join("\n");
    })
    .join("\n");

  const query = `[out:json][timeout:60];
area["name"="${args.city}"]->.a;
(
${tagFilters}
);
out tags ${limit * 3};`;

  console.error(`Querying Overpass for ${tags.join(" / ")} in ${args.city}...`);
  // Public mirrors; some reject requests without a descriptive User-Agent.
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  let data = null;
  let lastErr = "";
  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "invensis-master-db-discovery/1.0 (company research script)",
      },
      body: "data=" + encodeURIComponent(query),
    });
    if (res.ok) {
      data = await res.json();
      break;
    }
    lastErr = `${endpoint} -> ${res.status}: ${(await res.text()).slice(0, 200)}`;
    console.error(`Mirror failed (${res.status}), trying next...`);
  }
  if (!data) {
    console.error(`All Overpass mirrors failed. Last error: ${lastErr}`);
    process.exit(1);
  }

  const seen = new Set();
  const rows = [];
  for (const el of data.elements ?? []) {
    const t = el.tags ?? {};
    const name = (t.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const website = (t.website || t["contact:website"] || t.url || "").trim();
    rows.push([name, args.country, website, "", "", "OpenStreetMap (Overpass)"]);
    if (rows.length >= limit) break;
  }

  if (rows.length === 0) {
    console.error(
      "No companies found. Try a different --city spelling (OSM area names), another preset, or a raw --tag.",
    );
    process.exit(1);
  }

  const header = ["Company Name", "Country", "Website", "Annual Report URLs", "AI Insights", "Source"];
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(out, "﻿" + csv, "utf-8");
  console.error(`Wrote ${rows.length} companies -> ${out}`);
  console.error("Import via the app: course page -> Import CSV.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
