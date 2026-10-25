# Superseded files (kept for audit only)

- **baseline.csv, emg_matrix.csv:** first pass. Current replacements are mets.csv, atus_nonexercisers_v2.csv / nonexerciser_baseline_v2.csv and activation_shares_v2.1.csv.
- **baseline_energy.csv:** 34.3 MET-h/day, old purchasing and childcare codes. Superseded by nonexerciser_baseline_v2.csv (33.20 MET-h/day gross).
- **exercise_mets_shares.csv:** superseded by mets.csv and activation_shares_v2.1.csv.
- **activation_shares.csv, postural_shares.csv:** cited-only versions with GAP cells. Superseded by the *_v1 files (every cell flagged), which are themselves superseded by *_v1.1 / v2.1.
- **atus_nonexercisers.csv, nonexerciser_baseline_v1.csv:** ATUS 15+ stand-in. Superseded by atus_nonexercisers_v2.csv and nonexerciser_baseline_v2.csv (IPUMS 18+, non-exercisers).
- **activation_shares_v1.csv, postural_shares_v1.csv, activation_shares_v1.1.csv:** superseded by activation_shares_v2.1.csv (v0.7).
- **model_v1.R to model_v5.R, model_v3b.R, model_v6.R, spec_v1.md, demo_output.txt and demo_output_v2 to v6:** earlier model versions. The current model is model.R v0.7, with output in demo_output_v7.txt.
- **top10.csv:** BRFSS top-10 list used in v0.6.1 UI. Superseded by activity_catalog.csv (25 activities) for v0.7.

Current sources of truth (v0.7): `spec.md`, `data-model.md`, `model.R`, `demo_output_v7.txt`, `data/*`, `tests/golden_criterion_v07.R`, `methods/methods_v008_2026-10-24.md`.
