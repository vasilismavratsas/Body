#!/usr/bin/env node
/**
 * Convert reference/data/*.csv → src/data/*.json for Body alpha v0.7.
 * Share rule (spec §11): idx' = idx × assumedIndexScale when ASSUMPTION, else idx;
 * sbar = mass·idx' / Σ mass·idx'. Stored share column is a sum check only.
 * MET sigmaLog (spec §12): range → ln(hi/lo)/(2×1.598) ("range89"); else CV 0.20.
 */
import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = join(root, 'reference', 'data');
const out = join(root, 'src', 'data');

const PARTS = [
  'arms',
  'shoulders',
  'chest',
  'upper_back',
  'core',
  'lower_back',
  'hips_glutes',
  'legs',
];

const PART_LABELS = {
  arms: 'Arms',
  shoulders: 'Shoulders',
  chest: 'Chest',
  upper_back: 'Upper back',
  core: 'Core',
  lower_back: 'Lower back',
  hips_glutes: 'Hips & glutes',
  legs: 'Legs',
};

/** kappa per cell by status — spec §10 kappa subsection / model.R A1 */
const KAPPA = { cited: 50, 'stand-in': 20, ASSUMPTION: 5 };
/** assumed index ×2 onto %MVIC — spec §11 / model.R A11 */
const ASSUMED_INDEX_SCALE = 2;
const MET_CV = 0.2;
const MET_SDLOG = Math.sqrt(Math.log(1 + MET_CV ** 2));
/** z for 89% interval half-width — model.R A11 range_as_interval */
const Z89 = 1.598;
const LOW_N = 10; // spec §12
const ALLOWED_GROUPS = new Set(['Cardio', 'Sports', 'Strength', 'Outdoor', 'Daily life']);
const INTENSITIES = ['light', 'moderate', 'vigorous'];

const COMPENDIUM =
  'Herrmann SD et al., 2024, 2024 Adult Compendium of Physical Activities, https://doi.org/10.1016/j.jshs.2023.10.010';
const IPUMS =
  'Sarah M. Flood, Liana C. Sayer, and Daniel Backman. IPUMS ATUS 2024 extract (DOI 10.18128/D060.V3.3). Derived aggregates only; raw microdata not redistributed.';

function readCsv(name) {
  const text = readFileSync(join(ref, name), 'utf8');
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  });
}

function statusClass(s) {
  if (/^cited/i.test(s)) return 'cited';
  if (/^stand-in/i.test(s)) return 'stand-in';
  return 'ASSUMPTION';
}

function valued(value, status, sourceRefs) {
  return { value, status, sourceRefs: [...sourceRefs] };
}

function writeJson(name, data) {
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote src/data/${name}`);
}

function titleCase(s) {
  return s
    .split(/[\s_/]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function displayNameFromSearch(searchTerms, fallbackId) {
  const first = (searchTerms || '').split(';')[0]?.trim();
  return first ? titleCase(first) : titleCase(fallbackId);
}

function fail(msg) {
  throw new Error(msg);
}

/**
 * Validate long share table (spec §14 / model.R validate_shares).
 * Errors name file and id.
 */
function validateShares(rows, idCol, file) {
  const byId = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const id = r[idCol];
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push({ ...r, __row: i + 2 });
  }
  for (const [id, cells] of byId) {
    const parts = cells.map((c) => c.part);
    if (
      new Set(parts).size !== 8 ||
      cells.length !== 8 ||
      !PARTS.every((p) => parts.includes(p))
    ) {
      fail(
        `${file}: '${id}' must have exactly the 8 parts once each; has: ${parts.join(',')} (row ${String(cells[0].__row)})`,
      );
    }
    for (const c of cells) {
      if (!/^(cited|stand-in|ASSUMPTION)/.test(c.status)) {
        fail(
          `${file}: '${id}' has invalid status '${c.status}' (allowed: cited / stand-in / ASSUMPTION) (row ${String(c.__row)})`,
        );
      }
    }
    const ix = cells.map((c) => Number(c.index_pctMVC));
    const ms = cells.map((c) => Number(c.mass_fraction));
    if (
      ix.some((x) => !Number.isFinite(x) || x < 0) ||
      ix.reduce((a, b) => a + b, 0) === 0
    ) {
      fail(`${file}: '${id}' index_pctMVC must be numbers >= 0, not all 0`);
    }
    if (ms.some((x) => !Number.isFinite(x) || x <= 0)) {
      fail(`${file}: '${id}' mass_fraction must be > 0`);
    }
    if (cells[0].share !== undefined && cells[0].share !== '') {
      const sum = cells.reduce((a, c) => a + Number(c.share), 0);
      if (Math.abs(sum - 1) > 0.002) {
        fail(`${file}: '${id}' stored shares sum to ${sum.toFixed(4)}, not 1`);
      }
    }
  }
  return byId;
}

/** Recompute sbar from index × mass with ASSUMPTION ×2 (spec §11). */
function makeShareRow(id, cells, sourceTag) {
  const byPart = Object.fromEntries(cells.map((c) => [c.part, c]));
  const sbar = {};
  const kappa = {};
  const cellStatus = {};
  const index = {};
  const mass = {};
  const sourceRefs = new Set();
  let weightSum = 0;
  const weights = {};
  for (const part of PARTS) {
    const cell = byPart[part];
    const st = statusClass(cell.status);
    let ix = Number(cell.index_pctMVC);
    if (st === 'ASSUMPTION') ix *= ASSUMED_INDEX_SCALE; // spec §11
    const m = Number(cell.mass_fraction);
    weights[part] = m * ix;
    weightSum += weights[part];
    index[part] = valued(Number(cell.index_pctMVC), st, [
      cell.source || `${id} ${part} index`,
      cell.method || 'share_1',
    ]);
    mass[part] = valued(m, st, [cell.source || `${sourceTag} mass_fraction`]);
    cellStatus[part] = st;
    kappa[part] = valued(KAPPA[st], 'ASSUMPTION', [
      'spec.md §10 kappa: cited=50 / stand-in=20 / ASSUMPTION=5',
    ]);
    if (cell.source) sourceRefs.add(cell.source);
  }
  for (const part of PARTS) {
    const st = cellStatus[part];
    sbar[part] = valued(weights[part] / weightSum, st, [
      `spec §11 share rule (${sourceTag})`,
      ...(index[part].sourceRefs || []),
    ]);
  }
  return {
    id,
    sbar,
    kappa,
    cellStatus,
    index,
    mass,
    sourceRefs: [...sourceRefs],
  };
}

// --- bodyParts ---
const massRows = readCsv('muscle_mass_8part_v1.csv').filter((r) => r.sex === 'average');
const bodyParts = PARTS.map((id) => {
  const row = massRows.find((r) => r.part === id);
  if (!row) fail(`missing mass for ${id}`);
  return {
    id,
    label: PART_LABELS[id],
    muscleMassFraction: valued(Number(row.fraction), statusClass(row.status), [
      'muscle_mass_8part_v1.csv average row',
      'Janssen 2000; NHANES DXA; ASSUMED sub-splits (method_log mass_1–mass_7)',
    ]),
  };
});
writeJson('bodyParts.json', bodyParts);

// --- shareRows: activation + postural + lifts (lift: prefix) ---
const actRows = readCsv('activation_shares_v2.1.csv');
const postRows = readCsv('postural_shares_v1.1.csv');
const liftShareRows = readCsv('lift_shares.csv');
validateShares(actRows, 'activity_id', 'activation_shares_v2.1.csv');
validateShares(postRows, 'activity_id', 'postural_shares_v1.1.csv');
validateShares(liftShareRows, 'exercise_id', 'lift_shares.csv');

const shareRows = {};
for (const [id, cells] of validateShares(
  [...actRows, ...postRows],
  'activity_id',
  'activation+postural',
)) {
  shareRows[id] = makeShareRow(id, cells, 'activation/postural');
}
for (const [id, cells] of validateShares(
  liftShareRows,
  'exercise_id',
  'lift_shares.csv',
)) {
  shareRows[`lift:${id}`] = makeShareRow(`lift:${id}`, cells, 'lift_shares.csv');
}
writeJson('shareRows.json', shareRows);

// --- METs ---
const mets = readCsv('mets.csv');
const metById = Object.fromEntries(mets.map((r) => [r.activity_id, r]));
const m25 = readCsv('activities25_mets.csv');
const m25ById = Object.fromEntries(m25.map((r) => [r.activity_id, r]));
const sel = readCsv('activities25_selection.csv');
const selById = Object.fromEntries(sel.map((r) => [r.activity_id, r]));
const catalog = readCsv('activity_catalog.csv');
const liftMets = readCsv('lift_mets.csv');

const GROUPS = ['Cardio', 'Sports', 'Strength', 'Outdoor', 'Daily life'];

function catalogMet(metId, metFile, activityId) {
  if (metFile === 'mets.csv') {
    const m = metById[metId];
    if (!m || m.MET === 'GAP' || !Number.isFinite(Number(m.MET)) || Number(m.MET) <= 0) {
      fail(`mets.csv: activity '${metId}' needs MET > 0 (GAP not allowed)`);
    }
    return {
      code: m.compendium_code,
      median: Number(m.MET),
      sigmaLog: Number(MET_SDLOG.toFixed(6)),
      sigmaSource: 'cv0.20',
      description: m.description || '',
    };
  }
  if (metFile === 'activities25_mets.csv') {
    const r = m25ById[metId] || m25ById[activityId];
    if (!r) fail(`activities25_mets.csv: no row for '${metId}'`);
    const median = Number(r.default_MET);
    if (!Number.isFinite(median) || median <= 0) {
      fail(`activities25_mets.csv: activity '${activityId}' needs MET > 0`);
    }
    const nums = String(r.MET_range_across_codes || '').match(/[0-9.]+/g);
    let sigmaLog = Number(MET_SDLOG.toFixed(6));
    let sigmaSource = 'cv0.20';
    if (nums && nums.length >= 2) {
      const lo = Number(nums[0]);
      const hi = Number(nums[1]);
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
        // spec §12: sdlog = ln(hi/lo) / (2 × 1.598)
        sigmaLog = Math.log(hi / lo) / (2 * Z89);
        sigmaSource = 'range89';
      }
    }
    return {
      code: r.default_code,
      median,
      sigmaLog: Number(sigmaLog.toFixed(6)),
      sigmaSource,
      description: r.source || '',
    };
  }
  fail(`activity_catalog.csv: unknown met_file '${metFile}' for '${activityId}'`);
}

// Validate catalog
const catalogIds = new Set();
for (const row of catalog) {
  if (catalogIds.has(row.activity_id))
    fail(`activity_catalog.csv: duplicate activity_id ${row.activity_id}`);
  catalogIds.add(row.activity_id);
  if (!ALLOWED_GROUPS.has(row.group)) {
    fail(
      `activity_catalog.csv: '${row.activity_id}' group '${row.group}' not in allowed set`,
    );
  }
  if (!shareRows[row.share_row]) {
    fail(`activity_catalog.csv: share_row '${row.share_row}' not in share files`);
  }
}
if (catalogIds.size !== 25)
  fail(`activity_catalog.csv: expected 25 unique activity_ids, got ${catalogIds.size}`);

// Validate lift_mets
const liftIds = [...new Set(liftMets.map((r) => r.exercise_id))];
for (const eid of liftIds) {
  if (!shareRows[`lift:${eid}`]) {
    fail(`lift_mets.csv: exercise '${eid}' without shares in lift_shares.csv`);
  }
  const rows = liftMets.filter((r) => r.exercise_id === eid);
  const defaults = rows.filter((r) => String(r.is_default).toUpperCase() === 'TRUE');
  if (defaults.length !== 1) {
    fail(
      `lift_mets.csv: '${eid}' must have exactly one is_default TRUE (got ${defaults.length})`,
    );
  }
  for (const r of rows) {
    if (!INTENSITIES.includes(r.intensity)) {
      fail(`lift_mets.csv: intensity '${r.intensity}' not in light/moderate/vigorous`);
    }
    const met = Number(r.MET);
    if (!Number.isFinite(met) || met <= 0) {
      fail(`lift_mets.csv: '${eid}' ${r.intensity} needs MET > 0`);
    }
  }
}

const activities = catalog.map((row) => {
  const metId = row.met_id || row.activity_id;
  const met = catalogMet(metId, row.met_file, row.activity_id);
  const searchTerms = (row.search_terms || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const isLiftParent = row.share_row === 'weightlifting';
  // Input contract uses activity "weightlifting" for the lift parent (spec §13–§14).
  const id = isLiftParent ? 'weightlifting' : row.activity_id;
  const lowNRow = selById[row.activity_id];
  const lowN = lowNRow ? Number(lowNRow.unweighted_n) < LOW_N : false;
  const entry = {
    id,
    name: displayNameFromSearch(row.search_terms, id),
    kind: isLiftParent ? 'liftParent' : 'activity',
    group: row.group,
    searchTerms,
    compendiumCode: valued(met.code, 'cited', [COMPENDIUM, met.description]),
    met: {
      median: valued(met.median, 'cited', [COMPENDIUM, `code ${met.code}`]),
      sigmaLog: valued(met.sigmaLog, 'ASSUMPTION', [
        met.sigmaSource === 'range89'
          ? 'spec §12: sdlog = ln(hi/lo)/(2×1.598) from MET_range_across_codes (ASSUMPTION)'
          : 'spec §12 / model.R A4: CV 0.20 → sdlog = sqrt(log(1+CV²))',
      ]),
      sigmaSource: met.sigmaSource,
      cv:
        met.sigmaSource === 'cv0.20'
          ? valued(MET_CV, 'ASSUMPTION', ['spec §12 / model.R A4'])
          : undefined,
    },
    shareRow: row.share_row,
    // keep shareRowId alias for engine prep
    shareRowId: row.share_row,
    catalogActivityId: row.activity_id,
    metId,
    lowN,
    activityToSharePairing: valued(row.share_row, statusClass(row.mapping_status), [
      'activity_catalog.csv',
      'spec §12 data-driven catalog (ASSUMPTION pairings)',
    ]),
    sourceRefs: [COMPENDIUM, 'activity_catalog.csv', 'spec.md §12'],
  };

  if (isLiftParent) {
    entry.children = liftIds.map((exerciseId) => {
      const share = shareRows[`lift:${exerciseId}`];
      const metRows = liftMets.filter((r) => r.exercise_id === exerciseId);
      const defaultRow = metRows.find(
        (r) => String(r.is_default).toUpperCase() === 'TRUE',
      );
      const metByIntensity = {};
      for (const intens of INTENSITIES) {
        const mr = metRows.find((r) => r.intensity === intens);
        metByIntensity[intens] = {
          code: valued(mr.compendium_code, statusClass(mr.status), [
            COMPENDIUM,
            mr.source || 'lift_mets.csv',
          ]),
          MET: valued(Number(mr.MET), statusClass(mr.status), [
            COMPENDIUM,
            mr.source || 'lift_mets.csv',
          ]),
        };
      }
      const index = {};
      const mass = {};
      for (const part of PARTS) {
        index[part] = share.index[part];
        mass[part] = share.mass[part];
      }
      return {
        exerciseId,
        name: titleCase(exerciseId),
        shares: { index, mass },
        shareRowId: `lift:${exerciseId}`,
        metByIntensity,
        defaultIntensity: defaultRow.intensity,
        sourceRefs: share.sourceRefs,
      };
    });
  }

  return entry;
});

// Drop undefined cv keys for prettier JSON
for (const a of activities) {
  if (a.met.cv === undefined) delete a.met.cv;
}
writeJson('activities.json', activities);

// --- Baseline ---
const bmap = readCsv('baseline_row_map.csv');
const bmapById = Object.fromEntries(bmap.map((r) => [r.activity_id, r]));
const base = readCsv('nonexerciser_baseline_v2.csv');
const atus = readCsv('atus_nonexercisers_v2.csv');
const atusById = Object.fromEntries(atus.map((r) => [r.activity_id, r]));
const mapping = readCsv('atus_to_compendium.csv');
const mapById = Object.fromEntries(mapping.map((r) => [r.atus_activity_id, r]));

const groups = base
  .filter((r) => !/^(TOTAL|per_person)/.test(r.activity_id))
  .map((r) => {
    const a = atusById[r.activity_id];
    if (!a) fail(`missing atus row ${r.activity_id}`);
    const map = mapById[r.activity_id];
    const bm = bmapById[r.activity_id];
    if (!bm)
      fail(`baseline_row_map.csv: no share row for baseline group(s) ${r.activity_id}`);
    const shareRowId = bm.share_row;
    if (!shareRows[shareRowId]) {
      fail(
        `baseline_row_map.csv: share_row '${shareRowId}' missing for ${r.activity_id}`,
      );
    }
    return {
      activityId: r.activity_id,
      atusCode: valued(r.activity_id, 'cited', [IPUMS]),
      compendiumCode: valued(r.compendium_code, 'cited', [
        COMPENDIUM,
        map?.rationale || 'atus_to_compendium.csv',
      ]),
      met: valued(Number(r.MET), 'cited', [COMPENDIUM, `code ${r.compendium_code}`]),
      minutes: {
        mean: valued(Number(r.mean_min_per_day), 'cited', [
          IPUMS,
          'atus_nonexercisers_v2.csv',
        ]),
        sd: valued(Number(a.sd_min), 'cited', [IPUMS, 'atus_nonexercisers_v2.csv']),
        median: valued(Number(a.median), 'cited', [IPUMS]),
        p10: valued(Number(a.p10), 'cited', [IPUMS]),
        p90: valued(Number(a.p90), 'cited', [IPUMS]),
      },
      participationRate: valued(Number(a.participation_rate_pct) / 100, 'cited', [
        IPUMS,
        'atus_nonexercisers_v2.csv participation_rate_pct / 100',
      ]),
      n: valued(Number(a.n), 'cited', [IPUMS]),
      shareRowId: valued(shareRowId, statusClass(bm.mapping_status), [
        'baseline_row_map.csv',
        'spec §12 / model.R A2',
      ]),
      mappingRationale: bm.note || map?.rationale || '',
      status: 'cited',
      sourceRefs: [IPUMS, 'nonexerciser_baseline_v2.csv', 'atus_nonexercisers_v2.csv'],
    };
  });

const baseline = {
  population: valued(
    'IPUMS ATUS 2024, adults 18+, WT06, 0 min ATUS 1301 (sports/exercise participation)',
    'cited',
    [IPUMS],
  ),
  designEffect: valued(1.5, 'ASSUMPTION', [
    'model.R A5b: deff for WT06 weights (no replicate weights)',
  ]),
  perPersonGross: {
    sd: valued(4.4, 'cited', [IPUMS, 'nonexerciser_baseline_v2.csv per_person_gross_sd']),
    p10: valued(28.22, 'cited', [IPUMS]),
    p50: valued(32.6, 'cited', [IPUMS]),
    p90: valued(38.8, 'cited', [IPUMS]),
  },
  totalNetMetH: valued(9.2, 'cited', [IPUMS, 'TOTAL_net']),
  totalGrossMetH: valued(33.2, 'cited', [IPUMS, 'TOTAL_gross']),
  groups,
};
writeJson('baseline.json', baseline);

// --- modelConfig ---
const modelConfig = {
  version: '0.7',
  energyMode: valued('net', 'cited', ['spec.md §1', 'model.R']),
  nDraws: valued(4000, 'ASSUMPTION', ['model.R A9', 'data-model v0.7']),
  intervalProb: valued(0.89, 'ASSUMPTION', ['spec.md §4', 'data-model']),
  offset: {
    phi: valued(0.25, 'ASSUMPTION', ['model.R A6', 'spec §16 P1']),
  },
  metCv: valued(MET_CV, 'ASSUMPTION', ['model.R A4', 'spec §12']),
  metSigmaLog: valued(Number(MET_SDLOG.toFixed(6)), 'ASSUMPTION', ['model.R A4']),
  designEffect: valued(1.5, 'ASSUMPTION', ['model.R A5b']),
  shareRule: {
    assumedIndexScale: valued(ASSUMED_INDEX_SCALE, 'ASSUMPTION', [
      'spec §11 / model.R A11: assumed indices ×2 onto %MVIC',
    ]),
  },
  colorScale: {
    bandEdges: valued([1.15, 1.4, 1.8], 'ASSUMPTION', ['spec.md §5', 'model.R A7']),
    bandNames: valued(['green', 'yellow-green', 'orange', 'red'], 'ASSUMPTION', [
      'spec.md §5',
    ]),
    mCap: valued(2.5, 'ASSUMPTION', ['spec.md §5', 'model.R A7']),
    rampStops: valued(['#2E7D32', '#FBC02D', '#C62828'], 'ASSUMPTION', [
      'model.R color_of continuous log2 ramp stops',
    ]),
  },
  highUncertaintyLog2Width: valued(2, 'ASSUMPTION', ['model.R A8', 'spec.md §5']),
  massSex: valued('average', 'ASSUMPTION', ['model.R A10']),
  seedDefault: valued(2026, 'ASSUMPTION', ['model.R set.seed(2026)']),
  lowNThreshold: valued(LOW_N, 'ASSUMPTION', ['spec §12 / model.R A11']),
  swapFrom: valued('tv', 'ASSUMPTION', ['model.R A11 swap_from']),
};
writeJson('modelConfig.json', modelConfig);

console.log(
  `done: ${activities.length} activities, ${liftIds.length} lifts, ${Object.keys(shareRows).length} share rows`,
);
