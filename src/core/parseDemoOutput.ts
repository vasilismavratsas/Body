/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Parse reference/demo_output_v7.txt into per-scenario part rows for golden tests.
 */
import type { BandName } from './model';
import type { PartId } from '../data/schemas';
import { PART_IDS } from '../data/schemas';

export type DemoPartRow = {
  scenario: string;
  part: PartId;
  lo: number;
  med: number;
  hi: number;
  band: BandName;
  straddles: boolean;
  highU: boolean;
  saturated: boolean;
  offsetGtB: number;
  pRed: number;
  typPct: number;
};

export type DemoMeta = {
  baselineNet: number;
  lowN: string[];
  activityMets: { activity_id: string; MET: number; sdlog: number }[];
};

const PART_SET = new Set<string>(PART_IDS);

export function parseDemoOutput(text: string): { rows: DemoPartRow[]; meta: DemoMeta } {
  const baselineMatch = text.match(/Deterministic baseline net = ([0-9.]+) MET-h\/day/);
  const lowNMatch = text.match(/lowN \(<\d+ ATUS respondents\) flagged: ([^\n]+)/);
  const lowN = lowNMatch
    ? lowNMatch[1]!
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== '')
    : [];

  const activityMets: DemoMeta['activityMets'] = [];
  const metBlock = text.match(
    /Activity METs \(code, median, sdlog\):\n([\s\S]*?)\nASSUMPTIONS:/,
  );
  if (metBlock) {
    for (const line of metBlock[1]!.split('\n')) {
      const m = line.trim().match(/^(\S+)\s+\S+\s+\S+\s+([0-9.]+)\s+([0-9.]+)\s*$/);
      if (m) {
        activityMets.push({
          activity_id: m[1]!,
          MET: Number(m[2]),
          sdlog: Number(m[3]),
        });
      }
    }
  }

  const rows: DemoPartRow[] = [];
  const scenarioRe =
    /=== Scenario: (\S+)[^\n]*===\n\s*part[^\n]*\n([\s\S]*?)(?=\n=== |\n=== Sanity|$)/g;
  let match: RegExpExecArray | null;
  while ((match = scenarioRe.exec(text)) !== null) {
    const scenario = match[1]!;
    const body = match[2]!;
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+/);
      // part lo89 median hi89 band color straddlesCutoff log2_hi_lo highUncertainty offset_gt_B pRed saturated typ_pct
      if (parts.length < 12) continue;
      const part = parts[0]!;
      if (!PART_SET.has(part)) continue;
      const lo = Number(parts[1]);
      const med = Number(parts[2]);
      const hi = Number(parts[3]);
      const band = parts[4] as BandName;
      // color may be #hex without spaces
      let i = 5;
      if (parts[i]?.startsWith('#')) i++;
      const straddles = parts[i] === 'TRUE';
      i++;
      i++; // log2_hi_lo
      const highU = parts[i] === 'TRUE';
      i++;
      const offsetGtB = Number(parts[i]);
      i++;
      const pRed = Number(parts[i]);
      i++;
      const saturated = parts[i] === 'TRUE';
      i++;
      const typPct = Number(parts[i]);
      rows.push({
        scenario,
        part: part as PartId,
        lo,
        med,
        hi,
        band,
        straddles,
        highU,
        saturated,
        offsetGtB,
        pRed,
        typPct,
      });
    }
  }

  return {
    rows,
    meta: {
      baselineNet: baselineMatch ? Number(baselineMatch[1]) : NaN,
      lowN,
      activityMets,
    },
  };
}

/** Map demo scenario name → DayRow[] / ExtraMinutes builder hints. */
export function scenarioToDay(
  scenario: string,
): { activity: string; minutes: number; exercise?: string; intensity?: string }[] | null {
  if (scenario === 'sedentary') return null;
  if (scenario === 'walk30') return [{ activity: 'walk_brisk', minutes: 30 }];
  if (scenario === 'tennis60_curl30') {
    return [
      { activity: 'tennis', minutes: 60 },
      {
        activity: 'weightlifting',
        minutes: 30,
        exercise: 'biceps_curl',
        intensity: 'vigorous',
      },
    ];
  }
  // Demo names are lift_<exerciseId><minutes> e.g. lift_bench_press45 (no underscore before minutes).
  const liftVig = scenario.match(/^lift_(.+?)(\d+)_vig$/);
  if (liftVig) {
    return [
      {
        activity: 'weightlifting',
        minutes: Number(liftVig[2]),
        exercise: liftVig[1]!,
        intensity: 'vigorous',
      },
    ];
  }
  const lift = scenario.match(/^lift_(.+?)(\d+)$/);
  if (lift) {
    return [
      {
        activity: 'weightlifting',
        minutes: Number(lift[2]),
        exercise: lift[1]!,
      },
    ];
  }
  const act = scenario.match(/^(.+?)(\d+)$/);
  if (act) {
    // Catalog row resist_multi is exposed as activity id "weightlifting" (spec §13).
    const activity = act[1] === 'resist_multi' ? 'weightlifting' : act[1]!;
    return [{ activity, minutes: Number(act[2]) }];
  }
  throw new Error(`Unknown scenario: ${scenario}`);
}
