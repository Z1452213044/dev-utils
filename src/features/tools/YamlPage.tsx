import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Copy, Eraser } from 'lucide-react';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { createEditor, languageFor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { copyToClipboard } from '../../utils/clipboard';

export default function YamlPage() {
  const toast = useToast();
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftHandle = useRef<EditorHandle | null>(null);
  const rightHandle = useRef<EditorHandle | null>(null);
  const rightTextRef = useRef('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;
    leftHandle.current = createEditor({
      parent: leftRef.current,
      doc: '',
      language: languageFor(null, '{'),
    });
    rightHandle.current = createEditor({ parent: rightRef.current, doc: '', readOnly: true });
    return () => {
      leftHandle.current?.view.destroy();
      rightHandle.current?.view.destroy();
    };
  }, []);

  const getLeft = () => leftHandle.current?.view.state.doc.toString() ?? '';

  const renderRight = (text: string) => {
    rightTextRef.current = text;
    rightHandle.current?.view.dispatch({
      changes: { from: 0, to: rightHandle.current.view.state.doc.length, insert: text },
    });
  };

  const jsonToYaml = () => {
    try {
      const parsed: unknown = JSON.parse(getLeft());
      renderRight(yamlDump(parsed, { indent: 2, lineWidth: -1, noRefs: true }));
      setStatus({ ok: true, text: '已转换' });
    } catch (err) {
      setStatus({ ok: false, text: 'JSON 无效：' + (err as Error).message.split('\n')[0] });
    }
  };

  const yamlToJson = () => {
    try {
      const parsed: unknown = yamlLoad(getLeft());
      renderRight(JSON.stringify(parsed, null, 2));
      setStatus({ ok: true, text: '已转换' });
    } catch (err) {
      setStatus({ ok: false, text: 'YAML 无效：' + (err as Error).message.split('\n')[0].slice(0, 120) });
    }
  };

  const doSwap = () => {
    leftHandle.current?.view.dispatch({
      changes: { from: 0, to: leftHandle.current.view.state.doc.length, insert: rightTextRef.current },
    });
    renderRight('');
    setStatus(null);
  };

  const doClear = () => {
    leftHandle.current?.view.dispatch({ changes: { from: 0, to: leftHandle.current.view.state.doc.length, insert: '' } });
    renderRight('');
    setStatus(null);
  };

  return (
    <ToolPage title="JSON ↔ YAML" subtitle="在 JSON 与 YAML 之间互相转换。">
      <div className="tool-surface reader">
        <div className="toolbar" role="toolbar" aria-label="YAML 工具栏">
          <button className="btn btn-primary" onClick={jsonToYaml}>JSON → YAML</button>
          <button className="btn btn-ghost" onClick={yamlToJson}>YAML → JSON</button>
          <div className="toolbar-spacer" />
          <Tooltip label="复制结果">
            <button
              className="icon-btn"
              aria-label="复制结果"
              onClick={async () => {
                if (await copyToClipboard(rightTextRef.current)) toast('已复制');
              }}
            >
              <Copy />
            </button>
          </Tooltip>
          <Tooltip label="结果放回输入框">
            <button className="icon-btn" aria-label="结果放回输入框" onClick={doSwap}>
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
              <div className="editor-host" ref={leftRef} />
            </div>
            <div className="splitter" />
            <div className="pane">
              <div className="pane-header"><span className="pane-title">输出</span></div>
              <div className="editor-host" ref={rightRef} />
            </div>
          </div>
        </div>

        <div className="status-bar">
          {status ? (
            <span className={status.ok ? 'status-ok' : 'status-error'}>{status.text}</span>
          ) : (
            <span>左侧输入 JSON 或 YAML，选择方向转换</span>
          )}
          <div className="toolbar-spacer" />
          <span>本地处理</span>
        </div>
      </div>
    </ToolPage>
  );
}
