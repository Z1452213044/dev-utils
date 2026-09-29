import { Decoration, EditorView } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import type { Range } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';

/** 正则匹配高亮：整段文本中的所有匹配区间。 */

export const setRegexMatches = StateEffect.define<{ from: number; to: number }[]>();

function buildDecos(ranges: { from: number; to: number }[]): DecorationSet {
  const rangesDeco: Range<Decoration>[] = ranges
    .filter((r) => r.to > r.from)
    .map((r) => Decoration.mark({ class: 'regex-match' }).range(r.from, r.to));
  return Decoration.set(rangesDeco, true);
}

const regexMatchField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decos, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setRegexMatches)) return buildDecos(effect.value);
    }
    if (tr.docChanged) return Decoration.none;
    return decos;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const regexMatchExtension = regexMatchField;
