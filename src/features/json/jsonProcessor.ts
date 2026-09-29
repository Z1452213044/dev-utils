/**
 * Minimal, strict JSON parser with exact error positions.
 * Used instead of raw JSON.parse so we can always report Line/Column
 * regardless of the engine's error message format.
 */

export class JsonParseError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message);
    this.name = 'JsonParseError';
  }
}

class Parser {
  private i = 0;

  constructor(private readonly src: string) {}

  private fail(message: string): never {
    throw new JsonParseError(message, this.i);
  }

  private ws(): void {
    while (this.i < this.src.length) {
      const c = this.src[this.i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') this.i++;
      else break;
    }
  }

  private peek(): string {
    return this.src[this.i];
  }

  private expect(ch: string): void {
    if (this.src[this.i] !== ch) {
      this.fail(
        this.i >= this.src.length
          ? `应为 '${ch}'，但内容已结束`
          : `意外的符号 '${this.src[this.i]}'`,
      );
    }
    this.i++;
  }

  parse(): unknown {
    const value = this.parseValue();
    this.ws();
    if (this.i < this.src.length) {
      this.fail('JSON 结束后存在多余内容');
    }
    return value;
  }

  private parseValue(): unknown {
    this.ws();
    if (this.i >= this.src.length) this.fail('内容意外结束');
    const c = this.peek();
    if (c === '{') return this.parseObject();
    if (c === '[') return this.parseArray();
    if (c === '"') return this.parseString();
    if (c === 't') return this.parseLiteral('true', true);
    if (c === 'f') return this.parseLiteral('false', false);
    if (c === 'n') return this.parseLiteral('null', null);
    if (c === '-' || (c >= '0' && c <= '9')) return this.parseNumber();
    this.fail(`意外的符号 '${c}'`);
  }

  private parseLiteral(word: string, value: unknown): unknown {
    if (this.src.startsWith(word, this.i)) {
      this.i += word.length;
      return value;
    }
    this.fail(`意外的符号 '${this.src[this.i]}'`);
  }

  private parseNumber(): number {
    const rest = this.src.slice(this.i);
    const m = rest.match(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/);
    if (!m || m[0] === '') this.fail('无效的数字');
    this.i += m[0].length;
    return Number(m[0]);
  }

  private parseString(): string {
    this.expect('"');
    let out = '';
    for (;;) {
      if (this.i >= this.src.length) this.fail('字符串未闭合');
      const c = this.src[this.i];
      if (c === '"') {
        this.i++;
        return out;
      }
      if (c === '\\') {
        this.i++;
        if (this.i >= this.src.length) this.fail('字符串未闭合');
        const esc = this.src[this.i];
        switch (esc) {
          case '"': out += '"'; this.i++; break;
          case '\\': out += '\\'; this.i++; break;
          case '/': out += '/'; this.i++; break;
          case 'b': out += '\b'; this.i++; break;
          case 'f': out += '\f'; this.i++; break;
          case 'n': out += '\n'; this.i++; break;
          case 'r': out += '\r'; this.i++; break;
          case 't': out += '\t'; this.i++; break;
          case 'u': {
            const hex = this.src.slice(this.i + 1, this.i + 5);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail('无效的 Unicode 转义');
            out += String.fromCharCode(parseInt(hex, 16));
            this.i += 5;
            break;
          }
          default:
            this.fail(`无效的转义序列 '\\${esc}'`);
        }
      } else if (c.charCodeAt(0) < 0x20) {
        this.fail('字符串中包含未转义的控制字符');
      } else {
        out += c;
        this.i++;
      }
    }
  }

  private parseArray(): unknown[] {
    this.expect('[');
    const out: unknown[] = [];
    this.ws();
    if (this.peek() === ']') {
      this.i++;
      return out;
    }
    for (;;) {
      out.push(this.parseValue());
      this.ws();
      const c = this.peek();
      if (c === ',') {
        this.i++;
      } else if (c === ']') {
        this.i++;
        return out;
      } else {
        this.fail(c === undefined ? '数组未闭合' : `Unexpected token '${c}' （数组中）`);
      }
    }
  }

  private parseObject(): Record<string, unknown> {
    this.expect('{');
    const out: Record<string, unknown> = {};
    this.ws();
    if (this.peek() === '}') {
      this.i++;
      return out;
    }
    for (;;) {
      this.ws();
      if (this.peek() !== '"') {
        this.fail(this.peek() === undefined ? '对象未闭合' : `此处应为属性名，而不是 '${this.peek()}'`);
      }
      const key = this.parseString();
      this.ws();
      this.expect(':');
      out[key] = this.parseValue();
      this.ws();
      const c = this.peek();
      if (c === ',') {
        this.i++;
      } else if (c === '}') {
        this.i++;
        return out;
      } else {
        this.fail(c === undefined ? '对象未闭合' : `Unexpected token '${c}' （对象中）`);
      }
    }
  }
}

export function parseJson(
  text: string,
): { ok: true; value: unknown } | { ok: false; message: string; index: number } {
  try {
    return { ok: true, value: new Parser(text).parse() };
  } catch (err) {
    if (err instanceof JsonParseError) return { ok: false, message: err.message, index: err.index };
    throw err;
  }
}

/* ---------------- Public API ---------------- */

export interface JsonError {
  message: string;
  line: number;
  column: number;
  index: number;
}

export type JsonCheck =
  | { ok: true; keys: number; bytes: number }
  | { ok: false; error: JsonError };

export type JsonIndent = '2' | '4' | 'tab';

function indentUnit(indent: JsonIndent): string {
  // Note: JSON.stringify treats a string indent literally, so expand to spaces here.
  return indent === 'tab' ? '\t' : indent === '4' ? '    ' : '  ';
}

function positionFromIndex(text: string, index: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(index, text.length));
  const before = text.slice(0, clamped);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function toError(text: string, result: { ok: false; message: string; index: number }): JsonError {
  const { line, column } = positionFromIndex(text, result.index);
  return { message: result.message, line, column, index: result.index };
}

function countKeys(value: unknown): number {
  if (Array.isArray(value)) return value.reduce<number>((acc, v) => acc + countKeys(v), 0);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).reduce<number>(
      (acc, v) => acc + 1 + countKeys(v),
      0,
    );
  }
  return 0;
}

export function validateJson(text: string): JsonCheck {
  if (text.trim() === '') return { ok: true, keys: 0, bytes: text.length };
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, error: toError(text, parsed) };
  return { ok: true, keys: countKeys(parsed.value), bytes: text.length };
}

export interface FormatResult {
  ok: true;
  text: string;
  bytes: number;
}

type Failure = { ok: false; error: JsonError };

export function formatJson(text: string, indent: JsonIndent): FormatResult | Failure {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, error: toError(text, parsed) };
  const out = JSON.stringify(parsed.value, null, indentUnit(indent));
  return { ok: true, text: out, bytes: out.length };
}

export function minifyJson(text: string): FormatResult | Failure {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, error: toError(text, parsed) };
  const out = JSON.stringify(parsed.value);
  return { ok: true, text: out, bytes: out.length };
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = sortValue(v);
    return out;
  }
  return value;
}

export function sortJsonKeys(text: string, indent: JsonIndent): FormatResult | Failure {
  const parsed = parseJson(text);
  if (!parsed.ok) return { ok: false, error: toError(text, parsed) };
  const out = JSON.stringify(sortValue(parsed.value), null, indentUnit(indent));
  return { ok: true, text: out, bytes: out.length };
}
