/** Exactly one &lt;main&gt; landmark on the Methods page (round-2 §A.4). */
export function MethodsPage() {
  return (
    <main className="methods">
      <h1>Methods &amp; about</h1>
      <p>
        <strong>Body</strong> (alpha v0.7) colors eight body parts by how much muscular
        work they did today, as a multiple of an average US adult non-exerciser day.
      </p>

      <h2>Model (short)</h2>
      <ul>
        <li>
          Net work for an activity: (MET − 1) × minutes, using 2024 Adult Compendium point
          METs (per-activity sdlog from CV 0.20 or published code range as 89% interval —
          spec §12).
        </li>
        <li>
          Work is split across parts with the v0.7 share rule (spec §11): mass ×
          activation on one %MVIC scale; ASSUMPTION indices are rescaled ×2 before mass
          weighting.
        </li>
        <li>
          The reference is the <em>average</em> non-exerciser day from IPUMS ATUS 2024
          (adults 18+, 0 min sports/exercise participation on the diary day). User
          exercise minutes replace TV minutes on that mean day (model.R v0.7).
        </li>
        <li>
          Monte Carlo (N = 4000) carries MET, share, and sampling-error uncertainty. The
          app shows the median multiple, an 89% interval, P(M ≥ 1.8), and a saturated flag
          when the median reaches 2.5×.
        </li>
        <li>
          Color bands at 1.15 / 1.4 / 1.8 with a continuous log₂ ramp to full red at 2.5×
          (ASSUMPTION; phi = 0.25, spec §16 P1).
        </li>
        <li>
          Activity list is data-driven from <code>activity_catalog.csv</code> (25
          activities). Weightlifting is a parent with 14 child lifts × 3 intensities.
        </li>
      </ul>

      <h2>Citations</h2>
      <ul>
        <li>
          Sarah M. Flood, Liana C. Sayer, and Daniel Backman. American Time Use Survey
          Data Extract Builder: Version 3.3 [dataset]. College Park, MD: University of
          Maryland and Minneapolis, MN: IPUMS, 2025.{' '}
          <a href="https://doi.org/10.18128/D060.V3.3">
            https://doi.org/10.18128/D060.V3.3
          </a>
          . Only derived aggregates are used; raw IPUMS microdata are not redistributed.
        </li>
        <li>
          Herrmann SD et al., 2024, “2024 Adult Compendium of Physical Activities”,{' '}
          <a href="https://doi.org/10.1016/j.jshs.2023.10.010">
            https://doi.org/10.1016/j.jshs.2023.10.010
          </a>
          .
        </li>
        <li>
          Muscle-mass fractions: Janssen I et al. 2000 J Appl Physiol; NHANES DXA (team
          computation). Share indices mix cited EMG with ASSUMPTION cells — see badges in
          the detail panel.
        </li>
        <li>
          Background methods note:{' '}
          <code>reference/methods/methods_v008_2026-10-24.md</code>.
        </li>
      </ul>

      <h2>Honesty notes</h2>
      <ul>
        <li>
          Compendium MET SDs are GAP → the engine uses an ASSUMPTION CV of 0.20, or a
          published min–max range read as an 89% lognormal interval (spec §12).
        </li>
        <li>
          Activity → share-row pairings are ASSUMPTION (catalog / baseline_row_map).
        </li>
        <li>
          Most activation-share cells are ASSUMPTION. Results are illustrative, not
          clinical.
        </li>
        <li>
          Source of truth: <code>reference/spec.md</code>, <code>reference/model.R</code>,
          and <code>src/data</code>. Release CI fails if shipped structured status fields
          still contain GAP or PLACEHOLDER.
        </li>
      </ul>

      <p>
        Polygon artwork adapted from react-body-highlighter (MIT) — see{' '}
        <code>THIRD_PARTY_NOTICES.md</code>.
      </p>
    </main>
  );
}
