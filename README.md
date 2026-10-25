# Body

Web app that colors eight body parts by how much work they did today, as a
multiple of an average US non-exerciser day. Alpha: Vite + React + TypeScript,
model and data from `reference/` → `src/data`.

**Live:** https://vasilismavratsas.github.io/Body/

## Architecture

| Path         | Role                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| `src/core/`  | Pure TypeScript model (Monte Carlo, flags, bands) + Web Worker. No React.                     |
| `src/data/`  | Versioned JSON numbers with `status` and `sourceRefs`. No hardcoded physiology in UI code.    |
| `src/ui/`    | React UI: body map, detail panel, activity entry, methods.                                    |
| `reference/` | Source of truth for alpha: `spec.md`, `data-model.md`, `model.R`, CSVs, `demo_output_v6.txt`. |

**Rule:** never invent physiological numbers. Values live in `src/data` (converted from
`reference/data`). The release guard fails on `GAP` / `PLACEHOLDER` in shipped data.

## Scripts

```bash
npm install
npm run data:convert   # reference CSVs → src/data JSON
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

## CI / deploy

- `.github/workflows/ci.yml` — format, lint, typecheck, test (incl. release guard), build
- `.github/workflows/pages.yml` — deploy `dist/` to GitHub Pages on `main`
