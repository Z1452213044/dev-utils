export type TextOperationId =
  | 'trim'
  | 'removeEmptyLines'
  | 'removeDuplicateLines'
  | 'sortAsc'
  | 'sortDesc'
  | 'uppercase'
  | 'lowercase'
  | 'trimEachLine'
  | 'lfToCrlf'
  | 'crlfToLf';

export interface TextStats {
  characters: number;
  words: number;
  lines: number;
}

export function textStats(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
  const lines = text === '' ? 0 : text.split('\n').length;
  return { characters: text.length, words, lines };
}

export function trimText(text: string): string {
  return text.trim();
}

export function removeEmptyLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
}

export function removeDuplicateLines(text: string): string {
  const seen = new Set<string>();
  return text
    .split('\n')
    .filter((line) => {
      if (seen.has(line)) return false;
      seen.add(line);
      return true;
    })
    .join('\n');
}

export function sortLines(text: string, direction: 'asc' | 'desc'): string {
  const lines = text.split('\n');
  lines.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  if (direction === 'desc') lines.reverse();
  return lines.join('\n');
}

export function toUpperCase(text: string): string {
  return text.toUpperCase();
}

export function toLowerCase(text: string): string {
  return text.toLowerCase();
}

export function trimEachLine(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}

export function lfToCrlf(text: string): string {
  return text.replace(/\r?\n/g, '\r\n');
}

export function crlfToLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

export function applyTextOperation(id: TextOperationId, text: string): string {
  switch (id) {
    case 'trim':
      return trimText(text);
    case 'removeEmptyLines':
      return removeEmptyLines(text);
    case 'removeDuplicateLines':
      return removeDuplicateLines(text);
    case 'sortAsc':
      return sortLines(text, 'asc');
    case 'sortDesc':
      return sortLines(text, 'desc');
    case 'uppercase':
      return toUpperCase(text);
    case 'lowercase':
      return toLowerCase(text);
    case 'trimEachLine':
      return trimEachLine(text);
    case 'lfToCrlf':
      return lfToCrlf(text);
    case 'crlfToLf':
      return crlfToLf(text);
  }
}
