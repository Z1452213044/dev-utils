import { describe, it, expect } from 'vitest';
import { computeDiff, computeCollapseRuns } from './diffEngine';

const OPTS = { ignoreWhitespace: false, ignoreCase: false, trimLines: false };

describe('computeDiff', () => {
  it('identical texts produce no chunks', () => {
    const r = computeDiff('a\nb\nc', 'a\nb\nc', OPTS);
    expect(r.chunks).toHaveLength(0);
    expect(r.stats).toEqual({ added: 0, removed: 0, modified: 0, total: 0 });
    expect(r.leftLines).toBe(3);
  });

  it('detects pure additions', () => {
    const r = computeDiff('a\nc', 'a\nb\nc', OPTS);
    expect(r.stats.added).toBe(1);
    expect(r.chunks[0].kind).toBe('added');
    expect(r.chunks[0].leftStart).toBeGreaterThan(0); // anchor line
  });

  it('detects pure deletions', () => {
    const r = computeDiff('a\nb\nc', 'a\nc', OPTS);
    expect(r.stats.removed).toBe(1);
    expect(r.chunks[0].kind).toBe('removed');
  });

  it('pairs modified lines with inline spans', () => {
    const r = computeDiff('"userId": "123456"', '"userId": "123457"', OPTS);
    expect(r.stats.modified).toBe(1);
    const pair = r.pairs[0];
    expect(pair.kind).toBe('modified');
    // char-level: only the final digit differs
    expect(pair.left!.spans[0].from).toBeGreaterThan(10);
    expect(pair.left!.spans[0].to - pair.left!.spans[0].from).toBe(1);
    expect(pair.right!.spans[0].to - pair.right!.spans[0].from).toBe(1);
  });

  it('handles added + removed with different counts', () => {
    const r = computeDiff('x\ny\nz', 'x\np\nq\nr\nz', OPTS);
    expect(r.stats.modified).toBe(1);
    expect(r.stats.added).toBe(2);
  });

  it('ignoreWhitespace option', () => {
    const strict = computeDiff('a  b', 'a b', OPTS);
    expect(strict.chunks.length).toBeGreaterThan(0);
    const loose = computeDiff('a  b', 'a b', { ...OPTS, ignoreWhitespace: true });
    expect(loose.chunks).toHaveLength(0);
  });

  it('ignoreCase option', () => {
    const strict = computeDiff('Hello', 'hello', OPTS);
    expect(strict.chunks.length).toBeGreaterThan(0);
    const loose = computeDiff('Hello', 'hello', { ...OPTS, ignoreCase: true });
    expect(loose.chunks).toHaveLength(0);
  });

  it('trimLines option', () => {
    const loose = computeDiff('  foo  ', 'foo', { ...OPTS, trimLines: true });
    expect(loose.chunks).toHaveLength(0);
  });

  it('empty vs text is all added', () => {
    const r = computeDiff('', 'a\nb', OPTS);
    expect(r.stats.added).toBe(2);
    expect(r.leftLines).toBe(0);
  });

  it('inline rows include removed before added for modified pairs', () => {
    const r = computeDiff('old', 'new', OPTS);
    expect(r.inline.map((row) => row.kind)).toEqual(['removed', 'added']);
    expect(r.inline[0].chunk).toBe(0);
  });

  it('large text completes quickly and stays correct', () => {
    const a = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n');
    const b = a.replace('line 4999', 'line CHANGED');
    const t0 = performance.now();
    const r = computeDiff(a, b, OPTS);
    const ms = performance.now() - t0;
    expect(r.stats.modified + r.stats.added + r.stats.removed).toBeGreaterThan(0);
    expect(ms).toBeLessThan(3000);
  });

  it('collapse runs keep context and stay symmetric', () => {
    const a = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
    const b = a.replace('line 15', 'line CHANGED');
    const r = computeDiff(a, b, OPTS);
    const runs = computeCollapseRuns(r.pairs, { context: 2, minRun: 6 });
    expect(runs.length).toBeGreaterThan(0);
    for (const run of runs) {
      expect(run.leftTo - run.leftFrom).toBe(run.rightTo - run.rightFrom);
      expect(run.count).toBe(run.leftTo - run.leftFrom + 1);
    }
  });
});
