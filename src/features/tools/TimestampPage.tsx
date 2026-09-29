import { useEffect, useMemo, useState } from 'react';
import { ToolPage } from '../../components/ToolPage';

function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN');
}

function relativeTime(ms: number): string {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [365 * 24 * 3600e3, '年'],
    [30 * 24 * 3600e3, '个月'],
    [24 * 3600e3, '天'],
    [3600e3, '小时'],
    [60e3, '分钟'],
  ];
  for (const [unitMs, name] of units) {
    if (abs >= unitMs) {
      const v = Math.round(abs / unitMs);
      return diff > 0 ? `${v} ${name}后` : `${v} ${name}前`;
    }
  }
  return diff > 0 ? '刚刚之后' : '刚刚';
}

export default function TimestampPage() {
  const [now, setNow] = useState(() => new Date());
  const [tsInput, setTsInput] = useState('');
  const [tsUnit, setTsUnit] = useState<'s' | 'ms'>('s');
  const [dateInput, setDateInput] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tsParsed = useMemo(() => {
    const n = Number(tsInput.trim());
    if (tsInput.trim() === '' || !Number.isFinite(n)) return null;
    const ms = tsUnit === 's' ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [tsInput, tsUnit]);

  const dateParsed = useMemo(() => {
    if (dateInput === '') return null;
    const d = new Date(dateInput);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [dateInput]);

  return (
    <ToolPage title="时间戳" subtitle="Unix 时间戳与日期时间互相转换。">
      <div className="tool-surface">
        <div className="tool-body" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {now.toLocaleTimeString('zh-CN', { hour12: false })}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </span>
          </div>
          <div className="result-list">
            <div className="result-row">
              <span className="result-label">Unix 秒</span>
              <span className="result-value">{formatNumber(Math.floor(now.getTime() / 1000))}</span>
            </div>
            <div className="result-row">
              <span className="result-label">Unix 毫秒</span>
              <span className="result-value">{formatNumber(now.getTime())}</span>
            </div>
            <div className="result-row">
              <span className="result-label">ISO 8601</span>
              <span className="result-value">{now.toISOString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 'var(--sp-5)' }} />

      <div className="tool-surface">
        <div className="tool-body">
          <div className="section-label">时间戳 → 日期时间</div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="tool-input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder={tsUnit === 's' ? '例如 1758537600' : '例如 1758537600000'}
              value={tsInput}
              onChange={(e) => setTsInput(e.target.value)}
            />
            <div className="segmented">
              {(['s', 'ms'] as const).map((u) => (
                <button
                  key={u}
                  role="radio"
                  aria-checked={tsUnit === u}
                  className="segmented-option"
                  onClick={() => setTsUnit(u)}
                >
                  {u === 's' ? '秒' : '毫秒'}
                </button>
              ))}
            </div>
          </div>
          {tsParsed && (
            <div className="result-list">
              <div className="result-row">
                <span className="result-label">本地时间</span>
                <span className="result-value">{tsParsed.toLocaleString('zh-CN', { hour12: false })}</span>
              </div>
              <div className="result-row">
                <span className="result-label">UTC</span>
                <span className="result-value">{tsParsed.toUTCString()}</span>
              </div>
              <div className="result-row">
                <span className="result-label">ISO 8601</span>
                <span className="result-value">{tsParsed.toISOString()}</span>
              </div>
              <div className="result-row">
                <span className="result-label">相对</span>
                <span className="result-value">{relativeTime(tsParsed.getTime())}</span>
              </div>
            </div>
          )}
          {tsInput.trim() !== '' && !tsParsed && (
            <span className="status-error" style={{ fontSize: 12.5 }}>请输入有效的时间戳数字</span>
          )}
        </div>
      </div>

      <div style={{ height: 'var(--sp-5)' }} />

      <div className="tool-surface">
        <div className="tool-body">
          <div className="section-label">日期时间 → 时间戳</div>
          <input
            className="tool-input"
            type="datetime-local"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
          />
          {dateParsed && (
            <div className="result-list">
              <div className="result-row">
                <span className="result-label">Unix 秒</span>
                <span className="result-value">{formatNumber(Math.floor(dateParsed.getTime() / 1000))}</span>
              </div>
              <div className="result-row">
                <span className="result-label">Unix 毫秒</span>
                <span className="result-value">{formatNumber(dateParsed.getTime())}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ToolPage>
  );
}

