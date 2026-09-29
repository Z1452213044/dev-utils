import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import { computeDiff } from './diffEngine';
import { setSideDiff, sideDiffField } from './diffDecorations';
import type { SideRow } from './diffEngine';

/** 从 DecorationSet 中收集 mark 装饰的 [class, from, to]。 */
function collectMarks(decos: DecorationSet, docLen: number): { cls: string; from: number; to: number }[] {
  const out: { cls: string; from: number; to: number }[] = [];
  decos.between(0, docLen, (from, to, deco) => {
    const cls = (deco.spec as { class?: string }).class;
    if (cls) out.push({ cls, from, to });
  });
  return out.sort((x, y) => x.from - y.from);
}

/** 跑完整 diff，把某一侧的行数据注入 EditorState，返回最终装饰。 */
function renderSide(a: string, b: string, side: 'left' | 'right') {
  const diff = computeDiff(a, b, { ignoreWhitespace: false, ignoreCase: false, trimLines: false });
  const rows: SideRow[] = diff.pairs
    .map((p) => (side === 'left' ? p.left : p.right))
    .filter((r): r is SideRow => r !== null);
  const doc = side === 'left' ? a : b;
  const state = EditorState.create({ doc, extensions: [sideDiffField] });
  const tr = state.update({ effects: setSideDiff.of({ rows, collapse: [], side }) });
  return {
    marks: collectMarks(tr.state.field(sideDiffField).decos, tr.state.doc.length),
    doc: tr.state.doc,
  };
}

describe('diffDecorations 渲染级回归（原始 bug case）', () => {
  const LEFT = '去问问请问阿斯顿';
  const RIGHT = '去问问请啊阿斯顿';

  it('左侧 mark 恰好覆盖「问」', () => {
    const { marks, doc } = renderSide(LEFT, RIGHT, 'left');
    const wordMarks = marks.filter((m) => m.cls === 'diff-word-del');
    expect(wordMarks).toHaveLength(1);
    const covered = doc.sliceString(wordMarks[0].from, wordMarks[0].to);
    expect(covered).toBe('问');
  });

  it('右侧 mark 恰好覆盖「啊」（修复前错位到「阿」）', () => {
    const { marks, doc } = renderSide(LEFT, RIGHT, 'right');
    const wordMarks = marks.filter((m) => m.cls === 'diff-word-add');
    expect(wordMarks).toHaveLength(1);
    const covered = doc.sliceString(wordMarks[0].from, wordMarks[0].to);
    expect(covered).toBe('啊');
  });

  it('行背景装饰存在于对应行', () => {
    const left = renderSide(LEFT, RIGHT, 'left');
    expect(left.marks.some((m) => m.cls === 'diff-row-del')).toBe(true);
    const right = renderSide(LEFT, RIGHT, 'right');
    expect(right.marks.some((m) => m.cls === 'diff-row-add')).toBe(true);
  });

  it('emoji 场景：mark 落在 jsdiff 的 code unit 切分点，后续文本不错位', () => {
    const { marks, doc } = renderSide('hello😀world', 'hello😃world', 'right');
    const wordMarks = marks.filter((m) => m.cls === 'diff-word-add');
    expect(wordMarks).toHaveLength(1);
    // 😀 占 code unit 5-6；jsdiff 把替换切在 low surrogate (6,7)。
    // 修复前共享 pos 会把 mark 推到 (7,8) 误覆盖 'w'；修复后必须精确 (6,7)。
    expect([wordMarks[0].from, wordMarks[0].to]).toEqual([6, 7]);
    // span 之后的文本完整无偏移
    expect(doc.sliceString(7)).toBe('world');
  });

  it('删除场景：右侧无 word mark', () => {
    const { marks } = renderSide('abcXde', 'abcde', 'right');
    expect(marks.filter((m) => m.cls === 'diff-word-add')).toHaveLength(0);
  });

  it('新增场景：左侧无 word mark，右侧 mark 只覆盖新字符', () => {
    const { marks, doc } = renderSide('你好世界', '你好新世界', 'right');
    const wordMarks = marks.filter((m) => m.cls === 'diff-word-add');
    expect(wordMarks).toHaveLength(1);
    expect(doc.sliceString(wordMarks[0].from, wordMarks[0].to)).toBe('新');
  });
});
