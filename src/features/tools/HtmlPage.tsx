import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Eraser, FolderOpen, RefreshCw } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { createEditor, languageFor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { copyToClipboard, readTextFile, FILE_ACCEPT_ATTR } from '../../utils/clipboard';

export default function HtmlPage() {
  const toast = useToast();
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [wrap, setWrap] = useState(true);
  const [fitWidth, setFitWidth] = useState(true);
  const [empty, setEmpty] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRefreshRef = useRef(autoRefresh);
  autoRefreshRef.current = autoRefresh;
  const fitWidthRef = useRef(fitWidth);
  fitWidthRef.current = fitWidth;
  const pendingSrcRef = useRef<string | null>(null);

  const fitFrame = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.documentElement) return;
      const root = doc.documentElement;
      if (!fitWidthRef.current) {
        root.style.zoom = '';
        return;
      }
      const containerWidth = frame.clientWidth;
      const contentWidth = Math.max(
        doc.documentElement.scrollWidth,
        doc.body?.scrollWidth ?? 0,
      );
      if (contentWidth > containerWidth && contentWidth > 0) {
        root.style.zoom = String(containerWidth / contentWidth);
      } else {
        root.style.zoom = '';
      }
    } catch {
      /* sandbox 隔离时忽略 */
    }
  }, []);

  const applyPreview = useCallback(
    (src: string) => {
      if (!frameRef.current) return;
      frameRef.current.srcdoc = src;
      // srcdoc 加载完成后执行适配
      pendingSrcRef.current = src;
    },
    [],
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onLoad = () => {
      // 等一帧让布局稳定后再测量
      requestAnimationFrame(() => fitFrame());
    };
    frame.addEventListener('load', onLoad);
    return () => frame.removeEventListener('load', onLoad);
  }, [fitFrame]);

  useEffect(() => {
    fitFrame();
  }, [fitWidth, fitFrame]);

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createEditor({
      parent: hostRef.current,
      doc: '',
      language: languageFor('sample.html'),
      wordWrap: true,
      onChange: (text) => {
        setEmpty(text.trim() === '');
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          if (autoRefreshRef.current) applyPreview(text);
        }, 400);
      },
    });
    handleRef.current = handle;
    return () => {
      handle.view.destroy();
      handleRef.current = null;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setWordWrap(wrap);
  }, [wrap]);

  const doRefresh = () => {
    applyPreview(handleRef.current?.view.state.doc.toString() ?? '');
  };

  const doClear = () => {
    handleRef.current?.setDoc('');
    setFileName(null);
    applyPreview('');
  };

  const loadFile = (file: File) => {
    void readTextFile(file).then((text) => {
      handleRef.current?.setDoc(text);
      handleRef.current?.setLanguage(languageFor(file.name));
      setFileName(file.name);
      setEmpty(text.trim() === '');
      applyPreview(text);
    });
  };

  useEffect(() => {
    const onOpenEvent = () => fileInputRef.current?.click();
    document.addEventListener('dt-open-file', onOpenEvent);
    return () => document.removeEventListener('dt-open-file', onOpenEvent);
  }, []);

  return (
    <ToolPage title="HTML 预览" subtitle="左侧编辑或拖入 .html 文件，右侧沙箱渲染，脚本不会执行。">
      <div
        className="tool-surface reader"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) loadFile(file);
        }}
      >
        <div className="toolbar" role="toolbar" aria-label="HTML 工具栏">
          <button className="btn btn-ghost" onClick={doRefresh}>
            <RefreshCw style={{ width: 14, height: 14 }} />
            刷新预览
          </button>
          <button
            className={`btn btn-ghost ${autoRefresh ? 'btn-toggle-on' : ''}`}
            onClick={() => setAutoRefresh((v) => !v)}
            aria-pressed={autoRefresh}
          >
            自动刷新：{autoRefresh ? '开' : '关'}
          </button>
          <button
            className={`btn btn-ghost ${wrap ? 'btn-toggle-on' : ''}`}
            onClick={() => setWrap((v) => !v)}
            aria-pressed={wrap}
          >
            换行：{wrap ? '开' : '关'}
          </button>
          <button
            className={`btn btn-ghost ${fitWidth ? 'btn-toggle-on' : ''}`}
            onClick={() => setFitWidth((v) => !v)}
            aria-pressed={fitWidth}
          >
            适配宽度：{fitWidth ? '开' : '关'}
          </button>
          {fileName && <span className="summary-total">{fileName}</span>}
          <div className="toolbar-spacer" />
          <Tooltip label="复制源码">
            <button
              className="icon-btn"
              aria-label="复制源码"
              onClick={async () => {
                const src = handleRef.current?.view.state.doc.toString() ?? '';
                if (await copyToClipboard(src)) toast('已复制');
              }}
            >
              <Copy />
            </button>
          </Tooltip>
          <Tooltip label="打开文件">
            <button className="icon-btn" aria-label="打开文件" onClick={() => fileInputRef.current?.click()}>
              <FolderOpen />
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
              <div className="pane-header"><span className="pane-title">HTML 源码</span></div>
              <div className="editor-host" ref={hostRef} />
            </div>
            <div className="splitter" />
            <div className="pane">
              <div className="pane-header"><span className="pane-title">预览（沙箱）</span></div>
              <div className="editor-host html-preview-host">
                <iframe
                  ref={frameRef}
                  title="HTML 预览"
                  sandbox="allow-same-origin"
                  className="html-preview-frame"
                />
                {empty && <div className="html-empty">拖入 .html 文件，或在左侧直接输入</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="status-bar">
          <span>sandbox 隔离 · 脚本不执行{fitWidth ? ' · 适配宽度' : ''}</span>
          <div className="toolbar-spacer" />
          <span>本地渲染</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT_ATTR + ',.html,.htm'}
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
