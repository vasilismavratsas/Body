import type { PartId } from '../data/schemas';
import { PART_DISPLAY_LABELS } from '../data/schemas';

/** One shared display-label map for map, table, and detail panel (round-2 §A.2). */
export const PART_LABELS = PART_DISPLAY_LABELS;

export function partLabel(id: PartId): string {
  return PART_LABELS[id];
}

/**
 * Display a multiple: "1×" when rounded lo equals hi; ">2.5×" when saturated
 * (spec §16 P2 / round-2 §A.2, §C.4).
 */
export function displayMultiple(
  median: number,
  lo: number,
  hi: number,
  saturated = false,
  mCap = 2.5,
): string {
  if (saturated || median >= mCap) return `>${String(mCap)}×`;
  const rLo = Math.round(lo * 100) / 100;
  const rHi = Math.round(hi * 100) / 100;
  if (rLo === rHi) return `${String(rLo)}×`;
  return `${String(Math.round(median * 100) / 100)}×`;
}

export function displayInterval(
  lo: number,
  hi: number,
  saturated = false,
  mCap = 2.5,
): string {
  const rLo = Math.round(lo * 100) / 100;
  const rHi = Math.round(hi * 100) / 100;
  if (rLo === rHi) return `${String(rLo)}×`;
  if (saturated) return `${String(rLo)}–>${String(mCap)}×`;
  return `${String(rLo)}–${String(rHi)}×`;
}
