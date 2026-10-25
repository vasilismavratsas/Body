import { shareRows } from '../data/load';
import type { PartId } from '../data/schemas';
import { PART_IDS } from '../data/schemas';

/** True when a majority of share cells touching this part are ASSUMPTION. */
export function mostlyAssumptionByPart(): Record<PartId, boolean> {
  const out = {} as Record<PartId, boolean>;
  for (const part of PART_IDS) {
    let assumption = 0;
    let total = 0;
    for (const row of Object.values(shareRows)) {
      const st = row.cellStatus[part];
      total++;
      if (st === 'ASSUMPTION') assumption++;
    }
    out[part] = total > 0 && assumption / total >= 0.5;
  }
  return out;
}
