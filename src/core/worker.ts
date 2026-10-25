/// <reference lib="webworker" />
/**
 * Monte Carlo Web Worker — runs model.R port off the UI thread.
 */
import { activities, baseline, bodyParts, modelConfig, shareRows } from '../data/load';
import {
  prepareModelInput,
  runModel,
  type ExtraMinutes,
  type SimulationResult,
} from './model';

export type WorkerRequest = {
  type: 'run';
  requestId: number;
  extra: ExtraMinutes | null;
  seed?: number;
  nDraws?: number;
};

export type WorkerResponse =
  | { type: 'result'; requestId: number; result: SimulationResult }
  | { type: 'error'; requestId: number; message: string };

const input = prepareModelInput(bodyParts, shareRows, activities, baseline, modelConfig);

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    const seed = msg.seed ?? modelConfig.seedDefault.value;
    const prepared =
      msg.nDraws !== undefined && msg.nDraws !== input.nDraws
        ? { ...input, nDraws: msg.nDraws }
        : input;
    const result = runModel(prepared, msg.extra, seed);
    const response: WorkerResponse = { type: 'result', requestId: msg.requestId, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      type: 'error',
      requestId: msg.requestId,
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
