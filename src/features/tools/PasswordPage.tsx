import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { useToast } from '../../components/Toast';
import { Toggle } from '../../components/Toggle';
import { copyToClipboard } from '../../utils/clipboard';

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
};
const AMBIGUOUS = '0O1lI|`';

type Strength = '弱' | '中' | '强' | '极强';

function strengthOf(bits: number): Strength {
  if (bits < 40) return '弱';
  if (bits < 60) return '中';
  if (bits < 90) return '强';
  return '极强';
}

export default function PasswordPage() {
  const toast = useToast();
  const [length, setLength] = useState(20);
  const [opts, setOpts] = useState({ lower: true, upper: true, digits: true, symbols: true });
  const [noAmbiguous, setNoAmbiguous] = useState(true);
  const [password, setPassword] = useState('');

  const pool = useMemo(() => {
    let chars = '';
    for (const [key, set] of Object.entries(SETS)) {
      if (opts[key as keyof typeof opts]) {
        chars += noAmbiguous
          ? set.split('').filter((c) => !AMBIGUOUS.includes(c)).join('')
          : set;
      }
    }
    return chars;
  }, [opts, noAmbiguous]);

  const bits = password.length > 0 && pool.length > 1
    ? Math.round(password.length * Math.log2(pool.length))
    : 0;

  const generate = () => {
    if (pool.length === 0) {
      toast('请至少选择一种字符类型');
      return;
    }
    const values = crypto.getRandomValues(new Uint32Array(length));
    let out = '';
    for (const v of values) out += pool[v % pool.length];
    setPassword(out);
  };

  // 初次进入生成一个
  useEffect(() => {
    if (pool.length > 0) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ToolPage title="密码生成" subtitle="基于加密安全随机数生成高强度密码。">
      <div className="tool-surface">
        <div className="tool-body">
          <div className="result-list">
            <div className="result-row">
              <span className="result-label">密码</span>
              <span className="result-value" style={{ fontSize: 15, letterSpacing: '0.03em' }}>
                {password || '—'}
              </span>
              <button
                className="icon-btn result-copy"
                aria-label="复制密码"
                onClick={async () => {
                  if (await copyToClipboard(password)) toast('已复制密码');
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <button className="icon-btn result-copy" aria-label="重新生成" onClick={generate}>
                <RefreshCw style={{ width: 13, height: 13 }} />
              </button>
            </div>
            <div className="result-row">
              <span className="result-label">强度</span>
              <span className="result-value">
                {bits > 0 ? (
                  <>
                    <span
                      className={`status-chip ${bits >= 90 ? 'ok' : bits >= 60 ? 'info' : 'warn'}`}
                      style={{ marginRight: 10 }}
                    >
                      {strengthOf(bits)}
                    </span>
                    约 {bits} 位熵 · {length} 字符 · 字符池 {pool.length} 个
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="section-label" style={{ margin: 0 }}>长度 {length}</span>
            <input
              type="range"
              min={8}
              max={64}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              style={{ flex: 1, minWidth: 180, accentColor: 'var(--accent)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
            {(
              [
                ['lower', '小写字母 a-z'],
                ['upper', '大写字母 A-Z'],
                ['digits', '数字 0-9'],
                ['symbols', '符号 !@#$…'],
              ] as const
            ).map(([key, label]) => (
              <div className="popover-row" key={key} style={{ padding: 0 }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
                <Toggle
                  label={label}
                  checked={opts[key]}
                  onChange={(v) => setOpts((o) => ({ ...o, [key]: v }))}
                />
              </div>
            ))}
            <div className="popover-row" style={{ padding: 0 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>排除易混淆字符 (0O1lI)</span>
              <Toggle label="排除易混淆字符" checked={noAmbiguous} onChange={setNoAmbiguous} />
            </div>
          </div>
        </div>

        <div className="status-bar">
          <span>crypto.getRandomValues · 加密安全随机数</span>
          <div className="toolbar-spacer" />
          <span>本地生成</span>
        </div>
      </div>
    </ToolPage>
  );
}
