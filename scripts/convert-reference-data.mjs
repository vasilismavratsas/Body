#!/usr/bin/env node
/**
 * Convert reference/*.csv → src/data/*.json for Body alpha v0.6.1.
 * Only ships values the engine needs. MET SD GAP → ASSUMPTION sigmaLog (CV 0.20).
 * Unused GAP rows (e.g. swim) are omitted so the release guard stays green.
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

const KAPPA = { cited: 50, 'stand-in': 20, ASSUMPTION: 5 };
const MET_CV = 0.2;
const MET_SDLOG = Math.sqrt(Math.log(1 + MET_CV ** 2));
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

// --- bodyParts ---
const massRows = readCsv('muscle_mass_8part_v1.csv').filter((r) => r.sex === 'average');
const bodyParts = PARTS.map((id) => {
  const row = massRows.find((r) => r.part === id);
  if (!row) throw new Error(`missing mass for ${id}`);
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

// --- shareRows (activation + postural) ---
const shareLong = [
  ...readCsv('activation_shares_v1.1.csv'),
  ...readCsv('postural_shares_v1.1.csv'),
];
const shareRowIds = [...new Set(shareLong.map((r) => r.activity_id))];
const shareRows = {};
for (const id of shareRowIds) {
  const cells = shareLong.filter((r) => r.activity_id === id);
  const sbar = {};
  const kappa = {};
  const cellStatus = {};
  const sourceRefs = new Set();
  for (const part of PARTS) {
    const cell = cells.find((c) => c.part === part);
    if (!cell) throw new Error(`missing share ${id}/${part}`);
    const st = statusClass(cell.status);
    sbar[part] = valued(Number(cell.share), st, [
      cell.source || `${id} ${part} share`,
      cell.method || 'share_1',
    ]);
    kappa[part] = valued(KAPPA[st], 'ASSUMPTION', [
      'model.R A1: kappa cited=50 / stand-in=20 / ASSUMPTION=5',
    ]);
    cellStatus[part] = st;
    if (cell.source) sourceRefs.add(cell.source);
  }
  // renormalize sbar values for 4-decimal rounding (model.R)
  const sum = PARTS.reduce((a, p) => a + sbar[p].value, 0);
  for (const p of PARTS) {
    sbar[p] = valued(sbar[p].value / sum, sbar[p].status, sbar[p].sourceRefs);
  }
  shareRows[id] = {
    id,
    sbar,
    kappa,
    cellStatus,
    sourceRefs: [...sourceRefs],
  };
}
// yard work uses gardening shares (copy); keep gardening row as-is
writeJson('shareRows.json', shareRows);

// --- User activities (top 10) ---
const mets = readCsv('mets.csv');
const metById = Object.fromEntries(mets.map((r) => [r.activity_id, r]));

const USER_ACTIVITIES = [
  {
    id: 'walk_brisk',
    name: 'Walking',
    shareRowId: 'walking',
    metId: 'walk_brisk',
    top10Rank: 1,
  },
  {
    id: 'jog',
    name: 'Running / jogging',
    shareRowId: 'running',
    metId: 'jog',
    top10Rank: 2,
  },
  {
    id: 'resist_multi',
    name: 'Weightlifting',
    shareRowId: 'weightlifting',
    metId: 'resist_multi',
    top10Rank: 3,
  },
  {
    id: 'garden',
    name: 'Gardening',
    shareRowId: 'gardening',
    metId: 'garden',
    top10Rank: 4,
  },
  {
    id: 'bike_leisure',
    name: 'Bicycling',
    shareRowId: 'bicycling',
    metId: 'bike_leisure',
    top10Rank: 5,
  },
  {
    id: 'yard',
    name: 'Yard work',
    shareRowId: 'gardening',
    metId: 'yard',
    top10Rank: 6,
  },
  {
    id: 'chore_clean_light',
    name: 'Household activities',
    shareRowId: 'household',
    metId: 'chore_clean_light',
    top10Rank: 7,
  },
  {
    id: 'calisthenics_mod',
    name: 'Calisthenics',
    shareRowId: 'calisthenics',
    metId: 'calisthenics_mod',
    top10Rank: 8,
  },
  {
    id: 'yoga_hatha',
    name: 'Yoga',
    shareRowId: 'yoga',
    metId: 'yoga_hatha',
    top10Rank: 9,
  },
  {
    id: 'indoor_bike_general',
    name: 'Indoor biking',
    shareRowId: 'indoor_biking',
    metId: 'indoor_bike_general',
    top10Rank: 10,
  },
];

const top10 = readCsv('top10.csv').filter((r) => r.rank && /^\d+$/.test(r.rank));

const activities = USER_ACTIVITIES.map((a) => {
  const m = metById[a.metId];
  if (!m || m.MET === 'GAP' || !Number.isFinite(Number(m.MET))) {
    throw new Error(`missing usable MET for ${a.metId}`);
  }
  const top = top10.find((t) => Number(t.rank) === a.top10Rank);
  return {
    id: a.id,
    name: a.name,
    top10Rank: a.top10Rank,
    compendiumCode: valued(m.compendium_code, 'cited', [COMPENDIUM, m.description]),
    met: {
      median: valued(Number(m.MET), 'cited', [COMPENDIUM, `code ${m.compendium_code}`]),
      sigmaLog: valued(Number(MET_SDLOG.toFixed(6)), 'ASSUMPTION', [
        'model.R A4: Compendium SD is GAP; CV 0.20 → sdlog = sqrt(log(1+CV²))',
      ]),
      cv: valued(MET_CV, 'ASSUMPTION', ['model.R A4']),
    },
    shareRowId: a.shareRowId,
    activityToSharePairing: valued(a.shareRowId, 'ASSUMPTION', [
      'model.R A3 activity→share pairing (ASSUMPTION)',
    ]),
    prevalencePct: top
      ? valued(parseFloat(top.pct_US_adults), 'cited', [
          top.source_url,
          'BRFSS 2019 top-2 activities (top10.csv)',
        ])
      : undefined,
    sourceRefs: [COMPENDIUM, 'top10.csv', 'model.R A3'],
  };
});
writeJson('activities.json', activities);

// --- Baseline ---
const BASE_ROW = {
  sleep: 'lying',
  tv: 'sitting',
  eating: 'sitting',
  work: 'sitting',
  education: 'sitting',
  hh_management: 'sitting',
  org_civic_religious: 'sitting',
  socializing: 'sitting',
  phone_mail: 'sitting',
  other_leisure_residual: 'sitting',
  other_nec: 'sitting',
  sports_exercise: 'sitting',
  personal_care_nonsleep: 'standing',
  housework: 'household',
  food_prep: 'household',
  hh_other_residual: 'household',
  care_household: 'household',
  care_nonhousehold: 'household',
  lawn_garden: 'gardening',
  purchasing: 'walking',
};

const base = readCsv('nonexerciser_baseline_v2.csv');
const atus = readCsv('atus_nonexercisers_v2.csv');
const atusById = Object.fromEntries(atus.map((r) => [r.activity_id, r]));
const mapping = readCsv('atus_to_compendium.csv');
const mapById = Object.fromEntries(mapping.map((r) => [r.atus_activity_id, r]));

const groups = base
  .filter((r) => !/^(TOTAL|per_person)/.test(r.activity_id))
  .map((r) => {
    const a = atusById[r.activity_id];
    if (!a) throw new Error(`missing atus row ${r.activity_id}`);
    const map = mapById[r.activity_id];
    const shareRowId = BASE_ROW[r.activity_id];
    if (!shareRowId) throw new Error(`no base_row for ${r.activity_id}`);
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
      shareRowId: valued(shareRowId, 'ASSUMPTION', [
        'model.R A2 ATUS category → share row mapping',
      ]),
      mappingRationale: map?.rationale || '',
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
  version: '0.6.1',
  energyMode: valued('net', 'cited', ['spec.md §1', 'model.R']),
  nDraws: valued(4000, 'ASSUMPTION', ['model.R A9', 'data-model v0.6.1']),
  intervalProb: valued(0.89, 'ASSUMPTION', ['spec.md §4', 'data-model']),
  offset: {
    phi: valued(0.25, 'ASSUMPTION', ['model.R A6']),
  },
  metCv: valued(MET_CV, 'ASSUMPTION', ['model.R A4']),
  metSigmaLog: valued(Number(MET_SDLOG.toFixed(6)), 'ASSUMPTION', ['model.R A4']),
  designEffect: valued(1.5, 'ASSUMPTION', ['model.R A5b']),
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
};
writeJson('modelConfig.json', modelConfig);

console.log('done');
