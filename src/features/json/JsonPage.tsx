import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { Copy, Eraser, FolderOpen, WrapText, Minimize2, Check, SlidersHorizontal, Braces, ClipboardPaste } from 'lucide-react';
import { createEditor, languageFor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { Popover } from '../../components/Popover';
import { Select } from '../../components/Select';
import { Toggle } from '../../components/Toggle';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { useSettings } from '../../app/settings';
import { copyToClipboard, readTextFile, pasteFromClipboard, FILE_ACCEPT_ATTR } from '../../utils/clipboard';
import { validateJson, formatJson, minifyJson, sortJsonKeys } from './jsonProcessor';
import type { JsonCheck, JsonIndent } from './jsonProcessor';
import { setJsonError, jsonErrorExtension } from '../diff/diffDecorations';

export default function JsonPage() {
  const { settings } = useSettings();
  const toast = useToast();

  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [indent, setIndent] = useState<JsonIndent>('2');
  const [sortEnabled, setSortEnabled] = useState(false);
  const [check, setCheck] = useState<JsonCheck | null>(null);
  const [stats, setStats] = useState<{ chars: number; lines: number }>({ chars: 0, lines: 0 });
  const [dragOver, setDragOver] = useState(false);

  const runCheck = useCallback((text: string) => {
    const result = validateJson(text);
    setCheck(result);
    setStats({ chars: text.length, lines: text === '' ? 0 : text.split('\n').length });
    const view = handleRef.current?.view;
    if (view) {
      view.dispatch({
        effects: setJsonError.of(result.ok ? null : { index: result.error.index }),
      });
    }
  }, []);

  const scheduleCheck = useCallback(() => {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = setTimeout(() => {
      const text = handleRef.current?.view.state.doc.toString() ?? '';
      runCheck(text);
    }, 250);
  }, [runCheck]);

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createEditor({
      parent: hostRef.current,
      doc: '',
      language: languageFor(null, ''),
      wordWrap: settings.wordWrap,
      tabSize: settings.tabSize,
      onChange: () => scheduleCheck(),
      extra: [jsonErrorExtension],
    });
    handleRef.current = handle;
    return () => {
      handle.view.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setWordWrap(settings.wordWrap);
    handleRef.current?.setTabSize(settings.tabSize);
  }, [settings.wordWrap, settings.tabSize]);

  const getText = () => handleRef.current?.view.state.doc.toString() ?? '';

  const applyText = useCallback((text: string) => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.view.dispatch({
      changes: { from: 0, to: handle.view.state.doc.length, insert: text },
      userEvent: 'input.paste',
    });
  }, []);

  const gotoError = useCallback((c: JsonCheck) => {
    if (c.ok) return;
    const view = handleRef.current?.view;
    if (view) {
      const line = Math.min(c.error.line, view.state.doc.lines);
      view.dispatch({
        effects: EditorView.scrollIntoView(view.state.doc.line(line).from, { y: 'center' }),
      });
      view.focus();
    }
  }, []);

  const onFailed = useCallback(
    (error: { message: string; line: number; column: number; index: number }) => {
      const c: JsonCheck = { ok: false, error };
      setCheck(c);
      const view = handleRef.current?.view;
      if (view) {
        view.dispatch({ effects: setJsonError.of({ index: error.index }) });
        gotoError(c);
      }
    },
    [gotoError],
  );

  const doFormat = () => {
    const result = formatJson(getText(), indent);
    if (result.ok) {
      if (sortEnabled) {
        const sorted = sortJsonKeys(result.text, indent);
        if (sorted.ok) {
          applyText(sorted.text);
          runCheck(sorted.text);
        }
      } else {
        applyText(result.text);
        runCheck(result.text);
      }
      toast(sortEnabled ? '已格式化并排序键名' : '已格式化');
    } else {
      onFailed(result.error);
    }
  };

  const doMinify = () => {
    const result = minifyJson(getText());
    if (result.ok) {
      applyText(result.text);
      runCheck(result.text);
      toast('已压缩');
    } else {
      onFailed(result.error);
    }
  };

  const doValidate = () => {
    const result = validateJson(getText());
    setCheck(result);
    if (result.ok) {
      toast('JSON 有效');
    } else {
      const view = handleRef.current?.view;
      if (view) {
        view.dispatch({ effects: setJsonError.of({ index: result.error.index }) });
        gotoError(result);
      }
    }
  };

  const doCopy = async () => {
    if (await copyToClipboard(getText())) toast('已复制');
  };

  const doClear = () => {
    applyText('');
    setCheck(null);
    setStats({ chars: 0, lines: 0 });
  };

  const doPaste = useCallback(async () => {
    const text = await pasteFromClipboard();
    if (text !== null && text !== '') {
      applyText(text);
      runCheck(text);
    } else {
      toast('剪贴板为空或无法读取');
    }
  }, [applyText, runCheck, toast]);

  const loadFile = (file: File) => {
    void readTextFile(file).then((text) => {
      handleRef.current?.setDoc(text);
      handleRef.current?.setLanguage(languageFor(file.name));
      runCheck(text);
    });
  };

  useEffect(() => {
    const onOpenEvent = () => fileInputRef.current?.click();
    document.addEventListener('dt-open-file', onOpenEvent);
    return () => document.removeEventListener('dt-open-file', onOpenEvent);
  }, []);

  return (
    <div
      className={`page ${dragOver ? 'dropping' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) loadFile(file);
      }}
    >
      <header className="page-header">
        <h1 className="page-title">JSON 格式化</h1>
        <p className="page-subtitle">格式化、压缩并检查 JSON 数据。</p>
      </header>

      <div className="page-content">
        <div className="diff-surface">
          <div className="toolbar" role="toolbar" aria-label="JSON 工具栏">
            <button className="btn btn-primary" onClick={doFormat}>
              <WrapText style={{ width: 14, height: 14 }} />
              格式化
            </button>
            <button className="btn btn-ghost" onClick={doMinify}>
              <Minimize2 style={{ width: 14, height: 14 }} />
              压缩
            </button>
            <button className="btn btn-ghost" onClick={doValidate}>
              <Check style={{ width: 14, height: 14 }} />
              校验
            </button>

            <div className="toolbar-spacer" />

            <Tooltip label="复制内容">
              <button className="icon-btn" aria-label="复制内容" onClick={doCopy}>
                <Copy />
              </button>
            </Tooltip>
            <Tooltip label="清空">
              <button className="icon-btn" aria-label="清空" onClick={doClear}>
                <Eraser />
              </button>
            </Tooltip>
            <Tooltip label="打开文件">
              <button className="icon-btn" aria-label="打开文件" onClick={() => fileInputRef.current?.click()}>
                <FolderOpen />
              </button>
            </Tooltip>

            <div className="toolbar-sep" />

            <Popover
              label="更多选项"
              trigger={
                <Tooltip label="更多选项">
                  <button className="icon-btn" aria-label="更多选项">
                    <SlidersHorizontal />
                  </button>
                </Tooltip>
              }
            >
              <div className="popover-title">选项</div>
              <div className="popover-row">
                <span>缩进</span>
                <Select<JsonIndent>
                  label="缩进"
                  value={indent}
                  options={[
                    { value: '2', label: '2 空格' },
                    { value: '4', label: '4 空格' },
                    { value: 'tab', label: 'Tab' },
                  ]}
                  onChange={setIndent}
                />
              </div>
              <div className="popover-row">
                <span>键名排序</span>
                <Toggle label="键名排序" checked={sortEnabled} onChange={setSortEnabled} />
              </div>
              <div className="popover-row" style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                开启后「格式化」会同时对键名排序
              </div>
            </Popover>
          </div>

          <div className="diff-body">
            <div className="pane">
              <div className="editor-host" ref={hostRef} />
              {stats.chars === 0 && (
                <div className="empty-state" aria-label="开始使用">
                  <div className="empty-icon-wrap">
                    <Braces className="empty-icon" />
                  </div>
                  <div className="empty-text">粘贴或输入 JSON，支持拖入 .json 文件</div>
                  <div className="empty-caption">所有内容仅在当前设备处理</div>
                  <div className="empty-actions">
                    <button className="btn btn-secondary" onClick={doPaste}>
                      <ClipboardPaste style={{ width: 14, height: 14 }} />
                      粘贴
                    </button>
                    <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                      <FolderOpen style={{ width: 14, height: 14 }} />
                      打开文件
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="status-bar">
            {check === null && <span>粘贴或输入 JSON，输入时自动校验</span>}
            {check?.ok && (
              <>
                <span className="status-ok">JSON 有效</span>
                <span className="dot">·</span>
                <span>{check.keys.toLocaleString()} 个键</span>
              </>
            )}
            {check && !check.ok && (
              <>
                <span className="status-error">
                  第 {check.error.line} 行，第 {check.error.column} 列：{check.error.message}
                </span>
                <button className="link-btn" onClick={() => gotoError(check)}>
                  跳到错误处
                </button>
              </>
            )}
            <div className="toolbar-spacer" />
            <span>UTF-8</span>
            <span className="dot">·</span>
            <span>{stats.lines} 行</span>
            <span className="dot">·</span>
            <span>本地处理</span>
          </div>
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
    </div>
  );
}
