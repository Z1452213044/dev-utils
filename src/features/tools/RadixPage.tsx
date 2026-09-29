import { useMemo, useState } from 'react';
import { ToolPage } from '../../components/ToolPage';
import { SegmentedControl } from '../../components/SegmentedControl';

const RADICES = [2, 8, 10, 16] as const;
type Radix = (typeof RADICES)[number];

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

function parseWithRadix(input: string, radix: Radix): bigint | null {
  const trimmed = input.trim().toLowerCase().replace(/^0[xbo]/, '');
  if (trimmed === '') return null;
  const valid = DIGITS.slice(0, radix);
  let result = 0n;
  const bigRadix = BigInt(radix);
  for (const ch of trimmed) {
    const idx = valid.indexOf(ch);
    if (idx < 0) return null;
    result = result * bigRadix + BigInt(idx);
  }
  return result;
}

export default function RadixPage() {
  const [input, setInput] = useState('');
  const [radix, setRadix] = useState<Radix>(10);

  const value = useMemo(() => parseWithRadix(input, radix), [input, radix]);
  const invalid = input.trim() !== '' && value === null;

  const rows: { label: string; text: string }[] =
    value === null
      ? []
      : [
          { label: '二进制', text: value.toString(2) },
          { label: '八进制', text: value.toString(8) },
          { label: '十进制', text: value.toString(10) },
          { label: '十六进制', text: value.toString(16).toUpperCase() },
          { label: 'Base32', text: value.toString(32).toUpperCase() },
          { label: 'Base36', text: value.toString(36).toUpperCase() },
        ];

  const placeholders: Record<Radix, string> = {
    2: '例如 101010',
    8: '例如 755',
    10: '例如 41957',
    16: '例如 2FA9（也可带 0x 前缀）',
  };

  return (
    <ToolPage title="进制转换" subtitle="在二进制、八进制、十进制、十六进制等进制之间转换，支持任意大小。">
      <div className="tool-surface">
        <div className="tool-body">
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="section-label" style={{ margin: 0 }}>输入（按当前进制解析）</span>
            <SegmentedControl<string>
              ariaLabel="输入进制"
              value={String(radix)}
              onChange={(v) => setRadix(Number(v) as Radix)}
              options={RADICES.map((r) => ({ value: String(r), label: `${r} 进制` }))}
            />
          </div>
          <input
            className="tool-input"
            placeholder={placeholders[radix]}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
          {invalid && (
            <span className="status-error" style={{ fontSize: 12.5 }}>
              「{input.trim()}」不是有效的 {radix} 进制数
            </span>
          )}
          {value !== null && (
            <div className="result-list">
              {rows.map((row) => (
                <div className="result-row" key={row.label}>
                  <span className="result-label">{row.label}</span>
                  <span className="result-value">{row.text}</span>
                </div>
              ))}
            </div>
          )}
          {input.trim() === '' && (
            <div className="result-list">
              <div className="result-row">
                <span className="result-label">提示</span>
                <span className="result-value" style={{ color: 'var(--text-tertiary)' }}>
                  输入数字后自动显示各进制结果，支持超出 Number 安全范围的整数
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ToolPage>
  );
}
