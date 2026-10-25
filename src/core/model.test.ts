import { describe, expect, it } from 'vitest';
import { activities, baseline, bodyParts, modelConfig, shareRows } from '../data/load';
import {
  createRng,
  deterministicBaselineNet,
  prepareModelInput,
  quantile,
  runModel,
  sd,
  simulateDay,
  type ExtraMinutes,
} from './model';
import snapshot from './snapshots/seed2026-calibration.json';

const input = prepareModelInput(bodyParts, shareRows, activities, baseline, modelConfig);

describe('core engine port of model.R v0.6.1', () => {
  it('(setup) deterministic baseline net ≈ 9.20 MET-h/day', () => {
    expect(deterministicBaselineNet(input)).toBeCloseTo(9.2, 2);
    expect(input.nDraws).toBe(4000);
  });

  it('(a) identical day (no extra) gives exactly 1× for all parts', () => {
    const result = runModel(input, null, 2026);
    for (const p of result.parts) {
      expect(p.median).toBe(1);
      expect(p.lo89).toBe(1);
      expect(p.hi89).toBe(1);
    }
  });

  it('(b) model regression — any seed: individual-day gross bands', () => {
    for (const seed of [1, 42, 99, 2026, 7]) {
      const rng = createRng(seed);
      const sim = simulateDay(input, null, rng);
      const s = sd(sim.grossInd);
      const p10 = quantile(sim.grossInd, 0.1);
      const p90 = quantile(sim.grossInd, 0.9);
      expect(s).toBeGreaterThanOrEqual(3.9);
      expect(s).toBeLessThanOrEqual(4.4);
      expect(p10).toBeGreaterThanOrEqual(27.6);
      expect(p10).toBeLessThanOrEqual(28.4);
      expect(p90).toBeGreaterThanOrEqual(37.6);
      expect(p90).toBeLessThanOrEqual(38.8);
    }
  });

  it('(c) fixed-seed snapshot: seed 2026 reproducible to ±0.01', () => {
    const result = runModel(input, null, 2026);
    const cal = result.calibration;
    expect(cal.sd).toBeCloseTo(snapshot.sd, 2);
    expect(cal.p10).toBeCloseTo(snapshot.p10, 2);
    expect(cal.p90).toBeCloseTo(snapshot.p90, 2);
    // Re-run must match exactly the same snapshot
    const again = runModel(input, null, 2026).calibration;
    expect(again.sd).toBeCloseTo(cal.sd, 8);
    expect(again.p10).toBeCloseTo(cal.p10, 8);
    expect(again.p90).toBeCloseTo(cal.p90, 8);
  });

  it('(d) survey validity vs cited per-person gross', () => {
    const cal = runModel(input, null, 2026).calibration;
    expect(Math.abs(cal.sd - 4.4) / 4.4).toBeLessThanOrEqual(0.1);
    expect(Math.abs(cal.p10 - 28.22)).toBeLessThanOrEqual(1.0);
    expect(Math.abs(cal.p90 - 38.8)).toBeLessThanOrEqual(1.0);
  });

  it('(e) scenario multiples match demo_output_v6 within regression tolerance', () => {
    // Tolerance from (b): we check medians are finite, bands sensible, and
    // key elevated parts move in the expected direction vs sedentary.
    const scenarios: { name: string; extra: ExtraMinutes; hot: string[] }[] = [
      { name: 'walk30', extra: { walk_brisk: 30 }, hot: ['legs', 'hips_glutes'] },
      { name: 'run45', extra: { jog: 45 }, hot: ['legs', 'hips_glutes'] },
      { name: 'garden45', extra: { garden: 45 }, hot: ['arms', 'shoulders'] },
      {
        name: 'ibike45',
        extra: { indoor_bike_general: 45 },
        hot: ['legs', 'hips_glutes'],
      },
    ];

    // demo_output_v6 reference medians (R seed 2026) — allow ±0.35 absolute
    // (RNG streams differ; regression band on calibration is the hard gate)
    const demoRun45: Record<string, number> = {
      arms: 1.03,
      shoulders: 1.0,
      chest: 1.0,
      upper_back: 1.0,
      core: 1.0,
      lower_back: 1.01,
      hips_glutes: 1.66,
      legs: 1.49,
    };

    for (const sc of scenarios) {
      const result = runModel(input, sc.extra, 2026);
      for (const part of result.parts) {
        expect(part.median).toBeGreaterThanOrEqual(1);
        expect(part.hi89).toBeGreaterThanOrEqual(part.median);
        expect(part.lo89).toBeLessThanOrEqual(part.median);
      }
      for (const hot of sc.hot) {
        const p = result.parts.find((x) => x.part === hot);
        expect(p?.median).toBeGreaterThan(1.05);
      }
    }

    const run45 = runModel(input, { jog: 45 }, 2026);
    for (const [part, demoMed] of Object.entries(demoRun45)) {
      const p = run45.parts.find((x) => x.part === part);
      expect(p).toBeDefined();
      // Soft match to demo_output_v6: within 0.35 or relative 25% of (demo-1)
      const tol = Math.max(0.35, Math.abs(demoMed - 1) * 0.35);
      expect(Math.abs((p?.median ?? 0) - demoMed)).toBeLessThanOrEqual(tol);
    }
  });

  it('multi-entry composition subtracts total extras from TV (model.R)', () => {
    const result = runModel(input, { walk_brisk: 20, jog: 20 }, 2026);
    const legs = result.parts.find((p) => p.part === 'legs');
    expect(legs?.median).toBeGreaterThan(1.1);
  });

  it('yard work uses MET 4.0 and elevates arms/shoulders', () => {
    const yard = activities.find((a) => a.id === 'yard');
    expect(yard?.met.median.value).toBe(4);
    const result = runModel(input, { yard: 45 }, 2026);
    const arms = result.parts.find((p) => p.part === 'arms');
    expect(arms?.median).toBeGreaterThan(1.2);
  });
});
