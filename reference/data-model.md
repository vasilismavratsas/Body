# Body alpha: data model v0.6.1 (folds in spec.md v0.6.1, model.R v0.6.1; older sections kept for history, later sections supersede earlier ones)
Every number carries a status (cited | stand-in | ASSUMPTION | GAP); the release guard fails on GAP or PLACEHOLDER. Current values come from model.R v0.6.1.

## Data files (src/data, versioned, every value has sourceRefs)
- bodyParts.json: 8 ids (arms, shoulders, chest, upper_back, core, lower_back, hips_glutes, legs), label, muscleMassFraction (scales the additive offset F_p).
- activities.json: id, name, compendiumCode, met {median, sigmaLog}, shares {sbar: {part: 0-1, sum=1}, kappa}, sourceRefs. Final list pending Researcher.
- baseline.json: ATUS typical non-exerciser day as activities [{activityId, minutes {mean, sd}}] (Gamma-matched), sourceRefs. B_p is computed, not stored.
- modelConfig.json: energyMode "net" (fixed, documented), nDraws, intervalProb 0.89, offset {phi: 0.25 (ASSUMPTION), F_p = phi * massFraction_p * sum_q B_q, additive in numerator and denominator}, colorScale {log2 ramp, Mcap 2.5, bandEdges [1.15, 1.4, 1.8], stops green->yellow-green->orange->red} (see v0.6.1), uncertaintyDisplay rule.

## Core (src/core, pure, one formula file)
- W_p = sum_a (MET_a - 1) * t_a * s_ap   (net = 0 for nominal MET <= 1; otherwise max(MET_draw - 1, 0); v0.4+)
- B_p same formula over baseline day; M_p = (W_p + F_p) / (B_p + F_p), additive offset, W and B from the same draw (v0.3b+; the max-floor is superseded)
- Monte Carlo: MET ~ LogNormal, shares ~ Dirichlet(kappa*sbar), baseline minutes ~ Gamma; user durations fixed.
- Output per part: {median, lo5.5, hi94.5, flags[]}.
- Flags: "smallBaseline" (F_p > B_p), "straddlesCutoff" (89% interval spans ≥ 2 band edges, v0.6.1), "highUncertainty" (interval width over a config threshold), "referenceIsAverage" (always shown in UI label).

## UI implications
- Color from log2(median); hatching or desaturation when straddlesCutoff; tap shows median + interval + flags.

## v0.3 additions (Mathematician, Oct 24)
- Every numeric value carries status: "cited" | "GAP" | "stand-in" | "ASSUMPTION". The release guard fails on GAP and PLACEHOLDER; the UI surfaces ASSUMPTION and stand-in (most shares are currently ASSUMPTION based on muscle mass; a met.sigmaLog with no source = ASSUMPTION).
- Floor: mode massFraction, floor_p = phi * muscleMassFraction_p * sum_q B_q; superseded: F_p is an additive offset with phi = 0.25 (ASSUMPTION).
- nDraws = 4000 (fallback 2000 if too slow on device).
- highUncertainty when log2(hi89/lo89) > highUncertaintyLog2Width = 2.
- baseline.json entries: activityId, atusCode, mappingRationale (source atus_to_compendium.csv), minutes {mean, sd}; top-level populationFlag "IPUMS ATUS 2024, adults 18+, non-exercisers (1301 = 0), WT06-weighted" (v0.5+; the 15+ stand-in is superseded).

## v0.4 (Mathematician, Oct 24) SUPERSEDES the floor rules above
- M_p = (W_p + F_p) / (B_p + F_p); F_p = phi * massFraction_p * sum_q B_q; phi = 0.25 (ASSUMPTION). No max().
- In each Monte Carlo draw, W_p and B_p use the same sampled METs, shares, and baseline minutes, so a day identical to the baseline gives exactly 1x (add as a unit test).
- smallBaseline flag fires when F_p > B_p.
- Color: superseded by v0.6.1 bands (Mcap 2.5).
- Reference implementation: /workspace/body/model.R v0.3b. The TypeScript core must match it on a golden-test fixture.

## v0.5 (edited by the Mathematician, Oct 24) — matches model.R v0.4; SUPERSEDES earlier placeholders
- phi = 0.25 is a labelled ASSUMPTION (status "ASSUMPTION"), not a PLACEHOLDER.
- M_p = (W_p + F_p) / (B_p + F_p), F_p = phi × muscleMassFraction_p × Σ_q B_q; W_p and B_p from the same draw.
- Net energy: activities with nominal MET ≤ 1 have net = 0 and no MET noise; else net = max(MET_draw − 1, 0).
- met.sigmaLog = sqrt(log(1 + CV²)); CV = 0.20 ASSUMPTION → 0.198.
- Baseline minutes rescaled to exactly 1440 (proportional, ×1440/1440.6), and each draw is rescaled to 1440.
- Bands: superseded by v0.6.1 (see below).
- straddlesCutoff: superseded by v0.6.1 (≥ 2 edges).
- offset_gt_B (shown as smallBaseline): F_p > B_p; report the share of draws.
- Inputs: activation_shares_v1.1.csv, postural_shares_v1.1.csv.

### Changelog
- 2026-10-24: Mathematician edited this file for model.R v0.4 (offset, phi status, bands, flags, net and sdlog rules, 1440 renormalization).

## v0.6 (edited by the Mathematician, Oct 24) — matches model.R v0.6
- baseline.json, per ATUS group: activityId, atusCode, compendiumCode, met, minutes {mean, sd, median, p10, p90}, participationRate (0–1), n, status "cited", sourceRefs. Top level: population "IPUMS ATUS 2024, adults 18+, WT06, 0 min ATUS 1301", designEffect 1.5 (status ASSUMPTION), perPersonGross {sd 4.40, p10 28.22, p50 32.60, p90 38.80}.
- M uses the MEAN day: minutes_g ~ Gamma(mean_g, SE_g), SE_g = sd_g / sqrt(n / designEffect), then rescaled to 1440. Day-to-day spread is not in M.
- New optional output per part: typicalityPercentile (0–100) = % of simulated individual non-exerciser days (zero-inflated Gamma per group: Bernoulli(participationRate) × Gamma moment-matched to mean/sd, groups independent, rescaled to 1440; same MET and share draws) with part work below the user's median part work. Shown separately from the colour; not a flag.
- Calibration tests (HARD, see spec.md §10). (1) Any-seed bands on simulated individual-day gross MET-h/day: SD [3.90, 4.40], p10 [27.6, 28.4], p90 [37.6, 38.8]. (2) Survey validity: |SD−4.40|/4.40 ≤ 0.10, |p10−28.22| ≤ 1.0, |p90−38.80| ≤ 1.0. (3) Seed 2026 reproduces the TS engine's own committed snapshot to ±0.01. The R seed-2026 values 4.13 / 28.05 / 38.35 are reference only.

### Changelog
- 2026-10-24: Mathematician edited this file for model.R v0.6 (mean-day reference, SE with design effect, baseline fields, typicality percentile).

## v0.6.1 bands (Mathematician, Oct 24) — final for alpha, status ASSUMPTION
- bandEdges [1.15, 1.4, 1.8]: green < 1.15 ≤ yellow-green < 1.4 ≤ orange < 1.8 ≤ red. Colour ramp on log2(M), Mcap = 2.5 (full red).
- straddlesCutoff fires only when the 89% interval spans ≥ 2 band edges (count of edges with lo89 < edge ≤ hi89 ≥ 2).

### Changelog
- 2026-10-24: Mathematician synced bands.

- Changelog: the Mathematician removed stale v0.2 text (PLACEHOLDER header, max-floor, MET truncation, 15+ label) and bumped the version to v0.6.1.

