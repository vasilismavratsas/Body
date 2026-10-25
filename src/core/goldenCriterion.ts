/**
 * TS-vs-R golden criterion (spec §10 v0.7). Pure helpers used by tests and
 * the standalone scripts/run-golden-criterion.mjs runner (avoids vitest RPC
 * timeouts on long Monte Carlo suites in CI).
 */
import type { Intensity } from '../data/schemas';
import { nominalSmallBaseline, runModelDay, type DayRow, type ModelInput } from './model';
import { scenarioToDay, type DemoPartRow } from './parseDemoOutput';

export const GOLDEN_SEEDS = [2, 7, 11, 42, 99, 123, 999, 2025] as const;

const edges = [1.15, 1.4, 1.8];
const cap = 2.5;

function rel(a: number, b: number): number {
  return Math.abs(a - b) / b;
}
function distToEdges(v: number, th: number[]): number {
  return Math.min(...th.map((t) => Math.abs(v - t) / t));
}

export function runGoldenSeed(
  input: ModelInput,
  demoRows: DemoPartRow[],
  scenarios: string[],
  seed: number,
): { failures: string[]; meanExcess: number } {
  const failures: string[] = [];
  const excesses: number[] = [];

  for (const scenario of scenarios) {
    const dayRaw = scenarioToDay(scenario);
    const day: DayRow[] | null = dayRaw
      ? dayRaw.map((r) => ({
          activity: r.activity,
          minutes: r.minutes,
          ...(r.exercise ? { exercise: r.exercise } : {}),
          ...(r.intensity ? { intensity: r.intensity as Intensity } : {}),
        }))
      : null;
    const result = runModelDay(input, day, seed);
    for (const r of demoRows.filter((x) => x.scenario === scenario)) {
      const ts = result.parts.find((p) => p.part === r.part);
      if (!ts) {
        failures.push(`${scenario}/${r.part} missing`);
        continue;
      }
      if (rel(ts.median, r.med) > 0.06) failures.push(`${scenario}/${r.part} med`);
      if (rel(ts.lo89, r.lo) > 0.06) failures.push(`${scenario}/${r.part} lo`);
      if (rel(ts.hi89, r.hi) > 0.3) failures.push(`${scenario}/${r.part} hi`);

      const guardBand = distToEdges(r.med, [...edges, cap]) > 0.03;
      if (guardBand && (ts.band !== r.band || ts.saturated !== r.saturated)) {
        failures.push(`${scenario}/${r.part} band/sat`);
      }

      const guardStr = Math.min(distToEdges(r.lo, edges), distToEdges(r.hi, edges)) > 0.1;
      if (guardStr && ts.straddlesCutoff !== r.straddles) {
        failures.push(`${scenario}/${r.part} straddles`);
      }

      const log2w = Math.log2(r.hi / r.lo);
      if (Math.abs(log2w - 2) > 0.3 && ts.highUncertainty !== r.highU) {
        failures.push(`${scenario}/${r.part} highU`);
      }

      if (Math.abs(ts.offsetGtB - r.offsetGtB) > 0.06) {
        failures.push(`${scenario}/${r.part} offsetGtB`);
      }

      if (r.med > 1.05) {
        excesses.push((ts.median - 1) / (r.med - 1) - 1);
      }
    }
  }

  const expectedSmall = nominalSmallBaseline(input, null);
  for (const p of Object.keys(expectedSmall) as (keyof typeof expectedSmall)[]) {
    if (expectedSmall[p]) {
      failures.push(`smallBaseline/${p} expected false`);
    }
  }

  const meanExcess = excesses.reduce((a, b) => a + b, 0) / Math.max(excesses.length, 1);
  if (Math.abs(meanExcess) > 0.02) {
    failures.push(`AGGREGATE meanExcess=${meanExcess.toFixed(4)}`);
  }

  return { failures, meanExcess };
}
