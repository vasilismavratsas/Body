/**
 * Port of model.R validate_shares (spec §14). Errors name file and row/id.
 * Used by conversion and SYNTHETIC fixture tests; fixtures never ship.
 */
import { PART_IDS, type PartId } from './schemas';

export type ShareLongRow = {
  id: string;
  part: string;
  index_pctMVC: number | string;
  mass_fraction: number | string;
  status: string;
  share?: number | string;
  rowNumber?: number;
};

export class ShareValidationError extends Error {
  readonly file: string;
  readonly rowId: string;
  constructor(message: string, file: string, rowId: string) {
    super(message);
    this.name = 'ShareValidationError';
    this.file = file;
    this.rowId = rowId;
  }
}

function num(x: number | string): number {
  const n = typeof x === 'number' ? x : Number(x);
  return n;
}

export function validateShares(rows: ShareLongRow[], file: string): void {
  const byId = new Map<string, ShareLongRow[]>();
  for (const r of rows) {
    const list = byId.get(r.id) ?? [];
    list.push(r);
    byId.set(r.id, list);
  }
  for (const [id, cells] of byId) {
    const parts = cells.map((c) => c.part);
    const uniq = new Set(parts);
    if (uniq.size !== 8 || cells.length !== 8 || !PART_IDS.every((p) => uniq.has(p))) {
      throw new ShareValidationError(
        `${file}: '${id}' must have exactly the 8 parts once each; has: ${parts.join(',')}`,
        file,
        id,
      );
    }
    for (const c of cells) {
      if (!/^(cited|stand-in|ASSUMPTION)/.test(c.status)) {
        throw new ShareValidationError(
          `${file}: '${id}' has invalid status '${c.status}' (allowed: cited / stand-in / ASSUMPTION)`,
          file,
          id,
        );
      }
    }
    const ix = cells.map((c) => num(c.index_pctMVC));
    const ms = cells.map((c) => num(c.mass_fraction));
    if (
      ix.some((x) => !Number.isFinite(x) || x < 0) ||
      ix.reduce((a, b) => a + b, 0) === 0
    ) {
      throw new ShareValidationError(
        `${file}: '${id}' index_pctMVC must be numbers >= 0, not all 0`,
        file,
        id,
      );
    }
    if (ms.some((x) => !Number.isFinite(x) || x <= 0)) {
      throw new ShareValidationError(
        `${file}: '${id}' mass_fraction must be > 0`,
        file,
        id,
      );
    }
    if (cells.some((c) => c.share !== undefined && c.share !== '')) {
      const sum = cells.reduce((a, c) => a + num(c.share ?? 0), 0);
      if (Math.abs(sum - 1) > 0.002) {
        throw new ShareValidationError(
          `${file}: '${id}' stored shares sum to ${sum.toFixed(4)}, not 1`,
          file,
          id,
        );
      }
    }
  }
}

/** Recompute sbar from index × mass (spec §11). */
export function computeSbar(
  cells: { part: PartId; index: number; mass: number; status: string }[],
  assumedIndexScale: number,
): Record<PartId, number> {
  const out = {} as Record<PartId, number>;
  let sum = 0;
  const w = {} as Record<PartId, number>;
  for (const c of cells) {
    let ix = c.index;
    if (/^ASSUMPTION/i.test(c.status) || c.status === 'ASSUMPTION') {
      ix *= assumedIndexScale;
    }
    w[c.part] = c.mass * ix;
    sum += w[c.part];
  }
  for (const p of PART_IDS) {
    out[p] = w[p] / sum;
  }
  return out;
}
