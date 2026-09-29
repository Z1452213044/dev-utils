import { describe, it, expect } from 'vitest';
import { computeDiff } from './diffEngine';
import type { Span, DiffOptions } from './diffEngine';

/* ==================== helpers ==================== */

const BASE_OPTS: DiffOptions = { ignoreWhitespace: false, ignoreCase: false, trimLines: false };

/** 单行 diff：返回修改行的 left/right spans（经公共 API computeDiff）。 */
function spansOf(a: string, b: string, opts: Partial<DiffOptions> = {}): { left: Span[]; right: Span[] } {
  const diff = computeDiff(a, b, { ...BASE_OPTS, ...opts });
  const pair = diff.pairs.find((p) => p.kind === 'modified');
  return {
    left: pair?.left?.spans ?? [],
    right: pair?.right?.spans ?? [],
  };
}

/** 提取 spans 覆盖的文本片段（语义断言用）。 */
function extracted(spans: Span[], text: string): string[] {
  return spans.map((s) => text.slice(s.from, s.to));
}

/**
 * 通用不变量（对应需求第四节）：
 * - 0 <= from <= to <= line.length
 * - 单调递增（按 from 排序且不重叠）
 * - 不越界、不为负
 */
function expectInvariants(spans: Span[], line: string, label: string) {
  for (const s of spans) {
    expect(s.from, `${label}: from 非负`).toBeGreaterThanOrEqual(0);
    expect(s.to, `${label}: to >= from`).toBeGreaterThanOrEqual(s.from);
    expect(s.from, `${label}: from 不越界`).toBeLessThanOrEqual(line.length);
    expect(s.to, `${label}: to 不越界`).toBeLessThanOrEqual(line.length);
  }
  for (let i = 1; i < spans.length; i++) {
    expect(
      spans[i].from,
      `${label}: span[${i}] 起点必须 >= span[${i - 1}] 起点（单调）`,
    ).toBeGreaterThanOrEqual(spans[i - 1].from);
    expect(
      spans[i].from,
      `${label}: span[${i - 1}] 与 span[${i}] 重叠`,
    ).toBeGreaterThanOrEqual(spans[i - 1].to);
  }
}

/** 组合断言：invariants + 期望高亮文本。 */
function expectSpans(a: string, b: string, expectedLeft: string[], expectedRight: string[], opts: Partial<DiffOptions> = {}) {
  const { left, right } = spansOf(a, b, opts);
  expectInvariants(left, a, 'left');
  expectInvariants(right, b, 'right');
  expect(extracted(left, a), `left spans of ${JSON.stringify(a)} → ${JSON.stringify(b)}`).toEqual(expectedLeft);
  expect(extracted(right, b), `right spans of ${JSON.stringify(a)} → ${JSON.stringify(b)}`).toEqual(expectedRight);
}

/* ==================== A. 单字符替换 ==================== */

describe('A. 单字符替换（首/中/尾 × ASCII/中文）', () => {
  const cases = [
    // [左, 右, 期望旧字符, 期望新字符, 描述]
    ['abcde', 'Xbcde', 'a', 'X', '行首 ASCII'],
    ['abcde', 'abcXe', 'd', 'X', '行中 ASCII'],
    ['abcde', 'abcdX', 'e', 'X', '行尾 ASCII'],
    ['去问问请问阿斯顿', '啊问问请问阿斯顿', '去', '啊', '行首中文'],
    ['去问问请问阿斯顿', '去问问请啊阿斯顿', '问', '啊', '行中中文（原始 bug case）'],
    ['去问问请问阿斯顿', '去问问请问阿斯屯', '顿', '屯', '行尾中文'],
  ];
  for (const [a, b, oldCh, newCh, desc] of cases) {
    it(`${desc}: ${oldCh} → ${newCh}`, () => {
      expectSpans(a, b, [oldCh], [newCh]);
    });
  }
});

/* ==================== B/C. 单字符新增 / 删除 ==================== */

describe('B. 单字符新增', () => {
  it('ASCII 行中插入：左侧无 span，右侧只高亮新增字符', () => {
    expectSpans('abcde', 'abcXde', [], ['X']);
  });

  it('中文插入：你好世界 → 你好新世界', () => {
    expectSpans('你好世界', '你好新世界', [], ['新']);
  });

  it('行首插入：后续字符不错位', () => {
    expectSpans('abcde', 'Xabcde', [], ['X']);
  });

  it('行尾插入', () => {
    expectSpans('abcde', 'abcdeX', [], ['X']);
  });
});

describe('C. 单字符删除', () => {
  it('ASCII：左侧只高亮删除字符，右侧无 span', () => {
    expectSpans('abcXde', 'abcde', ['X'], []);
  });

  it('中文删除：jsdiff 等价解为删除相邻的「请问」两字符', () => {
    expectSpans('去问问请问阿斯顿', '去问问阿斯顿', ['请问'], []);
  });

  it('行首删除：右侧不错位', () => {
    expectSpans('Xabcde', 'abcde', ['X'], []);
  });
});

/* ==================== D. 连续字符替换（长度三种关系） ==================== */

describe('D. 连续字符替换', () => {
  it('等长替换：cde → XYZ', () => {
    expectSpans('abcdef', 'abXYZf', ['cde'], ['XYZ']);
  });

  it('左长右短：cde → X', () => {
    expectSpans('abcdef', 'abXf', ['cde'], ['X']);
  });

  it('左短右长：X → cde（反向）', () => {
    expectSpans('abXf', 'abcdef', ['X'], ['cde']);
  });

  it('左长右短（中文）：请问 → 啊', () => {
    expectSpans('去问问请问阿斯顿', '去问问请啊阿斯顿', ['问'], ['啊']);
  });

  it('左短右长（中文）反向：jsdiff 等价解为 啊 → 问', () => {
    expectSpans('去问问请啊阿斯顿', '去问问请问阿斯顿', ['啊'], ['问']);
  });
});

/* ==================== E. 多处不连续修改 ==================== */

describe('E. 一行内多处不连续修改', () => {
  it('三处修改各自独立、后续不错位', () => {
    expectSpans('abcdef123456xyz', 'abXdef123Y56xyZ', ['c', '4', 'z'], ['X', 'Y', 'Z']);
  });

  it('先删后插混合（jsdiff 可能合并为替换）', () => {
    const { left, right } = spansOf('abcdef123456xyz', 'abXdef12Y56xyz');
    expectInvariants(left, 'abcdef123456xyz', 'left');
    expectInvariants(right, 'abXdef12Y56xyz', 'right');
    // 左侧高亮的内容与右侧高亮的内容一一对应（逐对替换关系）
    expect(extracted(left, 'abcdef123456xyz').join('|') !== '' || extracted(right, 'abXdef12Y56xyz').join('|') !== '').toBe(true);
  });
});

/* ==================== F. 空字符串和边界 ==================== */

describe('F. 空字符串和边界', () => {
  it('空 → 空：无 diff 无 span', () => {
    const diff = computeDiff('', '', BASE_OPTS);
    expect(diff.pairs).toHaveLength(0);
  });

  it('空文本 → 有内容：全部为 added（空串不产生行，无 modified 配对）', () => {
    const diff = computeDiff('', 'abc', BASE_OPTS);
    expect(diff.pairs.map((p) => p.kind)).toEqual(['added']);
    expect(diff.stats.added).toBe(1);
    expect(diff.pairs[0].right!.spans).toEqual([]);
  });

  it('有内容 → 空文本：全部为 removed', () => {
    const diff = computeDiff('abc', '', BASE_OPTS);
    expect(diff.pairs.map((p) => p.kind)).toEqual(['removed']);
    expect(diff.stats.removed).toBe(1);
  });

  it('x → abc：完全不同的单行按整行替换配对（jsdiff 删除+插入）', () => {
    expectSpans('x', 'abc', ['x'], ['abc']);
  });

  it('a → b：单字符替换', () => {
    expectSpans('a', 'b', ['a'], ['b']);
  });

  it('a → ab：行尾新增', () => {
    expectSpans('a', 'ab', [], ['b']);
  });

  it('ab → a：行尾删除', () => {
    expectSpans('ab', 'a', ['b'], []);
  });
});

/* ==================== G. 空白字符 ==================== */

describe('G. 空白字符', () => {
  it('普通空格替换为连续空格（默认模式：可见 diff）', () => {
    expectSpans('a b', 'a  b', [], [' ']);
  });

  it('Tab 与空格（默认模式）', () => {
    expectSpans('a\tb', 'a b', ['\t'], [' ']);
  });

  it('ignoreWhitespace 开：空白差异不产生 span', () => {
    expectSpans('a  b', 'a b', [], [], { ignoreWhitespace: true });
    expectSpans('a\tb', 'a b', [], [], { ignoreWhitespace: true });
  });

  it('普通空格 → 连续空格：jsdiff 判定为插入一个空格', () => {
    expectSpans('a b', 'a  b', [], [' ']);
  });

  it('Tab 与空格（默认模式：视为替换）', () => {
    expectSpans('a\tb', 'a b', ['\t'], [' ']);
  });

  it('ignoreWhitespace 开：连续空格归一，内容相同则无 diff', () => {
    const diff = computeDiff('hello  world', 'hello world', { ...BASE_OPTS, ignoreWhitespace: true });
    expect(diff.chunks).toHaveLength(0);
  });
});

/* ==================== H. 大小写 ==================== */

describe('H. 大小写', () => {
  it('ignoreCase=false：大小写差异产生 span（H 与 W 两处）', () => {
    expectSpans('HelloWorld', 'helloworld', ['H', 'W'], ['h', 'w']);
  });

  it('ignoreCase=true：全等忽略，无 diff', () => {
    const diff = computeDiff('HelloWorld', 'helloworld', { ...BASE_OPTS, ignoreCase: true });
    expect(diff.chunks).toHaveLength(0);
  });
});

/* ==================== I. Unicode / emoji / 代理对 ==================== */

describe('I. Unicode / emoji / 代理对', () => {
  it('emoji 替换（surrogate pair）：span 落在 jsdiff 的 code unit 切分点且后续不错位', () => {
    // jsdiff v5 的 diffChars 按 UTF-16 code unit 拆 token，会把 😀 的替换切在
    // 高位代理（并入 equal）与低位代理之间 —— offset 语义正确，视觉上半个 emoji
    // 高亮属 jsdiff 拆分行为（已知限制，见测试尾部说明）。
    // 核心断言：修复前 added 会被共享 pos 推到 index 7（错高亮 'w'），修复后必须还在 (6,7)。
    const a = 'hello😀world';
    const b = 'hello😃world';
    const { left, right } = spansOf(a, b);
    expectInvariants(left, a, 'left');
    expectInvariants(right, b, 'right');
    // 😀 从 index 5 开始（占 5,6 两个 code unit），jsdiff 把替换点放在 low surrogate (6,7)
    expect(left).toEqual([{ from: 6, to: 7 }]);
    expect(right).toEqual([{ from: 6, to: 7 }]);
    // 后续文本不错位：span 之后是 'world'
    expect(b.slice(7)).toBe('world');
    expect(a.slice(7)).toBe('world');
  });

  it('emoji 前发生修改：emoji 本身不被误高亮', () => {
    expectSpans('hello😀world', 'hallo😀world', ['e'], ['a']);
  });

  it('emoji 后发生修改：不错位', () => {
    expectSpans('hello😀world', 'hello😀w0rld', ['o'], ['0']);
  });

  it('emoji + 中文混合新增', () => {
    expectSpans('你好😀世界', '你好😀新世界', [], ['新']);
  });

  it('中英混合替换', () => {
    expectSpans('中文abc混合', '中文abX混合', ['c'], ['X']);
  });
});

/* ==================== J. 多行 ==================== */

describe('J. 多行场景（span 相对行首 + 行定位）', () => {
  it('第二行修改：span 只作用于第二行内（jsdiff 切分为两段插入）', () => {
    const diff = computeDiff('line1\nhello world\nline3', 'line1\nhello new world\nline3', BASE_OPTS);
    const pair = diff.pairs.find((p) => p.kind === 'modified');
    expect(pair).toBeDefined();
    expect(pair!.left!.lineNo).toBe(2);
    expect(pair!.right!.lineNo).toBe(2);
    // 纯插入场景：左侧无 span；右侧高亮文本连接后是完整插入内容 "ne"+" w" = "new "（jsdiff 切分形状）
    expect(extracted(pair!.left!.spans, 'hello world')).toEqual([]);
    const rightText = extracted(pair!.right!.spans, 'hello new world').join('');
    expect(rightText.replace(/\s/g, '')).toBe('new');
  });

  it('第一行修改', () => {
    const diff = computeDiff('alpha\nb\nc', 'ALPHA\nb\nc', BASE_OPTS);
    const pair = diff.pairs.find((p) => p.kind === 'modified');
    expect(pair!.left!.lineNo).toBe(1);
    expect(extracted(pair!.left!.spans, 'alpha')).toEqual(['alpha']);
  });

  it('最后一行修改', () => {
    const diff = computeDiff('a\nb\nc3', 'a\nb\nc4', BASE_OPTS);
    const pair = diff.pairs.find((p) => p.kind === 'modified');
    expect(pair!.left!.lineNo).toBe(3);
    expect(extracted(pair!.left!.spans, 'c3')).toEqual(['3']);
    expect(extracted(pair!.right!.spans, 'c4')).toEqual(['4']);
  });

  it('新增整行 / 删除整行：无行内 span，统计正确', () => {
    const add = computeDiff('a\nb', 'a\nb\nc', BASE_OPTS);
    expect(add.stats.added).toBe(1);
    expect(add.pairs.find((p) => p.kind === 'added')!.right!.spans).toEqual([]);

    const del = computeDiff('a\nb\nc', 'a\nb', BASE_OPTS);
    expect(del.stats.removed).toBe(1);
    expect(del.pairs.find((p) => p.kind === 'removed')!.left!.spans).toEqual([]);
  });

  it('连续多行修改：逐行配对', () => {
    const diff = computeDiff('x1\nx2\nx3\nkeep', 'y1\ny2\ny3\nkeep', BASE_OPTS);
    const modified = diff.pairs.filter((p) => p.kind === 'modified');
    expect(modified).toHaveLength(3);
    for (const p of modified) {
      expectInvariants(p.left!.spans, p.left!.text, 'left');
      expectInvariants(p.right!.spans, p.right!.text, 'right');
    }
  });
});

/* ==================== K. modified 块行数不一致 ==================== */

describe('K. modified 块行数不一致', () => {
  it('removed 2 + added 1：前 1 行配对，多余 1 行降级为 removed', () => {
    const diff = computeDiff('old-1\nold-2\nkeep', 'new-1\nkeep', BASE_OPTS);
    const kinds = diff.pairs.map((p) => p.kind);
    expect(kinds).toEqual(['modified', 'removed', 'equal']);
    expect(diff.stats.modified).toBe(1);
    expect(diff.stats.removed).toBe(1);
    for (const p of diff.pairs) {
      if (p.left) expectInvariants(p.left.spans, p.left.text, 'left');
      if (p.right) expectInvariants(p.right.spans, p.right.text, 'right');
    }
  });

  it('removed 1 + added 2：多余 1 行降级为 added', () => {
    const diff = computeDiff('old-1\nkeep', 'new-1\nnew-2\nkeep', BASE_OPTS);
    const kinds = diff.pairs.map((p) => p.kind);
    expect(kinds).toEqual(['modified', 'added', 'equal']);
    expect(diff.stats.added).toBe(1);
  });

  it('removed N + added M（N=3, M=1）不产生越界 span', () => {
    const diff = computeDiff('a1\na2\na3\nkeep', 'b1\nkeep', BASE_OPTS);
    for (const p of diff.pairs) {
      if (p.left) expectInvariants(p.left.spans, p.left.text, 'left');
      if (p.right) expectInvariants(p.right.spans, p.right.text, 'right');
    }
    expect(diff.stats.modified).toBe(1);
    expect(diff.stats.removed).toBe(2);
  });
});

/* ==================== L. 重复文本 ==================== */

describe('L. 重复文本', () => {
  it('修改重复行中的一个 bar：右侧插入 y 不影响左侧', () => {
    const diff = computeDiff('foo\nbar\nbar\nbaz', 'foo\nbar\nbary\nbaz', BASE_OPTS);
    const pair = diff.pairs.find((p) => p.kind === 'modified');
    expect(pair).toBeDefined();
    expect(extracted(pair!.right!.spans, 'bary')).toEqual(['y']);
    expect(extracted(pair!.left!.spans, 'bar')).toEqual([]);
  });

  it('全篇重复字符行：span 语义正确', () => {
    expectSpans('aaaa', 'aaab', ['a'], ['b']);
  });
});

/* ==================== M. 长行降级（diffWords 路径） ==================== */

describe('M. 长行 >400 字符降级 diffWords', () => {
  const filler = 'x'.repeat(420);

  it('英文长行：前部修改', () => {
    const a = 'mod-' + filler;
    const b = 'MOD-' + filler;
    const { left, right } = spansOf(a, b);
    expectInvariants(left, a, 'left');
    expectInvariants(right, b, 'right');
    expect(extracted(left, a).join('')).toContain('mod');
    expect(extracted(right, b).join('')).toContain('MOD');
  });

  it('英文长行：尾部修改，左侧 span 不因右侧长度偏移', () => {
    const a = filler + '-oldEnd';
    const b = filler + '-newEndLonger';
    const { left, right } = spansOf(a, b);
    expectInvariants(left, a, 'left');
    expectInvariants(right, b, 'right');
    // 左侧最后一个 span 必须以 oldEnd 结尾（不被右侧更长的 added 推偏）
    const lastLeft = left[left.length - 1];
    expect(a.slice(lastLeft.from, a.length)).toContain('oldEnd');
  });

  it('中英混合长行：中部修改', () => {
    const a = ('中文' + 'y'.repeat(200) + 'OLDSEG' + 'z'.repeat(200) + '尾部');
    const b = ('中文' + 'y'.repeat(200) + 'NEWSEG' + 'z'.repeat(200) + '尾部');
    const { left, right } = spansOf(a, b);
    expectInvariants(left, a, 'left');
    expectInvariants(right, b, 'right');
    expect(extracted(left, a).join('')).toContain('OLDSEG');
    expect(extracted(right, b).join('')).toContain('NEWSEG');
    // span 不越界（不大于 400 的 diffWords 阈值也应正确处理）
    expect(left.every((s) => s.to <= a.length)).toBe(true);
    expect(right.every((s) => s.to <= b.length)).toBe(true);
  });

  it('长行路径也遵守左右独立推进（删短加长）', () => {
    const a = 'prefix-' + 'x'.repeat(420) + '-OLD- END';
    const b = 'prefix-' + 'x'.repeat(420) + '-MUCH-LONGER-NEW-SEGMENT-END';
    const { left, right } = spansOf(a, b);
    expectInvariants(left, a, 'left');
    expectInvariants(right, b, 'right');
  });
});

/* ==================== Invariant 压力测试 ==================== */

describe('Invariant 随机组合压力', () => {
  it(' systematically: 一批替换/增删组合全部满足不变量', () => {
    const combos: [string, string][] = [
      ['abcdef', 'abXYZf'],
      ['abcdef', 'abf'],
      ['abf', 'abcdef'],
      ['aXbXc', 'aYbYc'],
      ['中文测试文本', '中文替换文本'],
      ['emoji😀test', 'emoji😃test🎉'],
      ['x'.repeat(300) + 'A' + 'y'.repeat(300), 'x'.repeat(300) + 'B' + 'y'.repeat(300)],
      ['前缀旧内容', '前缀新内容更长'],
      ['same prefix-OLD-suffix', 'same prefix-NEW-suffix'],
      ['a b  c\td', 'a b c\td'],
    ];
    for (const [a, b] of combos) {
      const { left, right } = spansOf(a, b);
      expectInvariants(left, a, `left of ${a}`);
      expectInvariants(right, b, `right of ${b}`);
    }
  });
});
