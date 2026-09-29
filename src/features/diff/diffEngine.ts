import { diffArrays, diffChars, diffWords } from 'diff';
import type { Change } from 'diff';

export type RowKind = 'equal' | 'added' | 'removed' | 'modified';

export interface Span {
  from: number;
  to: number;
}

/** One row on one side of a side-by-side diff. */
export interface SideRow {
  kind: RowKind;
  text: string;
  /** 1-based line number within its own document. */
  lineNo: number;
  /** Inline (word/char) change spans, offsets relative to row text. */
  spans: Span[];
  /** Diff chunk id, -1 for unchanged rows. */
  chunk: number;
}

export interface PairRow {
  kind: RowKind;
  chunk: number;
  left: SideRow | null;
  right: SideRow | null;
}

export interface InlineRow {
  kind: 'equal' | 'added' | 'removed';
  text: string;
  spans: Span[];
  chunk: number;
  lineNo: number;
}

export type ChunkKind = 'added' | 'removed' | 'modified' | 'mixed';

export interface DiffChunk {
  id: number;
  kind: ChunkKind;
  leftStart: number;
  leftEnd: number;
  rightStart: number;
  rightEnd: number;
  inlineStart: number;
  inlineEnd: number;
}

export interface DiffStats {
  added: number;
  removed: number;
  modified: number;
  total: number;
}

export interface DiffResult {
  pairs: PairRow[];
  inline: InlineRow[];
  chunks: DiffChunk[];
  stats: DiffStats;
  leftLines: number;
  rightLines: number;
}

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  trimLines: boolean;
}

export function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function normalizeLine(line: string, opts: DiffOptions): string {
  let s = line;
  if (opts.ignoreCase) s = s.toLowerCase();
  if (opts.trimLines) {
    s = s.trim();
  } else if (opts.ignoreWhitespace) {
    s = s.trim().split(/\s+/).join(' ');
  }
  return s;
}

function inlineSpans(
  a: string,
  b: string,
  opts: DiffOptions,
): { left: Span[]; right: Span[] } {
  const useChars = a.length <= 400 && b.length <= 400;
  const changes: Change[] = useChars
    ? diffChars(a, b, { ignoreCase: opts.ignoreCase })
    : diffWords(a, b, { ignoreCase: opts.ignoreCase });

  const left: Span[] = [];
  const right: Span[] = [];
  // 左右位置必须独立推进：removed 只属于左侧，added 只属于右侧，
  // 共享一个游标会让 added 的位置被 removed 的长度推偏。
  // jsdiff 的 value.length 即 UTF-16 code unit 数，与 CodeMirror 文档偏移语义一致。
  let leftPos = 0;
  let rightPos = 0;
  for (const change of changes) {
    const len = change.value.length;
    if (change.added) {
      right.push({ from: rightPos, to: rightPos + len });
      rightPos += len;
    } else if (change.removed) {
      left.push({ from: leftPos, to: leftPos + len });
      leftPos += len;
    } else {
      leftPos += len;
      rightPos += len;
    }
  }
  return { left, right };
}

interface Seg {
  type: 'equal' | 'added' | 'removed';
  values: string[];
}

/**
 * Compute a structured diff between two texts.
 * Line-level first, then character/word-level within modified line pairs.
 */
export function computeDiff(original: string, modified: string, opts: DiffOptions): DiffResult {
  const aLines = splitLines(original);
  const bLines = splitLines(modified);

  const rawChanges = diffArrays(aLines, bLines, {
    comparator: (x: string, y: string) => normalizeLine(x, opts) === normalizeLine(y, opts),
  });

  const segs: Seg[] = rawChanges.map((c) => ({
    type: c.added ? 'added' : c.removed ? 'removed' : 'equal',
    values: c.value as string[],
  }));

  const pairs: PairRow[] = [];
  const inline: InlineRow[] = [];
  const chunks: DiffChunk[] = [];

  let leftLine = 0;
  let rightLine = 0;
  let inlineLine = 0;
  let chunkId = -1;
  let statsAdded = 0;
  let statsRemoved = 0;
  let statsModified = 0;

  const startChunk = (hasAdded: boolean, hasRemoved: boolean): number => {
    chunkId += 1;
    const kind: ChunkKind = hasAdded && hasRemoved ? 'modified' : hasAdded ? 'added' : 'removed';
    chunks.push({
      id: chunkId,
      kind,
      leftStart: leftLine + 1,
      leftEnd: leftLine,
      rightStart: rightLine + 1,
      rightEnd: rightLine,
      inlineStart: inlineLine + 1,
      inlineEnd: inlineLine,
    });
    return chunkId;
  };

  const extendChunk = (chunk: DiffChunk) => {
    chunk.leftEnd = leftLine;
    chunk.rightEnd = rightLine;
    chunk.inlineEnd = inlineLine;
  };

  const makeLeftRow = (text: string, kind: RowKind, chunk: number, spans: Span[] = []): SideRow => {
    leftLine += 1;
    return { kind, text, lineNo: leftLine, spans, chunk };
  };
  const makeRightRow = (text: string, kind: RowKind, chunk: number, spans: Span[] = []): SideRow => {
    rightLine += 1;
    return { kind, text, lineNo: rightLine, spans, chunk };
  };
  const pushInline = (text: string, kind: 'equal' | 'added' | 'removed', chunk: number, spans: Span[] = []) => {
    inlineLine += 1;
    inline.push({ kind, text, spans, chunk, lineNo: inlineLine });
  };

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];

    if (seg.type === 'equal') {
      for (const v of seg.values) {
        const row = makeLeftRow(v, 'equal', -1);
        pairs.push({ kind: 'equal', chunk: -1, left: row, right: { ...row, lineNo: (rightLine += 1) } });
        pushInline(v, 'equal', -1);
      }
      continue;
    }

    // Changed segment — try to pair with an opposite segment that follows.
    const opposite = seg.type === 'removed' ? 'added' : 'removed';
    if (i + 1 < segs.length && segs[i + 1].type === opposite) {
      const remValues = seg.type === 'removed' ? seg.values : segs[i + 1].values;
      const addValues = seg.type === 'removed' ? segs[i + 1].values : seg.values;

      const cid = startChunk(true, true);
      const chunk = chunks[chunks.length - 1];

      const n = Math.min(remValues.length, addValues.length);
      for (let k = 0; k < n; k++) {
        const spans = inlineSpans(remValues[k], addValues[k], opts);
        const left = makeLeftRow(remValues[k], 'modified', cid, spans.left);
        const right = makeRightRow(addValues[k], 'modified', cid, spans.right);
        pairs.push({ kind: 'modified', chunk: cid, left, right });
        pushInline(remValues[k], 'removed', cid, spans.left);
        pushInline(addValues[k], 'added', cid, spans.right);
        statsModified += 1;
      }
      for (let k = n; k < remValues.length; k++) {
        const left = makeLeftRow(remValues[k], 'removed', cid);
        pairs.push({ kind: 'removed', chunk: cid, left, right: null });
        pushInline(remValues[k], 'removed', cid);
        statsRemoved += 1;
      }
      for (let k = n; k < addValues.length; k++) {
        const right = makeRightRow(addValues[k], 'added', cid);
        pairs.push({ kind: 'added', chunk: cid, left: null, right });
        pushInline(addValues[k], 'added', cid);
        statsAdded += 1;
      }
      extendChunk(chunk);
      i += 1;
      continue;
    }

    // Pure added or pure removed segment.
    const cid = startChunk(seg.type === 'added', seg.type === 'removed');
    const chunk = chunks[chunks.length - 1];
    if (seg.type === 'removed') {
      for (const v of seg.values) {
        const left = makeLeftRow(v, 'removed', cid);
        pairs.push({ kind: 'removed', chunk: cid, left, right: null });
        pushInline(v, 'removed', cid);
        statsRemoved += 1;
      }
    } else {
      for (const v of seg.values) {
        const right = makeRightRow(v, 'added', cid);
        pairs.push({ kind: 'added', chunk: cid, left: null, right });
        pushInline(v, 'added', cid);
        statsAdded += 1;
      }
    }
    extendChunk(chunk);
  }

  return {
    pairs,
    inline,
    chunks,
    stats: {
      added: statsAdded,
      removed: statsRemoved,
      modified: statsModified,
      total: chunks.length,
    },
    leftLines: leftLine,
    rightLines: rightLine,
  };
}

/** Remove the unused strict helper (kept API minimal). */
export function identical(original: string, modified: string, opts: DiffOptions): boolean {
  return computeDiff(original, modified, opts).chunks.length === 0;
}

/**
 * Compute collapse runs: maximal runs of equal rows long enough to hide,
 * with `context` rows kept visible at each end. Returns 1-based inclusive
 * line ranges per side, so both sides collapse symmetrically.
 */
export interface CollapseRun {
  id: number;
  leftFrom: number;
  leftTo: number;
  rightFrom: number;
  rightTo: number;
  count: number;
}

export function computeCollapseRuns(
  pairs: PairRow[],
  opts: { context: number; minRun: number },
): CollapseRun[] {
  const runs: CollapseRun[] = [];
  let runStart = -1;

  for (let i = 0; i <= pairs.length; i++) {
    const isEq = i < pairs.length && pairs[i].kind === 'equal';
    if (isEq && runStart < 0) runStart = i;
    if (!isEq && runStart >= 0) {
      const runLen = i - runStart;
      const hideFrom = runStart + opts.context;
      const hideTo = i - 1 - opts.context;
      if (runLen >= opts.minRun && hideTo >= hideFrom) {
        const count = hideTo - hideFrom + 1;
        const lStart = pairs[hideFrom].left!.lineNo;
        const rStart = pairs[hideFrom].right!.lineNo;
        runs.push({
          id: hideFrom,
          leftFrom: lStart,
          leftTo: lStart + count - 1,
          rightFrom: rStart,
          rightTo: rStart + count - 1,
          count,
        });
      }
      runStart = -1;
    }
  }

  return runs;
}

/** Inline rows indexed for collapse runs (runs over equal inline rows). */
export function computeInlineCollapseRuns(
  rows: InlineRow[],
  opts: { context: number; minRun: number },
): CollapseRun[] {
  const runs: CollapseRun[] = [];
  let runStart = -1;

  for (let i = 0; i <= rows.length; i++) {
    const isEq = i < rows.length && rows[i].kind === 'equal';
    if (isEq && runStart < 0) runStart = i;
    if (!isEq && runStart >= 0) {
      const runLen = i - runStart;
      const hideFrom = runStart + opts.context;
      const hideTo = i - 1 - opts.context;
      if (runLen >= opts.minRun && hideTo >= hideFrom) {
        const count = hideTo - hideFrom + 1;
        const start = rows[hideFrom].lineNo;
        runs.push({
          id: hideFrom,
          leftFrom: start,
          leftTo: start + count - 1,
          rightFrom: start,
          rightTo: start + count - 1,
          count,
        });
      }
      runStart = -1;
    }
  }
  return runs;
}
