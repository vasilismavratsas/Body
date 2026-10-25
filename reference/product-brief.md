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

