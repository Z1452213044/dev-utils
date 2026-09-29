import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';
import type { SideRow, InlineRow, CollapseRun, Span } from './diffEngine';

/* ---------------- Side (left/right) decorations ---------------- */

export interface SidePayload {
  rows: SideRow[];
  collapse: CollapseRun[];
  /** Which side: affects modified-row tint (del on left, add on right). */
  side: 'left' | 'right';
}

export const setSideDiff = StateEffect.define<SidePayload>();
export const expandCollapse = StateEffect.define<number>(); // payload: run id

class CollapseWidget extends WidgetType {
  constructor(
    readonly count: number,
    readonly runId: number,
  ) {
    super();
  }

  eq(other: CollapseWidget) {
    return other.count === this.count && other.runId === this.runId;
  }

  toDOM(view: EditorView) {
    const box = document.createElement('div');
    box.className = 'diff-collapse';
    box.textContent = `⌃ ${this.count} unchanged line${this.count === 1 ? '' : 's'} — click to expand`;
    box.setAttribute('role', 'button');
    box.setAttribute('aria-label', `Expand ${this.count} hidden unchanged lines`);
    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      view.dispatch({ effects: expandCollapse.of(this.runId) });
    });
    return box;
  }

  ignoreEvent() {
    return false;
  }
}

interface SideField {
  decos: DecorationSet;
  payload: SidePayload | null;
  expanded: Set<number>;
}

function buildSideDecos(payload: SidePayload, expanded: Set<number>, state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const doc = state.doc;

  for (const row of payload.rows) {
    if (row.lineNo > doc.lines) continue;
    const line = doc.line(row.lineNo);
    let lineClass: string | null = null;
    if (row.kind === 'removed') lineClass = 'diff-row-del';
    else if (row.kind === 'added') lineClass = 'diff-row-add';
    else if (row.kind === 'modified') lineClass = payload.side === 'left' ? 'diff-row-del' : 'diff-row-add';

    if (lineClass) ranges.push(Decoration.line({ class: lineClass }).range(line.from));

    const spanClass = payload.side === 'left' ? 'diff-word-del' : 'diff-word-add';
    for (const span of row.spans) {
      if (span.to <= span.from) continue;
      const from = Math.min(line.from + span.from, line.to);
      const to = Math.min(line.from + span.to, line.to);
      if (to > from) ranges.push(Decoration.mark({ class: spanClass }).range(from, to));
    }
  }

  for (const run of payload.collapse) {
    if (expanded.has(run.id)) continue;
    if (run.leftTo > doc.lines) continue;
    const from = doc.line(run.leftFrom).from;
    const to = doc.line(run.leftTo).to;
    ranges.push(
      Decoration.replace({ widget: new CollapseWidget(run.count, run.id), block: true }).range(from, to),
    );
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(ranges, true);
}

export const sideDiffField = StateField.define<SideField>({
  create: () => ({ decos: Decoration.none, payload: null, expanded: new Set<number>() }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSideDiff)) {
        const expanded = new Set<number>();
        return {
          payload: effect.value,
          expanded,
          decos: buildSideDecos(effect.value, expanded, tr.state),
        };
      }
      if (effect.is(expandCollapse)) {
        const expanded = new Set(value.expanded);
        expanded.add(effect.value);
        const decos = value.payload ? buildSideDecos(value.payload, expanded, tr.state) : value.decos;
        return { payload: value.payload, expanded, decos };
      }
    }
    if (tr.docChanged && value.payload) {
      // Doc changed — stale decorations will be replaced by the next diff run.
      return { ...value, decos: Decoration.none };
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
});

/* ---------------- Inline (unified) decorations ---------------- */

export interface InlinePayload {
  rows: InlineRow[];
  collapse: CollapseRun[];
}

export const setInlineDiff = StateEffect.define<InlinePayload>();

interface InlineField {
  decos: DecorationSet;
  payload: InlinePayload | null;
  expanded: Set<number>;
}

function buildInlineDecos(payload: InlinePayload, expanded: Set<number>, state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const doc = state.doc;

  for (const row of payload.rows) {
    if (row.lineNo > doc.lines) continue;
    const line = doc.line(row.lineNo);
    const lineClass =
      row.kind === 'removed' ? 'diff-row-del' : row.kind === 'added' ? 'diff-row-add' : null;
    if (lineClass) ranges.push(Decoration.line({ class: lineClass }).range(line.from));

    const spanClass = row.kind === 'removed' ? 'diff-word-del' : 'diff-word-add';
    if (row.kind !== 'equal') {
      for (const span of row.spans) {
        if (span.to <= span.from) continue;
        const from = Math.min(line.from + span.from, line.to);
        const to = Math.min(line.from + span.to, line.to);
        if (to > from) ranges.push(Decoration.mark({ class: spanClass }).range(from, to));
      }
    }
  }

  for (const run of payload.collapse) {
    if (expanded.has(run.id)) continue;
    if (run.leftTo > doc.lines) continue;
    const from = doc.line(run.leftFrom).from;
    const to = doc.line(run.leftTo).to;
    ranges.push(
      Decoration.replace({ widget: new CollapseWidget(run.count, run.id), block: true }).range(from, to),
    );
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(ranges, true);
}

export const inlineDiffField = StateField.define<InlineField>({
  create: () => ({ decos: Decoration.none, payload: null, expanded: new Set<number>() }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setInlineDiff)) {
        const expanded = new Set<number>();
        return { payload: effect.value, expanded, decos: buildInlineDecos(effect.value, expanded, tr.state) };
      }
      if (effect.is(expandCollapse)) {
        const expanded = new Set(value.expanded);
        expanded.add(effect.value);
        const decos = value.payload ? buildInlineDecos(value.payload, expanded, tr.state) : value.decos;
        return { payload: value.payload, expanded, decos };
      }
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field, (v) => v.decos),
});

/* ---------------- JSON error decorations ---------------- */

export const setJsonError = StateEffect.define<{ index: number } | null>();

const jsonErrorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decos, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setJsonError)) {
        if (!effect.value) return Decoration.none;
        const { index } = effect.value;
        const line = tr.state.doc.lineAt(Math.min(index, tr.state.doc.length));
        const from = Math.min(index, line.to);
        const to = Math.min(index + 1, line.to);
        const ranges: Range<Decoration>[] = [
          Decoration.line({ class: 'json-error-line' }).range(line.from),
        ];
        if (to > from) ranges.push(Decoration.mark({ class: 'json-error-underline' }).range(from, to));
        return Decoration.set(ranges, true);
      }
    }
    return decos;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const jsonErrorExtension = jsonErrorField;

export function spansEqual(a: Span[], b: Span[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].from !== b[i].from || a[i].to !== b[i].to) return false;
  }
  return true;
}
