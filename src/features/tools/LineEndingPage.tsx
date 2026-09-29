import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Eraser } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { createEditor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { copyToClipboard } from '../../utils/clipboard';

export type LineEnding = 'LF' | 'CRLF' | 'CR' | 'mixed';

export function detectLineEnding(text: string): LineEnding | null {
  if (text === '') return null;
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/(?<!\r)\n/g) || []).length;
  const cr = (text.match(/\r(?!\n)/g) || []).length;
  const active = [crlf > 0 && 'CRLF', lf > 0 && 'LF', cr > 0 && 'CR'].filter(Boolean) as string[];
  if (active.length === 0) return 'LF';
  if (active.length === 1) return active[0] as LineEnding;
  return 'mixed';
}

export function convertLineEnding(text: string, to: 'LF' | 'CRLF' | 'CR'): string {
  const unified = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (to === 'LF') return unified;
  if (to === 'CRLF') return unified.replace(/\n/g, '\r\n');
  return unified.replace(/\n/g, '\r');
}

export function countEndings(text: string): { crlf: number; lf: number; cr: number } {
  return {
    crlf: (text.match(/\r\n/g) || []).length,
    lf: (text.match(/(?<!\r)\n/g) || []).length,
    cr: (text.match(/\r(?!\n)/g) || []).length,
  };
}

export default function LineEndingPage() {
  const toast = useToast();
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createEditor({
      parent: hostRef.current,
      doc: '',
      onChange: (t) => setText(t),
    });
    handleRef.current = handle;
    return () => {
      handle.view.destroy();
      handleRef.current = null;
    };
  }, []);

  const apply = useCallback(
    (to: 'LF' | 'CRLF' | 'CR') => {
      const handle = handleRef.current;
      if (!handle) return;
      const next = convertLineEnding(handle.view.state.doc.toString(), to);
      if (next === handle.view.state.doc.toString()) {
        setStatus('行尾已符合目标格式');
        return;
      }
      handle.view.dispatch({
        changes: { from: 0, to: handle.view.state.doc.length, insert: next },
        userEvent: 'input.change',
      });
      setText(next);
      setStatus(`已统一为 ${to}`);
    },
    [],
  );

  const doClear = () => {
    handleRef.current?.view.dispatch({
      changes: { from: 0, to: handleRef.current!.view.state.doc.length, insert: '' },
    });
    setText('');
    setStatus('');
  };

  const counts = countEndings(text);
  const detected = detectLineEnding(text);
  const total = counts.crlf + counts.lf + counts.cr;

  return (
    <ToolPage title="换行符转换" subtitle="检测并统一 LF / CRLF / CR 行尾，解决跨平台换行问题。">
      <div className="tool-surface">
        <div className="toolbar" role="toolbar" aria-label="换行符工具栏">
          <button className="btn btn-primary" onClick={() => apply('LF')} disabled={text === ''}>
            统一为 LF
          </button>
          <button className="btn btn-ghost" onClick={() => apply('CRLF')} disabled={text === ''}>
            统一为 CRLF
          </button>
          <button className="btn btn-ghost" onClick={() => apply('CR')} disabled={text === ''}>
            统一为 CR
          </button>
          <div className="toolbar-spacer" />
          <Tooltip label="复制内容">
            <button
              className="icon-btn"
              aria-label="复制内容"
              onClick={async () => {
                if (await copyToClipboard(text)) toast('已复制');
              }}
            >
              <Copy />
            </button>
          </Tooltip>
          <Tooltip label="清空">
            <button className="icon-btn" aria-label="清空" onClick={doClear}>
              <Eraser />
            </button>
          </Tooltip>
        </div>

        <div className="diff-body" style={{ minHeight: 240 }}>
          <div className="pane">
            <div className="editor-host" ref={hostRef} />
          </div>
        </div>

        <div className="status-bar">
          <span>
            {text === ''
              ? '粘贴文本或拖入文件，自动检测行尾'
              : detected === 'mixed'
                ? `检测到混合行尾：CRLF ${counts.crlf} · LF ${counts.lf} · CR ${counts.cr}`
                : `检测到 ${detected} · 共 ${total} 行`}
          </span>
          <div className="toolbar-spacer" />
          {status && <span className="status-ok">{status}</span>}
          <span>本地处理</span>
        </div>
      </div>
    </ToolPage>
  );
}
