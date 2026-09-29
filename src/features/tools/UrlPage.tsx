import { useEffect, useRef, useState } from 'react';
import { Copy, Eraser } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { createEditor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { copyToClipboard } from '../../utils/clipboard';

interface QueryParam {
  key: string;
  value: string;
}

function parseQueryParams(text: string): QueryParam[] {
  const out: QueryParam[] = [];
  const queryStart = text.indexOf('?');
  const query = queryStart >= 0 ? text.slice(queryStart + 1) : text.includes('=') ? text : '';
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq >= 0 ? pair.slice(0, eq) : pair;
    const rawValue = eq >= 0 ? pair.slice(eq + 1) : '';
    try {
      out.push({
        key: decodeURIComponent(rawKey.replace(/\+/g, ' ')),
        value: decodeURIComponent(rawValue.replace(/\+/g, ' ')),
      });
    } catch {
      out.push({ key: rawKey, value: rawValue });
    }
  }
  return out;
}

export default function UrlPage() {
  const toast = useToast();
  const inRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const inHandle = useRef<EditorHandle | null>(null);
  const outHandle = useRef<EditorHandle | null>(null);
  const outTextRef = useRef('');
  const [status, setStatus] = useState('');
  const [params, setParams] = useState<QueryParam[] | null>(null);

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

  const doEncode = () => {
    try {
      renderOut(encodeURIComponent(getInput()));
      setParams(null);
      setStatus('已编码');
    } catch {
      setStatus('编码失败');
    }
  };

  const doDecode = () => {
    try {
      const input = getInput().trim();
      const decoded = decodeURIComponent(input.replace(/\+/g, ' '));
      renderOut(decoded);
      setParams(input.includes('=') ? parseQueryParams(input) : null);
      setStatus('已解码');
    } catch {
      setStatus('解码失败：包含无效的百分号编码');
    }
  };

  const doClear = () => {
    inHandle.current?.view.dispatch({ changes: { from: 0, to: inHandle.current.view.state.doc.length, insert: '' } });
    renderOut('');
    setParams(null);
    setStatus('');
  };

  return (
    <ToolPage title="URL 编解码" subtitle="URL 编码与解码，自动拆解查询参数。">
      <div className="tool-surface reader">
        <div className="toolbar" role="toolbar" aria-label="URL 工具栏">
          <button className="btn btn-primary" onClick={doEncode}>编码</button>
          <button className="btn btn-ghost" onClick={doDecode}>解码</button>
          <div className="toolbar-spacer" />
          <Tooltip label="复制内容">
            <button
              className="icon-btn"
              aria-label="复制内容"
              onClick={async () => {
                if (await copyToClipboard(outTextRef.current)) toast('已复制');
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

        {params !== null && params.length > 0 && (
          <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderTop: '1px solid var(--border)' }}>
            <div className="section-label">查询参数</div>
            <table className="kv-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>参数名</th>
                  <th>值</th>
                </tr>
              </thead>
              <tbody>
                {params.map((p, i) => (
                  <tr key={i}>
                    <td>{p.key}</td>
                    <td>{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="status-bar">
          <span>{status || '输入内容后点击「编码」或「解码」'}</span>
          <div className="toolbar-spacer" />
          <span>本地处理</span>
        </div>
      </div>
    </ToolPage>
  );
}
