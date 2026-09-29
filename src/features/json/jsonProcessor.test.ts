import { describe, it, expect } from 'vitest';
import { validateJson, formatJson, minifyJson, sortJsonKeys } from './jsonProcessor';

describe('validateJson', () => {
  it('accepts valid JSON', () => {
    const r = validateJson('{"a": 1, "b": [2, 3]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.keys).toBe(2);
  });

  it('accepts unicode content', () => {
    expect(validateJson('{"名字": "腾讯"}').ok).toBe(true);
  });

  it('empty text is valid (idle state)', () => {
    expect(validateJson('   ').ok).toBe(true);
  });

  it('reports line/column for invalid JSON', () => {
    const text = '{\n  "a": 1,\n  "b": ,\n}';
    const r = validateJson(text);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBeGreaterThanOrEqual(3);
      expect(r.error.line).toBeLessThanOrEqual(4);
      expect(r.error.index).toBeGreaterThan(0);
    }
  });
});

describe('formatJson / minifyJson', () => {
  it('formats with chosen indent', () => {
    const r = formatJson('{"a":1}', '4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('{\n    "a": 1\n}');
  });

  it('formats with tab indent', () => {
    const r = formatJson('{"a":[1,2]}', 'tab');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toContain('\t"a"');
  });

  it('keeps unicode characters literal', () => {
    const r = formatJson('{"k":"中文"}', '2');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toContain('中文');
  });

  it('minifies', () => {
    const r = minifyJson('{\n  "a" : 1\n}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe('{"a":1}');
  });

  it('sorts keys recursively', () => {
    const r = sortJsonKeys('{"b":{"d":1,"c":2},"a":3}', '2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      const idxA = r.text.indexOf('"a"');
      const idxB = r.text.indexOf('"b"');
      const idxC = r.text.indexOf('"c"');
      const idxD = r.text.indexOf('"d"');
      expect(idxA).toBeLessThan(idxB);
      expect(idxC).toBeLessThan(idxD);
    }
  });

  it('returns error position on invalid input', () => {
    const r = formatJson('{bad}', '2');
    expect(r.ok).toBe(false);
  });
});
