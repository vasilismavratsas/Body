/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-confusing-void-expression */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
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
import { ShareValidationError, validateShares } from './validateShares';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('data schemas (v0.7)', () => {
  it('parses bodyParts with 8 parts and mass fractions', () => {
    const parts = BodyPartsFileSchema.parse(bodyPartsJson);
    expect(parts.map((p) => p.id)).toEqual([...PART_IDS]);
    const massSum = parts.reduce((s, p) => s + p.muscleMassFraction.value, 0);
    expect(massSum).toBeCloseTo(1, 3);
  });

  it('parses 25 catalog activities including yard_work and liftParent', () => {
    const acts = ActivitiesFileSchema.parse(activitiesJson);
    expect(acts).toHaveLength(25);
    const yard = acts.find((a) => a.id === 'yard_work');
    expect(yard?.met.median.value).toBe(4.0);
    expect(yard?.shareRow).toBe('yard_work');
    expect(yard?.group).toBe('Outdoor');
    const lift = acts.find((a) => a.kind === 'liftParent');
    expect(lift?.id).toBe('weightlifting');
    expect(lift?.children).toHaveLength(14);
    expect(lift?.children?.[0]?.metByIntensity.light.MET.value).toBeGreaterThan(0);
    const lowN = acts.filter((a) => a.lowN).map((a) => a.id);
    expect(lowN).toEqual(
      expect.arrayContaining([
        'basketball',
        'soccer',
        'bowling',
        'martial_arts',
        'rock_climbing',
      ]),
    );
  });

  it('parses share rows that sum to ~1 (including lifts)', () => {
    const rows = ShareRowsFileSchema.parse(shareRowsJson);
    for (const id of Object.keys(rows)) {
      const row = rows[id]!;
      const sum = PART_IDS.reduce((s, p) => s + row.sbar[p].value, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
    expect(rows.gardening).toBeDefined();
    expect(rows.yard_work).toBeDefined();
    expect(rows['lift:bench_press']).toBeDefined();
  });

  it('parses baseline groups with designEffect and per-person gross', () => {
    const base = BaselineSchema.parse(baselineJson);
    expect(base.groups.length).toBe(20);
    expect(base.designEffect.value).toBe(1.5);
    expect(base.perPersonGross.sd.value).toBe(4.4);
    expect(base.totalNetMetH.value).toBe(9.2);
  });

  it('parses modelConfig v0.7 with shareRule', () => {
    const cfg = ModelConfigSchema.parse(modelConfigJson);
    expect(cfg.version).toBe('0.7');
    expect(cfg.shareRule.assumedIndexScale.value).toBe(2);
    expect(cfg.offset.phi.value).toBe(0.25);
    expect(cfg.colorScale.mCap.value).toBe(2.5);
  });
});

describe('release guard', () => {
  it('passes on shipped src/data (no GAP or PLACEHOLDER status)', () => {
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

  it('fails when a GAP status is present', () => {
    const result = runReleaseGuard({
      bad: {
        metSd: { value: null, status: 'GAP', sourceRefs: ['x'] },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0]?.reason).toMatch(/GAP/);
  });

  it('does not scan free-text note/source/search_terms for GAP substrings', () => {
    const result = runReleaseGuard({
      ok: {
        note: 'this note mentions GAP as free text',
        searchTerms: ['GAP placeholder words'],
        mappingRationale: 'PLACEHOLDER in prose',
        met: { value: 3.5, status: 'cited', sourceRefs: ['x'] },
      },
    });
    expect(result.ok).toBe(true);
  });
});

describe('SYNTHETIC fixture validation (spec §14; fixtures never ship)', () => {
  function loadFixture(name: string) {
    const text = readFileSync(join(root, 'reference/tests/fixtures', name), 'utf8');
    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
    return rows.map((r) => ({
      id: r.exercise_id ?? '',
      part: r.part ?? '',
      index_pctMVC: r.index_pctMVC ?? '',
      mass_fraction: r.mass_fraction ?? '',
      status: r.status ?? '',
      ...(r.share !== undefined ? { share: r.share } : {}),
    }));
  }

  it('lift_shares_SYNTHETIC_bad_status fails naming file/id', () => {
    expect(() =>
      validateShares(
        loadFixture('lift_shares_SYNTHETIC_bad_status.csv'),
        'lift_shares_SYNTHETIC_bad_status.csv',
      ),
    ).toThrow(ShareValidationError);
    try {
      validateShares(
        loadFixture('lift_shares_SYNTHETIC_bad_status.csv'),
        'lift_shares_SYNTHETIC_bad_status.csv',
      );
    } catch (e) {
      expect(String(e)).toMatch(/lift_shares_SYNTHETIC_bad_status\.csv/);
      expect(String(e)).toMatch(/invalid status/);
    }
  });

  it('lift_shares_SYNTHETIC_bad_sum fails naming file/id', () => {
    try {
      validateShares(
        loadFixture('lift_shares_SYNTHETIC_bad_sum.csv'),
        'lift_shares_SYNTHETIC_bad_sum.csv',
      );
      expect.fail('expected throw');
    } catch (e) {
      expect(String(e)).toMatch(/lift_shares_SYNTHETIC_bad_sum\.csv/);
      expect(String(e)).toMatch(/stored shares sum/);
    }
  });

  it('lift_shares_SYNTHETIC_missing_part fails naming file/id', () => {
    try {
      validateShares(
        loadFixture('lift_shares_SYNTHETIC_missing_part.csv'),
        'lift_shares_SYNTHETIC_missing_part.csv',
      );
      expect.fail('expected throw');
    } catch (e) {
      expect(String(e)).toMatch(/lift_shares_SYNTHETIC_missing_part\.csv/);
      expect(String(e)).toMatch(/exactly the 8 parts/);
    }
  });
});
