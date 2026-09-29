import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Copy, Eraser } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { createEditor, languageFor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { copyToClipboard } from '../../utils/clipboard';
import { encodeBase64, decodeBase64, isValidBase64 } from './base64Codec';

export default function Base64Page() {
  const toast = useToast();
  const [urlSafe, setUrlSafe] = useState(false);
  const inRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const inHandle = useRef<EditorHandle | null>(null);
  const outHandle = useRef<EditorHandle | null>(null);
  const [status, setStatus] = useState('');
  const outTextRef = useRef('');

  useEffect(() => {
    if (!inRef.current || !outRef.current) return;
    inHandle.current = createEditor({ parent: inRef.current, doc: '', language: languageFor(null, '') });
    outHandle.current = createEditor({
      parent: outRef.current,
      doc: '',
      readOnly: true,
      language: languageFor(null, ''),
    });
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
      renderOut(encodeBase64(getInput(), urlSafe));
      setStatus('已编码');
    } catch {
      setStatus('编码失败');
    }
  };

  const doDecode = () => {
    const input = getInput().trim();
    if (!isValidBase64(input)) {
      setStatus('不是有效的 Base64 内容');
      return;
    }
    try {
      renderOut(decodeBase64(input));
      setStatus('已解码');
    } catch {
      setStatus('解码失败：内容不完整或包含非法字符');
    }
  };

  const doSwap = () => {
    const out = outTextRef.current;
    inHandle.current?.view.dispatch({
      changes: { from: 0, to: inHandle.current.view.state.doc.length, insert: out },
    });
    renderOut('');
    setStatus('');
  };

  const doClear = () => {
    inHandle.current?.view.dispatch({ changes: { from: 0, to: inHandle.current.view.state.doc.length, insert: '' } });
    renderOut('');
    setStatus('');
  };

  return (
    <ToolPage title="Base64" subtitle="文本与 Base64 互相转换，支持 UTF-8 与 URL 安全变体。">
      <div className="tool-surface reader">
        <div className="toolbar" role="toolbar" aria-label="Base64 工具栏">
          <button className="btn btn-primary" onClick={doEncode}>编码</button>
          <button className="btn btn-ghost" onClick={doDecode}>解码</button>
          <button
            className={`btn btn-ghost \${urlSafe ? 'btn-toggle-on' : ''}`}
            onClick={() => setUrlSafe((v) => !v)}
            aria-pressed={urlSafe}
          >
            URL 安全：{urlSafe ? '开' : '关'}
          </button>
          <div className="toolbar-spacer" />
          <Tooltip label="把结果放回输入框">
            <button className="icon-btn" aria-label="把结果放回输入框" onClick={doSwap}>
              <ArrowLeftRight />
            </button>
          </Tooltip>
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

        <div className="status-bar">
          <span>{status || '输入内容后点击「编码」或「解码」'}</span>
          <div className="toolbar-spacer" />
          <span>UTF-8</span>
          <span className="dot">·</span>
          <span>本地处理</span>
        </div>
      </div>
    </ToolPage>
  );
}
