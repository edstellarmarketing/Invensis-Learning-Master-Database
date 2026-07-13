# Antigravity Research Guide — Company Training/L&D Insight Enrichment

Self-contained instructions for an autonomous agent (Google Antigravity, or any agent with
its own live web-search + page-fetch tools) to research and write real, sourced
"AI Insights" for the company lists in this `research/` folder — **without routing through
this app's `GROQ_API_KEY` integration**, which cannot browse the live web and only ever
produces hedged, unverified guesses (see `docs/ai-search-workflow.md` for why).

Read this whole file before starting. It documents the exact method that was used to
enrich all five files in this folder (Construction, ITES, IT, Manufacturing, Pharma — 500
companies total) and should be followed identically for any future run: adding a new
industry file, re-running a stale one, or filling gaps.

## 1. The problem this solves

Each `PMP_<Industry>_Companies_USA.xlsx` file has six columns:

| Company Name | Country | Website | Annual Report URLs | AI Insights | Source |

`AI Insights` is meant to answer one question for a sales rep at Invensis Learning
(a corporate-training / PMP-certification vendor): **"What does this company already do
for employee training and development, and is that a signal they'd buy corporate
training from us?"**

A row is **not acceptable** if `AI Insights` is:
- Empty
- A generic, interchangeable paragraph that reads the same for every company (the
  telltale sign of a non-browsing model guessing: "Likely: Company X has a well-established
  learning and development infrastructure..." repeated with only the company name swapped)

A row **is acceptable** when the three bullets contain a fact that could only be true of
that specific company — a named internal program, a real number, a cited source document.

## 2. Do not use this app's AI Search / Groq path for this task

`GROQ_API_KEY` (the only key currently set in `.env.local`) cannot do live web search on
its free tier — per `AGENTS.md`, non-live-search providers are explicitly prompted to
hedge every claim with `"Likely:"` and invent nothing, which is exactly the low-value
output this guide exists to replace. Do **not**:

- Call `/api/companies/search` expecting real citations from Groq
- Trust an existing `"Likely:"`-only row as "already researched" — treat it as **empty**

Instead, use your own agent's real web-search and page-fetch tools directly against each
company's own sources. That is the entire point of this workflow: an agent with live
browsing does the verification a free, non-browsing LLM call cannot.

## 3. Inputs

For each industry file, you need per company:
- **row number** (spreadsheet row, header is row 1, data starts row 2)
- **name**
- **website**
- **existing `Annual Report URLs`** if present (a `|`-separated list of SEC EDGAR / IR /
  sustainability-report URLs) — use these as a starting point, don't re-discover from
  scratch if a good URL is already there

Extract this once per file before starting research (Python + `openpyxl`, read-only, is
the fastest way — see §7 for the exact snippet).

## 4. Research method, per company

For each company, spend real effort finding facts from **primary sources**, in this
priority order:

1. The company's most recent **10-K** (SEC EDGAR — search `efts.sec.gov` full-text search
   if you don't have a direct filing URL) or **20-F**/annual report for foreign private
   issuers — read the **Human Capital** / **Human Capital Resources** section specifically.
   SEC EDGAR blocks generic fetchers with a 403; if your fetch tool gets blocked, retry
   with a `curl`-style request carrying a real `User-Agent` header, or fall back to web
   search snippets that quote the same section.
2. The company's own **Sustainability / ESG / Corporate Responsibility report** (often has
   more specific training-hour and $-invested figures than the 10-K).
3. The company's own **careers / "Life at X" / L&D program pages** — this is where named
   internal programs live ("Bechtel University", "Kiewit University", "Jacobs University",
   "HexaVarsity", etc.). These are legitimate primary sources even though they're
   marketing pages — they're the company's own claim about its own program, not a guess.
4. Press releases / investor materials about specific initiatives (e.g. a training-center
   groundbreaking, an upskilling pledge, an M&A integration note).

**Prefer concrete facts over vague claims**, in this priority:
- Training hours (total, or per employee)
- $ invested in training/L&D
- % or count of employees trained / certified
- A **named** internal program, academy, or university (not just "training programs")
- Tuition reimbursement amount/policy
- Certification partnerships relevant to Invensis's business (PMI/PMP, Six Sigma, etc.)
- Leadership-development program structure (cohort length, who's eligible)

Write **exactly 3 pipe-separated bullets** per company, each a standalone fact — no
company name repeated in every bullet, no filler phrases ("the company is committed to...").

```
insights = "fact one | fact two | fact three"
source   = "short description of where each fact came from (report name + fiscal year, or URL)"
```

## 5. Honest hedging — when and how

Some companies in these lists are:
- **Defunct / acquired / merged** (very common in the Pharma and older ITES lists — e.g.
  Celgene → BMS 2019, Allergan → AbbVie 2020, Kite Pharma → Gilead 2017). Confirm this via
  search first, don't assume.
- **Taken private** (no more SEC filings — e.g. Citrix, Proofpoint, RealPage, all
  Thoma-Bravo-era take-privates).
- **Dissolved / bankrupt** (Clovis Oncology, PDL BioPharma, Eiger — confirm via news
  search).
- **Genuinely tiny or opaque** — a 30-person clinical-stage biotech with no careers page
  detail and no 10-K human-capital specifics.

For these, after a **real search attempt has failed** (not a lazy skip), write 3 bullets
prefixed `"Likely:"` each, containing **qualitative, industry-plausible inferences only**
— never invent a specific number, program name, or dollar figure when hedging. State in
the `source` field *why* it's hedged (e.g. "acquired by X in 2019, no standalone filings
since").

```
insights = "Likely: qualitative inference one | Likely: qualitative inference two | Likely: qualitative inference three"
source   = "Company acquired by X in 2019 — no standalone filings since; hedged per lack of public disclosure"
```

This is fundamentally different from Groq's hedging: Groq hedges *everything* because it
never checked; you hedge *only* the specific companies where a genuine check turned up
nothing, and every hedge bullet's `source` field says exactly what was tried and why it
came up empty.

## 6. Duplicates in the source data

Some of the source lists contain the same company twice under different row numbers (e.g.
Toll Brothers, Jacobs Engineering, Quanta Services all appear twice in
`PMP_Construction_Companies_USA.xlsx`, and several ITES consulting firms appear once under
a short name and once under a fuller legal name). This is a pre-existing data-quality
issue in the source lists, not something to silently fix by skipping rows — research each
row independently (the facts may legitimately differ slightly by which year/filing you
land on), and flag it in your final report so a human can decide whether to dedupe the
sheet itself.

## 7. Execution plan for an agent with parallel/background task support

This is exactly how the 500-company run was actually done, and is the recommended shape
for any future run of this size:

1. **Extract** each file's company list to a plain (row, name, website, report_urls)
   structure. Python:
   ```python
   import openpyxl
   wb = openpyxl.load_workbook('PMP_<Industry>_Companies_USA.xlsx', read_only=True)
   ws = wb.worksheets[0]
   rows = list(ws.iter_rows(values_only=True))
   companies = [
       {'row': i, 'name': r[0], 'website': r[2], 'report_urls': r[3]}
       for i, r in enumerate(rows[1:], start=2)
   ]
   ```
2. **Batch** into groups of ~15–25 companies per sub-task. Smaller batches (10–20) give
   more reliable per-company depth; larger batches risk an agent running out of tool
   budget partway through and returning incomplete JSON. For a 100-row file, 5 batches of
   20 worked well.
3. **Dispatch each batch to an independent sub-agent/task**, running in parallel, with a
   prompt that:
   - States the goal (§1) and the "don't use Groq-style guessing" constraint (§2)
   - Lists the batch's companies with row/name/website/report-url
   - Repeats the research-priority order (§4) and hedging rule (§5)
   - Demands the **exact output contract**: a JSON array, one object per company, `row`
     values covering every row given, nothing else in the response:
     ```json
     [{"row": 2, "insights": "fact one | fact two | fact three", "source": "..."}, ...]
     ```
4. **Merge** all batch results by `row` into one dict, and verify before writing:
   - Every row number 2..N+1 is present (no gaps)
   - No `insights` value is empty
   - Spot-check a handful of `"Likely:"` rows actually correspond to defunct/private
     companies, not laziness
5. **Write back** into the xlsx (column 5 = AI Insights, column 6 = Source), preserving
   every other column untouched:
   ```python
   wb = openpyxl.load_workbook('PMP_<Industry>_Companies_USA.xlsx')
   ws = wb.worksheets[0]
   for row, item in merged.items():
       ws.cell(row=row, column=5, value=item['insights'])
       ws.cell(row=row, column=6, value=item['source'])
   wb.save('PMP_<Industry>_Companies_USA.xlsx')
   ```
6. **Verify** the file has zero empty `AI Insights` cells and report the real-vs-hedged
   split (a fully-hedged row = every one of its 3 bullets starts with `"Likely:"`):
   ```python
   rows = list(ws.iter_rows(values_only=True))[1:]
   empty = sum(1 for r in rows if not r[4])
   hedged = sum(1 for r in rows if r[4] and all(p.strip().startswith('Likely:') for p in r[4].split('|')))
   print(f'total={len(rows)} hedged={hedged} empty={empty}')
   ```
   `empty` must be `0`. A high `hedged` count is fine and expected for industries with many
   small/defunct/private companies (Pharma ran ~32% hedged; Manufacturing ran 0% because
   every company there was a large, well-disclosed public filer).

## 8. Windows/WSL path gotcha (only relevant if scripting the merge step)

If you're running Python for the extract/merge/write steps from a POSIX-style shell
(Git Bash / WSL) on Windows, **`/c/Users/...`-style paths are a shell convention, not a
Python one** — plain CPython on Windows needs the native `C:\Users\...` form. If a script
mysteriously can't find a file that `ls` just showed you, this path-format mismatch is the
first thing to check.

## 9. When you're done

Update this checklist per file and report the final `total / real / hedged / empty` counts
for all five (or however many) files, same shape as this table:

| File | Companies | Real/sourced | Honestly-hedged |
|---|---|---|---|
| PMP_Construction_Companies_USA.xlsx | 100 | 91 | 9 |
| PMP_ITES_Companies_USA.xlsx | 100 | 92 | 8 |
| PMP_IT_Companies_USA.xlsx | 100 | 89 | 11 |
| PMP_Manufacturing_Companies_USA.xlsx | 100 | 100 | 0 |
| PMP_Pharma_Companies_USA.xlsx | 100 | 68 | 32 |

Do not commit or push without being asked — per this project's own git workflow rules,
that's a separate, explicit step.
