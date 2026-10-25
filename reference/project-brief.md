# Body: first message to the Cursor Project agent

## 1. Introduction (from Vasilis)

Hi! I'm Vasilis Mavratsas, an MD and the founder of **Body**. Here's what we're building and how I'd like us to work together.

**The vision (phase alpha).** Body is a web app that shows a color-coded front/back map of the human body. It has 8 body parts: `arms, shoulders, chest, upper_back, core, lower_back, hips_glutes, legs`. Each part is colored by how much work it did today, as a *multiple* of what that part does on an average day for a US adult who doesn't exercise. Green = 1x (an ordinary non-exercise day), shading toward red as the multiple goes up. Because we work in multiples, we don't personalize baselines for alpha. Relative load should hold roughly steady across different true baselines.

**Input.** The user enters activities by hand (activity + minutes). Alpha supports the 10 most common US exercise forms: walking, running, weightlifting, gardening, cycling, yard work, housework, calisthenics, yoga, and indoor cycling.

**The model.** Each part's work is energy use above rest (net MET x duration), split across body parts using activation shares and compared with the non-exerciser baseline built from IPUMS ATUS 2024 time-use data (33.20 gross / 9.20 net MET-h/day, SD 4.40). Every output has a median, an 89% interval, and flags. The full spec, data model, R reference implementation, and data tables are inlined below.

**The team.** I run a small team of AI agents:
- **Body**: chief design and systems engineer. Supervises the team and signs off on each round.
- **Body Researcher**: finds the evidence (Compendium METs, EMG/activation data, ATUS time use, muscle-mass data) and logs the method behind every number.
- **Body Mathematician & Statistician**: owns the model and the R reference code (`model.R`) and makes sure what the user sees matches the math.
- **Body Software Engineer**: writes the build plan and the prompts I send you, and reviews your PRs against the spec. They don't write the core code. **You do.**
- **Body Methods Writer**: keeps a versioned methods paper describing exactly what we do.

**How I want to work.**
- Be frugal and accurate. Don't waste effort, and ask early when something is unclear.
- **Never invent numbers.** All numbers live in data files with a `status` (cited / stand-in / ASSUMPTION / GAP / PLACEHOLDER) and `sourceRefs`. Code never hard-codes values.
- A **placeholder-guard test** must fail the release while any PLACEHOLDER or GAP value remains.
- Show uncertainty and ASSUMPTION status honestly in the UI. Most activation shares are rough estimates, and the user should be able to see that.
- Cite IPUMS ATUS for the baseline. Don't commit raw IPUMS microdata (its terms forbid redistribution). Derived aggregates are fine.

**What I want from you.** Create the new repo **vasilismavratsas/body**. Then carry out the staged build plan in section 4, one PR per step. Use `reference/model.R` and the reference data as the source of truth for the TypeScript engine, including tests that reproduce the R outputs. Flag any spec ambiguities or conflicts early, before building around them.

---

## 1b. Product brief (product-brief.md) → commit as reference/product-brief.md

# Body alpha: product brief (v0.6.1)
Web app: Vite + React + TypeScript, deployed with GitHub Pages from repo `vasilismavratsas/body` (not created yet). Model and data: `data-model.md` v0.6.1, `spec.md` v0.6.1, `model.R` v0.6.1. Build order: `cursor-prompts.md`.

## 1. Users and core stories
**Who:** Vasilis and a few invited testers using phone or desktop browsers. They aren't clinicians, and they need plain-language output.
**Typical session:** open the app and see today's front/back body map with all 8 parts (arms, shoulders, chest, upper_back, core, lower_back, hips_glutes, legs) at baseline. Add "running, 30 min" from the activity list (spec §6). The map recolors, and legs and hips_glutes shift away from green. Tap or focus a part to see its detail panel:
- the multiple M (median)
- the likely range (89% interval)
- the typicality percentile
- the confidence label and the ASSUMPTION/stand-in status of the values behind it
- which entries contributed
Edit or delete entries. They persist in localStorage for today.
**Stories:** "As a tester I can log an activity and duration in under 10 s." "I can see which parts worked harder than an average non-exercising American's day." "I can tell when a number is uncertain or assumed, without reading the methods."

## 2. Body artwork
- **Chosen: `react-body-highlighter`** (npm; https://github.com/GV79/react-body-highlighter). **MIT** license, verified in the repo LICENSE file and the npm registry. It has anterior and posterior SVG polygons split by muscle. Cursor should copy or adapt the polygon data into our own `BodyMap` component, map its muscle groups onto the 8 parts, and keep the MIT notice in `THIRD_PARTY_NOTICES.md`. We shouldn't depend on the package at runtime, because we need our own hatching, focus and ARIA handling.
- **Fallback / reference:** Wikimedia Commons "Muscles anterior labeled" by Mikael Häggström (https://commons.wikimedia.org/wiki/File:Muscles_anterior_labeled.png) is **public domain**. It's a raster image, so use it only as a tracing reference. "Human body silhouette.svg" (https://commons.wikimedia.org/wiki/File:Human_body_silhouette.svg) is a **public domain** outline, but it shows the upper body front only.
- **If the adaptation proves messy:** hand-draw simple region shapes on a 200×440 viewBox per view instead:
  - front view: shoulders (deltoid caps), chest, core, arms, hips_glutes (front hip and groin), legs
  - back view: shoulders, upper_back, lower_back, arms, hips_glutes, legs
  - Each part is one `<g id={part}>` so both views highlight together.

## 3. Alpha definition of done
- Works on current Safari iOS, Chrome Android and desktop Chrome, Firefox, Safari and Edge, at 360 px wide and up.
- **Load target (a product target, not data):** interactive in under 3 s on a mid-range phone over 4G. The Monte Carlo runs in a Web Worker, and the UI never blocks.
- **Accessibility:**
  - Color is never the only cue. Uncertainty is shown with hatching (straddlesCutoff, spec §5) and desaturation plus a dotted outline (highUncertainty / mostly ASSUMPTION), each with a text label and legend entry.
  - Parts are keyboard-reachable (Tab and Enter) with visible focus.
  - Each part has an accessible name that includes its band and multiple. The map has alt text and a text-table equivalent.
  - Text and UI meet WCAG AA contrast.
- Bands, cap and flags exactly as in spec §5. No numbers are hardcoded outside `src/data` and config.
- Deployed at https://vasilismavratsas.github.io/body/.
- All spec tests pass in CI: spec §10 tests 1–3 (model regression, survey validity, TS snapshot) and cursor-prompts.md step 3 tests (a)–(e) (identical day = exactly 1×, regression, snapshot, survey validity, match to reference/demo_output_v6), plus step-2 schema tests.
- The release guard is green in CI: no PLACEHOLDER or GAP values in shipped data, and every value has a status and sourceRefs.

## 4. Non-goals for alpha
No accounts, no backend or server storage, no wearables or imports, and no personalization (one average 18+ non-exerciser baseline only; spec §3, §7). No history beyond the current day.

## 5. Version rule
In `data-model.md`, later sections supersede earlier ones. **Only the v0.6.1 rules apply.** Ignore floor/max rules, the old bands and older placeholders from the v0.2–v0.6 sections wherever they conflict. If data-model.md and spec.md disagree, spec.md v0.6.1 and model.R v0.6.1 win. Never invent a physiological number. Cite the spec section, or mark the value as a GAP.

---

## 2. Methods paper — latest version: v006 (2026-10-24), file methods_v006_2026-10-24.md

# Body: Methods for estimating daily body-part work as multiples of a non-exercising American baseline

**Version:** v006 (2026-10-24) · **Supersedes:** methods_v005_2026-10-24.md
**Model:** model.R v0.6.1 (spec.md and data-model.md are also v0.6.1) · **Demo output:** demo_output_v6.txt (regenerated, run stamp 2026-10-24 20:11:36 CDT; seed 2026). A fresh scratch run of the current model.R at 20:14:18 CDT matched it exactly, apart from the timestamp.
**Company:** Body (Vasilis Mavratsas, MD) · **Status:** alpha, internal draft

**Source of truth:** files in `/workspace/body/`. Every number below traces to a named file.
- Superseded data files (README_SUPERSEDED.md) are not used.
- Earlier model versions (model_v1.R through model_v5.R) and spec_v1.md are cited for history only.
- Earlier spec text (v0.1–v0.3b) is superseded by spec.md v0.6.1.

**Status labels** (data-model.md v0.6.1):
- **cited**: taken directly from a published source.
- **stand-in**: a published value used for a population or quantity it was not measured on.
- **ASSUMPTION**: a team choice with no source.
- **GAP**: not available.
- The release guard fails on any GAP or PLACEHOLDER value that is still used.

---

## 1. Abstract / Overview

Body is an alpha app. It colors 8 body parts (arms, shoulders, chest, upper_back, core, lower_back, hips_glutes, legs) by how much muscular work the user did that day, shown as a multiple of the work on an **average non-exerciser day**.

**How the work is calculated:**
- Each activity's work is its net energy: (MET − 1) × minutes, using 2024 Adult Compendium MET values.
- That work is split across the 8 parts by an activation share matrix: muscle mass × %MVC index, normalized so each row sums to 1.
- The same formula gives the baseline. The baseline now comes from IPUMS ATUS 2024 microdata: adults 18+ with 0 min in ATUS 1301 on the diary day, WT06-weighted, n = 5,973, which is 79.6% of weighted adults. It is 33.20 MET-h/day gross and 9.20 net. **This retires the v001 15+ all-persons stand-in.**

**How the multiple and color are computed:**
- The multiple is regularized with an additive offset: $M_p=(W_p+F_p)/(B_p+F_p)$.
- A Monte Carlo simulation (N = 4000) carries MET, share and baseline-mean uncertainty. The app reports the median and 89% interval.
- Parts are colored by bands with edges 1.15 / 1.4 / 1.8, and a continuous ramp reaches full red at 2.5×.
- An optional **typicality percentile** shows where the user's day falls among individual non-exerciser days.

**Evidence is still thin.** Shares are still mostly ASSUMPTION: 85 of 104 cells. Results are illustrative.

## 2. Data sources

| Domain | Citation (as given in files) | Use | File |
|---|---|---|---|
| Time use (v2, current) | Sarah M. Flood, Liana C. Sayer, and Daniel Backman. American Time Use Survey Data Extract Builder: Version 3.3 [dataset]. College Park, MD: University of Maryland and Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D060.V3.3 (IPUMS ATUS extract #1, sample at2024) | Baseline means, SD, median, p10/p90, participation for 20 groups | atus_nonexercisers_v2.csv, nonexerciser_baseline_v2.csv; method_log ipums_1–7 |
| Time use (v1, retired) | BLS, 2025, "American Time Use Survey – 2024 Results" (USDL-25-1060), Table 1 | History only | atus_nonexercisers.csv, nonexerciser_baseline_v1.csv |
| METs | Herrmann SD et al., 2024, "2024 Adult Compendium of Physical Activities", https://doi.org/10.1016/j.jshs.2023.10.010; code list https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf | Point METs (SD is GAP) | mets.csv (46 rows), atus_to_compendium.csv |
| Muscle mass | Janssen I et al. 2000 J Appl Physiol 89(1):81-88, https://doi.org/10.1152/jappl.2000.89.1.81 (MRI, n = 468); NHANES 2017-18 DXX_J + DEMO_J (team computation) | Mass fractions | muscle_mass_fractions.csv, muscle_mass_8part_v1.csv |
| EMG | Mullerpatan 2020 Int J Yoga PMC7336940; APNM 2025 https://doi.org/10.1139/apnm-2025-0097; **O'Sullivan PB et al. 2006 Spine 31:E707-12 https://doi.org/10.1097/01.brs.0000234735.98075.50** (new cited cell, v1.1); White & McNair 2002 Clin Biomech 17:177-184; Park 2014 https://doi.org/10.7235/hort.2014.14059 (abstract only) | Share indices | activation_shares_v1.1.csv, postural_shares_v1.1.csv |
| Qualitative | Tikkanen 2013, Collins 2009, Arellano & Kram 2014, Inbar 2013, Vokac 1975, Shiomi 2000 | ASSUMPTION indices only | locomotion_arm_leg_evidence.csv |
| Activity prevalence | MSSE https://doi.org/10.1249/01.mss.0000981132.53032.99; PLOS One (BRFSS 2019) | Activity list | top10.csv |

The raw IPUMS microdata are stored in raw/ipums/. They are not read by the model and are not for redistribution (method_log ipums_7).

## 3. Activity selection and wired activities

**Activity list.** The 10 activities come from BRFSS 2019 via top10.csv (unchanged from v001): walking 43.9%, running 11.6, weightlifting 10.7, gardening 5.8, bicycling 3.8, yard work 2.8, household 2.6, calisthenics 2.4, yoga 2.2, indoor biking 2.2.

**Activities wired in model.R v0.6.1** (A3; the demo prints these METs):

| Model id | Compendium code | MET | Share row |
|---|---|---|---|
| walk_brisk | 17200 | 4.8 | walking |
| jog | 12020 | 7.5 | running |
| resist_multi | 02054 | 3.5 | weightlifting |
| bike_leisure | 01010 | 4.0 | bicycling |
| **indoor_bike_general** | **01200** | **6.8** | indoor_biking |
| calisthenics_mod | 02022 | 3.8 | calisthenics |
| yoga_hatha | 02150 | 2.3 | yoga |
| garden | 08245 | 3.8 | gardening |
| chore_clean_light | 05040 | 2.5 | household |

Notes on the table:
- All activity → share-row pairings are ASSUMPTION.
- **Indoor cycling** is new (method_log mets_1, math_v05_3). mets.csv now includes 01200 general 6.8, 01214 (50 W) 4.0, 01216 (60 W) 5.0 and 01220 (90-100 W) 6.0. Only 01200 is wired.
- The indoor_biking share row is a copy of bicycling (ASSUMPTION).
- Yard work has a share row (a copy of gardening) but is not a separate scenario. mets.csv lists yard 08261 = 4.0.

**mets.csv code fixes.** mets.csv now carries the corrected baseline codes, shopping 05065 = 2.3 and child care 05184 = 2.5, replacing 05060 = 3.3 and 05186 = 3.5. The v001 mismatch is resolved.

## 4. Baseline derivation (v2: IPUMS 18+ non-exercisers)

The baseline extract and its processing are logged in method_log ipums_1–7.

**Extract:**
- IPUMS ATUS API extract #1, sample at2024, activity level.
- Variables: AGE, SEX, ACTIVITY, DURATION, WT06 (2024 final weight).
- Aggregated to person-day minutes per group.

**Population:**
- AGE ≥ 18: n = 7,509.
- **Non-exerciser:** 0 min in ACTIVITY 1301xx (participating in sports/exercise/recreation); n = 5,973; weighted 79.6%.
- 1302 (attending sporting events) is excluded because spectating is sedentary. Sensitivity: 79.0% using all of category 13, and 78.9% adding travel 1813.

**Grouping** (ASSUMPTION, ipums_4):
- Travel (18xx) goes to its parent category, following the BLS Table 1 convention; 1812 goes to the leisure residual.
- Household management is mapped from 0209 (corrected from 0207).

**Statistics** (ipums_5):
- WT06-weighted mean and SD (population form).
- Weighted median, p10 and p90 (inverse CDF).
- Participation = weighted % of people with > 0 min.

**Energy** (ipums_6; nonexerciser_baseline_v2.csv):
- Gross = Σ (mean min / 60 × MET), using atus_to_compendium.csv codes: **33.20 MET-h/day**.
- Net = gross − 24 × 1.0 = **9.20**. The model's deterministic check gives Σ min·(MET−1)/60 = 9.200 (math_v05_2; demo_output_v6). These agree because every group has MET ≥ 1.
- Per-person gross (survey spread): SD 4.40, p10 28.22, p50 32.60, p90 38.80. nonexerciser_baseline_v2.csv, method_log ipums_6, methods_notes and spec.md §10 all give these values.
- Group means sum to 1440.0 (the demo prints "Raw ATUS minutes 1440.0").

| Group | mean min | SD | particip. % | Code | MET |
|---|---|---|---|---|---|
| sleep | 543.9 | 142.4 | 99.9 | 07030 | 1.0 |
| work | 219.7 | 278.1 | 44.5 | 11580 | 1.5 |
| tv | 163.1 | 183.2 | 72.7 | 07020 | 1.0 |
| other_leisure_residual | 92.4 | 143.0 | 60.0 | 09040 | 1.3 |
| eating | 73.2 | 61.7 | 95.3 | 13030 | 1.5 |
| personal_care_nonsleep | 44.6 | 55.9 | 78.8 | 13040 | 2.0 |
| purchasing | 42.0 | 77.5 | 39.9 | 05065 | 2.3 |
| food_prep | 40.7 | 57.4 | 63.8 | 05050 | 2.0 |
| housework | 39.3 | 81.7 | 37.2 | 05040 | 2.5 |
| care_household | 33.8 | 91.0 | 23.2 | 05184 | 2.5 |
| socializing | 32.4 | 79.7 | 28.2 | 09055 | 1.3 |
| hh_other_residual | 24.7 | 72.4 | 30.2 | 05025 | 2.8 |
| org_civic_religious | 19.2 | 70.0 | 12.6 | 09055 | 1.3 |
| education | 14.9 | 77.0 | 5.5 | 09065 | 1.8 |
| lawn_garden | 12.5 | 53.4 | 9.4 | 08245 | 3.8 |
| other_nec | 12.3 | 48.1 | 15.1 | 07021 | 1.0 |
| hh_management | 11.7 | 42.8 | 21.6 | 09040 | 1.3 |
| care_nonhousehold | 10.4 | 51.4 | 8.3 | 05184 | 2.5 |
| phone_mail | 7.6 | 30.3 | 11.8 | 09055 | 1.3 |
| sports_exercise (residual, e.g. spectating) | 1.6 | 20.8 | 0.9 | 07021 | 1.0 |

**Mapping groups to share rows** (ASSUMPTION, model.R A2; unchanged from v001):
- sleep → lying
- seated groups → sitting
- personal care → standing
- household and care groups → household
- lawn → gardening
- purchasing → walking

## 5. Activation / share estimation

**Share rule** (unchanged, method_log share_1):

$$\bar s_{a,p}=\frac{m_p I_{a,p}}{\sum_q m_q I_{a,q}}$$

- Mass fractions: muscle_mass_8part_v1.csv, average row. Arms 0.148, shoulders 0.0634, chest 0.0528, upper_back 0.074, core 0.0423, lower_back 0.0423, hips_glutes 0.1443, legs 0.4329.
- These rest on assumed sub-splits: legs/hips 0.75/0.25, arms/shoulders 0.70/0.30, trunk 0.25/0.35/0.20/0.20, and a 50/50 sex mix.

**Change in v1.1** (method_log v1.1_1):
- The sitting lower_back index changed from 5 (ASSUMPTION) to **13 %MVIC (cited)**. Source: O'Sullivan 2006, superficial lumbar multifidus in slump and thoracic upright sitting, n = 22.
- The sitting row was renormalized: lower_back 0.0907 → 0.206 and legs 0.4643 → 0.4054.
- activation_shares_v1.1.csv is identical to v1 (v1.1_2).

**Cell status, v1.1** (104 cells):

| Status | Count |
|---|---|
| cited | 8 |
| cited+derived | 1 |
| stand-in | 10 |
| ASSUMPTION | 85 |

- Cited cells: yoga core, lower_back, hips_glutes and legs; yoga upper_back (cited+derived); legs for walking, sitting and standing; sitting lower_back.
- Stand-in cells: walking core and hips; gardening and yard arms, shoulders and legs; sitting and standing hips.

**Uncertainty and display parameters** (all ASSUMPTION unless noted):

| Parameter | Value | Source |
|---|---|---|
| Dirichlet κ (cited / stand-in / ASSUMPTION) | 50 / 20 / 5 | model.R A1 |
| MET CV → sdlog | 0.20 → 0.198 | A4 |
| Design effect for WT06 | 1.5 | A5b, math_v06_1 |
| Offset φ | 0.25 | A6 |
| Band edges | 1.15 / 1.4 / 1.8 | A7; spec.md §5; data-model.md v0.6.1 ("final for alpha") |
| M_cap | 2.5 | A7; spec.md §5; data-model.md v0.6.1 |
| highUncertainty threshold, log2(hi/lo) | 2 | A8 |
| N draws | 4000 | A9 |

## 6. Mathematical model

### 6.1 Net energy

$$\text{net}_a=\begin{cases}0 & \mathrm{MET}_a^{\text{nom}}\le 1\\ \max(\mathrm{MET}_a^{(i)}-1,0) & \text{otherwise}\end{cases},\qquad \mathrm{MET}_a^{(i)}\sim\mathrm{LogNormal}(\log \mathrm{MET}_a^{\text{nom}},\ \sigma),\ \ \sigma=\sqrt{\log(1+\mathrm{CV}^2)}=0.198.$$

- Activities at rest (sleep, TV, sitting codes, MET 1.0) get **net = 0 exactly and no MET noise**. This fixes the v001 artifact, where noise around MET = 1 produced positive "rest work".
- The Compendium value is the median of the draw.
- The sdlog conversion replaces v001's use of CV = 0.20 directly as sdlog.

### 6.2 Work, baseline, offset, multiple

$$W_p=\sum_a \text{net}_a\,t_a^{\text{user}}\,s_{a,p},\qquad B_p=\sum_a \text{net}_a\,t_a^{\text{base}}\,s_{a,p}$$

$$F_p=\varphi\,m_p\sum_q B_q,\qquad M_p=\frac{W_p+F_p}{B_p+F_p},\quad \varphi=0.25.$$

- **Additive-offset floor.** $F_p=\varphi\times m_p\times\sum_q B_q$, where $m_p$ is the part's muscle-mass fraction (muscle_mass_8part_v1.csv, average row) and $\sum_q B_q$ is the total baseline net work across all 8 parts in the same draw. $\varphi=0.25$ is an ASSUMPTION.
- $F_p$ is added to **both** numerator and denominator. It acts as a pseudo-count, a regularizing prior that shrinks parts with low work toward 1×.
- It replaces v001's $W_p/\max(B_p,\text{floor}_p)$. There is no max().
- **smallBaseline** means $F_p>B_p$, i.e. the offset outweighs the part's own baseline work (spec.md §5, data-model.md core flags). model.R reports `offset_gt_B`, the share of draws in which this happens.
- $W_p$ and $B_p$ use the **same** draw. The user's day is that draw's mean baseline day with TV minutes replaced by the logged exercise. A day identical to baseline therefore gives exactly 1× for any φ; demo sedentary: all parts 1 [1, 1].

### 6.3 Baseline minutes uncertainty (v0.6 reference = average day)

Per draw, each group's mean minutes follow

$$t_g\sim\mathrm{Gamma}\big(\text{mean}=\bar t_g,\ \text{SD}=SE_g\big),\quad SE_g=\frac{SD_g}{\sqrt{n/\text{deff}}},\ n=5973,\ \text{deff}=1.5,$$

and the day is rescaled to 1440 min.

- **Minutes rescale:** in v0.4, the v1 table summed to 1440.6, so it was rescaled proportionally to 1440. Each draw is still renormalized. With v2 data, the nominal sum is already 1440.0.
- **History:** this replaces the v001 CV 0.50 ASSUMPTION. It also replaces v0.5's zero-inflated individual-day draws for M (math_v06_1 supersedes math_v05_1). Day-to-day variation is not uncertainty about the average, so it is excluded from M.

### 6.4 Typicality percentile (optional output, math_v06_2)

**Simulating individual days.** In each draw, the model also simulates one individual non-exerciser day using the same METs and shares. Each group is drawn from a zero-inflated Gamma:

$$t_g=\begin{cases}0 & \text{w.p. } 1-\pi_g\\ \mathrm{Gamma}(\mu_c,\ s_c) & \text{w.p. } \pi_g\end{cases},\quad \mu_c=\bar t_g/\pi_g,\quad s_c^2=\frac{SD_g^2+\bar t_g^2}{\pi_g}-\mu_c^2$$

- Groups are drawn independently (ASSUMPTION).
- The day is then rescaled to 1440.

**Definition.** $\text{typ}_p$ = the % of simulated individual days whose part-$p$ work is below the user's median $W_p$. It is not used in M or in the color.

**Model spread vs survey spread** (spec.md §10). These are two different quantities:
- **Survey spread (data, cited):** per-person gross MET-h/day from nonexerciser_baseline_v2.csv (IPUMS ATUS 2024, 18+, WT06): SD 4.40, p10 28.22, p50 32.60, p90 38.80.
- **Model spread (simulated):** the zero-inflated Gamma simulation of individual non-exerciser days.
  - spec.md §10 and method_log math_v06_3 give, for seed 2026: SD 4.13, p10 28.05, p90 38.35 (p50 32.15 per math_v06_3).
  - Across 8 other seeds (4000 draws each): SD 4.06–4.25, p10 27.90–28.12, p90 37.99–38.35.
  - It runs about 6% narrower than the survey because activity groups are drawn independently.
- The R seed-2026 values are **reference only**, not a test target.

**Test tolerances** (spec.md §10; any seed, nDraws ≥ 4000):
1. **Regression test** (HARD, any seed, any implementation): SD in [3.90, 4.40], p10 in [27.6, 28.4], p90 in [37.6, 38.8].
2. **Survey validity test** (HARD): $|SD_{sim}-4.40|/4.40\le0.10$, $|p10_{sim}-28.22|\le1.0$, $|p90_{sim}-38.80|\le1.0$ MET-h/day.
3. **Snapshot test** (HARD): with seed 2026, a TypeScript port must reproduce its **own** committed snapshot to ±0.01. It can't reproduce R's random-number stream.

**Demo calibration.** demo_output_v6.txt line 16 prints SD 4.13, p10 28.05, p50 32.15, p90 38.35. These match the seed-2026 reference above and pass all three HARD tests.

### 6.5 Summaries, color, flags

- **Summaries:** median and 89% interval (5.5%, 94.5%) of $M_p$.
- **Bands** (model.R, spec.md and data-model.md, all v0.6.1; ASSUMPTION, final for alpha): green < 1.15 ≤ yellow-green < 1.4 ≤ orange < 1.8 ≤ red.
- **Color ramp:**
  $$x=\min\!\Big(\frac{\max(\log_2\tilde M_p,0)}{\log_2 2.5},1\Big),$$
  mapped linearly #2E7D32 → #FBC02D → #C62828.
- **straddlesCutoff** (v0.6.1, same in model.R, spec.md and data-model.md): the 89% interval spans **≥ 2** band edges, counting edges $e$ with $lo_{89}<e\le hi_{89}$.
- **highUncertainty:** $\log_2(hi_{89}/lo_{89})>2$.
- **smallBaseline:** $F_p>B_p$. model.R reports offset_gt_B, the share of draws in which this holds.
- **referenceIsAverage:** always shown.

### 6.6 Illustrative output

Source: demo_output_v6.txt, seed 2026, 45 min swapped for TV unless noted. Values are median [89% interval], with band and typicality percentile in parentheses.

| Scenario | Most-affected parts |
|---|---|
| walk30 | legs 1.26 [1.15, 1.43] yellow-green (77); hips_glutes 1.16 [1.05, 1.41] yellow-green (72) |
| run45 | hips_glutes 1.66 [1.06, 3.52] orange (89); legs 1.49 [1.20, 1.92] orange (87) |
| ibike45 (01200) | hips_glutes 1.51 [1.04, 3.09] orange (86); legs 1.48 [1.22, 1.90] orange (87) |
| bike45 | hips_glutes 1.27 yellow-green (79); legs 1.24 yellow-green (78) |
| garden45 | arms 1.58 [1.20, 2.38] orange (82); shoulders 1.56 orange (81) |
| calis45 | arms 1.23 yellow-green; chest 1.24 [1.00, 4.72] yellow-green, highUncertainty |
| yoga45 | upper_back 1.26 yellow-green (75) |
| lift45 | all parts green (medians 1.01–1.14) |
| house45 | all parts green (medians 1.00–1.14) |

**Other demo results:**
- **Small-baseline parts:** the offset exceeds the baseline in about 79–81% of draws for chest, about 69–71% for core and about 57–59% for upper_back.
- **Sensitivity to φ (run45):** hips_glutes median 1.85 / 1.66 / 1.52 and legs 1.55 / 1.48 / 1.42 at φ = 0.05 / 0.25 / 0.5.

## 7. Limitations

1. **Shares are mostly assumed.** 85 of 104 cells are ASSUMPTION. %MVC is treated as an energy split and mixed across studies. Lifting and household activities barely move off green, which reflects the assumed shares rather than data.
2. **Mass fractions** rely on DXA lean mass (not muscle) and on assumed sub-splits.
3. **The offset φ = 0.25 controls the trunk parts.** Chest, core and upper_back are offset-dominated, so their multiples sit near 1× by construction.
4. **Groups are drawn independently**, with deff 1.5 assumed and no replicate weights. The typicality spread is slightly too narrow.
5. **Group METs come from one Compendium code per ATUS group.** Work is coded as desk work (11580, 1.5), and travel is folded into parent categories.
6. **METs assume a standard resting rate.** Differences in body mass, fitness and occupation are not captured. The reference is the average non-exerciser, not the user.
7. **The user day is built by swapping TV minutes** (a scenario ASSUMPTION). Each user activity is mapped to a single Compendium code.
8. **The non-exerciser definition uses a single diary day** (0 min of 1301 that day). It is not a measure of habitual inactivity.

## 8. Software implementation

**model.R v0.6.1:**
- Base R, `set.seed(2026)`, run with `Rscript model.R`.
- Inputs: activation_shares_v1.1, postural_shares_v1.1, muscle_mass_8part_v1, nonexerciser_baseline_v2, atus_nonexercisers_v2 and mets.csv. Only published aggregates are read; raw/ipums is never read.
- All non-file numbers are in ASSUMPTION block A.
- Writes demo_output_v6.txt, including the calibration block and the φ sensitivity table.

**Planned app** (data-model.md v0.6.1 and cursor-prompts.md):
- A TypeScript core ported from model.R, run in a Web Worker with a seeded RNG.
- zod schemas where every number is {value, status, sourceRefs}.
- baseline.json with per-group mean/sd/median/p10/p90/participation/n, population "IPUMS ATUS 2024, adults 18+, WT06, 0 min ATUS 1301", designEffect 1.5 (ASSUMPTION) and perPersonGross.
- Tests (cursor-prompts.md step 3, spec.md §10): an identical day gives exactly 1×; the any-seed regression bands; survey validity; the TS seed-2026 self-snapshot to ±0.01; multiples match demo_output_v6 within the regression tolerance.
- A release guard on GAP and PLACEHOLDER values.

## 9. Changes since v001 and file consistency (re-checked 2026-10-24 20:16 CDT)

**Fixes made in the files since v001:**
- spec.md rewritten (now v0.6.1).
- The max-floor rule replaced by the additive offset.
- straddlesCutoff implemented.
- Net energy set to 0 when MET ≤ 1.
- Minutes rescaled to 1440.
- CV converted to sdlog.
- Six more activities wired (bike, indoor bike, calisthenics, yoga, garden, household).
- mets.csv codes 05065 and 05184 added.
- Sitting lower_back now cited.
- IPUMS 18+ non-exerciser baseline adopted.
- Mean-day reference with SE.
- Typicality percentile added.

**Resolved since v002** (checked against the current files):
- **Bands and cap:** spec.md §5, data-model.md v0.6.1, model.R A7, demo_output_v6 and cursor-prompts.md all use 1.15 / 1.4 / 1.8 with M_cap 2.5.
- **straddlesCutoff:** every file requires ≥ 2 band edges.
- **Version labels:** model.R, the demo, spec.md and data-model.md are all v0.6.1.
- **model.R comments:** the "v0.4 inputs" header line is gone. The A3 comment now says indoor_biking is wired as 01200 (6.8).
- **Provisional vs final:** model.R A7, the demo column note and data-model.md all say "final for alpha" (status ASSUMPTION).
- **data-model.md cleanup:** the PLACEHOLDER header, max-floor rule, MET-truncation note and 15+ population label have been removed or marked superseded.

**Resolved since v003:**
- **README_SUPERSEDED.md** (updated 20:08) now lists the v1 baseline and share files, atus_nonexercisers.csv, model_v1–v5.R, model_v3b.R, spec_v1.md and the old demo outputs.
- **data-model.md data-files section** now describes the offset {phi 0.25, F_p = phi × massFraction_p × Σ B_q}, and smallBaseline as F_p > B_p.
- **IPUMS citation:** the canonical full-name form with "(IPUMS ATUS extract #1, sample at2024)" now appears in methods_notes.md and in all 4 method_log rows (updated 20:09:16).
- **Survey figures:** written to two decimals (SD 4.40, p10 28.22, p50 32.60, p90 38.80, gross 33.20, net 9.20) in nonexerciser_baseline_v2.csv, method_log ipums_6, methods_notes and spec.md §10.

**Resolved since v004** (verified 20:15 CDT):
- **demo_output_v6.txt** has been regenerated (20:11:36). Its calibration is 4.13 / 28.05 / 32.15 / 38.35, matching spec.md, method_log math_v06_3 and cursor-prompts.md. A scratch re-run reproduces it exactly.
- **data-model.md line 52** now gives the spec §10 HARD tests. Line 49 now has two-decimal survey figures (4.40 / 28.22 / 32.60 / 38.80).
- **cursor-prompts.md line 5** now reads data-model v0.6.1.
- **README_SUPERSEDED.md line 2** now points baseline.csv to the current files.

**Resolved since v005** (verified 20:16 CDT):
- **README_SUPERSEDED.md line 3** (updated 20:15:31): baseline_energy.csv is now marked superseded by nonexerciser_baseline_v2.csv (33.20 MET-h/day gross).
- **README_SUPERSEDED.md line 4:** exercise_mets_shares.csv is now marked superseded by mets.csv and activation_shares_v1.1.csv.
- **README_SUPERSEDED.md line 5:** the *_v1 share files are now marked as themselves superseded by *_v1.1.
- **cursor-project-prompt.md** was rebuilt at 20:15:50. It now embeds the current spec.md, data-model.md, model.R, cursor-prompts.md, README_SUPERSEDED.md, demo_output_v6.txt, method_log.csv, the current data CSVs and methods v005, all verbatim.
- **cursor-project-prompt.txt** is a byte-identical copy of the .md.

**Still open (exact conflicts):** none. The prompt's quoted copy of the v005 open-conflicts list is a quotation, not a current value.

## 10. Open gaps

1. Compendium MET SDs (CV 0.20 is ASSUMPTION). Swimming METs.
2. Cross-group covariance of ATUS minutes. Replicate-weight SEs (deff 1.5 is ASSUMPTION).
3. Whole-body EMG (trunk and arms) for walking, running, cycling and lifting. Time-averaged gait trunk/hip EMG.
4. Park 2014 tables (v1.1_2). Tikkanen 2013 per-task values.
5. An anatomical source for the mass sub-splits (candidate: Clarys 1984).
6. Calibration or user testing of φ, the band edges, M_cap and κ (all ASSUMPTION).
7. Wiring the indoor-cycling intensity codes (01214, 01216, 01220) and yard work 08261 as user choices.


---

## 3. Mathematician & Statistician: model and data (v0.6.1)

### 3.1 spec.md (v0.6.1) → commit as reference/spec.md

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


### 3.2 data-model.md (v0.6.1) → commit as reference/data-model.md

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


### 3.3 model.R (v0.6.1) → commit as reference/model.R

```r
# =============================================================================
# Body — phase alpha model, v0.6.1(base R only, no packages)   [v0.5 = model_v5.R]
# -----------------------------------------------------------------------------
# For each of 8 coarse body parts: how many times more muscular work did the
# user do today than a typical non-exercising American does in a day?
#
#   Work      W_p = sum_a (MET_a - 1) * minutes_a * share_{a,p}    (net MET-min)
#   Baseline  B_p = same formula on the non-exerciser day
#   Offset    F_p = phi * massFraction_p * sum_p B_p
#   Multiple  M_p = (W_p + F_p) / (B_p + F_p)        (v0.3b: replaces max-floor)
#
# Inputs (v0.6.1: Body Researcher round 1 + v1.1, IPUMS baseline v2): activation_shares_v1.1.csv,
# postural_shares_v1.1.csv (O'Sullivan 2006 sitting lower back), muscle_mass_8part_v1.csv, nonexerciser_baseline_v2.csv + atus_nonexercisers_v2.csv
# (IPUMS ATUS 2024, adults 18+, WT06-weighted aggregates only; raw microdata not read),
# mets.csv (Compendium METs for the scenario exercises only).
# Superseded files (README_SUPERSEDED.md) are NOT read.
# Every number not in those files is in the ASSUMPTION block below.
# Run:  Rscript model.R
# =============================================================================
set.seed(2026); options(width = 200)
here  <- if (dir.exists("/workspace/body")) "/workspace/body" else "."
parts <- c("arms","shoulders","chest","upper_back","core","lower_back","hips_glutes","legs")

# =============================================================================
# 0. ASSUMPTION PARAMETERS  (nothing here comes from a cited file)
# =============================================================================
A <- list()

# A1. Dirichlet concentration PER CELL, chosen by the cell's status label.
#     For activity a, alpha_{a,p} = kappa(status_{a,p}) * sbar_{a,p}.
#     Rethinking intuition: kappa acts like a "pseudo-sample size". With all cells
#     at one kappa this is the usual Dirichlet(kappa * sbar); mixing kappas means
#     confident cells wobble less, guessed cells wobble more. (Side effect: the
#     mean is no longer exactly sbar; it tilts toward low-kappa cells. Reported below.)
A$kappa <- c(cited = 50, stand_in = 20, ASSUMPTION = 5)
#     Status strings in the files -> one of the three classes above:
status_class <- function(s) ifelse(grepl("^cited", s), "cited",
                             ifelse(grepl("^stand-in", s), "stand_in", "ASSUMPTION"))

# A2. Which share row each baseline (ATUS) category uses. The researcher gave
#     postural rows (sitting/standing/lying) and activity rows, but no mapping
#     from ATUS categories to rows, so this mapping is ASSUMED.
A$base_row <- c(
  sleep = "lying",
  tv = "sitting", eating = "sitting", work = "sitting", education = "sitting",
  hh_management = "sitting", org_civic_religious = "sitting", socializing = "sitting",
  phone_mail = "sitting", other_leisure_residual = "sitting", other_nec = "sitting",
  sports_exercise = "sitting",          # researcher reassigned this to sitting (07021)
  personal_care_nonsleep = "standing",
  housework = "household", food_prep = "household", hh_other_residual = "household",
  care_household = "household", care_nonhousehold = "household",
  lawn_garden = "gardening",
  purchasing = "walking")

# A3. Scenario exercises: Compendium id (mets.csv) -> share row (ASSUMED pairing).
#     indoor_biking is wired as Compendium 01200 (6.8 MET), using the cycling shares (v0.5+)
#     (would need a MET; not invented).
A$exercise <- data.frame(
  activity_id = c("walk_brisk", "jog",     "resist_multi",  "bike_leisure", "indoor_bike_general",
                  "calisthenics_mod", "yoga_hatha", "garden",    "chore_clean_light"),
  row         = c("walking",    "running", "weightlifting", "bicycling",     "indoor_biking",
                  "calisthenics",     "yoga",       "gardening", "household"),
  stringsAsFactors = FALSE)

# A4. MET uncertainty: Compendium SD is GAP -> ASSUMED CV of 0.20 on the MET scale.
#     A CV is not a log-SD. For a lognormal, CV^2 = exp(sdlog^2) - 1, so
#     sdlog = sqrt(log(1 + CV^2)) = 0.198 for CV 0.20 (v0.3b used 0.20 directly;
#     tiny numeric difference, but now the label is true).
#     MET ~ LogNormal(meanlog = log(MET_compendium), sdlog): the Compendium value
#     is the MEDIAN of the draw.
A$met_cv <- 0.20
met_sdlog <- sqrt(log(1 + A$met_cv^2))
#     Net energy rule (v0.4): activities whose nominal MET <= 1 (sleep 1.0, TV 1.0,
#     sitting 1.0) are AT REST by definition, so net = 0 exactly and they get no
#     MET noise. Otherwise noise in MET would create positive net work from
#     resting (v0.3b: E[max(MET_draw - 1, 0)] > 0 even when MET = 1). For MET > 1,
#     net = max(MET_draw - 1, 0).
# A5. (v0.5) Baseline minutes now use REAL per-group weighted mean, SD and
#     participation (atus_nonexercisers_v2.csv). Zero-inflated Gamma per group:
#       participate ~ Bernoulli(pi);  if yes, minutes ~ Gamma(mean mu_c, sd s_c)
#       mu_c = mean / pi;  s_c^2 = (SD^2 + mean^2) / pi - mu_c^2
#     (moment-matched so the unconditional mean and SD equal the cited ones).
#     Then the day is rescaled to 1440. ASSUMPTIONS that remain: groups are drawn
#     independently (cross-group correlation not available), and the rescale to
#     1440 changes the per-group SDs somewhat. A$min_cv is no longer used.
#     (old:) minutes ~ Gamma(mean, CV = min_cv),
#     then the day is rescaled to 1440 min.
A$min_cv <- NA    # retired in v0.5
# A5b. (v0.6) DESIGN: the reference is the AVERAGE non-exerciser day. Baseline
#     minutes per group = cited weighted mean; its uncertainty is only the
#     SAMPLING ERROR of that mean: SE = SD / sqrt(n_eff), n_eff = n / deff.
#     deff = 1.5 is an ASSUMPTION for WT06 weighting (no replicate weights used).
#     Means are drawn as Gamma(mean, SE), then rescaled to 1440.
#     Day-to-day variation (the zero-inflated Gamma above) is used ONLY for the
#     optional typicality percentile, not for M.
A$deff <- 1.5
A$zero_inflate <- TRUE
# A6. Offset multiplier phi in F_p = phi * massFraction_p * sum_p B_p.
#     WHY AN OFFSET: adding the same pseudo-count F_p to work and baseline is
#     shrinkage toward 1x. Parts whose baseline work is tiny (chest, core) would
#     otherwise give wild ratios from tiny denominators; F_p acts like a prior
#     "imaginary baseline day" of work, so M_p only moves away from 1x when the
#     data (real work) are large relative to that prior -- the same logic as a
#     regularizing prior in Statistical Rethinking (ch. 7), or adding pseudo-counts
#     to a Beta/Dirichlet. Bigger phi = stronger pull to 1x. A day identical to
#     baseline gives exactly 1x for any phi.
A$phi <- 0.25
# A7. Colour bands (ASSUMPTION, final for alpha, v0.6.1): edges at 1.15, 1.4, 1.8.
#     green < 1.15 <= yellow-green < 1.4 <= orange < 1.8 <= red.
#     Continuous ramp on log2(M) from 1x (green) to M_cap = 2.5x (full red).
A$band_edges <- c(1.15, 1.4, 1.8)
A$band_names <- c("green", "yellow-green", "orange", "red")
A$M_cap <- 2.5
# A8. highUncertainty flag: log2(hi89 / lo89) > 2  (interval spans > 4x).
A$hu_log2 <- 2
# A9. Monte Carlo draws.
A$N <- 4000
# A10. Mass fractions: use the "average" row (researcher's mass_7 = 50/50 sex mix).
A$mass_sex <- "average"

# =============================================================================
# 1. LOAD DATA
# =============================================================================
rd  <- function(f) read.csv(file.path(here, f), stringsAsFactors = FALSE, colClasses = "character")
num <- function(x) suppressWarnings(as.numeric(x))       # "GAP" -> NA, never imputed

act  <- rd("activation_shares_v1.1.csv")
post <- rd("postural_shares_v1.1.csv")
mm   <- rd("muscle_mass_8part_v1.csv")
base <- rd("nonexerciser_baseline_v2.csv")
atv2 <- rd("atus_nonexercisers_v2.csv")
mets <- rd("mets.csv")

shares_long <- rbind(act, post)
shares_long$share <- num(shares_long$share)

# --- 1a. Share table: one row per activity/posture, columns = parts ---------
rows <- unique(shares_long$activity_id)
Sbar <- matrix(NA, length(rows), 8, dimnames = list(rows, parts))
Kap  <- Sbar
for (i in seq_len(nrow(shares_long))) {
  r <- shares_long[i, ]
  Sbar[r$activity_id, r$part] <- r$share
  Kap[r$activity_id, r$part]  <- A$kappa[[status_class(r$status)]]
}
stopifnot(!anyNA(Sbar))
rowsum_err <- abs(rowSums(Sbar) - 1)          # researcher says every row sums to 1
Sbar <- Sbar / rowSums(Sbar)                  # remove 4-decimal rounding only

# --- 1b. Mass fractions ------------------------------------------------------
mass <- setNames(num(mm$fraction[mm$sex == A$mass_sex]), mm$part[mm$sex == A$mass_sex])[parts]
mass_sum <- sum(mass)
mass <- mass / sum(mass)

# --- 1c. Baseline day (drop the TOTAL row) -----------------------------------
ref_net <- num(base$MET_h[base$activity_id == "TOTAL_net"])     # researcher: 9.2
base <- base[!grepl("^(TOTAL|per_person)", base$activity_id), ]
base$min <- num(base$mean_min_per_day); base$MET <- num(base$MET)
base <- merge(base, atv2[, c("activity_id","sd_min","participation_rate_pct")], by = "activity_id", sort = FALSE)
base$n <- num(atv2$n[match(base$activity_id, atv2$activity_id)])
base$se <- num(base$sd_min) / sqrt(base$n / A$deff)
base$sd <- num(base$sd_min); base$pi <- num(base$participation_rate_pct) / 100
if (!A$zero_inflate) base$pi <- 1
base$mu_c <- base$min / base$pi
base$sd_c <- sqrt(pmax((base$sd^2 + base$min^2) / base$pi - base$mu_c^2, 0))
stopifnot(all(base$sd_c > 0))
# Fix (v0.4): ATUS category means sum to 1440.6 (rounding in the published table).
# Rescale every category proportionally so the nominal day is exactly 1440 min:
# min_a <- min_a * 1440 / sum(min). (Each MC draw is also rescaled to 1440.)
raw_min_sum <- sum(base$min)
base$min <- base$min * 1440 / raw_min_sum
stopifnot(all(base$activity_id %in% names(A$base_row)))

# --- 1d. All activities the model knows: baseline categories + exercises -----
ex <- merge(A$exercise, mets[, c("activity_id", "compendium_code", "MET")], by = "activity_id")
ex$MET <- num(ex$MET)
acts  <- c(base$activity_id, ex$activity_id)
MET0  <- setNames(c(base$MET, ex$MET), acts)
rowOf <- setNames(c(A$base_row[base$activity_id], ex$row), acts)

# =============================================================================
# 2. CORE FUNCTIONS
# =============================================================================
# Dirichlet via normalised Gammas (the standard trick; Rethinking ch. on simplexes)
rdirichlet1 <- function(alpha) { g <- rgamma(length(alpha), alpha, 1); g / sum(g) }
# Gamma with given mean m and coefficient of variation cv: shape = 1/cv^2
# Gamma from mean m and SD s: shape = (m/s)^2, rate = m/s^2; zero-inflated by pi
rzigamma <- function(m, s, p) ifelse(runif(length(m)) < p, rgamma(length(m), (m / s)^2, m / s^2), 0)
rgamma_mcv  <- function(m, cv) ifelse(m > 0, rgamma(length(m), 1 / cv^2, 1 / (cv^2 * m)), 0)

# extra = named exercise minutes swapped in for TV on the MEAN baseline day of
# this draw (same METs, shares and mean minutes for W and B -> sedentary = 1x).
# Also returns, per draw, one simulated INDIVIDUAL non-exerciser day (v0.5
# zero-inflated Gamma) using the same METs/shares, for the typicality percentile.
rgamma_ms <- function(m, s) rgamma(length(m), (m / s)^2, m / s^2)
simulate_day <- function(extra = NULL, N = A$N, phi = A$phi) {
  M <- Mraw <- FB <- Wm <- Bind <- matrix(NA, N, 8, dimnames = list(NULL, parts))
  gross_ind <- numeric(N)
  for (i in 1:N) {
    MET <- exp(rnorm(length(acts), log(MET0), met_sdlog))
    net <- ifelse(MET0 <= 1, 0, pmax(MET - 1, 0))   # resting activities: net = 0
    Srow <- t(sapply(rows, function(r) rdirichlet1(Kap[r, ] * Sbar[r, ])))
    dimnames(Srow) <- list(rows, parts)
    S <- Srow[rowOf, , drop = FALSE]
    # (iii) MEAN baseline minutes: sampling error of the weighted mean only
    bm <- setNames(rep(0, length(acts)), acts)
    bm[base$activity_id] <- rgamma_ms(base$min, base$se)
    bm <- bm / sum(bm) * 1440
    B  <- drop((net * bm) %*% S)
    um <- bm
    if (length(extra)) {
      um["tv"] <- max(um["tv"] - sum(extra), 0)
      um[names(extra)] <- um[names(extra)] + extra
    }
    W  <- drop((net * um) %*% S)
    Fp <- phi * mass * sum(B)                 # additive offset (pseudo-count)
    M[i, ]    <- (W + Fp) / (B + Fp)
    Mraw[i, ] <- W / B
    FB[i, ]   <- Fp > B
    Wm[i, ]   <- W
    # (iv) one INDIVIDUAL non-exerciser day (day-to-day spread) for typicality
    im <- setNames(rep(0, length(acts)), acts)
    im[base$activity_id] <- rzigamma(base$mu_c, base$sd_c, base$pi)
    im <- im / sum(im) * 1440
    Bind[i, ] <- drop((net * im) %*% S)
    gross_ind[i] <- sum(im * MET0) / 60      # nominal METs, comparable to cited gross
  }
  list(M = M, Mraw = Mraw, FB = FB, W = Wm, Bind = Bind, gross_ind = gross_ind)
}
# Typicality percentile (optional output): share of individual non-exerciser
# days whose part work is below the user's median part work.
typicality <- function(sim) round(100 * sapply(parts, function(p) mean(sim$Bind[, p] < median(sim$W[, p]))), 0)

band_of <- function(M) A$band_names[findInterval(M, A$band_edges) + 1]
# straddlesCutoff (v0.6.1): the 89% interval spans >= 2 band edges (lo < edge <= hi)
straddles <- function(lo, hi) sapply(seq_along(lo), function(i) sum(lo[i] < A$band_edges & A$band_edges <= hi[i]) >= 2)
color_of <- function(M) {
  x <- pmin(pmax(log2(M), 0) / log2(A$M_cap), 1)
  rgb(colorRamp(c("#2E7D32", "#FBC02D", "#C62828"))(x), maxColorValue = 255)
}
summarise <- function(sim) {
  q <- t(apply(sim$M, 2, quantile, c(.055, .5, .945)))     # 89% interval
  data.frame(part = parts, lo89 = round(q[,1], 2), median = round(q[,2], 2),
             hi89 = round(q[,3], 2), band = band_of(q[,2]), color = color_of(q[,2]),
             straddlesCutoff = straddles(q[,1], q[,3]),
             log2_hi_lo = round(log2(q[,3] / q[,1]), 2),
             highUncertainty = log2(q[,3] / q[,1]) > A$hu_log2,
             offset_gt_B = round(colMeans(sim$FB), 3),
             typ_pct = typicality(sim))
}

# =============================================================================
# 3. SCENARIOS (ASSUMED: built from the ATUS mean day by swapping TV time)
# =============================================================================
days <- list(sedentary = NULL,                       # literally the baseline day
             walk30    = c(walk_brisk = 30),
             run45     = c(jog = 45),
             lift45    = c(resist_multi = 45),
             bike45    = c(bike_leisure = 45),
             ibike45   = c(indoor_bike_general = 45),
             calis45   = c(calisthenics_mod = 45),
             yoga45    = c(yoga_hatha = 45),
             garden45  = c(garden = 45),
             house45   = c(chore_clean_light = 45))
sink(file.path(here, "demo_output_v6.txt"), split = TRUE)
cat("Body model v0.6.1 —", format(Sys.time()), "\n")
cat(sprintf("Raw ATUS minutes %.1f rescaled to %.1f\n", raw_min_sum, sum(base$min)))
cat(sprintf("Deterministic baseline net = %.3f MET-h/day (researcher TOTAL_net %.2f)\n", sum(base$min * pmax(base$MET - 1, 0)) / 60, ref_net))
cat("Inputs: activation/postural_shares_v1.1, muscle_mass_8part_v1 (average), nonexerciser_baseline_v2 + atus_nonexercisers_v2 (IPUMS 18+), mets.csv\n")
cat(sprintf("Baseline minutes sum = %.1f; gross = %.2f MET-h/day; net = %.2f MET-h/day\n",
            sum(base$min), sum(base$min * base$MET) / 60, sum(base$min * (base$MET - 1)) / 60))
cat(sprintf("Mass fractions (%s) summed to %.4f before renormalising\n", A$mass_sex, mass_sum))
cat(sprintf("Max share row-sum error before renormalising: %.4f\n", max(rowsum_err)))
cat("Exercise METs: "); cat(sprintf("%s(%s)=%.1f ", ex$activity_id, ex$compendium_code, ex$MET)); cat("\n")
cat(sprintf("ASSUMPTIONS: kappa cited/stand-in/ASSUMPTION = %s; MET CV %.2f (sdlog %.3f); baseline = mean day, SE with deff %.1f; phi %.2f (offset); M_cap %g; N %d\n",
            paste(A$kappa, collapse = "/"), A$met_cv, met_sdlog, A$deff, A$phi, A$M_cap, A$N))
cat("\nColumns: median and 89% interval of M; band = ASSUMPTION band (final for alpha) of the median;\nstraddlesCutoff = 89% interval spans >= 2 band edges; highUncertainty = log2(hi/lo) > 2;\n",
    "offset_gt_B = share of draws where offset F_p exceeds baseline B_p;\ntyp_pct = typicality percentile vs individual non-exerciser days (day-to-day spread).\n", sep = "")
# --- Calibration of individual-day spread vs cited per-person gross MET-h ---
cal <- simulate_day(NULL)$gross_ind
cat(sprintf("\nCalibration (individual days, gross MET-h/day): SD %.2f (cited 4.40); p10 %.2f (28.22); p50 %.2f (32.60); p90 %.2f (38.80)\n",
            sd(cal), quantile(cal, .1), quantile(cal, .5), quantile(cal, .9)))
res <- list()
for (d in names(days)) {
  cat("\n=== Scenario:", d, "===\n")
  res[[d]] <- summarise(simulate_day(days[[d]]))
  print(res[[d]], row.names = FALSE)
}
cat("\n=== Sensitivity: run45 medians by phi (ASSUMPTION) ===\n")
sens <- sapply(c(0.05, 0.25, 0.5), function(ph) {
  set.seed(2026); round(apply(simulate_day(days$run45, phi = ph)$M, 2, median), 2) })
colnames(sens) <- paste0("phi=", c(0.05, 0.25, 0.5)); print(sens)
sink()

```

### reference/data/mets.csv

```csv
activity_id,compendium_code,description,MET,MET_sd_or_range,source,table_page,population,imputed_flag
sleep,07030,Sleeping,1.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
sit_tv,07020,"Sit, watch television",1.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
sit_quiet,07021,"Sitting quietly, general",1.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
sit_computer,09040,"Sitting: writing, desk work, typing",1.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
sit_talk,09055,Sitting: talking in person/phone/computer,1.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
eat_sit,13030,"Eating, sitting",1.5,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
stand_quiet,07040,Standing quietly (standing in a line),1.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
stand_misc,09071,Standing: miscellaneous,2.5,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
walk_household,17150,"Walking, household",2.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
walk_slow,17170,"Walking, 2.5 mph, firm, level",3.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
walk_normal,17190,"Walking, 2.8-3.4 mph, level, moderate",3.8,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
walk_brisk,17200,"Walking, 3.5-3.9 mph, brisk, exercise",4.8,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
stairs_slow,17133,"Stair climbing, slow pace",4.5,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
chore_clean_light,05040,"Cleaning, general, light",2.5,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
chore_sweep,05010,"Cleaning, sweeping floors",3.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
chore_vacuum,05043,"Vacuuming, general, moderate",3.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
chore_cook,05050,"Cooking/food prep, general, light",2.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
chore_dishes,05042,"Wash/clear dishes, walking, light",2.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
chore_multi,05025,"Multiple household tasks, light",2.8,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
shopping,05065,"Non-food shopping, standing or walking",2.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
childcare,05184,"Infant care, general (lower bound 05185 seated childcare 2.0)",2.5,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
garden,08245,"Gardening, general, moderate",3.8,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
yard,08261,"Yardwork, general, moderate",4.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
driving,16010,Automobile/light truck driving,2.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
riding_car,16015,Riding in a car or truck,1.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
grooming,13040,"Grooming, sitting or standing",2.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
shower,13050,"Showering, toweling off, standing",2.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
occ_sit_light,11580,"Sitting tasks, light effort (office)",1.5,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
occ_stand_light,11600,"Standing tasks, light effort",1.8,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
occ_stand_mod,11610,"Standing, light/moderate effort",3.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
jog,12020,"Jogging, general, self-selected",7.5,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
run_5mph,12030,"Running, 5.0-5.2 mph",8.5,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
bike_leisure,01010,"Bicycling, <10 mph, leisure",4.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
bike_easy,01015,"Bicycling, self-selected easy pace",4.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
resist_multi,02054,"Resistance training, multiple exercises, 8-15 reps",3.5,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
resist_squat_deadlift,02052,"Resistance training, squats, deadlift",5.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
resist_vigorous,02050,"Resistance training, power lifting/body building, vigorous",6.0,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
calisthenics_mod,02022,"Calisthenics, moderate",3.8,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
yoga_hatha,02150,"Yoga, Hatha",2.3,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
pilates,02105,"Pilates, general",2.8,GAP (Compendium publishes point values; SD not in code list),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF,adults 19-59,no
swim,GAP,Swimming codes (18xxx) not extracted this pass,GAP,,"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",,,GAP
resist_bench/row/press,GAP,Compendium has no region-specific resistance codes; use 02054/02050,GAP,,"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",,,GAP
indoor_bike_general,01200,"Bicycling, stationary, general",6.8,GAP (point values only),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF (Bicycling),adults 19-59,no
indoor_bike_light,01214,"Bicycling, stationary, 50 watts, light effort",4.0,GAP (point values only),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF (Bicycling),adults 19-59,no
indoor_bike_light_moderate,01216,"Bicycling, stationary, 60 watts, light to moderate effort",5.0,GAP (point values only),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF (Bicycling),adults 19-59,no
indoor_bike_moderate,01220,"Bicycling, stationary, 90-100 watts, moderate to vigorous",6.0,GAP (point values only),"Herrmann SD et al., 2024, '2024 Adult Compendium of Physical Activities', https://doi.org/10.1016/j.jshs.2023.10.010 ; code list PDF https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf",code list PDF (Bicycling),adults 19-59,no

```

### reference/data/top10.csv

```csv
rank,activity,pct_US_adults,source_url,verification,quality
1,Walking,43.9 (44.1 in PLOS One),https://doi.org/10.1249/01.mss.0000981132.53032.99,abstract text read; cross-checked with PLOS One 2019 BRFSS,High
2,Running/jogging,11.6 (11.7),https://doi.org/10.1249/01.mss.0000981132.53032.99,same,High
3,Weightlifting,10.7,https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0345026,PLOS One results text; absent from MSSE abstract top-10 (category grouping differs),Medium-High
4,Gardening,5.8,https://doi.org/10.1249/01.mss.0000981132.53032.99,both sources agree,High
5,Bicycling,3.8,https://doi.org/10.1249/01.mss.0000981132.53032.99,both sources agree,High
6,Yard work,2.8,https://doi.org/10.1249/01.mss.0000981132.53032.99,MSSE abstract only,Medium
7,Household activities,2.6,https://doi.org/10.1249/01.mss.0000981132.53032.99,MSSE abstract only,Medium
8,Calisthenics,2.4,https://doi.org/10.1249/01.mss.0000981132.53032.99,MSSE abstract only,Medium
9,Yoga,2.2,https://doi.org/10.1249/01.mss.0000981132.53032.99,MSSE abstract only,Medium
10,Indoor biking,2.2,https://doi.org/10.1249/01.mss.0000981132.53032.99,MSSE abstract only,Medium
note,"'Other' (9.2%) excluded. Metric = % of all adults naming the activity as one of their top 2 in the past month (BRFSS 2019). ATUS 2024: 21.5% do any sport/exercise on an average day (https://www.bls.gov/news.release/archives/atus_06262025.htm)",,,

```

### reference/data/activation_shares_v1.1.csv

```csv
activity_id,part,share,index_pctMVC,mass_fraction,status,confidence,method,source
walking,arms,0.0339,3,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",Collins 2009 minimal shoulder torque
walking,shoulders,0.0145,3,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",Collins 2009
walking,chest,0.0081,2,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
walking,upper_back,0.0226,4,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
walking,core,0.0161,5,0.0423,stand-in,low,"share_1 (mass x index, normalized)",White & McNair 2002 Clin Biomech (abdominals <5% MVC walking) Clin Biomech 17:177-184 (copy: https://studyres.com/doc/4295915/abdominal-and-erector-spinae-muscle-activity-during)
walking,lower_back,0.0323,10,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",ES bursts near foot strike per White&McNair; magnitude assumed
walking,hips_glutes,0.2181,19.8,0.1443,stand-in,low,"share_1 (mass x index, normalized)",APNM thigh/hip value reused
walking,legs,0.6544,19.8,0.4329,cited,medium,"share_1 (mass x index, normalized)",APNM 2025 https://doi.org/10.1139/apnm-2025-0097 walking thigh/hip mean %MVC
running,arms,0.0439,8,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",Arellano&Kram 2014 arm swing active
running,shoulders,0.0235,10,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",
running,chest,0.0078,4,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
running,upper_back,0.0219,8,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
running,core,0.0157,10,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
running,lower_back,0.0313,20,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
running,hips_glutes,0.214,40,0.1443,ASSUMPTION,low,"share_1 (mass x index, normalized)",
running,legs,0.6419,40,0.4329,ASSUMPTION,low,"share_1 (mass x index, normalized)",~2x walking
weightlifting,arms,0.148,40,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",general whole-body program assumed equal intensity
weightlifting,shoulders,0.0634,40,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",general whole-body program assumed equal intensity
weightlifting,chest,0.0528,40,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",general whole-body program assumed equal intensity
weightlifting,upper_back,0.074,40,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",general whole-body program assumed equal intensity
weightlifting,core,0.0423,40,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",general whole-body program assumed equal intensity
weightlifting,lower_back,0.0423,40,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",general whole-body program assumed equal intensity
weightlifting,hips_glutes,0.1443,40,0.1443,ASSUMPTION,low,"share_1 (mass x index, normalized)",general whole-body program assumed equal intensity
weightlifting,legs,0.4329,40,0.4329,ASSUMPTION,low,"share_1 (mass x index, normalized)",general whole-body program assumed equal intensity
gardening,arms,0.2709,30,0.148,stand-in,low,"share_1 (mass x index, normalized)",Park 2014 Kor J Hort Sci https://doi.org/10.7235/hort.2014.14059 (abstract: forearm/anterior deltoid highest; tables not extracted)
gardening,shoulders,0.0967,25,0.0634,stand-in,low,"share_1 (mass x index, normalized)",Park 2014 Kor J Hort Sci https://doi.org/10.7235/hort.2014.14059 (abstract: forearm/anterior deltoid highest; tables not extracted)
gardening,chest,0.0258,8,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
gardening,upper_back,0.0677,15,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
gardening,core,0.0258,10,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
gardening,lower_back,0.0644,25,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",stooped work
gardening,hips_glutes,0.132,15,0.1443,ASSUMPTION,low,"share_1 (mass x index, normalized)",
gardening,legs,0.3168,12,0.4329,stand-in,low,"share_1 (mass x index, normalized)",Park 2014 Kor J Hort Sci https://doi.org/10.7235/hort.2014.14059 (abstract: forearm/anterior deltoid highest; tables not extracted) lower limb lower than upper
bicycling,arms,0.0322,4,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",handlebar support
bicycling,shoulders,0.0138,4,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",
bicycling,chest,0.0057,2,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
bicycling,upper_back,0.0161,4,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
bicycling,core,0.0115,5,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
bicycling,lower_back,0.0184,8,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
bicycling,hips_glutes,0.1961,25,0.1443,ASSUMPTION,low,"share_1 (mass x index, normalized)",
bicycling,legs,0.7061,30,0.4329,ASSUMPTION,low,"share_1 (mass x index, normalized)",
yard_work,arms,0.2709,30,0.148,stand-in,low,"share_1 (mass x index, normalized)",Park 2014 Kor J Hort Sci https://doi.org/10.7235/hort.2014.14059 (abstract: forearm/anterior deltoid highest; tables not extracted)
yard_work,shoulders,0.0967,25,0.0634,stand-in,low,"share_1 (mass x index, normalized)",Park 2014 Kor J Hort Sci https://doi.org/10.7235/hort.2014.14059 (abstract: forearm/anterior deltoid highest; tables not extracted)
yard_work,chest,0.0258,8,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
yard_work,upper_back,0.0677,15,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
yard_work,core,0.0258,10,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
yard_work,lower_back,0.0644,25,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",stooped work
yard_work,hips_glutes,0.132,15,0.1443,ASSUMPTION,low,"share_1 (mass x index, normalized)",
yard_work,legs,0.3168,12,0.4329,stand-in,low,"share_1 (mass x index, normalized)",Park 2014 Kor J Hort Sci https://doi.org/10.7235/hort.2014.14059 (abstract: forearm/anterior deltoid highest; tables not extracted) lower limb lower than upper
household,arms,0.2141,15,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",
household,shoulders,0.0734,12,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",
household,chest,0.0255,5,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
household,upper_back,0.0571,8,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
household,core,0.0245,6,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
household,lower_back,0.0489,12,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
household,hips_glutes,0.1391,10,0.1443,ASSUMPTION,low,"share_1 (mass x index, normalized)",
household,legs,0.4174,10,0.4329,ASSUMPTION,low,"share_1 (mass x index, normalized)",
calisthenics,arms,0.1865,40,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",push-up/dip
calisthenics,shoulders,0.07,35,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",
calisthenics,chest,0.0666,40,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
calisthenics,upper_back,0.0582,25,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
calisthenics,core,0.0466,35,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",plank/sit-up
calisthenics,lower_back,0.0266,20,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
calisthenics,hips_glutes,0.1364,30,0.1443,ASSUMPTION,low,"share_1 (mass x index, normalized)",squat/lunge
calisthenics,legs,0.4091,30,0.4329,ASSUMPTION,low,"share_1 (mass x index, normalized)",
yoga,arms,0.127,30,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",not measured; plank/chaturanga assumed ~core-legs level
yoga,shoulders,0.0544,30,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",not measured
yoga,chest,0.0378,25,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",not measured
yoga,upper_back,0.0839,39.65,0.074,cited+derived,low,"share_1 (mass x index, normalized)","Mullerpatan 2020 Int J Yoga PMC7336940 mean of lower trapezius 41.9, latissimus 37.4"
yoga,core,0.0276,22.8,0.0423,cited,medium,"share_1 (mass x index, normalized)",Mullerpatan 2020 Int J Yoga PMC7336940 rectus abdominis
yoga,lower_back,0.0782,64.7,0.0423,cited,medium,"share_1 (mass x index, normalized)",Mullerpatan 2020 Int J Yoga PMC7336940 erector spinae max pose
yoga,hips_glutes,0.1589,38.5,0.1443,cited,medium,"share_1 (mass x index, normalized)",Mullerpatan 2020 Int J Yoga PMC7336940 gluteus maximus
yoga,legs,0.4321,34.9,0.4329,cited,medium,"share_1 (mass x index, normalized)",Mullerpatan 2020 Int J Yoga PMC7336940 vastus lateralis
indoor_biking,arms,0.0322,4,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",handlebar support
indoor_biking,shoulders,0.0138,4,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",
indoor_biking,chest,0.0057,2,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
indoor_biking,upper_back,0.0161,4,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
indoor_biking,core,0.0115,5,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
indoor_biking,lower_back,0.0184,8,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
indoor_biking,hips_glutes,0.1961,25,0.1443,ASSUMPTION,low,"share_1 (mass x index, normalized)",
indoor_biking,legs,0.7061,30,0.4329,ASSUMPTION,low,"share_1 (mass x index, normalized)",

```

### reference/data/postural_shares_v1.1.csv

```csv
activity_id,part,share,index_pctMVC,mass_fraction,status,confidence,method,source
sitting,arms,0.0554,1,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",
sitting,shoulders,0.0475,2,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",neck/trapezius tone
sitting,chest,0.0198,1,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
sitting,upper_back,0.0832,3,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
sitting,core,0.0475,3,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",O'Sullivan 2006
sitting,lower_back,0.206,13,0.0423,cited,medium,"share_1 (mass x index, normalized)",O'Sullivan PB et al. 2006 Spine 31:E707-12 https://doi.org/10.1097/01.brs.0000234735.98075.50 Discussion p.E709-710: superficial lumbar multifidus 13% MVIC in slump and thoracic upright sitting; n=22 pain-free adults
sitting,hips_glutes,0.1351,2.5,0.1443,stand-in,low,"share_1 (mass x index, normalized)",APNM thigh/hip reused
sitting,legs,0.4054,2.5,0.4329,cited,medium,"share_1 (mass x index, normalized)",APNM 2025 https://doi.org/10.1139/apnm-2025-0097 sitting thigh/hip
standing,arms,0.0327,1,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",
standing,shoulders,0.0281,2,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",
standing,chest,0.0117,1,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",
standing,upper_back,0.049,3,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",
standing,core,0.028,3,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
standing,lower_back,0.0467,5,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",
standing,hips_glutes,0.2009,6.3,0.1443,stand-in,low,"share_1 (mass x index, normalized)",APNM reused
standing,legs,0.6028,6.3,0.4329,cited,medium,"share_1 (mass x index, normalized)",APNM 2025 https://doi.org/10.1139/apnm-2025-0097 standing thigh/hip; Tikkanen 2013 https://doi.org/10.1371/journal.pone.0052228 standing ~2.5x sitting
lying,arms,0.148,1,0.148,ASSUMPTION,low,"share_1 (mass x index, normalized)",near-rest; equal tone -> pure mass weighting
lying,shoulders,0.0634,1,0.0634,ASSUMPTION,low,"share_1 (mass x index, normalized)",near-rest; equal tone -> pure mass weighting
lying,chest,0.0528,1,0.0528,ASSUMPTION,low,"share_1 (mass x index, normalized)",near-rest; equal tone -> pure mass weighting
lying,upper_back,0.074,1,0.074,ASSUMPTION,low,"share_1 (mass x index, normalized)",near-rest; equal tone -> pure mass weighting
lying,core,0.0423,1,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",near-rest; equal tone -> pure mass weighting
lying,lower_back,0.0423,1,0.0423,ASSUMPTION,low,"share_1 (mass x index, normalized)",near-rest; equal tone -> pure mass weighting
lying,hips_glutes,0.1443,1,0.1443,ASSUMPTION,low,"share_1 (mass x index, normalized)",near-rest; equal tone -> pure mass weighting
lying,legs,0.4329,1,0.4329,ASSUMPTION,low,"share_1 (mass x index, normalized)",near-rest; equal tone -> pure mass weighting

```

### reference/data/nonexerciser_baseline_v2.csv

```csv
activity_id,mean_min_per_day,compendium_code,MET,MET_h,status
sleep,543.9,07030,1.0,9.065,"cited (IPUMS ATUS 2024 microdata, weighted)"
personal_care_nonsleep,44.6,13040,2.0,1.488,"cited (IPUMS ATUS 2024 microdata, weighted)"
eating,73.2,13030,1.5,1.83,"cited (IPUMS ATUS 2024 microdata, weighted)"
housework,39.3,05040,2.5,1.637,"cited (IPUMS ATUS 2024 microdata, weighted)"
food_prep,40.7,05050,2.0,1.357,"cited (IPUMS ATUS 2024 microdata, weighted)"
lawn_garden,12.5,08245,3.8,0.793,"cited (IPUMS ATUS 2024 microdata, weighted)"
hh_management,11.7,09040,1.3,0.254,"cited (IPUMS ATUS 2024 microdata, weighted); ATUS 0209 household management mapped to Compendium 09040 sitting desk work/writing (intended)"
hh_other_residual,24.7,05025,2.8,1.154,"cited (IPUMS ATUS 2024 microdata, weighted)"
purchasing,42.0,05065,2.3,1.608,"cited (IPUMS ATUS 2024 microdata, weighted)"
care_household,33.8,05184,2.5,1.407,"cited (IPUMS ATUS 2024 microdata, weighted)"
care_nonhousehold,10.4,05184,2.5,0.434,"cited (IPUMS ATUS 2024 microdata, weighted)"
work,219.7,11580,1.5,5.492,"cited (IPUMS ATUS 2024 microdata, weighted)"
education,14.9,09065,1.8,0.446,"cited (IPUMS ATUS 2024 microdata, weighted)"
org_civic_religious,19.2,09055,1.3,0.416,"cited (IPUMS ATUS 2024 microdata, weighted)"
socializing,32.4,09055,1.3,0.701,"cited (IPUMS ATUS 2024 microdata, weighted)"
tv,163.1,07020,1.0,2.719,"cited (IPUMS ATUS 2024 microdata, weighted)"
sports_exercise,1.6,07021,1.0,0.027,"cited (IPUMS ATUS 2024 microdata, weighted); residual non-1301 category-13 time (1302 attending sporting events etc.) mapped to sitting"
other_leisure_residual,92.4,09040,1.3,2.001,"cited (IPUMS ATUS 2024 microdata, weighted)"
phone_mail,7.6,09055,1.3,0.164,"cited (IPUMS ATUS 2024 microdata, weighted)"
other_nec,12.3,07021,1.0,0.206,"cited (IPUMS ATUS 2024 microdata, weighted)"
TOTAL_gross,1440.0,,,33.20,gross = sum(min/60 x MET)
TOTAL_net,,,,9.20,net = gross - 24 h x 1.0 MET (v1 definition)
per_person_gross_sd,,,,4.40,weighted
per_person_gross_p10,,,,28.22,weighted
per_person_gross_p50,,,,32.60,weighted
per_person_gross_p90,,,,38.80,weighted

```

### reference/data/atus_nonexercisers_v2.csv

```csv
activity_id,mean_min_per_day,sd_min,median,p10,p90,participation_rate_pct,n,weights,years,population,source
sleep,543.9,142.4,535.0,390.0,720.0,99.9,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
personal_care_nonsleep,44.6,55.9,30.0,0.0,90.0,78.8,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
eating,73.2,61.7,60.0,15.0,145.0,95.3,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
housework,39.3,81.7,0.0,0.0,130.0,37.2,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
food_prep,40.7,57.4,20.0,0.0,110.0,63.8,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
lawn_garden,12.5,53.4,0.0,0.0,0.0,9.4,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
hh_management,11.7,42.8,0.0,0.0,30.0,21.6,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
hh_other_residual,24.7,72.4,0.0,0.0,70.0,30.2,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
purchasing,42.0,77.5,0.0,0.0,140.0,39.9,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
care_household,33.8,91.0,0.0,0.0,123.0,23.2,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
care_nonhousehold,10.4,51.4,0.0,0.0,0.0,8.3,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
work,219.7,278.1,0.0,0.0,616.0,44.5,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
education,14.9,77.0,0.0,0.0,0.0,5.5,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
org_civic_religious,19.2,70.0,0.0,0.0,45.0,12.6,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
socializing,32.4,79.7,0.0,0.0,120.0,28.2,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
tv,163.1,183.2,120.0,0.0,420.0,72.7,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
sports_exercise,1.6,20.8,0.0,0.0,0.0,0.9,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
other_leisure_residual,92.4,143.0,30.0,0.0,282.0,60.0,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
phone_mail,7.6,30.3,0.0,0.0,15.0,11.8,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)
other_nec,12.3,48.1,0.0,0.0,35.0,15.1,5973,WT06,2024,"adults 18+, 0 min ATUS 1301 on diary day",IPUMS ATUS extract 1 (see methods_notes citation)

```

### reference/data/muscle_mass_8part_v1.csv

```csv
sex,part,fraction,status,method_step
male,arms,0.1609,stand-in/ASSUMPTION,mass_1..mass_7
male,shoulders,0.069,stand-in/ASSUMPTION,mass_1..mass_7
male,chest,0.052,stand-in/ASSUMPTION,mass_1..mass_7
male,upper_back,0.0728,stand-in/ASSUMPTION,mass_1..mass_7
male,core,0.0416,stand-in/ASSUMPTION,mass_1..mass_7
male,lower_back,0.0416,stand-in/ASSUMPTION,mass_1..mass_7
male,hips_glutes,0.1405,stand-in/ASSUMPTION,mass_1..mass_7
male,legs,0.4216,stand-in/ASSUMPTION,mass_1..mass_7
female,arms,0.1352,stand-in/ASSUMPTION,mass_1..mass_7
female,shoulders,0.0579,stand-in/ASSUMPTION,mass_1..mass_7
female,chest,0.0537,stand-in/ASSUMPTION,mass_1..mass_7
female,upper_back,0.0751,stand-in/ASSUMPTION,mass_1..mass_7
female,core,0.0429,stand-in/ASSUMPTION,mass_1..mass_7
female,lower_back,0.0429,stand-in/ASSUMPTION,mass_1..mass_7
female,hips_glutes,0.1481,stand-in/ASSUMPTION,mass_1..mass_7
female,legs,0.4442,stand-in/ASSUMPTION,mass_1..mass_7
average,arms,0.148,stand-in/ASSUMPTION,mass_1..mass_7
average,shoulders,0.0634,stand-in/ASSUMPTION,mass_1..mass_7
average,chest,0.0528,stand-in/ASSUMPTION,mass_1..mass_7
average,upper_back,0.074,stand-in/ASSUMPTION,mass_1..mass_7
average,core,0.0423,stand-in/ASSUMPTION,mass_1..mass_7
average,lower_back,0.0423,stand-in/ASSUMPTION,mass_1..mass_7
average,hips_glutes,0.1443,stand-in/ASSUMPTION,mass_1..mass_7
average,legs,0.4329,stand-in/ASSUMPTION,mass_1..mass_7

```

### reference/data/method_log.csv

```csv
step,id,rule,status,source
1,mass_1,"Upper vs lower muscle = Janssen upper/(upper+lower) kg, renormalized to drop 4-cm L4-L5 gap",cited+derived,Janssen 2000 J Appl Physiol https://doi.org/10.1152/jappl.2000.89.1.81 Table 1
2,mass_2,Arm-region muscle = lower-body muscle x (DXA arm lean / DXA leg lean); assumes lean ratio = muscle ratio in limbs,stand-in,"NHANES 2017-18 DXX_J/DEMO_J (my computation, muscle_mass_fractions.csv)"
3,mass_3,Trunk muscle = upper-body muscle minus arm region (Janssen upper body includes arms+trunk above L4-L5; head/neck ignored),derived,Janssen 2000 J Appl Physiol https://doi.org/10.1152/jappl.2000.89.1.81 Table 1
4,mass_4,Lower body split legs 0.75 / hips_glutes 0.25,ASSUMPTION,none found; gluteal+hip muscles vs thigh+shank not separated in Janssen or DXA
5,mass_5,Arm region split arms 0.70 / shoulders 0.30 (deltoid+rotator cuff vs upper arm+forearm),ASSUMPTION,none found
6,mass_6,Trunk split chest 0.25 / upper_back 0.35 / core 0.20 / lower_back 0.20,ASSUMPTION,"none found; candidate source: cadaver muscle-mass tables (e.g., Clarys 1984 Hum Biol) not retrieved"
7,mass_7,Single baseline = unweighted mean of male and female fractions,ASSUMPTION,
8,share_1,share_p = mass_p x index_p / sum_parts(mass x index); index = %MVC (cited where available) else assumed %MVC-equivalent,method,
9,share_2,Mass weights = muscle_mass_8part_v1 average,stand-in,mass_1..7
10,share_3,Yard work uses gardening indices; indoor biking uses bicycling indices,ASSUMPTION,
11,share_4,Mixing %MVC across studies/muscles is not strictly valid (normalization differs); all rows low confidence,caveat,
12,atus_1,"ATUS 2024 Table 1 means (15+, all persons) used as non-exerciser stand-in; sports time reassigned to 07021 sitting",stand-in,https://www.bls.gov/news.release/archives/atus_06262025.htm
13,atus_2,Microdata (BLS atussum-2024.zip) 403 Access Denied; IPUMS requires login (not approved) -> SD/percentiles GAP,GAP,
14,atus_3,Purchasing 05060->05065 (2.3); child care 05186->05184 (2.5),ASSUMPTION,2024 Compendium code list https://pacompendium.com/wp-content/uploads/2025/02/1_2024-adult-compendium_1_2024.pdf
15,atus_4,ALPHA DECISION: IPUMS non-exerciser filter skipped for alpha; ATUS 2024 Table 1 all-persons 15+ stand-in kept (flagged stand-in),decision,user/parent instruction 2026-10-24
16,v1.1_1,"postural v1.1: sitting lower_back index 5 (ASSUMPTION) -> 13 %MVIC (cited, O'Sullivan 2006 text, slump sitting); sitting row renormalized",cited,https://doi.org/10.1097/01.brs.0000234735.98075.50
17,v1.1_2,activation_shares_v1.1 = unchanged copy of v1 (Park 2014 tables and time-averaged gait trunk/hip EMG not retrieved: landing page timeout / skipped for effort),GAP,https://doi.org/10.7235/hort.2014.14059
18,ipums_1,"IPUMS ATUS API extract #1: sample at2024, activity-level rectangular; vars AGE, SEX, ACTIVITY, DURATION, WT06 (2024 final weight); aggregated to person-day minutes per group",cited,"Sarah M. Flood, Liana C. Sayer, and Daniel Backman. American Time Use Survey Data Extract Builder: Version 3.3 [dataset]. College Park, MD: University of Maryland and Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D060.V3.3 (IPUMS ATUS extract #1, sample at2024)"
19,ipums_2,Population: respondents AGE>=18 (n=7509),method,"Sarah M. Flood, Liana C. Sayer, and Daniel Backman. American Time Use Survey Data Extract Builder: Version 3.3 [dataset]. College Park, MD: University of Maryland and Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D060.V3.3 (IPUMS ATUS extract #1, sample at2024)"
20,ipums_3,"Non-exerciser = 0 min in ACTIVITY 1301xx (participating in sports/exercise/recreation). Chosen over all of 13 because 1302 = attending sporting events (spectating, sedentary); results nearly identical: 79.6% (1301) vs 79.0% (all 13) vs 78.9% (13 + travel 1813). n non-exercisers = 5973",decision,"Sarah M. Flood, Liana C. Sayer, and Daniel Backman. American Time Use Survey Data Extract Builder: Version 3.3 [dataset]. College Park, MD: University of Maryland and Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D060.V3.3 (IPUMS ATUS extract #1, sample at2024)"
21,ipums_4,"Group mapping: 0101 sleep; other 01 personal care; 11 eating; 0201 housework; 0202 food prep; 0205 lawn; 0209 hh mgmt (corrected from 0207 vehicles); other 02 hh residual; 07-10 purchasing; 03/04 care; 05 work; 06 education; 14-15 org/civic/religious; 1201 socializing; 120303-04 TV; other 12 leisure residual; 13 sports (residual spectating etc., MET 1.0); 16 phone; 50 and unmapped -> other_nec. Travel 18xx assigned to parent category (BLS Table 1 convention); 1812 -> leisure residual",ASSUMPTION,ATUS lexicon
22,ipums_5,"Stats weighted by WT06: mean, SD (population), weighted median/p10/p90 (inverse CDF), participation = weighted % with >0 min",method,
23,ipums_6,"Gross MET-h = sum(mean min/60 x MET) using atus_to_compendium.csv; net = gross - 24 h x 1.0 MET (v1 definition: 32.99-24=8.99). v2: gross 33.20, net 9.20; per-person gross SD 4.40, p10 28.22, p50 32.60, p90 38.80",cited+derived,
24,ipums_7,"Supersedes alpha stand-in (atus_4): v2 uses true 18+ non-exerciser microdata. Raw microdata kept in raw/ipums/ only, not redistributed",decision,"Sarah M. Flood, Liana C. Sayer, and Daniel Backman. American Time Use Survey Data Extract Builder: Version 3.3 [dataset]. College Park, MD: University of Maryland and Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D060.V3.3 (IPUMS ATUS extract #1, sample at2024)"
25,mets_1,Indoor/stationary cycling added to mets.csv: 01200 general 6.8; 01214 50 W light 4.0; 01216 60 W light-moderate 5.0; 01220 90-100 W moderate-vigorous 6.0,cited,2024 Adult Compendium code list
26,math_v05_1,"model.R v0.5: baseline minutes = zero-inflated Gamma per ATUS group (Bernoulli participation; conditional Gamma moment-matched to weighted mean and SD), groups independent (ASSUMPTION), each draw rescaled to 1440; replaces CV 0.50 ASSUMPTION",method,atus_nonexercisers_v2.csv
27,math_v05_2,"Deterministic net check: sum(min x (MET-1))/60 = 9.200 MET-h/day = researcher TOTAL_net 9.20 (identical since all MET >= 1)",check,nonexerciser_baseline_v2.csv
28,math_v05_3,"Indoor biking scenario uses 01200 (6.8) with indoor_biking share row (copy of bicycling, ASSUMPTION)",ASSUMPTION,mets.csv mets_1
29,math_v06_1,"model.R v0.6: reference = average non-exerciser day; per-group mean minutes ~ Gamma(mean, SE), SE = SD/sqrt(n/deff), deff 1.5 (ASSUMPTION for WT06), rescaled to 1440. Supersedes math_v05_1 for M",method,atus_nonexercisers_v2.csv
30,math_v06_2,"Typicality percentile: individual days by zero-inflated Gamma (math_v05_1 method), same METs and shares; % of individual days below user median part work. Optional output, not used in M",method,atus_nonexercisers_v2.csv
31,math_v06_3,"Calibration of individual-day gross MET-h/day vs cited per-person: SD 4.13 vs 4.40; p10 28.05 vs 28.22; p50 32.15 vs 32.60; p90 38.35 vs 38.80 (independence assumption gives slightly narrow spread)",check,nonexerciser_baseline_v2.csv

```

### reference/data/atus_to_compendium.csv

```csv
atus_activity_id,compendium_code,MET,rationale
sleep,07030,1.0,Direct match
personal_care_nonsleep,13040,2.0,Grooming/dressing dominates the non-sleep personal care category
eating,13030,1.5,Most eating is seated
housework,05040,2.5,Population-average housework assumed light; vacuuming (05043) is 3.0
food_prep,05050,2.0,The general/light cooking code fits a mix of standing and sitting
lawn_garden,08245,3.8,General moderate gardening
hh_management,09040,1.3,Paperwork and bills are desk-type work
hh_other_residual,05025,2.8,Pets/vehicle/repair mix; ASSUMED
purchasing,05065,2.3,CHANGED from 05060 (3.3): ATUS purchasing includes non-food shopping and waiting; 05065 non-food shopping standing/walking=2.3. Still ignores travel (16010 driving 2.0)
care_household,05184,2.5,CHANGED from 05186 (3.5): 05184 child care infant general=2.5; 05185 sitting child care=2.0 is lower bound
care_nonhousehold,05184,2.5,CHANGED from 05186 (3.5): 05184 child care infant general=2.5; 05185 sitting child care=2.0 is lower bound
work,11580,1.5,Population is mostly desk work; MAJOR uncertainty (11600=1.8; 11610=3.3)
education,09065,1.8,Sitting in class
org_civic_religious,09055,1.3,Mostly seated with talking
socializing,09055,1.3,Seated conversation
tv,07020,1.0,Direct match
sports_exercise,07021,1.0,Reassigned to sitting for the non-exerciser baseline
other_leisure_residual,09040,1.3,Reading/computer/games; reading alone is 09030=1.0
phone_mail,09055,1.3,Direct match
other_nec,07021,1.0,Unknown activities defaulted to sitting

```

### reference/README_SUPERSEDED.md

# Superseded files (kept for audit only)
- **baseline.csv, emg_matrix.csv:** first pass. Current replacements are mets.csv, atus_nonexercisers_v2.csv / nonexerciser_baseline_v2.csv and activation_shares_v1.1.csv.
- **baseline_energy.csv:** 34.3 MET-h/day, old purchasing and childcare codes. Superseded by nonexerciser_baseline_v2.csv (33.20 MET-h/day gross).
- **exercise_mets_shares.csv:** superseded by mets.csv and activation_shares_v1.1.csv.
- **activation_shares.csv, postural_shares.csv:** cited-only versions with GAP cells. Superseded by the *_v1 files (every cell flagged), which are themselves superseded by *_v1.1.
- **atus_nonexercisers.csv, nonexerciser_baseline_v1.csv:** ATUS 15+ stand-in. Superseded by atus_nonexercisers_v2.csv and nonexerciser_baseline_v2.csv (IPUMS 18+, non-exercisers).
- **activation_shares_v1.csv, postural_shares_v1.csv:** superseded by activation_shares_v1.1.csv and postural_shares_v1.1.csv.
- **model_v1.R to model_v5.R, model_v3b.R, spec_v1.md, demo_output.txt and demo_output_v2 to v5:** earlier model versions. The current model is model.R v0.6.1, with output in demo_output_v6.txt.


### 3.4 Reference output (demo_output_v6.txt) for test parity

```text
Body model v0.6.1 — 2026-10-24 20:11:36 
Raw ATUS minutes 1440.0 rescaled to 1440.0
Deterministic baseline net = 9.200 MET-h/day (researcher TOTAL_net 9.20)
Inputs: activation/postural_shares_v1.1, muscle_mass_8part_v1 (average), nonexerciser_baseline_v2 + atus_nonexercisers_v2 (IPUMS 18+), mets.csv
Baseline minutes sum = 1440.0; gross = 33.20 MET-h/day; net = 9.20 MET-h/day
Mass fractions (average) summed to 1.0000 before renormalising
Max share row-sum error before renormalising: 0.0001
Exercise METs: bike_leisure(01010)=4.0  calisthenics_mod(02022)=3.8  chore_clean_light(05040)=2.5  garden(08245)=3.8  indoor_bike_general(01200)=6.8  jog(12020)=7.5  resist_multi(02054)=3.5  walk_brisk(17200)=4.8  yoga_hatha(02150)=2.3 
ASSUMPTIONS: kappa cited/stand-in/ASSUMPTION = 50/20/5; MET CV 0.20 (sdlog 0.198); baseline = mean day, SE with deff 1.5; phi 0.25 (offset); M_cap 2.5; N 4000

Columns: median and 89% interval of M; band = ASSUMPTION band (final for alpha) of the median;
straddlesCutoff = 89% interval spans >= 2 band edges; highUncertainty = log2(hi/lo) > 2;
offset_gt_B = share of draws where offset F_p exceeds baseline B_p;
typ_pct = typicality percentile vs individual non-exerciser days (day-to-day spread).

Calibration (individual days, gross MET-h/day): SD 4.13 (cited 4.40); p10 28.05 (28.22); p50 32.15 (32.60); p90 38.35 (38.80)

=== Scenario: sedentary ===
        part lo89 median hi89  band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms    1      1    1 green #2E7D32           FALSE          0           FALSE       0.093      68
   shoulders    1      1    1 green #2E7D32           FALSE          0           FALSE       0.342      68
       chest    1      1    1 green #2E7D32           FALSE          0           FALSE       0.794      63
  upper_back    1      1    1 green #2E7D32           FALSE          0           FALSE       0.583      61
        core    1      1    1 green #2E7D32           FALSE          0           FALSE       0.704      60
  lower_back    1      1    1 green #2E7D32           FALSE          0           FALSE       0.000      59
 hips_glutes    1      1    1 green #2E7D32           FALSE          0           FALSE       0.030      60
        legs    1      1    1 green #2E7D32           FALSE          0           FALSE       0.000      57

=== Scenario: walk30 ===
        part lo89 median hi89         band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms 1.00   1.00 1.04        green #2E7D31           FALSE       0.05           FALSE       0.109      67
   shoulders 1.00   1.00 1.05        green #2E7D31           FALSE       0.07           FALSE       0.350      67
       chest 1.00   1.00 1.05        green #2E7D31           FALSE       0.07           FALSE       0.798      64
  upper_back 1.00   1.00 1.09        green #2E7D31           FALSE       0.13           FALSE       0.569      62
        core 1.00   1.02 1.39        green #378031           FALSE       0.48           FALSE       0.700      68
  lower_back 1.00   1.00 1.03        green #2E7D31           FALSE       0.05           FALSE       0.000      61
 hips_glutes 1.05   1.16 1.41 yellow-green #719330            TRUE       0.42           FALSE       0.031      72
        legs 1.15   1.26 1.43 yellow-green #939E2F           FALSE       0.31           FALSE       0.000      77

=== Scenario: run45 ===
        part lo89 median hi89   band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms 1.00   1.03 1.84  green #398031            TRUE       0.88           FALSE       0.116      72
   shoulders 1.00   1.00 2.66  green #307D31            TRUE       1.41           FALSE       0.353      72
       chest 1.00   1.00 2.04  green #2E7D31            TRUE       1.03           FALSE       0.791      68
  upper_back 1.00   1.00 2.65  green #2F7D31            TRUE       1.41           FALSE       0.580      71
        core 1.00   1.00 3.81  green #2E7D31            TRUE       1.93           FALSE       0.706      70
  lower_back 1.00   1.01 1.66  green #317E31            TRUE       0.73           FALSE       0.000      64
 hips_glutes 1.06   1.66 3.52 orange #F5B02C            TRUE       1.74           FALSE       0.026      89
        legs 1.20   1.49 1.92 orange #DFB72D            TRUE       0.68           FALSE       0.000      87

=== Scenario: lift45 ===
        part lo89 median hi89  band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms 1.01   1.14 1.84 green #688F30            TRUE       0.87           FALSE       0.107      74
   shoulders 1.00   1.08 2.41 green #4F8831            TRUE       1.27           FALSE       0.346      74
       chest 1.00   1.11 3.91 green #5E8C30            TRUE       1.97           FALSE       0.795      80
  upper_back 1.00   1.13 2.87 green #658F30            TRUE       1.52           FALSE       0.571      78
        core 1.00   1.06 3.66 green #4A8631            TRUE       1.87           FALSE       0.711      76
  lower_back 1.00   1.01 1.33 green #317E31           FALSE       0.42           FALSE       0.000      63
 hips_glutes 1.01   1.13 1.80 green #668F30            TRUE       0.84           FALSE       0.035      72
        legs 1.03   1.12 1.29 green #608D30           FALSE       0.32           FALSE       0.000      69

=== Scenario: bike45 ===
        part lo89 median hi89         band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms 1.00   1.00 1.33        green #2F7D31           FALSE       0.41           FALSE       0.108      70
   shoulders 1.00   1.00 1.41        green #2E7D31            TRUE       0.50           FALSE       0.357      69
       chest 1.00   1.00 1.21        green #2E7D31           FALSE       0.27           FALSE       0.798      66
  upper_back 1.00   1.00 1.61        green #2E7D31            TRUE       0.68           FALSE       0.583      66
        core 1.00   1.00 1.75        green #2E7D31            TRUE       0.81           FALSE       0.695      66
  lower_back 1.00   1.00 1.19        green #2E7D31           FALSE       0.25           FALSE       0.000      62
 hips_glutes 1.02   1.27 2.11 yellow-green #9AA02F            TRUE       1.04           FALSE       0.034      79
        legs 1.11   1.24 1.47 yellow-green #8F9C2F            TRUE       0.41           FALSE       0.000      78

=== Scenario: ibike45 ===
        part lo89 median hi89   band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms 1.00   1.01 1.62  green #317D31            TRUE       0.70           FALSE       0.098      70
   shoulders 1.00   1.00 1.83  green #2E7D31            TRUE       0.87           FALSE       0.348      70
       chest 1.00   1.00 1.44  green #2E7D31            TRUE       0.52           FALSE       0.802      67
  upper_back 1.00   1.00 2.22  green #2E7D31            TRUE       1.15           FALSE       0.577      69
        core 1.00   1.00 2.75  green #2E7D31            TRUE       1.46           FALSE       0.689      68
  lower_back 1.00   1.00 1.38  green #2E7D31           FALSE       0.47           FALSE       0.000      64
 hips_glutes 1.04   1.51 3.09 orange #E6B92D            TRUE       1.57           FALSE       0.030      86
        legs 1.22   1.48 1.90 orange #DDB62D            TRUE       0.64           FALSE       0.000      87

=== Scenario: calis45 ===
        part lo89 median hi89         band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms 1.02   1.23 2.07 yellow-green #899A2F            TRUE       1.03           FALSE       0.106      75
   shoulders 1.00   1.12 2.80        green #608D30            TRUE       1.49           FALSE       0.351      74
       chest 1.00   1.24 4.72 yellow-green #8C9B2F            TRUE       2.24            TRUE       0.798      84
  upper_back 1.00   1.08 2.77        green #518831            TRUE       1.47           FALSE       0.567      75
        core 1.00   1.10 4.14        green #578A30            TRUE       2.05            TRUE       0.713      78
  lower_back 1.00   1.00 1.26        green #2E7D31           FALSE       0.33           FALSE       0.000      62
 hips_glutes 1.01   1.14 1.87        green #699030            TRUE       0.89           FALSE       0.032      73
        legs 1.03   1.12 1.30        green #628E30           FALSE       0.33           FALSE       0.000      68

=== Scenario: yoga45 ===
        part lo89 median hi89         band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms 1.00   1.01 1.05        green #307D31           FALSE       0.07           FALSE       0.103      69
   shoulders 1.00   1.00 1.08        green #2F7D31           FALSE       0.11           FALSE       0.342      68
       chest 1.00   1.00 1.14        green #2E7D31           FALSE       0.19           FALSE       0.802      66
  upper_back 1.05   1.26 1.84 yellow-green #949E2F            TRUE       0.81           FALSE       0.572      75
        core 1.01   1.14 1.67        green #689030            TRUE       0.72           FALSE       0.694      73
  lower_back 1.02   1.07 1.21        green #4A8631           FALSE       0.25           FALSE       0.000      64
 hips_glutes 1.05   1.15 1.37        green #6A9030           FALSE       0.39           FALSE       0.027      72
        legs 1.04   1.08 1.16        green #518831           FALSE       0.16           FALSE       0.000      64

=== Scenario: garden45 ===
        part lo89 median hi89   band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms 1.20   1.58 2.38 orange #F9BF2D            TRUE       0.98           FALSE       0.111      82
   shoulders 1.10   1.56 2.74 orange #F5BE2D            TRUE       1.32           FALSE       0.352      81
       chest 1.00   1.00 1.53  green #2F7D31            TRUE       0.61           FALSE       0.805      69
  upper_back 1.00   1.04 1.58  green #3E8231            TRUE       0.66           FALSE       0.592      70
        core 1.00   1.00 1.53  green #2E7D31            TRUE       0.62           FALSE       0.703      66
  lower_back 1.00   1.01 1.16  green #327E31           FALSE       0.22           FALSE       0.000      63
 hips_glutes 1.00   1.04 1.25  green #3F8231           FALSE       0.32           FALSE       0.028      65
        legs 1.06   1.13 1.26  green #658E30           FALSE       0.25           FALSE       0.000      69

=== Scenario: house45 ===
        part lo89 median hi89  band   color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B typ_pct
        arms 1.03   1.14 1.31 green #699030           FALSE       0.36           FALSE       0.112      72
   shoulders 1.00   1.08 1.31 green #508831           FALSE       0.39           FALSE       0.343      68
       chest 1.00   1.00 1.26 green #307D31           FALSE       0.33           FALSE       0.795      63
  upper_back 1.00   1.06 1.29 green #468431           FALSE       0.37           FALSE       0.573      65
        core 1.00   1.00 1.26 green #2F7D31           FALSE       0.33           FALSE       0.699      62
  lower_back 1.00   1.01 1.13 green #317E31           FALSE       0.18           FALSE       0.000      61
 hips_glutes 1.00   1.08 1.24 green #508831           FALSE       0.31           FALSE       0.028      66
        legs 1.02   1.07 1.14 green #4B8631           FALSE       0.17           FALSE       0.000      65

=== Sensitivity: run45 medians by phi (ASSUMPTION) ===
            phi=0.05 phi=0.25 phi=0.5
arms            1.03     1.03    1.02
shoulders       1.01     1.01    1.00
chest           1.00     1.00    1.00
upper_back      1.00     1.00    1.00
core            1.00     1.00    1.00
lower_back      1.01     1.01    1.01
hips_glutes     1.85     1.66    1.52
legs            1.55     1.48    1.42

```

---

## 4. Software Engineer build plan (cursor-prompts.md)

# Body alpha: Cursor prompt sequence v1 (supersedes old prompts 1-2). Data model: data-model.md v0.6.1, reference model.R v0.6.1 (tests: spec.md §10).
Note: Cursor can't see this computer. Before prompt 2, the reference files (model.R, data CSVs, data-model.md) get committed to reference/ in the repo.

1. Scaffold: new public repo vasilismavratsas/body. Vite+React+TS strict, Vitest, ESLint/Prettier, CI. src/core (pure TS), src/data, src/ui, reference/. README architecture. No numbers.
2. Data model: zod schemas per data-model v0.6.1. Every number is {value, status: cited|GAP|stand-in|ASSUMPTION|PLACEHOLDER, sourceRefs}. Baseline per ATUS group (atusCode, compendiumCode, met, minutes mean/sd/median/p10/p90, participationRate, n), population, designEffect. Activities (MET median/sigmaLog, shares sbar/kappa). modelConfig (net, nDraws 4000, phi 0.25, bands 1.15/1.4/1.8, cap 2.5, highUncertaintyLog2Width 2). Convert reference CSVs to JSON with a script. Release guard fails on GAP/PLACEHOLDER.
3. Core engine: port model.R v0.6.1 to src/core/model.ts in a single file. Seeded RNG; Gamma, LogNormal, Dirichlet samplers. User day = mean day with TV minutes swapped for the activity. M_p = (W_p+F_p)/(B_p+F_p), with W and B drawn together in each draw. Output median, 89% interval, flags (smallBaseline F>B, straddlesCutoff when the interval crosses 2 or more band edges, highUncertainty) and typicalityPercentile. Tests (spec §10, nDraws >= 4000): (a) identical day gives exactly 1x; (b) model regression, any seed: individual-day gross MET-h/day SD in [3.90,4.40], p10 in [27.6,28.4], p90 in [37.6,38.8]; (c) fixed-seed snapshot: seed 2026 is reproducible to +/-0.01 against the TS engine's own committed snapshot (R reference with seed 2026 = 4.13/28.05/38.35; TS cannot reproduce R's RNG stream, so an exact match is only required if the port uses an R-compatible RNG); (d) survey validity: |SD-4.40|/4.40 <= 0.10, |p10-28.22| <= 1.0, |p90-38.80| <= 1.0; (e) multiples match reference/demo_output_v6 within the tolerance of (b). Run it in a Web Worker.
4. Body map: front/back SVG with the 8 regions, colored from the median by band. Uncertainty shown gracefully: a part whose range crosses band edges gets soft hatching; a part with highUncertainty or mostly ASSUMPTION shares gets lower saturation and a dotted outline. Legend explains both.
5. Detail panel: tap a part to see the multiple as "about 1.6x (likely 1.2-2.3x)", the typicality percentile ("more than 82% of non-exercisers' days"), contributing activities, and plain-language confidence badges ("estimate based on muscle mass, low confidence"). A standing note says the comparison is to the average non-exercising American, not you.
6. Activity entry: pick from the top-10 list plus duration; today's entries kept in localStorage and cleared at midnight. Recompute in the worker, with a loading state.
7. Data and release: wire the final data, a methods/about page linking sources, the release guard on in CI for main, and deploy to GitHub Pages.


---

## 5. First instructions
1. Create the repo `vasilismavratsas/body`. Commit everything in section 3 under `reference/` (spec.md, data-model.md, model.R, data/*.csv, README_SUPERSEDED.md, demo_output_v6.txt), plus section 1b as reference/product-brief.md, exactly as given, along with this document as `reference/project-brief.md`.
2. Then start **step 1** of the plan in section 4 (scaffold) and open a PR.
3. Before you write any code that depends on them, raise any ambiguities.
