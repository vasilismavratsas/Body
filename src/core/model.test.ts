/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-boolean-literal-compare */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { activities, baseline, bodyParts, modelConfig, shareRows } from '../data/load';
import type { Intensity } from '../data/schemas';
import {
  createRng,
  dayToExtra,
  deterministicBaselineNet,
  liftKey,
  nominalSmallBaseline,
  prepareModelInput,
  quantile,
  runModel,
  runModelDay,
  sd,
  simulateDay,
  type DayRow,
} from './model';
import { parseDemoOutput, scenarioToDay } from './parseDemoOutput';
import snapshot from './snapshots/seed2026-calibration.json';

const input = prepareModelInput(bodyParts, shareRows, activities, baseline, modelConfig);

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const demoText = readFileSync(join(root, 'reference/demo_output_v7.txt'), 'utf8');
const demo = parseDemoOutput(demoText);

describe('core engine port of model.R v0.7', () => {
  it('(setup) deterministic baseline net ≈ 9.20 MET-h/day', () => {
    expect(deterministicBaselineNet(input)).toBeCloseTo(9.2, 2);
    expect(demo.meta.baselineNet).toBeCloseTo(9.2, 2);
    expect(input.nDraws).toBe(4000);
    expect(activities).toHaveLength(25);
  });

  it('(a) identical day (no extra) gives exactly 1× for all parts', () => {
    const result = runModel(input, null, 2026);
    for (const p of result.parts) {
      expect(p.median).toBe(1);
      expect(p.lo89).toBe(1);
      expect(p.hi89).toBe(1);
      expect(p.saturated).toBe(false);
    }
  });

  it('(b) model regression — any seed: individual-day gross bands (spec §10)', () => {
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
  }, 60_000);

  it('(c) fixed-seed snapshot: seed 2026 reproducible to ±0.01', () => {
    const result = runModel(input, null, 2026);
    const cal = result.calibration;
    expect(cal.sd).toBeCloseTo(snapshot.sd, 2);
    expect(cal.p10).toBeCloseTo(snapshot.p10, 2);
    expect(cal.p90).toBeCloseTo(snapshot.p90, 2);
    const again = runModel(input, null, 2026).calibration;
    expect(again.sd).toBeCloseTo(cal.sd, 8);
    expect(again.p10).toBeCloseTo(cal.p10, 8);
    expect(again.p90).toBeCloseTo(cal.p90, 8);
  });

  it('(d) survey validity vs cited per-person gross (spec §10)', () => {
    const cal = runModel(input, null, 2026).calibration;
    expect(Math.abs(cal.sd - 4.4) / 4.4).toBeLessThanOrEqual(0.1);
    expect(Math.abs(cal.p10 - 28.22)).toBeLessThanOrEqual(1.0);
    expect(Math.abs(cal.p90 - 38.8)).toBeLessThanOrEqual(1.0);
  });

  it('smallBaseline is computed once on nominal inputs (spec §10 v0.7)', () => {
    // Spec §15: F_p/B_p ranges to 0.49 (chest) at phi=0.25 — so nominal F_p > B_p
    // is false for every part. The draw-share offset_gt_B (demo) is diagnostic only.
    const small = nominalSmallBaseline(input, null);
    const result = runModel(input, null, 2026);
    for (const part of result.parts) {
      expect(part.smallBaseline).toBe(small[part.part]);
      expect(part.smallBaseline).toBe(false);
    }
    // Seed-independent
    const again = runModel(input, null, 99);
    for (const part of again.parts) {
      expect(part.smallBaseline).toBe(small[part.part]);
    }
    // Diagnostic share vs R sedentary within 0.06 (spec §10 rule 6)
    for (const r of demo.rows.filter((x) => x.scenario === 'sedentary')) {
      const part = result.parts.find((p) => p.part === r.part)!;
      expect(Math.abs(part.offsetGtB - r.offsetGtB)).toBeLessThanOrEqual(0.06);
    }
  }, 30_000);

  it('saturated flag when median >= 2.5; UI value concept >2.5× (spec §16 P2)', () => {
    const day: DayRow[] = [
      {
        activity: 'weightlifting',
        minutes: 45,
        exercise: 'bench_press',
        intensity: 'vigorous',
      },
    ];
    const result = runModelDay(input, day, 2026);
    const chest = result.parts.find((p) => p.part === 'chest')!;
    expect(chest.median).toBeGreaterThanOrEqual(2.5);
    expect(chest.saturated).toBe(true);

    const walk = runModelDay(input, [{ activity: 'walk_brisk', minutes: 30 }], 2026);
    for (const p of walk.parts) {
      if (p.median < 2.5) expect(p.saturated).toBe(false);
    }
  });

  it('two lift rows in one session run without error; each changes M via own shares', () => {
    const day: DayRow[] = [
      {
        activity: 'weightlifting',
        minutes: 30,
        exercise: 'biceps_curl',
        intensity: 'vigorous',
      },
      {
        activity: 'weightlifting',
        minutes: 30,
        exercise: 'bench_press',
        intensity: 'light',
      },
    ];
    const result = runModelDay(input, day, 2026);
    expect(result.parts).toHaveLength(8);
    const arms = result.parts.find((p) => p.part === 'arms')!;
    const chest = result.parts.find((p) => p.part === 'chest')!;
    expect(arms.median).toBeGreaterThan(1);
    expect(chest.median).toBeGreaterThan(1);
  });

  it('input contract errors name the row (spec §14)', () => {
    expect(() => dayToExtra([{ activity: 'nope', minutes: 10 }], input)).toThrow(
      /input row 1: unknown activity/,
    );
    expect(() =>
      dayToExtra(
        [{ activity: 'weightlifting', minutes: 10, exercise: 'not_a_lift' }],
        input,
      ),
    ).toThrow(/input row 1: unknown lift/);
    expect(() => dayToExtra([{ activity: 'walk_brisk', minutes: 2000 }], input)).toThrow(
      /minutes must be 0-1440/,
    );
  });

  it('sanity ordering (data-model v0.7)', () => {
    const checks: {
      day: DayRow[];
      hot: string;
      cool: string;
    }[] = [
      {
        day: [{ activity: 'weightlifting', minutes: 45, exercise: 'hip_thrust' }],
        hot: 'hips_glutes',
        cool: 'legs',
      },
      {
        day: [{ activity: 'weightlifting', minutes: 45, exercise: 'bench_press' }],
        hot: 'chest',
        cool: 'arms',
      },
      {
        day: [
          {
            activity: 'weightlifting',
            minutes: 45,
            exercise: 'biceps_curl',
          },
        ],
        hot: 'arms',
        cool: 'legs',
      },
      {
        day: [{ activity: 'weightlifting', minutes: 45, exercise: 'back_squat' }],
        hot: 'legs',
        cool: 'arms',
      },
      {
        day: [{ activity: 'swimming', minutes: 45 }],
        hot: 'shoulders',
        cool: 'hips_glutes',
      },
    ];
    for (const c of checks) {
      const result = runModelDay(input, c.day, 2026);
      const a = result.parts.find((p) => p.part === c.hot)!.median;
      const b = result.parts.find((p) => p.part === c.cool)!.median;
      expect(a).toBeGreaterThanOrEqual(b);
    }
  }, 60_000);

  it('deterministic values in demo_output match exactly (baseline, METs, lowN)', () => {
    expect(deterministicBaselineNet(input)).toBeCloseTo(demo.meta.baselineNet, 2);
    // lowN list (spec §12)
    const expectedLowN = new Set(demo.meta.lowN);
    for (const a of activities) {
      if (expectedLowN.has(a.id) || expectedLowN.has(a.catalogActivityId)) {
        expect(a.lowN).toBe(true);
      }
    }
    expect(input.lowNIds.length).toBeGreaterThanOrEqual(5);
    // Per-activity MET table
    for (const row of demo.meta.activityMets) {
      const id = row.activity_id === 'resist_multi' ? 'weightlifting' : row.activity_id;
      const act = activities.find(
        (a) => a.id === id || a.catalogActivityId === row.activity_id,
      );
      expect(act, row.activity_id).toBeDefined();
      expect(act!.met.median.value).toBeCloseTo(row.MET, 5);
      expect(act!.met.sigmaLog.value).toBeCloseTo(row.sdlog, 2);
    }
  });
});

describe('TS-vs-R golden criterion (spec §10 v0.7)', () => {
  const edges = [1.15, 1.4, 1.8];
  const cap = 2.5;
  const seeds = [2, 7, 11, 42, 99, 123, 999, 2025];

  function rel(a: number, b: number): number {
    return Math.abs(a - b) / b;
  }
  function distToEdges(v: number, th: number[]): number {
    return Math.min(...th.map((t) => Math.abs(v - t) / t));
  }

  function runScenario(scenario: string, seed: number) {
    const dayRaw = scenarioToDay(scenario);
    const day: DayRow[] | null = dayRaw
      ? dayRaw.map((r) => ({
          activity: r.activity,
          minutes: r.minutes,
          ...(r.exercise ? { exercise: r.exercise } : {}),
          ...(r.intensity ? { intensity: r.intensity as Intensity } : {}),
        }))
      : null;
    return runModelDay(input, day, seed);
  }

  // One `it` per seed so each stays under vitest's ~60s worker RPC heartbeat
  // (a single 8-seed loop caused CI exit 1 via "Timeout calling onTaskUpdate"
  // even when every assertion passed).
  const scenarios = [...new Set(demo.rows.map((r) => r.scenario))];

  it('golden criterion has demo scenarios wired', () => {
    expect(scenarios.length).toBeGreaterThan(30);
    expect(seeds).toHaveLength(8);
  });

  for (const seed of seeds) {
    it(`golden criterion seed ${String(seed)} (0 failing cells)`, () => {
      const failures: string[] = [];
      const excesses: number[] = [];

      for (const scenario of scenarios) {
        const result = runScenario(scenario, seed);
        for (const r of demo.rows.filter((x) => x.scenario === scenario)) {
          const ts = result.parts.find((p) => p.part === r.part)!;
          if (rel(ts.median, r.med) > 0.06) failures.push(`${scenario}/${r.part} med`);
          if (rel(ts.lo89, r.lo) > 0.06) failures.push(`${scenario}/${r.part} lo`);
          if (rel(ts.hi89, r.hi) > 0.3) failures.push(`${scenario}/${r.part} hi`);

          const guardBand = distToEdges(r.med, [...edges, cap]) > 0.03;
          if (guardBand && (ts.band !== r.band || ts.saturated !== r.saturated)) {
            failures.push(`${scenario}/${r.part} band/sat`);
          }

          const guardStr =
            Math.min(distToEdges(r.lo, edges), distToEdges(r.hi, edges)) > 0.1;
          if (guardStr && ts.straddlesCutoff !== r.straddles) {
            failures.push(`${scenario}/${r.part} straddles`);
          }

          const log2w = Math.log2(r.hi / r.lo);
          if (Math.abs(log2w - 2) > 0.3 && ts.highUncertainty !== r.highU) {
            failures.push(`${scenario}/${r.part} highU`);
          }

          // Diagnostic offset_gt_B within 0.06 (spec §10 rule 6)
          if (Math.abs(ts.offsetGtB - r.offsetGtB) > 0.06) {
            failures.push(`${scenario}/${r.part} offsetGtB`);
          }

          if (r.med > 1.05) {
            excesses.push((ts.median - 1) / (r.med - 1) - 1);
          }
        }
      }

      // smallBaseline exact: deterministic F>B on nominal (spec §10 / §15 → all false at phi 0.25)
      const expectedSmall = nominalSmallBaseline(input, null);
      for (const p of Object.keys(expectedSmall) as (keyof typeof expectedSmall)[]) {
        if (expectedSmall[p] !== false) {
          failures.push(`smallBaseline/${p} expected false`);
        }
      }

      const meanExcess =
        excesses.reduce((a, b) => a + b, 0) / Math.max(excesses.length, 1);
      if (Math.abs(meanExcess) > 0.02) {
        failures.push(`AGGREGATE meanExcess=${meanExcess.toFixed(4)}`);
      }

      expect(
        failures,
        `seed ${String(seed)}: ${failures.slice(0, 8).join('; ')}`,
      ).toEqual([]);
    }, 120_000);
  }

  it('can regenerate seed-2026 snapshot when BODY_REGEN_SNAPSHOT=1', () => {
    if (process.env.BODY_REGEN_SNAPSHOT !== '1') return;
    const cal = runModel(input, null, 2026).calibration;
    const path = join(
      dirname(fileURLToPath(import.meta.url)),
      'snapshots/seed2026-calibration.json',
    );
    writeFileSync(
      path,
      `${JSON.stringify(
        {
          seed: 2026,
          nDraws: 4000,
          modelVersion: '0.7',
          sd: Number(cal.sd.toFixed(6)),
          p10: Number(cal.p10.toFixed(6)),
          p50: Number(cal.p50.toFixed(6)),
          p90: Number(cal.p90.toFixed(6)),
          note: 'TS engine own snapshot (spec §10); R 4.16/27.91/38.16 are reference only',
        },
        null,
        2,
      )}\n`,
    );
  });
});

describe('lift key helpers', () => {
  it('builds lift:exercise:intensity keys', () => {
    expect(liftKey('bench_press', 'light')).toBe('lift:bench_press:light');
    const extra = dayToExtra(
      [{ activity: 'weightlifting', minutes: 45, exercise: 'bench_press' }],
      input,
    );
    const def = input.liftDefaultIntensity.bench_press!;
    expect(extra).toEqual({ [liftKey('bench_press', def)]: 45 });
  });
});
