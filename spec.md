# Body — Phase Alpha Model Spec (v0.7, 2026-10-24)
Reference implementation: `model.R` v0.7 (previous: model_v6.R = v0.6.1, model_v5.R, model_v4.R, model_v3b.R, model_v2.R, model_v1.R). Output: demo_output_v7.txt; stress checks: check_bands_v07.R → check_bands_v07_output.txt; unit tests: tests/test_validation_v07.R. §1–§10 still hold except where §11–§16 override them (§2 shares, §6 activity list, §8 data status).
Data lineage: method_log.csv (steps 1–25, 26–31 plus Mathematician notes). Superseded data files are listed in README_SUPERSEDED.md and are not read.
Earlier spec text (v0.1–v0.3b: kappa 5 everywhere, hips/legs 0.35/0.65 split, DXA arm split, type-weight shares, max() floor, full red at 8×) is SUPERSEDED by this document; see spec_v1.md for history.

## 1. Energy (net)
Net MET-min for activity a: (MET_a − 1) × t_a. 1 MET = rest, which is not muscle work.
- Activities with nominal Compendium MET ≤ 1 (sleep, TV, sitting codes) have net = 0 exactly and no MET noise.
- Otherwise MET_a ~ LogNormal(meanlog = log MET_compendium, sdlog), net = max(MET_draw − 1, 0).
- sdlog = sqrt(log(1 + CV²)) with CV = 0.20 (ASSUMPTION; Compendium SD is GAP) → sdlog = 0.198. The Compendium value is the draw's median.

## 2. Allocation to body parts
Parts: arms, shoulders, chest, upper_back, core, lower_back, hips_glutes, legs.
Share means s̄_{a,p} come from activation_shares_v2.1.csv (activities) + postural_shares_v1.1.csv (baseline postures) + lift_shares.csv (weightlifting child lifts): share = muscle-mass fraction × activation index (%MVC where cited, otherwise an ASSUMED equivalent), normalized per row (method_log share_1–share_4). These are activation-weighted mass, not measured energy splits.
Mass fractions: muscle_mass_8part_v1.csv, average row (mass_1–mass_7: Janssen 2000 upper/lower; NHANES DXA arm ratio; ASSUMED sub-splits legs/hips 0.75/0.25, arms/shoulders 0.70/0.30, trunk 0.25/0.35/0.20/0.20; 50/50 sex mix).
Uncertainty: per-cell Dirichlet alpha_{a,p} = kappa(status) × s̄_{a,p}, kappa = cited 50 / stand-in 20 / ASSUMPTION 5 (ASSUMPTION). One draw per share row per Monte Carlo iteration.

## 3. Baseline day (v0.5: real IPUMS data)
nonexerciser_baseline_v2.csv + atus_nonexercisers_v2.csv: IPUMS ATUS 2024, adults 18+, WT06-weighted, 0 min of ATUS 1301 (sports/exercise participation) on the diary day. Only published aggregates are read; raw/ipums microdata is not read.
Group means sum to 1440.0.
**Reference day (v0.6 design):** the multiple is against the AVERAGE non-exerciser day. Per draw, each group's minutes = Gamma(mean = cited weighted mean, SD = SE), SE = SD/sqrt(n_eff), n_eff = n/deff, n = 5973, deff = 1.5 (ASSUMPTION for WT06 weights; no replicate weights). Then rescaled to 1440. Day-to-day variation is NOT uncertainty about the average and is excluded from M.
**Typicality percentile (optional output, separate from M):** individual non-exerciser days are simulated per draw (zero-inflated Gamma: participation ~ Bernoulli(pi); conditional Gamma moment-matched to cited mean and SD; groups independent (ASSUMPTION); rescaled to 1440), using the same METs and shares. typ_pct_p = % of individual days with part work below the user's median part work. Calibration vs cited per-person gross MET-h/day: SD 4.16 vs 4.40, p10 27.91 vs 28.22, p50 32.34 vs 32.60, p90 38.16 vs 38.80 (slightly too narrow; no tuning knob applied).
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

## 6. Activities wired (v0.6.1 list; v0.7 list = activity_catalog.csv, see §12)
walk_brisk 17200 4.8 → walking; jog 12020 7.5 → running; resist_multi 02054 3.5 → weightlifting; bike_leisure 01010 4.0 → bicycling; indoor_bike_general 01200 6.8 → indoor_biking; calisthenics_mod 02022 3.8 → calisthenics; yoga_hatha 02150 2.3 → yoga; garden 08245 3.8 → gardening; chore_clean_light 05040 2.5 → household. yard_work is a copy of gardening.

## 7. Where "multiples hold across true baselines" breaks
Multiples cancel a uniform scaling of resting rate, but not differences in body mass, fitness (relative intensity), or habitual occupation; the reference is an average day, not the user's own. Low-baseline parts are handled by the offset, not by data.

## 8. Data status
Cited share cells: yoga (5 parts), legs for walking/sitting/standing, sitting lower_back (O'Sullivan 2006, v1.1). Stand-in: walking core and hips, gardening arms/shoulders/legs, sitting/standing hips. (v0.6.1 list; superseded for v0.7, see below.)
**v0.7 status counts (exact, from the CSVs):** activation_shares_v2.1.csv has 200 cells (25 activities × 8): ASSUMPTION 183/200, cited 8/200 (walking legs; yoga upper_back, core, lower_back, hips_glutes, legs; swimming shoulders, core), stand-in 9/200 (walking core, hips_glutes; gardening arms, shoulders, legs; yard_work arms, shoulders, legs; swimming arms). lift_shares.csv has 112 cells (14 lifts × 8): ASSUMPTION 105/112, cited 7/112 (bench_press arms, shoulders, chest, Schoenfeld 2016; back_squat and hip_thrust hips_glutes, legs, Contreras 2015), stand-in 0/112. Combined: ASSUMPTION 288/312, cited 15/312, stand-in 9/312. postural_shares_v1.1.csv: ASSUMPTION 19/24, cited 3/24, stand-in 2/24. All running, cycling, household and calisthenics cells, and the 11 uncited lifts, are ASSUMPTION; lying = pure mass.
Baseline minutes and spread: cited (IPUMS 18+ non-exercisers). Still GAP: cross-group covariance of minutes, replicate-weight SEs (deff assumed), Compendium SDs, running/lifting/cycling EMG, Park 2014 tables, time-averaged gait trunk/hip EMG.

## 10. Calibration test targets (v0.7, Mathematician)
Two different spreads; don't mix them up:
- **Survey spread (data, cited):** nonexerciser_baseline_v2.csv gives per-person gross MET-h/day SD 4.40, p10 28.22, p50 32.60 and p90 38.80 (IPUMS ATUS 2024, 18+, WT06).
- **Model spread (simulated):** the model's zero-inflated Gamma simulation of individual non-exerciser days. With seed 2026, model.R v0.7 gives SD 4.16, p10 27.91 and p90 38.16 (v0.6.1 gave 4.13 / 28.05 / 38.35; the change comes from the longer random stream). Across 8 seeds in v0.6.1 (4000 draws each) it ranged over SD 4.06–4.25, p10 27.90–28.12 and p90 37.99–38.35. It runs about 6% narrower than the survey because activity groups are drawn independently.
Test tolerances (any seed, nDraws ≥ 4000):
1. Regression test against the model (HARD, any seed, any implementation): SD in [3.90, 4.40], p10 in [27.6, 28.4] and p90 in [37.6, 38.8].
2. Validity test against the survey (HARD): |SD_sim − 4.40|/4.40 ≤ 0.10, |p10_sim − 28.22| ≤ 1.0 and |p90_sim − 38.80| ≤ 1.0 MET-h/day.
3. Snapshot test (HARD): a TypeScript port can't reproduce R's random-number stream, so with seed 2026 the TS engine must reproduce its OWN committed snapshot to ±0.01. The R seed-2026 values (v0.7: 4.16 / 27.91 / 38.16) are reference only, not a test target.

### TS-vs-R golden criterion (v0.7, CONFIRMED by the Mathematician from a seed study; replaces the SE's proposal of 3% on medians, 5% on lo/hi and exact band and flag equality)
Evidence (tests/seed_spread_v07.R, tests/seed_spread_analyze_v07.R, output in tests/seed_spread_v07_output.txt): all 42 v0.7 demo scenarios × 8 parts = 336 cells, N = 4000, seed 2026 vs 8 other seeds (2,688 comparisons). Other seeds stand in for an independent TS random stream.
- Median relative difference: max 4.03%, p99 2.15%, p95 1.28%. 2 cells fail 3%.
- lo89: max 4.71%, p99 1.54%, p95 0.59%. 0 fail 5%.
- hi89: max 20.2%, p99 11.3%, p95 6.9%. 272 cells fail 5%. The upper tail is heavy for low-kappa ASSUMPTION cells (chest, for example).
- Band mismatches: 17, plus 2 saturated mismatches. All have the R median within 1.8% of an edge or of 2.5.
- straddlesCutoff mismatches: 55. All have R lo89 or hi89 within 5.3% of an edge.
- highUncertainty mismatches: 12. All have |log2(hi/lo) − 2| ≤ 0.13.
- smallBaseline (share of draws with F_p > B_p, compared at 0.5): 0 mismatches; the share differs by at most 0.036.
The SE's proposal would therefore fail a correct port on every run, mostly on hi89, the band near edges and straddlesCutoff.

**Criterion (HARD; TS engine, nDraws 4000, any seed, against the committed R reference demo_output_v7.txt at seed 2026):**
1. Median: |TS − R| / R ≤ 6% per cell.
2. lo89: ≤ 6%. hi89: ≤ 30%.
3. Band and saturated must match whenever the R median is more than 3% (relative) from every band edge (1.15, 1.4, 1.8) and from 2.5. Coverage: 88% of cells.
4. straddlesCutoff must match whenever R lo89 and hi89 are both more than 10% from every edge. Coverage: 38% of cells.
5. highUncertainty must match whenever |log2(hi89/lo89) − 2| > 0.3. Coverage: 88% of cells.
6. smallBaseline is deterministic. It is computed on nominal inputs (nominal MET, mean shares s̄, mean baseline minutes) as F_p > B_p and must match EXACTLY. The per-draw share is diagnostic only and must agree within 0.06 absolute.
7. Aggregate bias: over cells with R median > 1.05, the mean of (M_TS − 1)/(M_R − 1) − 1 must be within ±0.02. Observed across seeds: at most 0.0071 in absolute value.
Result: all 8 seeds pass rules 1–7 with 0 failing cells. Bug-injection check: a 20% error in phi (0.30) fails rules 1 and 3 on 5 cells and rule 7 (−0.067). A 5% MET-scaling bug passes every per-cell rule but fails rule 7 (−0.042). So rule 7 is what catches small systematic bugs.
Code: tests/golden_criterion_v07.R (check(ts, r)). GOLDEN_TOL (±0.01) remains the same-seed R-only regression check.

### GOLDEN_TOL (v0.7)
GOLDEN_TOL = ±0.01 on every reported median, lo89 and hi89 in demo_output_v7.txt. It applies to a same-seed (2026) run of R model.R v0.7 with the same input files, and is a regression check for R only. The TypeScript port cannot reproduce R's random stream, so it does NOT use GOLDEN_TOL against R. It uses the §10 band tests 1–2 plus its own snapshot test 3.

### Dirichlet concentration (ASSUMPTION)
Share uncertainty: shares_a ~ Dirichlet(alpha), alpha_{a,p} = kappa(status_{a,p}) × s̄_{a,p}, with kappa = 50 for cited, 20 for stand-in and 5 for ASSUMPTION cells. These values are ASSUMPTION, a pseudo-sample size per cell with no cited source.

## 11. Share rule (v0.7, ASSUMPTION — Body decision 2026-10-24)
share_{a,p} = mass_p × index_{a,p} / Σ_q mass_q × index_{a,q}, applied identically to EVERY activity, posture and lift row; no special case for EMG-cited cells.
- One scale: cited and stand-in indices are %MVIC as published. Assumed indices (Researcher scale prime 50 / secondary 20 / stabilizer 10 / other 2, activity rows up to 50) are rescaled ×2 onto %MVIC (100 / 40 / 20 / 4) before mass weighting (option B). The factor 2 is an ASSUMPTION (prime mover ≈ 100 %MVIC).
- Why: the metric is ENERGY. A large part doing moderate work can legitimately spend more than a small part working near maximum, so the order of shares need not match the EMG prime-mover order (e.g. hip thrust: legs share 0.68 > glutes 0.25; bench: arms 0.45 > chest 0.21). Colour comes from each part's multiple relative to its OWN baseline, which restores the intuitive ordering (demo_output_v7.txt: hip thrust glutes 1.39× ≥ legs 1.22×; bench chest 3.27× ≥ arms 1.73×; vigorous bench chest 5.66× ≥ arms 2.45×; curls arms 2.11× ≥ legs 1.01×; squat legs 1.39× ≥ arms 1.00×; swimming shoulders 2.63× ≥ hips 1.08×).
- The Researcher's stored `share` column is only used as a sum-to-1 check; shares are recomputed from index × mass.
- Sensitivity only (not adopted): A = no mass weighting for rows containing EMG-cited cells; C = %MVIC directly, no mass, every row. Table in check_bands_v07_output.txt §1.

## 12. Activity list and MET uncertainty (data-driven)
- No activity names appear in model logic. activity_catalog.csv maps activity_id → share_row → met_file; baseline_row_map.csv maps ATUS groups → share rows (both carry the v0.6.1 ASSUMED pairings verbatim).
- 25 user activities (10 from mets.csv, incl. yard_work via met_id `yard`, + 15 from activities25_mets.csv) + 14 lifts × 3 intensities. v0.7 LOCKED: yard_work is the 25th catalog activity. It is wired PROVISIONALLY to existing Researcher data: its own activation_shares_v2.1 row and mets.csv `yard` 08261 4.0, via the catalog's met_id column. Confirmation is pending the Researcher's yard delivery. Catalog total: 25 activities.
- activities25_mets.csv: nominal MET = default_MET (the default Compendium code). The min–max range across codes is NOT an SD; it is read as the 89% interval of the lognormal: sdlog = ln(max/min) / (2 × 1.598) (ASSUMPTION). Activities without a range keep CV 0.20 (sdlog 0.198). Lifts use sdlog 0.198.
- lowN flag: activities whose ATUS selection row has unweighted n < 10 (basketball 7, soccer 2, bowling 8, martial_arts 4, rock_climbing 3) are labelled in output. This flags the participation estimate only; it does not change M.

## 13. Weightlifting (parent + child lifts)
- Parent activity "weightlifting"; children = lifts in lift_shares.csv (14 lifts). Each child has its own 8-part share row and a MET per intensity in lift_mets.csv.
- Intensity ladder (Compendium): light 02054 3.5, moderate 02052 5.0, vigorous 02050 6.0. Plank 02024 2.8 and push-up 02056 3.0 have one code, so all three levels use it. Default level (is_default in lift_mets.csv, exactly one per lift): moderate for back_squat and deadlift (default code 02052); moderate for plank and push_up, flagged is_default at moderate, but because they use a single code the MET is the same at every level (2.8 / 3.0); light for the other 10 lifts (default code 02054). The lift → code pairing is ASSUMPTION.
- "weightlifting" with no exercise falls back to the generic resist_multi row (02054, 3.5).

## 14. Input contract
A user day is a table of rows {activity, minutes, exercise?, intensity?}. activity is a catalog id or "weightlifting". For weightlifting, exercise is a lift id and intensity ∈ {light, moderate, vigorous} (missing → default). Minutes must be 0–1440. Logged minutes replace TV minutes on the mean baseline day (ASSUMPTION, A$swap_from). Unknown activity, unknown lift, bad intensity or bad minutes → error naming the row.
Input validation (load time, error names the file and row): all 8 parts exactly once per row; status starts with cited / stand-in / ASSUMPTION; index ≥ 0 and not all zero; mass > 0; stored shares sum to 1 ± 0.002; every wired activity has MET > 0 (GAP not allowed); every catalog share_row and every lift in lift_mets.csv has a share row.

## 15. Stress checks (check_bands_v07.R, real round-2 data, phi 0.25, cap 2.5)
Medians (P(M ≥ 1.8) in brackets):
- Vigorous curls 45 min: arms 3.17 [0.94]; 90 min: arms 5.57. Vigorous triceps 45 min: arms 3.22. About 20 min of vigorous curls takes arms to red (deterministic).
- Vigorous bench 45 min: chest 5.70 [0.97], shoulders 3.28, arms 2.46. Light bench 45 min (demo): chest 3.27 (red).
- Plank 20 min: core 1.78 [0.49].
- Soccer 90 min: hips/glutes 2.23, legs 2.00. Basketball 90: 2.05 / 2.00. Tennis 90: arms 1.76, legs 1.73. Swimming 60: shoulders 3.15, arms 2.40. Martial arts 60: hips/glutes 1.96. Rowing 60: upper_back 1.43.
- Small baselines: deterministic B_p (net MET-min/day) is chest 14.9, core 25.1, shoulders 37.2, upper_back 49.0, arms 76.4, legs 218.0. F_p/B_p ranges from 0.11 (lower_back) to 0.49 (chest).
(Source: check_bands_v07_output.txt run 2026-10-24 22:33 CT on the final 25-activity model, seed 2026, N = 1500 per cell.)
Reading: isolated upper-body and core work saturates red (above M_cap) within about 20–45 min, while whole-body sports reach red only after about 90 min. This follows from the definition (each part relative to its own very small daily energy). It is not caused by phi: at phi = 1, vigorous bench chest is still 2.43 and swimming shoulders 2.03, but soccer legs drop to 1.66. The cap behaves correctly: colour saturates and nothing overflows. But a large share of red cells sit above the cap, so "how far above red" is invisible.

## 16. Decisions on proposals (Body, 2026-10-24)
P1 — ADOPTED. Keep phi = 0.25 and bands 1.15 / 1.4 / 1.8 / cap 2.5. Raising phi compresses legs and hips in sports as much as it tames small parts, so it does not fix the saturation.
P2 — ADOPTED (implemented: output column `saturated`). Add a "saturated" flag (median ≥ M_cap) so the UI can show that a part is beyond full red, e.g. with a label "> 2.5×".
P3 — REJECTED. Optional alternative if Body finds upper-body red too easy: phi = 0.5. This raises the minutes of vigorous curls needed for red from about 20 to 25, takes vigorous bench chest from 5.64 to 3.67, and takes run hips from 1.63 to 1.49 (yellow-green).

## 17. Expected behaviour (not a bug)
A small part can turn red quickly after a heavy isolated lift (curls, bench, push-ups, plank, overhead press, rows, pull-ups) or after swimming. This happens because that part's sedentary baseline is very small (for example chest 14.9 net MET-min/day vs legs 218). The multiple is relative to each part's own baseline, so modest absolute work in a small part is a large multiple. The `saturated` flag (median ≥ 2.5) tells the UI to show ">2.5×".

### Changelog
- 2026-10-24 v0.7 (Mathematician): Methods Writer sweep fixes. §8 now gives exact status counts (ASSUMPTION 183/200, 105/112, 288/312) and the 7 cited lift cells. §11 sanity numbers synced to demo_output_v7.txt. §12 now reads 25 activities. §13 lift defaults clarified (plank and push_up use is_default moderate, single code). §15 regenerated from the final check_bands_v07 run. §16 P3 numbers updated. §3 calibration line updated to v0.7 (4.16 / 27.91 / 32.34 / 38.16). The "from the 24-activity run" note below is superseded.
- 2026-10-24 v0.7 (Mathematician): TS-vs-R golden criterion confirmed with seed-study numbers (§10); it replaces the SE's 3%/5%/exact-equality proposal.
- 2026-10-24 v0.7 LOCKED (Mathematician): SE review applied — GOLDEN_TOL defined, §10 reference values updated, kappa stated, lift status enum fixed, yard_work added as the 25th activity (provisional). P1 and P2 adopted, P3 rejected. The `saturated` flag was added and §17 records the expected behaviour. demo_output_v7.txt was regenerated.
- 2026-10-24 v0.7 (Mathematician; §15 numbers are from the 24-activity run, and adding yard_work shifts the random stream by about ±0.05): §11 share rule (option B, energy rationale); §12 data-driven catalog and range-based MET sdlog; §13 weightlifting parent/child; §14 input contract and validation; §15 stress checks; §16 proposals. §10 test 1 on v0.7 final (25 activities): SD 4.16, p10 27.91, p90 38.16, PASS. The R seed-2026 reference values change because the random stream now covers more activities.
