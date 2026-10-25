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

## CI / deploy

- `.github/workflows/ci.yml` — format, lint, typecheck, test (incl. release guard + golden criterion), build
- `.github/workflows/pages.yml` — deploy `dist/` to GitHub Pages on `main`
