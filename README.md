# Body

Web app that colors eight body parts by how much work they did today, as a
multiple of an average US non-exerciser day. Alpha: Vite + React + TypeScript,
model and data from `reference/`.

Deploy target: https://vasilismavratsas.github.io/body/

## Architecture

| Path         | Role                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| `src/core/`  | Pure TypeScript model (Monte Carlo, flags, bands). No React, no I/O.                          |
| `src/data/`  | Versioned JSON numbers with `status` and `sourceRefs`. No hardcoded physiology in code.       |
| `src/ui/`    | React UI: body map, detail panel, activity entry.                                             |
| `reference/` | Source of truth for alpha: `spec.md`, `data-model.md`, `model.R`, CSVs, `demo_output_v6.txt`. |

Build order (one PR per step): scaffold → data schemas → core engine → body map →
detail panel → activity entry → release/deploy. See `reference/project-brief.md`
§4–5.

**Rule:** never invent physiological numbers. Values live in data files (and
eventually `src/data`); the release guard fails on `GAP` / `PLACEHOLDER`.

## Scripts

```bash
npm install
npm run dev          # local Vite server
npm test             # Vitest
npm run lint         # ESLint (strict TypeScript)
npm run format       # Prettier write
npm run format:check
npm run typecheck
npm run build        # tsc -b && vite build
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs format check, lint, typecheck,
test, and build on pushes to `main` and on pull requests.
