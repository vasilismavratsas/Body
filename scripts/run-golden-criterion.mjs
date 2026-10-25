#!/usr/bin/env node
/**
 * Standalone golden criterion runner (spec §10 v0.7).
 * Invoked outside vitest so long Monte Carlo work cannot trip the
 * vitest-worker RPC heartbeat ("Timeout calling onTaskUpdate") on CI.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

await import('tsx/esm');

const { activities, baseline, bodyParts, modelConfig, shareRows } = await import(
  pathToFileURL(join(root, 'src/data/load.ts')).href
);
const { prepareModelInput } = await import(
  pathToFileURL(join(root, 'src/core/model.ts')).href
);
const { parseDemoOutput } = await import(
  pathToFileURL(join(root, 'src/core/parseDemoOutput.ts')).href
);
const { GOLDEN_SEEDS, runGoldenSeed } = await import(
  pathToFileURL(join(root, 'src/core/goldenCriterion.ts')).href
);

const input = prepareModelInput(bodyParts, shareRows, activities, baseline, modelConfig);
const demo = parseDemoOutput(
  readFileSync(join(root, 'reference/demo_output_v7.txt'), 'utf8'),
);
const scenarios = [...new Set(demo.rows.map((r) => r.scenario))];

if (scenarios.length <= 30) {
  console.error(`expected >30 demo scenarios, got ${String(scenarios.length)}`);
  process.exit(1);
}

let failed = false;
for (const seed of GOLDEN_SEEDS) {
  const t0 = Date.now();
  const { failures, meanExcess } = runGoldenSeed(input, demo.rows, scenarios, seed);
  const ms = Date.now() - t0;
  if (failures.length) {
    failed = true;
    console.error(
      `FAIL seed ${String(seed)} (${String(ms)}ms) meanExcess=${meanExcess.toFixed(4)}: ${failures.slice(0, 8).join('; ')}`,
    );
  } else {
    console.log(
      `PASS seed ${String(seed)} (${String(ms)}ms) meanExcess=${meanExcess.toFixed(4)} cells ok`,
    );
  }
}

if (failed) {
  console.error('golden criterion: FAILED');
  process.exit(1);
}
console.log(`golden criterion: PASS (${String(GOLDEN_SEEDS.length)} seeds)`);
