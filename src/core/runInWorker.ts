import {
  prepareModelInput,
  runModel,
  type ExtraMinutes,
  type SimulationResult,
} from './model';
import type { WorkerRequest, WorkerResponse } from './worker';
import { activities, baseline, bodyParts, modelConfig, shareRows } from '../data/load';

let worker: Worker | null = null;
let nextId = 1;
let workerFailed = false;

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (typeof Worker === 'undefined') {
    workerFailed = true;
    return null;
  }
  if (!worker) {
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch {
      workerFailed = true;
      return null;
    }
  }
  return worker;
}

function runOnMain(
  extra: ExtraMinutes | null,
  seed: number,
  nDraws?: number,
): SimulationResult {
  const input = prepareModelInput(
    bodyParts,
    shareRows,
    activities,
    baseline,
    modelConfig,
  );
  const prepared = nDraws !== undefined ? { ...input, nDraws } : input;
  return runModel(prepared, extra, seed);
}

/** Run the Monte Carlo model in a Web Worker (falls back to main thread). */
export function runModelInWorker(
  extra: ExtraMinutes | null,
  opts?: { seed?: number; nDraws?: number; signal?: AbortSignal },
): Promise<SimulationResult> {
  const seed = opts?.seed ?? modelConfig.seedDefault.value;
  const w = getWorker();
  if (!w) {
    return Promise.resolve(runOnMain(extra, seed, opts?.nDraws));
  }

  const requestId = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.requestId !== requestId) return;
      cleanup();
      if (ev.data.type === 'error') reject(new Error(ev.data.message));
      else resolve(ev.data.result);
    };
    const onError = (err: ErrorEvent) => {
      cleanup();
      workerFailed = true;
      worker = null;
      try {
        resolve(runOnMain(extra, seed, opts?.nDraws));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(err.message));
      }
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const cleanup = () => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      opts?.signal?.removeEventListener('abort', onAbort);
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    opts?.signal?.addEventListener('abort', onAbort);
    if (opts?.signal?.aborted) {
      onAbort();
      return;
    }
    const msg: WorkerRequest = {
      type: 'run',
      requestId,
      extra,
      seed,
      ...(opts?.nDraws !== undefined ? { nDraws: opts.nDraws } : {}),
    };
    w.postMessage(msg);
  });
}
