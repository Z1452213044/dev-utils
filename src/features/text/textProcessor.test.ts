import { describe, it, expect } from 'vitest';
import {
  applyTextOperation,
  textStats,
  lfToCrlf,
  crlfToLf,
  removeDuplicateLines,
  removeEmptyLines,
  sortLines,
} from './textProcessor';

describe('textStats', () => {
  it('counts characters, words and lines', () => {
    expect(textStats('hello world\nsecond line')).toEqual({
      characters: 23,
      words: 4,
      lines: 2,
    });
  });

  it('empty text has zero everything', () => {
    expect(textStats('')).toEqual({ characters: 0, words: 0, lines: 0 });
  });
});

describe('operations', () => {
  it('trim', () => {
    expect(applyTextOperation('trim', '  hi  ')).toBe('hi');
  });

  it('removeEmptyLines keeps non-empty only', () => {
    expect(removeEmptyLines('a\n\nb\n   \nc')).toBe('a\nb\nc');
  });

  it('removeDuplicateLines keeps first occurrence', () => {
    expect(removeDuplicateLines('a\nb\na\nc\nb')).toBe('a\nb\nc');
  });

  it('sort asc/desc case-insensitively', () => {
    expect(sortLines('b\nA\nc', 'asc')).toBe('A\nb\nc');
    expect(sortLines('b\nA\nc', 'desc')).toBe('c\nb\nA');
  });

  it('uppercase / lowercase', () => {
    expect(applyTextOperation('uppercase', 'aBc')).toBe('ABC');
    expect(applyTextOperation('lowercase', 'aBc')).toBe('abc');
  });

  it('trimEachLine', () => {
    expect(applyTextOperation('trimEachLine', '  a \n\tb\t')).toBe('a\nb');
  });

  it('line ending conversions', () => {
    expect(lfToCrlf('a\nb\r\nc')).toBe('a\r\nb\r\nc');
    expect(crlfToLf('a\r\nb\nc')).toBe('a\nb\nc');
  });

  it('empty input round-trips safely', () => {
    for (const op of ['trim', 'removeEmptyLines', 'removeDuplicateLines', 'sortAsc', 'sortDesc'] as const) {
      expect(applyTextOperation(op, '')).toBe('');
    }
  });
});
