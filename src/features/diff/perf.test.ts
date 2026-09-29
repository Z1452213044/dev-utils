import { describe, it } from 'vitest';
import { computeDiff } from './diffEngine';

describe('perf', () => {
  it('3000-line benchmark', () => {
    const lines = Array.from({ length: 3000 }, (_, i) => 'line ' + i + ' lorem ipsum content');
    const left = lines.join('\n');
    const rightLines = lines.slice();
    for (let i = 0; i < 30; i++) rightLines[100 + i] = 'line ' + (100 + i) + ' CHANGED';
    rightLines.push('tail added line');

    const t0 = performance.now();
    const r = computeDiff(left, rightLines.join('\n'), {
      ignoreWhitespace: false,
      ignoreCase: false,
      trimLines: false,
    });
    const ms = Math.round(performance.now() - t0);
    console.log('BENCH ms:', ms, 'chunks:', r.chunks.length, 'stats:', JSON.stringify(r.stats));
  });
});
