#!/usr/bin/env node
/**
 * Step 0: fail the build if required v0.7 reference files are missing.
 * Spec: cursor-project-prompt-round2.txt §0 / reference/ layout.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref = join(root, 'reference');

const REQUIRED = [
  'spec.md',
  'data-model.md',
  'model.R',
  'demo_output_v7.txt',
  'tests/golden_criterion_v07.R',
  'methods/methods_v008_2026-10-24.md',
  'data/activity_catalog.csv',
  'data/activities25_mets.csv',
  'data/activities25_selection.csv',
  'data/mets.csv',
  'data/activation_shares_v2.1.csv',
  'data/postural_shares_v1.1.csv',
  'data/lift_shares.csv',
  'data/lift_mets.csv',
  'data/baseline_row_map.csv',
  'data/muscle_mass_8part_v1.csv',
  'data/nonexerciser_baseline_v2.csv',
  'data/atus_nonexercisers_v2.csv',
  'tests/fixtures/lift_shares_SYNTHETIC_bad_status.csv',
  'tests/fixtures/lift_shares_SYNTHETIC_bad_sum.csv',
  'tests/fixtures/lift_shares_SYNTHETIC_missing_part.csv',
];

const missing = REQUIRED.filter((rel) => !existsSync(join(ref, rel)));
if (missing.length) {
  console.error('Missing required v0.7 reference files:');
  for (const m of missing) console.error(`  - reference/${m}`);
  process.exit(1);
}
console.log(`OK: ${String(REQUIRED.length)} v0.7 reference files present`);
