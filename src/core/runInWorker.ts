import type { ExtraMinutes, SimulationResult } from './model';
import type { WorkerRequest, WorkerResponse } from './worker';

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

/** Run the Monte Carlo model in a Web Worker. */
export function runModelInWorker(
  extra: ExtraMinutes | null,
  opts?: { seed?: number; nDraws?: number; signal?: AbortSignal },
): Promise<SimulationResult> {
  const requestId = nextId++;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.requestId !== requestId) return;
      cleanup();
      if (ev.data.type === 'error') reject(new Error(ev.data.message));
      else resolve(ev.data.result);
    };
    const onError = (err: ErrorEvent) => {
      cleanup();
      reject(err.error instanceof Error ? err.error : new Error(err.message));
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
      ...(opts?.seed !== undefined ? { seed: opts.seed } : {}),
      ...(opts?.nDraws !== undefined ? { nDraws: opts.nDraws } : {}),
    };
    w.postMessage(msg);
  });
}
