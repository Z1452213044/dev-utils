/// <reference lib="webworker" />
import { computeDiff } from './diffEngine';
import type { DiffOptions } from './diffEngine';

export interface DiffRequest {
  id: number;
  original: string;
  modified: string;
  opts: DiffOptions;
}

self.onmessage = (e: MessageEvent<DiffRequest>) => {
  const { id, original, modified, opts } = e.data;
  const result = computeDiff(original, modified, opts);
  (self as unknown as Worker).postMessage({ id, result });
};
