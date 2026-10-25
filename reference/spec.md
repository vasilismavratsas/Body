# Body — Phase Alpha Model Spec (v0.6.1, 2026-10-24)
Reference implementation: `model.R` v0.6.1 (previous: model_v5.R, model_v4.R, model_v3b.R, model_v2.R, model_v1.R). Output: demo_output_v6.txt.
Data lineage: method_log.csv (steps 1–25, 26–31 plus Mathematician notes). Superseded data files are listed in README_SUPERSEDED.md and are not read.
Earlier spec text (v0.1–v0.3b: kappa 5 everywhere, hips/legs 0.35/0.65 split, DXA arm split, type-weight shares, max() floor, full red at 8×) is SUPERSEDED by this document; see spec_v1.md for history.

## 1. Energy (net)
Net MET-min for activity a: (MET_a − 1) × t_a. 1 MET = rest, which is not muscle work.
- Activities with nominal Compendium MET ≤ 1 (sleep, TV, sitting codes) have net = 0 exactly and no MET noise.
- Otherwise MET_a ~ LogNormal(meanlog = log MET_compendium, sdlog), net = max(MET_draw − 1, 0).
- sdlog = sqrt(log(1 + CV²)) with CV = 0.20 (ASSUMPTION; Compendium SD is GAP) → sdlog = 0.198. The Compendium value is the draw's median.

## 2. Allocation to body parts
Parts: arms, shoulders, chest, upper_back, core, lower_back, hips_glutes, legs.
Share means s̄_{a,p} come from activation_shares_v1.1.csv / postural_shares_v1.1.csv: share = muscle-mass fraction × activation index (%MVC where cited, otherwise an ASSUMED equivalent), normalized per row (method_log share_1–share_4). These are activation-weighted mass, not measured energy splits.
Mass fractions: muscle_mass_8part_v1.csv, average row (mass_1–mass_7: Janssen 2000 upper/lower; NHANES DXA arm ratio; ASSUMED sub-splits legs/hips 0.75/0.25, arms/shoulders 0.70/0.30, trunk 0.25/0.35/0.20/0.20; 50/50 sex mix).
Uncertainty: per-cell Dirichlet alpha_{a,p} = kappa(status) × s̄_{a,p}, kappa = cited 50 / stand-in 20 / ASSUMPTION 5 (ASSUMPTION). One draw per share row per Monte Carlo iteration.

## 3. Baseline day (v0.5: real IPUMS data)
nonexerciser_baseline_v2.csv + atus_nonexercisers_v2.csv: IPUMS ATUS 2024, adults 18+, WT06-weighted, 0 min of ATUS 1301 (sports/exercise participation) on the diary day. Only published aggregates are read; raw/ipums microdata is not read.
Group means sum to 1440.0.
**Reference day (v0.6 design):** the multiple is against the AVERAGE non-exerciser day. Per draw, each group's minutes = Gamma(mean = cited weighted mean, SD = SE), SE = SD/sqrt(n_eff), n_eff = n/deff, n = 5973, deff = 1.5 (ASSUMPTION for WT06 weights; no replicate weights). Then rescaled to 1440. Day-to-day variation is NOT uncertainty about the average and is excluded from M.
**Typicality percentile (optional output, separate from M):** individual non-exerciser days are simulated per draw (zero-inflated Gamma: participation ~ Bernoulli(pi); conditional Gamma moment-matched to cited mean and SD; groups independent (ASSUMPTION); rescaled to 1440), using the same METs and shares. typ_pct_p = % of individual days with part work below the user's median part work. Calibration vs cited per-person gross MET-h/day: SD 4.13 vs 4.40, p10 28.05 vs 28.22, p50 32.15 vs 32.60, p90 38.35 vs 38.80 (slightly too narrow; no tuning knob applied).
Deterministic baseline: 33.20 MET-h/day gross, 9.200 net — matches the researcher's TOTAL_net 9.20 (gross − 24 equals Σ min·(MET−1) because every group has MET ≥ 1).
ATUS category → share row (ASSUMPTION): sleep→lying; TV, eating, work, education, household management (ATUS 0209, Compendium 09040), civic/religious, socializing, phone/mail, other leisure, other, sports→sitting; personal care→standing; housework, food prep, other household, care→household; lawn/garden→gardening; purchasing→walking.

## 4. Multiple
W_p and B_p are computed from the SAME draw (METs, shares, mean baseline minutes). The user's day = that draw's mean baseline day with TV minutes replaced by the logged exercise.
F_p = phi × massFraction_p × Σ_q B_q, phi = 0.25 (ASSUMPTION).
M_p = (W_p + F_p) / (B_p + F_p). The additive offset shrinks low-work parts toward 1× (pseudo-count / regularizing prior). A day identical to baseline gives exactly 1×.
Summaries: median and 89% interval (5.5%, 94.5%), N = 4000 draws.

## 5. Colour and flags (ASSUMPTION, final for alpha)
Bands on M: green < 1.15 ≤ yellow-green < 1.4 ≤ orange < 1.8 ≤ red. Continuous colour ramp on log2(M) from 1× (green) to full red at M_cap = 2.5×.
- straddlesCutoff: the 89% interval spans ≥ 2 band edges (count of edges e with lo89 < e ≤ hi89 is ≥ 2).
- highUncertainty: log2(hi89 / lo89) > 2.
- offset_gt_B: share of draws with F_p > B_p (diagnostic; "smallBaseline" in the app).

## 6. Activities wired (Compendium code, MET → share row)
walk_brisk 17200 4.8 → walking; jog 12020 7.5 → running; resist_multi 02054 3.5 → weightlifting; bike_leisure 01010 4.0 → bicycling; indoor_bike_general 01200 6.8 → indoor_biking; calisthenics_mod 02022 3.8 → calisthenics; yoga_hatha 02150 2.3 → yoga; garden 08245 3.8 → gardening; chore_clean_light 05040 2.5 → household. yard_work is a copy of gardening.

## 7. Where "multiples hold across true baselines" breaks
Multiples cancel a uniform scaling of resting rate, but not differences in body mass, fitness (relative intensity), or habitual occupation; the reference is an average day, not the user's own. Low-baseline parts are handled by the offset, not by data.

## 8. Data status
Cited share cells: yoga (5 parts), legs for walking/sitting/standing, sitting lower_back (O'Sullivan 2006, v1.1). Stand-in: walking core and hips, gardening arms/shoulders/legs, sitting/standing hips. All other cells ASSUMPTION (all running, weightlifting, cycling, household, calisthenics; lying = pure mass).
Baseline minutes and spread: cited (IPUMS 18+ non-exercisers). Still GAP: cross-group covariance of minutes, replicate-weight SEs (deff assumed), Compendium SDs, running/lifting/cycling EMG, Park 2014 tables, time-averaged gait trunk/hip EMG.

## 10. Calibration test targets (v0.6.1, Mathematician)
Two different spreads; don't mix them up:
- **Survey spread (data, cited):** nonexerciser_baseline_v2.csv gives per-person gross MET-h/day SD 4.40, p10 28.22, p50 32.60 and p90 38.80 (IPUMS ATUS 2024, 18+, WT06).
- **Model spread (simulated):** the model's zero-inflated Gamma simulation of individual non-exerciser days. With seed 2026 it gives SD 4.13, p10 28.05 and p90 38.35. Across 8 other seeds (4000 draws each) it ranged over SD 4.06–4.25, p10 27.90–28.12 and p90 37.99–38.35. It runs about 6% narrower than the survey because activity groups are drawn independently.
Test tolerances (any seed, nDraws ≥ 4000):
1. Regression test against the model (HARD, any seed, any implementation): SD in [3.90, 4.40], p10 in [27.6, 28.4] and p90 in [37.6, 38.8].
2. Validity test against the survey (HARD): |SD_sim − 4.40|/4.40 ≤ 0.10, |p10_sim − 28.22| ≤ 1.0 and |p90_sim − 38.80| ≤ 1.0 MET-h/day.
3. Snapshot test (HARD): a TypeScript port can't reproduce R's random-number stream, so with seed 2026 the TS engine must reproduce its OWN committed snapshot to ±0.01. The R seed-2026 values (4.13 / 28.05 / 38.35) are reference only, not a test target.

