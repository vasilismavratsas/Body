import { describe, expect, it } from 'vitest';
import activitiesJson from './activities.json';
import baselineJson from './baseline.json';
import bodyPartsJson from './bodyParts.json';
import modelConfigJson from './modelConfig.json';
import { runReleaseGuard } from './releaseGuard';
import {
  ActivitiesFileSchema,
  BaselineSchema,
  BodyPartsFileSchema,
  ModelConfigSchema,
  PART_IDS,
  ShareRowsFileSchema,
} from './schemas';
import shareRowsJson from './shareRows.json';

describe('data schemas (v0.6.1)', () => {
  it('parses bodyParts with 8 parts and mass fractions', () => {
    const parts = BodyPartsFileSchema.parse(bodyPartsJson);
    expect(parts.map((p) => p.id)).toEqual([...PART_IDS]);
    const massSum = parts.reduce((s, p) => s + p.muscleMassFraction.value, 0);
    expect(massSum).toBeCloseTo(1, 3);
  });

  it('parses 10 top activities including yard work MET 4.0 / gardening shares', () => {
    const acts = ActivitiesFileSchema.parse(activitiesJson);
    expect(acts).toHaveLength(10);
    const yard = acts.find((a) => a.id === 'yard');
    expect(yard?.met.median.value).toBe(4.0);
    expect(yard?.compendiumCode.value).toBe('08261');
    expect(yard?.shareRowId).toBe('gardening');
    expect(yard?.met.sigmaLog.status).toBe('ASSUMPTION');
    expect(yard?.activityToSharePairing.status).toBe('ASSUMPTION');
  });

  it('parses share rows that sum to ~1', () => {
    const rows = ShareRowsFileSchema.parse(shareRowsJson);
    for (const id of Object.keys(rows)) {
      const row = rows[id];
      expect(row).toBeDefined();
      if (!row) continue;
      const sum = PART_IDS.reduce((s, p) => s + row.sbar[p].value, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
    expect(rows.gardening).toBeDefined();
    expect(rows.indoor_biking).toBeDefined();
  });

  it('parses baseline groups with designEffect and per-person gross', () => {
    const base = BaselineSchema.parse(baselineJson);
    expect(base.groups.length).toBe(20);
    expect(base.designEffect.value).toBe(1.5);
    expect(base.designEffect.status).toBe('ASSUMPTION');
    expect(base.perPersonGross.sd.value).toBe(4.4);
    expect(base.totalNetMetH.value).toBe(9.2);
    const minSum = base.groups.reduce((s, g) => s + g.minutes.mean.value, 0);
    expect(minSum).toBeCloseTo(1440, 0);
  });

  it('parses modelConfig bands, cap, nDraws', () => {
    const cfg = ModelConfigSchema.parse(modelConfigJson);
    expect(cfg.version).toBe('0.6.1');
    expect(cfg.nDraws.value).toBe(4000);
    expect(cfg.colorScale.bandEdges.value).toEqual([1.15, 1.4, 1.8]);
    expect(cfg.colorScale.mCap.value).toBe(2.5);
    expect(cfg.offset.phi.value).toBe(0.25);
    expect(cfg.highUncertaintyLog2Width.value).toBe(2);
  });
});

describe('release guard', () => {
  it('passes on shipped src/data (no GAP or PLACEHOLDER)', () => {
    const result = runReleaseGuard({
      bodyParts: bodyPartsJson,
      shareRows: shareRowsJson,
      activities: activitiesJson,
      baseline: baselineJson,
      modelConfig: modelConfigJson,
    });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.valuedCount).toBeGreaterThan(50);
  });

  it('fails when a GAP value is present', () => {
    const result = runReleaseGuard({
      bad: {
        metSd: { value: null, status: 'GAP', sourceRefs: ['x'] },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]?.reason).toMatch(/GAP/);
  });
});
