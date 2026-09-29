import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Copy, Eraser } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { createEditor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { copyToClipboard } from '../../utils/clipboard';

export function escapeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function unescapeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => named[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

export function escapeUnicode(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code < 128) {
      out += ch;
    } else if (code > 0xffff) {
      // 代理对拆分
      const hi = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const lo = ((code - 0x10000) % 0x400) + 0xdc00;
      out += '\\u' + hi.toString(16).padStart(4, '0') + '\\u' + lo.toString(16).padStart(4, '0');
    } else {
      out += '\\u' + code.toString(16).padStart(4, '0');
    }
  }
  return out;
}

export function unescapeUnicode(text: string): string {
  return text.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, braced, plain) =>
    String.fromCodePoint(parseInt(braced ?? plain, 16)),
  );
}

type Action = 'escHtml' | 'unescHtml' | 'escUni' | 'unescUni';

export default function EscapePage() {
  const toast = useToast();
  const inRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const inHandle = useRef<EditorHandle | null>(null);
  const outHandle = useRef<EditorHandle | null>(null);
  const outTextRef = useRef('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!inRef.current || !outRef.current) return;
    inHandle.current = createEditor({ parent: inRef.current, doc: '' });
    outHandle.current = createEditor({ parent: outRef.current, doc: '', readOnly: true });
    return () => {
      inHandle.current?.view.destroy();
      outHandle.current?.view.destroy();
    };
  }, []);

  const getInput = () => inHandle.current?.view.state.doc.toString() ?? '';

  const renderOut = (text: string) => {
    outTextRef.current = text;
    outHandle.current?.view.dispatch({
      changes: { from: 0, to: outHandle.current.view.state.doc.length, insert: text },
    });
  };

  const run = (action: Action) => {
    const input = getInput();
    try {
      switch (action) {
        case 'escHtml':
          renderOut(escapeHtmlEntities(input));
          setStatus('已转义 HTML 实体');
          break;
        case 'unescHtml':
          renderOut(unescapeHtmlEntities(input));
          setStatus('已反转义 HTML 实体');
          break;
        case 'escUni':
          renderOut(escapeUnicode(input));
          setStatus('已转义为 Unicode（\\uXXXX）');
          break;
        case 'unescUni':
          renderOut(unescapeUnicode(input));
          setStatus('已反转义 Unicode');
          break;
      }
    } catch (err) {
      setStatus('转换失败：' + (err as Error).message);
    }
  };

  const doClear = () => {
    inHandle.current?.view.dispatch({ changes: { from: 0, to: inHandle.current.view.state.doc.length, insert: '' } });
    renderOut('');
    setStatus('');
  };

  return (
    <ToolPage title="HTML / Unicode 转义" subtitle="HTML 实体与 Unicode（\\uXXXX）转义、反转义。">
      <div className="tool-surface reader">
        <div className="toolbar" role="toolbar" aria-label="转义工具栏">
          <button className="btn btn-primary" onClick={() => run('escHtml')}>HTML 转义</button>
          <button className="btn btn-ghost" onClick={() => run('unescHtml')}>HTML 反转义</button>
          <div className="toolbar-sep" />
          <button className="btn btn-primary" onClick={() => run('escUni')}>Unicode 转义</button>
          <button className="btn btn-ghost" onClick={() => run('unescUni')}>Unicode 反转义</button>
          <div className="toolbar-spacer" />
          <Tooltip label="复制结果">
            <button
              className="icon-btn"
              aria-label="复制结果"
              onClick={async () => {
                if (await copyToClipboard(outTextRef.current)) toast('已复制');
              }}
            >
              <Copy />
            </button>
          </Tooltip>
          <Tooltip label="结果放回输入框">
            <button
              className="icon-btn"
              aria-label="结果放回输入框"
              onClick={() => {
                inHandle.current?.view.dispatch({
                  changes: { from: 0, to: inHandle.current.view.state.doc.length, insert: outTextRef.current },
                });
                renderOut('');
                setStatus('');
              }}
            >
              <ArrowLeftRight />
            </button>
          </Tooltip>
          <Tooltip label="清空">
            <button className="icon-btn" aria-label="清空" onClick={doClear}>
              <Eraser />
            </button>
          </Tooltip>
        </div>

        <div className="diff-body">
          <div className="diff-split">
            <div className="pane">
              <div className="pane-header"><span className="pane-title">输入</span></div>
              <div className="editor-host" ref={inRef} />
            </div>
            <div className="splitter" />
            <div className="pane">
              <div className="pane-header"><span className="pane-title">输出</span></div>
              <div className="editor-host" ref={outRef} />
            </div>
          </div>
        </div>

        <div className="status-bar">
          <span>{status || '输入内容后选择转换方向'}</span>
          <div className="toolbar-spacer" />
          <span>本地处理</span>
        </div>
      </div>
    </ToolPage>
  );
}
