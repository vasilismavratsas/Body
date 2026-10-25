/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion */

/**
 * Body phase-alpha model v0.7 — TypeScript port of reference/model.R.
 * Pure: no React, no DOM. All physiological numbers come from src/data.
 * Share rule (spec §11) applied at data conversion; engine uses sbar + kappa.
 */
import type {
  Activity,
  Baseline,
  BodyPart,
  Intensity,
  ModelConfig,
  PartId,
  ShareRow,
} from '../data/schemas';
import { INTENSITIES, PART_IDS } from '../data/schemas';

// ---------------------------------------------------------------------------
// Seeded RNG (Mulberry32) + distribution samplers
// ---------------------------------------------------------------------------

export type Rng = () => number; // U(0,1)

export function createRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller standard normal. */
function rnorm(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape, rate) via Marsaglia–Tsang (shape ≥ 1) + boost for shape < 1. */
export function rgamma(rng: Rng, shape: number, rate: number): number {
  if (!(shape > 0) || !(rate > 0)) return 0;
  if (shape < 1) {
    const u = rng();
    return rgamma(rng, 1 + shape, rate) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = rnorm(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return (d * v) / rate;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return (d * v) / rate;
  }
}

/** Gamma from mean m and SD s. */
export function rgammaMs(rng: Rng, m: number, s: number): number {
  if (!(m > 0) || !(s > 0)) return 0;
  const shape = (m / s) ** 2;
  const rate = m / s ** 2;
  return rgamma(rng, shape, rate);
}

/** Zero-inflated Gamma: participate ~ Bern(p); else 0. */
export function rzigamma(rng: Rng, m: number, s: number, p: number): number {
  if (rng() >= p) return 0;
  return rgammaMs(rng, m, s);
}

/** Dirichlet via normalised Gammas. */
export function rdirichlet(rng: Rng, alpha: number[]): number[] {
  const g = alpha.map((a) => rgamma(rng, Math.max(a, 1e-12), 1));
  const sum = g.reduce((x, y) => x + y, 0);
  return g.map((x) => x / sum);
}

export function rlnorm(rng: Rng, meanlog: number, sdlog: number): number {
  return Math.exp(meanlog + sdlog * rnorm(rng));
}

// ---------------------------------------------------------------------------
// Colour / bands
// ---------------------------------------------------------------------------

export type BandName = 'green' | 'yellow-green' | 'orange' | 'red';

export function bandOf(m: number, edges: number[]): BandName {
  const names: BandName[] = ['green', 'yellow-green', 'orange', 'red'];
  let i = 0;
  while (i < edges.length && m >= edges[i]!) i++;
  return names[i] ?? 'red';
}

/** Continuous log2 ramp from green → amber → red, capped at mCap. */
export function colorOf(m: number, mCap: number, stops: string[]): string {
  const t = Math.min(Math.max(Math.log2(Math.max(m, 1e-12)), 0) / Math.log2(mCap), 1);
  return lerpHexRamp(stops, t);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.round(x).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function lerpHexRamp(stops: string[], t: number): string {
  if (stops.length === 0) return '#000000';
  if (stops.length === 1) return stops[0]!.toUpperCase();
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const [r0, g0, b0] = hexToRgb(stops[i]!);
  const [r1, g1, b1] = hexToRgb(stops[i + 1]!);
  return rgbToHex(r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f);
}

export function straddlesCutoff(lo: number, hi: number, edges: number[]): boolean {
  let count = 0;
  for (const e of edges) {
    if (lo < e && e <= hi) count++;
  }
  return count >= 2;
}

// ---------------------------------------------------------------------------
// Input contract (spec §14)
// ---------------------------------------------------------------------------

/** User-day row: activity = catalog id or "weightlifting". */
export type DayRow = {
  activity: string;
  minutes: number;
  exercise?: string;
  intensity?: Intensity;
};

/** Aggregated minutes by engine key (catalog id or lift:ex:intensity). */
export type ExtraMinutes = Record<string, number>;

export class ModelInputError extends Error {
  readonly rowIndex: number;
  constructor(message: string, rowIndex: number) {
    super(message);
    this.name = 'ModelInputError';
    this.rowIndex = rowIndex;
  }
}

export function liftKey(exerciseId: string, intensity: Intensity): string {
  return `lift:${exerciseId}:${intensity}`;
}

/**
 * Resolve day rows → ExtraMinutes (model.R as_extra).
 * Unknown activity/lift, bad intensity or bad minutes → error naming the row.
 */
export function dayToExtra(
  day: DayRow[] | null | undefined,
  input: ModelInput,
): ExtraMinutes | null {
  if (!day || day.length === 0) return null;
  const out: ExtraMinutes = {};
  for (let i = 0; i < day.length; i++) {
    const row = day[i]!;
    const m = row.minutes;
    if (!Number.isFinite(m) || m < 0 || m > 1440) {
      throw new ModelInputError(`input row ${String(i + 1)}: minutes must be 0-1440`, i);
    }
    let key: string;
    if (row.activity === 'weightlifting' && row.exercise) {
      const e = row.exercise;
      if (!input.liftIds.includes(e)) {
        throw new ModelInputError(
          `input row ${String(i + 1)}: unknown lift '${e}' (known: ${input.liftIds.join(', ')})`,
          i,
        );
      }
      let it = row.intensity;
      if (!it) it = input.liftDefaultIntensity[e]!;
      if (!INTENSITIES.includes(it)) {
        throw new ModelInputError(
          `input row ${String(i + 1)}: intensity must be light/moderate/vigorous`,
          i,
        );
      }
      key = liftKey(e, it);
    } else {
      let a = row.activity;
      // weightlifting with no exercise → catalog resist_multi / weightlifting row (spec §13)
      if (a === 'weightlifting') a = 'weightlifting';
      if (!input.catalogIds.includes(a)) {
        throw new ModelInputError(
          `input row ${String(i + 1)}: unknown activity '${a}'`,
          i,
        );
      }
      key = a;
    }
    out[key] = (out[key] ?? 0) + m;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prepared model inputs (from src/data)
// ---------------------------------------------------------------------------

export type ModelInput = {
  parts: PartId[];
  mass: Record<PartId, number>;
  shareRowIds: string[];
  sbar: Record<string, Record<PartId, number>>;
  kappa: Record<string, Record<PartId, number>>;
  /** All activity keys (baseline groups + catalog + lift×intensity). */
  acts: string[];
  catalogIds: string[];
  liftIds: string[];
  liftDefaultIntensity: Record<string, Intensity>;
  lowNIds: string[];
  met0: Record<string, number>;
  /** Per-activity sdlog (spec §12). */
  sdlog: Record<string, number>;
  rowOf: Record<string, string>;
  baseIds: string[];
  baseMin: Record<string, number>;
  baseSe: Record<string, number>;
  baseMuC: Record<string, number>;
  baseSdC: Record<string, number>;
  basePi: Record<string, number>;
  phi: number;
  nDraws: number;
  metSigmaLog: number;
  bandEdges: number[];
  bandNames: string[];
  mCap: number;
  rampStops: string[];
  huLog2: number;
  rawMinSum: number;
  swapFrom: string;
};

export type PartResult = {
  part: PartId;
  lo89: number;
  median: number;
  hi89: number;
  band: BandName;
  color: string;
  straddlesCutoff: boolean;
  log2HiLo: number;
  highUncertainty: boolean;
  /** Share of draws with F_p > B_p (diagnostic). */
  offsetGtB: number;
  /** Deterministic smallBaseline on nominal inputs (spec §10 v0.7). */
  smallBaseline: boolean;
  /** P(M ≥ 1.8) — data-model v0.7 / model.R pRed. */
  pRed: number;
  /** median ≥ M_cap (spec §16 P2). */
  saturated: boolean;
  typPct: number;
  flags: (
    'smallBaseline' | 'straddlesCutoff' | 'highUncertainty' | 'referenceIsAverage'
  )[];
};

export type SimulationResult = {
  parts: PartResult[];
  grossInd: number[];
  calibration: { sd: number; p10: number; p50: number; p90: number };
};

export function prepareModelInput(
  bodyParts: BodyPart[],
  shareRows: Record<string, ShareRow>,
  activities: Activity[],
  baseline: Baseline,
  config: ModelConfig,
): ModelInput {
  const parts = [...PART_IDS];
  const massRaw: Record<PartId, number> = {} as Record<PartId, number>;
  for (const p of bodyParts) massRaw[p.id] = p.muscleMassFraction.value;
  const massSum = parts.reduce((s, p) => s + massRaw[p], 0);
  const mass = {} as Record<PartId, number>;
  for (const p of parts) mass[p] = massRaw[p] / massSum;

  const shareRowIds = Object.keys(shareRows);
  const sbar: Record<string, Record<PartId, number>> = {};
  const kappa: Record<string, Record<PartId, number>> = {};
  for (const id of shareRowIds) {
    const row = shareRows[id]!;
    sbar[id] = {} as Record<PartId, number>;
    kappa[id] = {} as Record<PartId, number>;
    for (const p of parts) {
      sbar[id]![p] = row.sbar[p].value;
      kappa[id]![p] = row.kappa[p].value;
    }
  }

  const deff = baseline.designEffect.value;
  const baseIds: string[] = [];
  const baseMin: Record<string, number> = {};
  const baseSe: Record<string, number> = {};
  const baseMuC: Record<string, number> = {};
  const baseSdC: Record<string, number> = {};
  const basePi: Record<string, number> = {};
  const met0: Record<string, number> = {};
  const sdlog: Record<string, number> = {};
  const rowOf: Record<string, string> = {};

  let rawMinSum = 0;
  for (const g of baseline.groups) {
    rawMinSum += g.minutes.mean.value;
  }
  const defaultSdlog = config.metSigmaLog.value;
  for (const g of baseline.groups) {
    const id = g.activityId;
    baseIds.push(id);
    const min = (g.minutes.mean.value * 1440) / rawMinSum;
    baseMin[id] = min;
    const n = g.n.value;
    const sd = g.minutes.sd.value;
    baseSe[id] = sd / Math.sqrt(n / deff);
    const pi = Math.max(g.participationRate.value, 1e-9);
    basePi[id] = pi;
    const muC = min / pi;
    baseMuC[id] = muC;
    const sdC2 = Math.max((sd ** 2 + min ** 2) / pi - muC ** 2, 0);
    baseSdC[id] = Math.sqrt(sdC2);
    met0[id] = g.met.value;
    sdlog[id] = defaultSdlog;
    rowOf[id] = g.shareRowId.value;
  }

  const catalogIds: string[] = [];
  const liftIds: string[] = [];
  const liftDefaultIntensity: Record<string, Intensity> = {};
  const lowNIds: string[] = [];

  for (const a of activities) {
    catalogIds.push(a.id);
    met0[a.id] = a.met.median.value;
    sdlog[a.id] = a.met.sigmaLog.value;
    rowOf[a.id] = a.shareRowId;
    if (a.lowN) lowNIds.push(a.id);

    if (a.kind === 'liftParent' && a.children) {
      for (const child of a.children) {
        liftIds.push(child.exerciseId);
        liftDefaultIntensity[child.exerciseId] = child.defaultIntensity;
        for (const intens of INTENSITIES) {
          const key = liftKey(child.exerciseId, intens);
          const m = child.metByIntensity[intens];
          met0[key] = m.MET.value;
          sdlog[key] = defaultSdlog; // lifts use CV 0.20 (spec §12)
          rowOf[key] = child.shareRowId;
        }
      }
    }
  }

  const liftKeys = liftIds.flatMap((e) => INTENSITIES.map((it) => liftKey(e, it)));
  const acts = [...baseIds, ...catalogIds, ...liftKeys];

  return {
    parts,
    mass,
    shareRowIds,
    sbar,
    kappa,
    acts,
    catalogIds,
    liftIds,
    liftDefaultIntensity,
    lowNIds,
    met0,
    sdlog,
    rowOf,
    baseIds,
    baseMin,
    baseSe,
    baseMuC,
    baseSdC,
    basePi,
    phi: config.offset.phi.value,
    nDraws: config.nDraws.value,
    metSigmaLog: defaultSdlog,
    bandEdges: [...config.colorScale.bandEdges.value],
    bandNames: [...config.colorScale.bandNames.value],
    mCap: config.colorScale.mCap.value,
    rampStops: [...config.colorScale.rampStops.value],
    huLog2: config.highUncertaintyLog2Width.value,
    rawMinSum,
    swapFrom: config.swapFrom.value,
  };
}

// ---------------------------------------------------------------------------
// Core simulation (model.R simulate_day)
// ---------------------------------------------------------------------------

export type DrawMatrices = {
  M: number[][];
  W: number[][];
  Bind: number[][];
  FB: boolean[][];
  grossInd: number[];
};

function emptyMatrix(n: number, p: number): number[][] {
  return Array.from({ length: n }, () => Array.from({ length: p }, () => 0));
}

export function simulateDay(
  input: ModelInput,
  extra: ExtraMinutes | null,
  rng: Rng,
  nDraws = input.nDraws,
  phi = input.phi,
): DrawMatrices {
  const P = input.parts.length;
  const M = emptyMatrix(nDraws, P);
  const Wmat = emptyMatrix(nDraws, P);
  const Bind = emptyMatrix(nDraws, P);
  const FB: boolean[][] = Array.from({ length: nDraws }, () =>
    Array.from({ length: P }, () => false),
  );
  const grossInd = new Array<number>(nDraws).fill(0);

  // Only activities that can carry minutes this run (baseline + extras).
  // Unused lift×intensity keys do not affect M when minutes are 0 (spec §14).
  const activeActs = new Set<string>(input.baseIds);
  if (extra) {
    for (const k of Object.keys(extra)) activeActs.add(k);
  }
  const acts = [...activeActs];
  const neededRows = new Set<string>();
  for (const a of acts) neededRows.add(input.rowOf[a]!);
  const shareRowIds = [...neededRows];

  for (let i = 0; i < nDraws; i++) {
    // MET draws — per-activity sdlog (spec §12 / model.R v0.7)
    const net: Record<string, number> = {};
    for (const a of acts) {
      const m0 = input.met0[a]!;
      if (m0 <= 1) {
        net[a] = 0;
      } else {
        const met = rlnorm(rng, Math.log(m0), input.sdlog[a] ?? input.metSigmaLog);
        net[a] = Math.max(met - 1, 0);
      }
    }

    // Dirichlet shares per needed share row
    const Srow: Record<string, Record<PartId, number>> = {};
    for (const rid of shareRowIds) {
      const alpha = input.parts.map((p) => input.kappa[rid]![p]! * input.sbar[rid]![p]!);
      const draw = rdirichlet(rng, alpha);
      Srow[rid] = {} as Record<PartId, number>;
      input.parts.forEach((p, j) => {
        Srow[rid]![p] = draw[j]!;
      });
    }

    // MEAN baseline minutes (SE only), rescale to 1440
    const bm: Record<string, number> = {};
    for (const a of acts) bm[a] = 0;
    let bmSum = 0;
    for (const id of input.baseIds) {
      const v = rgammaMs(rng, input.baseMin[id]!, input.baseSe[id]!);
      bm[id] = v;
      bmSum += v;
    }
    for (const a of acts) bm[a] = ((bm[a] ?? 0) / bmSum) * 1440;

    // B_p
    const B = new Array<number>(P).fill(0);
    for (const a of acts) {
      const mins = bm[a]!;
      if (mins === 0 && net[a] === 0) continue;
      const row = Srow[input.rowOf[a]!]!;
      const w = net[a]! * mins;
      if (w === 0) continue;
      input.parts.forEach((p, j) => {
        B[j]! += w * row[p]!;
      });
    }

    // User minutes = mean day with TV swapped for exercise (model.R composition)
    const um = { ...bm };
    if (extra) {
      const totalExtra = Object.values(extra).reduce((s, v) => s + v, 0);
      const swap = input.swapFrom;
      um[swap] = Math.max((um[swap] ?? 0) - totalExtra, 0);
      for (const [aid, mins] of Object.entries(extra)) {
        um[aid] = (um[aid] ?? 0) + mins;
      }
    }

    const W = new Array<number>(P).fill(0);
    for (const a of acts) {
      const mins = um[a] ?? 0;
      if (mins === 0) continue;
      const row = Srow[input.rowOf[a]!]!;
      const w = net[a]! * mins;
      if (w === 0) continue;
      input.parts.forEach((p, j) => {
        W[j]! += w * row[p]!;
      });
    }

    const sumB = B.reduce((s, v) => s + v, 0);
    input.parts.forEach((p, j) => {
      const Fp = phi * input.mass[p]! * sumB;
      M[i]![j] = (W[j]! + Fp) / (B[j]! + Fp);
      FB[i]![j] = Fp > B[j]!;
      Wmat[i]![j] = W[j]!;
    });

    // Individual non-exerciser day for typicality
    const im: Record<string, number> = {};
    for (const a of acts) im[a] = 0;
    let imSum = 0;
    for (const id of input.baseIds) {
      const v = rzigamma(rng, input.baseMuC[id]!, input.baseSdC[id]!, input.basePi[id]!);
      im[id] = v;
      imSum += v;
    }
    if (imSum <= 0) {
      for (const id of input.baseIds) {
        im[id] = input.baseMin[id]!;
        imSum += im[id]!;
      }
    }
    for (const a of acts) im[a] = ((im[a] ?? 0) / imSum) * 1440;

    input.parts.forEach((p, j) => {
      let bp = 0;
      for (const a of acts) {
        const mins = im[a]!;
        if (mins === 0) continue;
        bp += net[a]! * mins * Srow[input.rowOf[a]!]![p]!;
      }
      Bind[i]![j] = bp;
    });

    // nominal METs for calibration gross
    let gross = 0;
    for (const a of acts) {
      gross += (im[a] ?? 0) * input.met0[a]!;
    }
    grossInd[i] = gross / 60;
  }

  return { M, W: Wmat, Bind, FB, grossInd };
}

/**
 * smallBaseline on NOMINAL inputs only (spec §10 v0.7):
 * nominal MET, mean shares s̄, mean baseline day; smallBaseline_p = F_p > B_p.
 */
export function nominalSmallBaseline(
  input: ModelInput,
  extra: ExtraMinutes | null = null,
  phi = input.phi,
): Record<PartId, boolean> {
  const P = input.parts.length;
  const B = new Array<number>(P).fill(0);
  const W = new Array<number>(P).fill(0);

  const bm: Record<string, number> = {};
  for (const a of input.acts) bm[a] = 0;
  for (const id of input.baseIds) bm[id] = input.baseMin[id]!;

  const um = { ...bm };
  if (extra) {
    const totalExtra = Object.values(extra).reduce((s, v) => s + v, 0);
    um[input.swapFrom] = Math.max((um[input.swapFrom] ?? 0) - totalExtra, 0);
    for (const [aid, mins] of Object.entries(extra)) {
      um[aid] = (um[aid] ?? 0) + mins;
    }
  }

  for (const a of input.acts) {
    const m0 = input.met0[a]!;
    const net = m0 <= 1 ? 0 : Math.max(m0 - 1, 0);
    const row = input.sbar[input.rowOf[a]!]!;
    input.parts.forEach((p, j) => {
      B[j]! += net * bm[a]! * row[p]!;
      W[j]! += net * (um[a] ?? 0) * row[p]!;
    });
  }

  const sumB = B.reduce((s, v) => s + v, 0);
  const out = {} as Record<PartId, boolean>;
  input.parts.forEach((p, j) => {
    const Fp = phi * input.mass[p]! * sumB;
    out[p] = Fp > B[j]!;
  });
  return out;
}

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! * (hi - pos) + sorted[hi]! * (pos - lo);
}

export function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  return quantileSorted(s, q);
}

export function sd(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let v = 0;
  for (const x of values) v += (x - mean) ** 2;
  return Math.sqrt(v / (n - 1));
}

export function summarise(
  input: ModelInput,
  sim: DrawMatrices,
  extra: ExtraMinutes | null = null,
): PartResult[] {
  const small = nominalSmallBaseline(input, extra);
  const redEdge = input.bandEdges[2]!; // 1.8
  const results: PartResult[] = [];
  for (let j = 0; j < input.parts.length; j++) {
    const col = sim.M.map((row) => row[j]!);
    const sorted = [...col].sort((a, b) => a - b);
    const lo89 = quantileSorted(sorted, 0.055);
    const median = quantileSorted(sorted, 0.5);
    const hi89 = quantileSorted(sorted, 0.945);
    const log2HiLo = Math.log2(hi89 / lo89);
    const straddles = straddlesCutoff(lo89, hi89, input.bandEdges);
    const highUnc = log2HiLo > input.huLog2;
    const offsetGtB = sim.FB.reduce((s, row) => s + (row[j] ? 1 : 0), 0) / sim.FB.length;
    const pRed = col.filter((m) => m >= redEdge).length / col.length;
    const saturated = median >= input.mCap; // spec §16 P2

    const wMedian = quantile(
      sim.W.map((row) => row[j]!),
      0.5,
    );
    const typPct = Math.round(
      (100 * sim.Bind.filter((row) => row[j]! < wMedian).length) / sim.Bind.length,
    );

    const part = input.parts[j]!;
    const smallBaseline = small[part]!;
    const flags: PartResult['flags'] = ['referenceIsAverage'];
    if (smallBaseline) flags.push('smallBaseline');
    if (straddles) flags.push('straddlesCutoff');
    if (highUnc) flags.push('highUncertainty');

    results.push({
      part,
      lo89: round2(lo89),
      median: round2(median),
      hi89: round2(hi89),
      band: bandOf(median, input.bandEdges),
      color: colorOf(median, input.mCap, input.rampStops),
      straddlesCutoff: straddles,
      log2HiLo: round2(log2HiLo),
      highUncertainty: highUnc,
      offsetGtB: round3(offsetGtB),
      smallBaseline,
      pRed: round2(pRed),
      saturated,
      typPct,
      flags,
    });
  }
  return results;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export function runModel(
  input: ModelInput,
  extra: ExtraMinutes | null,
  seed: number,
): SimulationResult {
  const rng = createRng(seed);
  const sim = simulateDay(input, extra, rng);
  const parts = summarise(input, sim, extra);
  const cal = {
    sd: sd(sim.grossInd),
    p10: quantile(sim.grossInd, 0.1),
    p50: quantile(sim.grossInd, 0.5),
    p90: quantile(sim.grossInd, 0.9),
  };
  return { parts, grossInd: sim.grossInd, calibration: cal };
}

/** Run from DayRow[] input contract (spec §14). */
export function runModelDay(
  input: ModelInput,
  day: DayRow[] | null,
  seed: number,
): SimulationResult {
  const extra = dayToExtra(day, input);
  return runModel(input, extra, seed);
}

/** Deterministic baseline net MET-h/day (no Monte Carlo). */
export function deterministicBaselineNet(input: ModelInput): number {
  let net = 0;
  for (const id of input.baseIds) {
    const met = input.met0[id]!;
    net += input.baseMin[id]! * Math.max(met - 1, 0);
  }
  return net / 60;
}
