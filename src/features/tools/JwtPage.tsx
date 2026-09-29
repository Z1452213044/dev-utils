import { useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, Copy } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useToast } from '../../components/Toast';
import {
  parseJwt,
  expiryState,
  claimTimeInfo,
  tokenTimeState,
  formatDuration,
  encodeJwt,
  signJwt,
  verifyJwtSignature,
  updateAlgInHeader,
  updateExpInPayload,
} from './jwtCodec';
import type { HsAlg, VerifyResult } from './jwtCodec';
import { createEditor, languageFor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { copyToClipboard } from '../../utils/clipboard';

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

type Mode = 'decode' | 'encode' | 'verify';

const HS_OPTIONS: { value: HsAlg; label: string }[] = [
  { value: 'HS256', label: 'HS256' },
  { value: 'HS384', label: 'HS384' },
  { value: 'HS512', label: 'HS512' },
];

const DEFAULT_HEADER = JSON.stringify({ alg: 'HS256', typ: 'JWT' }, null, 2);

function defaultPayload(): string {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({ sub: 'user123', iat: now, exp: now + 3600 }, null, 2);
}

/* ==================== 解析 ==================== */

function DecodePane() {
  const toast = useToast();
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const [token, setToken] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createEditor({
      parent: hostRef.current,
      doc: '',
      language: languageFor(null, ''),
      onChange: (text) => setToken(text),
    });
    handleRef.current = handle;
    return () => {
      handle.view.destroy();
      handleRef.current = null;
    };
  }, []);

  const parsed = useMemo(() => parseJwt(token), [token]);
  const expiry = parsed ? expiryState(parsed.payload) : 'none';
  const timeState = parsed ? tokenTimeState(parsed.payload, now) : 'active';
  const claims = parsed ? claimTimeInfo(parsed.payload, now) : [];

  // 状态含「剩余 xx」时每 30 秒刷新相对时间
  useEffect(() => {
    if (!parsed) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [parsed]);

  return (
    <>
      <div className="tool-surface jwt-input">
        <div className="toolbar" role="toolbar" aria-label="JWT 工具栏">
          <span className="summary-total" style={{ paddingLeft: 0 }}>粘贴完整的 JWT（三段式，以点分隔）</span>
          <div className="toolbar-spacer" />
          <Tooltip label="复制内容">
            <button
              className="icon-btn"
              aria-label="复制内容"
              onClick={async () => {
                if (parsed && (await copyToClipboard(prettyJson(parsed.payload)))) toast('已复制 Payload');
              }}
            >
              <Copy />
            </button>
          </Tooltip>
          <Tooltip label="清空">
            <button
              className="icon-btn"
              aria-label="清空"
              onClick={() => {
                handleRef.current?.view.dispatch({
                  changes: { from: 0, to: handleRef.current.view.state.doc.length, insert: '' },
                });
                setToken('');
              }}
            >
              <Eraser />
            </button>
          </Tooltip>
        </div>

        <div className="diff-body">
          <div className="pane">
            <div className="editor-host" ref={hostRef} />
          </div>
        </div>
      </div>

      <div style={{ height: 'var(--sp-5)' }} />

      {token.trim() !== '' && !parsed && (
        <div className="tool-surface">
          <div className="tool-body">
            <span className="status-error" style={{ fontSize: 13 }}>
              无法解析：请确认是「header.payload.signature」三段式的 Base64URL 字符串
            </span>
          </div>
        </div>
      )}

      {parsed && (
        <div className="tool-surface">
          <div className="tool-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <span className="section-label" style={{ margin: 0 }}>状态</span>
              {timeState === 'active' && (
                <span className="status-chip ok">
                  有效{typeof parsed.payload['exp'] === 'number' ? `（剩余 ${formatDuration(toMsOf(parsed.payload['exp']) - now)}）` : ''}
                </span>
              )}
              {timeState === 'expired' && <span className="status-chip warn">已过期</span>}
              {timeState === 'pending' && <span className="status-chip info">尚未生效</span>}
              {expiry === 'none' && <span className="status-chip info">无 exp 声明</span>}
              {typeof parsed.header['alg'] === 'string' && (
                <span className="status-chip info">算法 {String(parsed.header['alg'])}</span>
              )}
            </div>

            {claims.length > 0 && (
              <div className="result-list">
                {claims.map((c) => (
                  <div className="result-row" key={c.key}>
                    <span className="result-label">{c.key}</span>
                    <span className="result-value">{c.readable}</span>
                    <span
                      className="status-chip"
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        color: c.state === 'future' ? 'var(--accent-text)' : 'var(--text-secondary)',
                        background: 'var(--surface-inset)',
                      }}
                    >
                      {c.relative}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <div className="section-label">Header</div>
              <textarea className="tool-input" readOnly rows={Math.min(10, prettyJson(parsed.header).split('\n').length)} value={prettyJson(parsed.header)} />
            </div>

            <div>
              <div className="section-label">Payload</div>
              <textarea className="tool-input" readOnly rows={Math.min(14, prettyJson(parsed.payload).split('\n').length)} value={prettyJson(parsed.payload)} />
            </div>

            <div>
              <div className="section-label">签名（Base64URL，未验证；到「验证」页可校验签名）</div>
              <textarea className="tool-input" readOnly rows={2} value={parsed.signature} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function toMsOf(unix: number): number {
  return unix < 1e12 ? unix * 1000 : unix;
}

/* ==================== 生成 ==================== */

function EncodePane() {
  const toast = useToast();
  const headerHostRef = useRef<HTMLDivElement>(null);
  const payloadHostRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<EditorHandle | null>(null);
  const payloadRef = useRef<EditorHandle | null>(null);
  const headerTextRef = useRef(DEFAULT_HEADER);
  const payloadTextRef = useRef(defaultPayload());

  const [alg, setAlg] = useState<'none' | HsAlg>('HS256');
  const [secret, setSecret] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!headerHostRef.current || !payloadHostRef.current) return;
    const h = createEditor({
      parent: headerHostRef.current,
      doc: headerTextRef.current,
      language: languageFor(null, ''),
      onChange: (t) => (headerTextRef.current = t),
    });
    const p = createEditor({
      parent: payloadHostRef.current,
      doc: payloadTextRef.current,
      language: languageFor(null, ''),
      onChange: (t) => (payloadTextRef.current = t),
    });
    headerRef.current = h;
    payloadRef.current = p;
    return () => {
      h.view.destroy();
      p.view.destroy();
      headerRef.current = null;
      payloadRef.current = null;
    };
  }, []);

  const changeAlg = (next: 'none' | HsAlg) => {
    setAlg(next);
    const updated = updateAlgInHeader(headerTextRef.current, next);
    headerTextRef.current = updated;
    headerRef.current?.view.dispatch({
      changes: { from: 0, to: headerRef.current.view.state.doc.length, insert: updated },
    });
  };

  const bumpExp = (seconds: number) => {
    const updated = updateExpInPayload(payloadTextRef.current, seconds);
    payloadTextRef.current = updated;
    payloadRef.current?.view.dispatch({
      changes: { from: 0, to: payloadRef.current.view.state.doc.length, insert: updated },
    });
  };

  const doEncode = async () => {
    setError('');
    let headerObj: Record<string, unknown>;
    let payloadObj: Record<string, unknown>;
    try {
      headerObj = JSON.parse(headerTextRef.current);
    } catch (e) {
      setError('Header 不是合法 JSON：' + (e as Error).message);
      return;
    }
    try {
      payloadObj = JSON.parse(payloadTextRef.current);
    } catch (e) {
      setError('Payload 不是合法 JSON：' + (e as Error).message);
      return;
    }
    headerObj['alg'] = alg;
    const headerJson = JSON.stringify(headerObj);
    const payloadJson = JSON.stringify(payloadObj);
    if (alg === 'none') {
      setOutput(encodeJwt(headerJson, payloadJson));
      return;
    }
    if (secret === '') {
      setError('选择签名算法后需要填写 Secret 密钥（或把算法切换为「仅编码」）');
      return;
    }
    const token = await signJwt(headerJson, payloadJson, secret, alg);
    setOutput(token);
  };

  return (
    <>
      <div className="tool-surface jwt-input">
        <div className="toolbar" role="toolbar" aria-label="JWT 生成工具栏">
          <SegmentedControl<'none' | HsAlg>
            ariaLabel="签名算法"
            value={alg}
            onChange={changeAlg}
            options={[
              { value: 'none', label: '仅编码' },
              ...HS_OPTIONS,
            ]}
          />
          <div className="toolbar-spacer" />
          <Tooltip label="清空">
            <button
              className="icon-btn"
              aria-label="清空"
              onClick={() => {
                headerTextRef.current = DEFAULT_HEADER;
                payloadTextRef.current = defaultPayload();
                headerRef.current?.setDoc(DEFAULT_HEADER);
                payloadRef.current?.setDoc(defaultPayload());
                setOutput('');
                setError('');
              }}
            >
              <Eraser />
            </button>
          </Tooltip>
        </div>

        <div className="tool-body" style={{ paddingBottom: 0 }}>
          {alg === 'none' && (
            <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
              仅编码：token 以空签名结尾（header.payload.），仅供调试，生产环境请勿使用
            </span>
          )}
          {alg !== 'none' && (
            <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Secret</span>
              <input
                type="password"
                className="tool-input"
                style={{ flex: 1, minWidth: 200 }}
                placeholder="签名密钥（不会保存在本页之外）"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>exp 快捷填充</span>
            {[
              { label: '1 小时', sec: 3600 },
              { label: '1 天', sec: 86400 },
              { label: '7 天', sec: 7 * 86400 },
              { label: '30 天', sec: 30 * 86400 },
            ].map((o) => (
              <button key={o.sec} className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => bumpExp(o.sec)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tool-body">
          <div>
            <div className="section-label">Header</div>
            <div className="encode-editor" ref={headerHostRef} />
          </div>
          <div>
            <div className="section-label">Payload</div>
            <div className="encode-editor" ref={payloadHostRef} />
          </div>
          {error && <span className="status-error" style={{ fontSize: 12.5 }}>{error}</span>}
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={doEncode}>
              {alg === 'none' ? '生成（不签名）' : `生成并签名（${alg}）`}
            </button>
            <Tooltip label="复制 token">
              <button className="icon-btn" aria-label="复制 token" disabled={!output} onClick={async () => {
                if (await copyToClipboard(output)) toast('已复制 token');
              }}>
                <Copy />
              </button>
            </Tooltip>
          </div>
          <div>
            <div className="section-label">JWT 输出</div>
            <textarea className="tool-input" readOnly rows={4} value={output} placeholder="生成的 token 将显示在这里" />
          </div>
        </div>
      </div>
    </>
  );
}

/* ==================== 验证 ==================== */

function VerifyPane() {
  const hostRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<EditorHandle | null>(null);
  const tokenTextRef = useRef('');
  const [secret, setSecret] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const h = createEditor({
      parent: hostRef.current,
      doc: '',
      language: languageFor(null, ''),
      onChange: (t) => (tokenTextRef.current = t),
    });
    tokenRef.current = h;
    return () => {
      h.view.destroy();
      tokenRef.current = null;
    };
  }, []);

  const doVerify = async () => {
    setResult(null);
    const r = await verifyJwtSignature(tokenTextRef.current, secret);
    setResult(r);
  };

  return (
    <>
      <div className="tool-surface jwt-input">
        <div className="toolbar" role="toolbar" aria-label="JWT 验证工具栏">
          <span className="summary-total" style={{ paddingLeft: 0 }}>
            粘贴 JWT，输入 Secret 后验证 HMAC 签名（HS256/384/512）
          </span>
          <div className="toolbar-spacer" />
          <Tooltip label="清空">
            <button
              className="icon-btn"
              aria-label="清空"
              onClick={() => {
                tokenRef.current?.setDoc('');
                setSecret('');
                setResult(null);
              }}
            >
              <Eraser />
            </button>
          </Tooltip>
        </div>

        <div className="tool-body" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Secret</span>
            <input
              type="password"
              className="tool-input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="与签发时相同的密钥"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <button className="btn btn-primary" onClick={doVerify}>验证签名</button>
          </div>
        </div>

        <div className="diff-body">
          <div className="pane">
            <div className="editor-host" ref={hostRef} />
          </div>
        </div>
      </div>

      {result && (
        <>
          <div style={{ height: 'var(--sp-5)' }} />
          <div className={`verify-banner ${result.ok ? 'ok' : 'err'}`} role="status">
            {result.ok ? '✓ 签名有效' : '✗ 签名无效'}
            {result.ok && result.alg && <span className="verify-detail">算法 {result.alg} · 密钥匹配</span>}
            {!result.ok && result.reason && <span className="verify-detail">{result.reason}</span>}
          </div>
          <div style={{ height: 'var(--sp-3)' }} />
          <div className="tool-surface">
            <div className="tool-body">
              <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                签名验证与解析相互独立：签名无效的 token 依然可以被解析查看内容，但不应被信任。
                RS256/384/512、ES256 等公私钥算法暂未支持，后续加入。
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ==================== 页面 ==================== */

export default function JwtPage() {
  const [mode, setMode] = useState<Mode>('decode');

  return (
    <ToolPage title="JWT 工具" subtitle="解析、生成与签名验证。所有计算仅在本地完成，Secret 不会离开当前页面。">
      <div className="tool-surface" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="tool-body" style={{ padding: 'var(--sp-3) var(--sp-5)' }}>
          <SegmentedControl<Mode>
            ariaLabel="JWT 模式"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'decode', label: '解析' },
              { value: 'encode', label: '生成' },
              { value: 'verify', label: '验证' },
            ]}
          />
        </div>
      </div>

      {mode === 'decode' && <DecodePane />}
      {mode === 'encode' && <EncodePane />}
      {mode === 'verify' && <VerifyPane />}
    </ToolPage>
  );
}
