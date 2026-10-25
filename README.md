# Body

Web app that colors eight body parts by how much work they did today, as a
multiple of an average US non-exerciser day. Alpha v0.7: Vite + React + TypeScript,
model and data from `reference/` → `src/data`.

**Live:** https://vasilismavratsas.github.io/Body/

## Architecture

| Path         | Role                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `src/core/`  | Pure TypeScript model v0.7 (Monte Carlo, share rule, pRed, saturated) + Web Worker. No React.      |
| `src/data/`  | Versioned JSON numbers with `status` and `sourceRefs`. 25 activities + 14 lifts × 3 intensities.   |
| `src/ui/`    | React UI: body map, searchable activity picker, lift sub-form, detail panel, methods.              |
| `reference/` | Source of truth: `spec.md` v0.7, `data-model.md`, `model.R`, CSVs, `demo_output_v7.txt`, fixtures. |

**Rule:** never invent physiological numbers. Values live in `src/data` (converted from
`reference/data`). The release guard fails on `GAP` / `PLACEHOLDER` in structured status
fields only (free-text note/source/search_terms are not scanned).

## Scripts

```bash
npm install
npm run ref:verify     # fail if v0.7 reference files are missing
npm run data:convert   # reference CSVs → src/data JSON
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

## Data sources and attribution

Baseline time-use statistics are weighted aggregates (means, SDs, percentiles, participation rates; no individual records) derived from:

Sarah M. Flood, Liana C. Sayer, and Daniel Backman. American Time Use Survey Data Extract Builder: Version 3.3 [dataset]. College Park, MD: University of Maryland and Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D060.V3.3

Underlying ATUS data are provided by the U.S. Bureau of Labor Statistics. IPUMS ATUS microdata are not redistributed in this repository; obtain them from https://www.atusdata.org under the IPUMS terms of use.

MET values: Herrmann SD et al. 2024 Adult Compendium of Physical Activities, J Sport Health Sci, https://doi.org/10.1016/j.jshs.2023.10.010.

Body diagram: react-body-highlighter (MIT); see THIRD_PARTY_NOTICES.md.

## CI / deploy

- `.github/workflows/ci.yml` — format, lint, microdata guard (CASEID/PERNUM), typecheck, test (incl. release guard + golden criterion), build
- `.github/workflows/pages.yml` — deploy `dist/` to GitHub Pages on `main`
