import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, FolderOpen } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { createEditor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { md5HexBytes } from './md5';
import { FILE_ACCEPT_ATTR, formatBytes } from '../../utils/clipboard';

const ALGOS = [
  { id: 'MD5', label: 'MD5' },
  { id: 'SHA-1', label: 'SHA-1' },
  { id: 'SHA-256', label: 'SHA-256' },
  { id: 'SHA-512', label: 'SHA-512' },
] as const;

async function computeHashes(bytes: Uint8Array): Promise<Record<string, string>> {
  const out: Record<string, string> = { MD5: md5HexBytes(bytes) };
  for (const algo of ALGOS) {
    if (algo.id === 'MD5') continue;
    const digest = await crypto.subtle.digest(algo.id, bytes as unknown as ArrayBuffer);
    out[algo.id] = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return out;
}

export default function HashPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hashes, setHashes] = useState<Record<string, string> | null>(null);
  const [source, setSource] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recompute = useCallback(async (bytes: Uint8Array, label: string) => {
    const result = await computeHashes(bytes);
    setHashes(result);
    setSource(label);
  }, []);

  const scheduleRecompute = useCallback(
    (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void recompute(new TextEncoder().encode(text), `文本 · ${formatBytes(text.length)}`);
      }, 250);
    },
    [recompute],
  );

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createEditor({
      parent: hostRef.current,
      doc: '',
      onChange: (text) => scheduleRecompute(text),
    });
    handleRef.current = handle;
    return () => {
      handle.view.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFile = (file: File) => {
    void file.arrayBuffer().then((buf) => {
      handleRef.current?.view.dispatch({
        changes: { from: 0, to: handleRef.current!.view.state.doc.length, insert: '' },
      });
      void recompute(new Uint8Array(buf), `${file.name} · ${formatBytes(file.size)}`);
    });
  };

  return (
    <ToolPage title="Hash 计算" subtitle="对文本或文件计算 MD5 与 SHA 系列摘要，全部本地完成。">
      <div
        className="tool-surface jwt-input"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) loadFile(file);
        }}
      >
        <div className="toolbar" role="toolbar" aria-label="Hash 工具栏">
          <span className="summary-total" style={{ paddingLeft: 0 }}>输入文本或拖入文件 · 支持大文件</span>
          <div className="toolbar-spacer" />
          <Tooltip label="打开文件">
            <button className="icon-btn" aria-label="打开文件" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen />
            </button>
          </Tooltip>
          <Tooltip label="清空">
            <button
              className="icon-btn"
              aria-label="清空"
              onClick={() => {
                handleRef.current?.view.dispatch({
                  changes: { from: 0, to: handleRef.current!.view.state.doc.length, insert: '' },
                });
                setHashes(null);
                setSource('');
              }}
            >
              <Eraser />
            </button>
          </Tooltip>
        </div>

        <div className="diff-body" style={{ minHeight: 140 }}>
          <div className="pane">
            <div className="editor-host" ref={hostRef} />
          </div>
        </div>
      </div>

      <div style={{ height: 'var(--sp-5)' }} />

      <div className="tool-surface">
        <div className="tool-body">
          <div className="section-label">
            {hashes ? `输入源：${source}` : '输入内容后自动计算'}
          </div>
          {hashes && (
            <div className="result-list">
              {ALGOS.map((algo) => (
                <div className="result-row" key={algo.id}>
                  <span className="result-label">{algo.label}</span>
                  <span className="result-value">{hashes[algo.id]}</span>
                </div>
              ))}
            </div>
          )}
          {!hashes && (
            <div className="result-list">
              <div className="result-row">
                <span className="result-label">支持</span>
                <span className="result-value" style={{ color: 'var(--text-tertiary)' }}>
                  MD5 · SHA-1 · SHA-256 · SHA-512
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT_ATTR}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
          e.target.value = '';
        }}
      />
    </ToolPage>
  );
}
