import { useCallback, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Copy, Eraser, FolderOpen } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { createEditor, languageFor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { copyToClipboard, readTextFile, FILE_ACCEPT_ATTR } from '../../utils/clipboard';
import { isMermaidLang, mermaidPlaceholderHtml, renderMermaidBlocks } from './mermaidSupport';

// ```mermaid 代码块 → 占位 div（DOMPurify 安全链路不变，SVG 在预览阶段懒加载渲染）
const baseRenderer = new marked.Renderer();
const fallbackCodeRenderer = baseRenderer.code.bind(baseRenderer);
baseRenderer.code = (token) => {
  if (isMermaidLang(token.lang)) return mermaidPlaceholderHtml(token.text);
  return fallbackCodeRenderer(token);
};

marked.setOptions({ breaks: true, gfm: true, renderer: baseRenderer });

export function renderMarkdown(src: string): string {
  const html = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(html, { FORBID_TAGS: ['style'], FORBID_ATTR: ['style'] });
}

export default function MarkdownPage() {
  const toast = useToast();
  const hostRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncingRef = useRef(false);
  const mermaidTimerRef = useRef<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [empty, setEmpty] = useState(true);

  // 打字过程中不逐帧渲染图表，停手 300ms 后再画
  const scheduleMermaid = useCallback((root: HTMLElement | null) => {
    if (mermaidTimerRef.current !== null) window.clearTimeout(mermaidTimerRef.current);
    mermaidTimerRef.current = window.setTimeout(() => {
      mermaidTimerRef.current = null;
      void renderMermaidBlocks(root);
    }, 300);
  }, []);

  const renderPreview = useCallback(
    (src: string) => {
      const html = renderMarkdown(src);
      const preview = previewRef.current;
      if (preview) {
        preview.innerHTML = html;
        scheduleMermaid(preview);
      }
      setEmpty(src.trim() === '');
    },
    [scheduleMermaid],
  );

  // 主题切换后按新配色重画图
  useEffect(() => {
    const root = document.documentElement;
    let last = root.getAttribute('data-theme');
    const observer = new MutationObserver(() => {
      const now = root.getAttribute('data-theme');
      if (now === last) return;
      last = now;
      scheduleMermaid(previewRef.current);
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [scheduleMermaid]);

  useEffect(
    () => () => {
      if (mermaidTimerRef.current !== null) window.clearTimeout(mermaidTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createEditor({
      parent: hostRef.current,
      doc: '',
      language: languageFor('sample.md'),
      wordWrap: true,
      onChange: (text) => renderPreview(text),
    });
    handleRef.current = handle;
    renderPreview('');
    return () => {
      handle.view.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 源码滚动 → 预览按比例同步
  const onSourceScroll = () => {
    if (syncingRef.current) return;
    const view = handleRef.current?.view;
    const scroller = view?.scrollDOM;
    const preview = previewRef.current;
    if (!scroller || !preview) return;
    const ratio = scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    syncingRef.current = true;
    preview.parentElement!.scrollTop = ratio * (preview.parentElement!.scrollHeight - preview.parentElement!.clientHeight);
    requestAnimationFrame(() => (syncingRef.current = false));
  };

  useEffect(() => {
    const view = handleRef.current?.view;
    if (!view) return;
    view.scrollDOM.addEventListener('scroll', onSourceScroll, { passive: true });
    return () => view.scrollDOM.removeEventListener('scroll', onSourceScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRef.current]);

  const doClear = () => {
    handleRef.current?.setDoc('');
    setFileName(null);
  };

  const loadFile = (file: File) => {
    void readTextFile(file).then((text) => {
      handleRef.current?.setDoc(text);
      handleRef.current?.setLanguage(languageFor(file.name));
      setFileName(file.name);
    });
  };

  useEffect(() => {
    const onOpenEvent = () => fileInputRef.current?.click();
    document.addEventListener('dt-open-file', onOpenEvent);
    return () => document.removeEventListener('dt-open-file', onOpenEvent);
  }, []);

  return (
    <ToolPage title="Markdown 阅读" subtitle="左侧编辑或拖入 .md 文件，右侧实时渲染阅读视图。">
      <div
        className="tool-surface reader"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) loadFile(file);
        }}
      >
        <div className="toolbar" role="toolbar" aria-label="Markdown 工具栏">
          <span className="summary-total" style={{ paddingLeft: 0 }}>
            {fileName ?? '未打开文件'}
          </span>
          <div className="toolbar-spacer" />
          <Tooltip label="复制 HTML">
            <button
              className="icon-btn"
              aria-label="复制 HTML"
              onClick={async () => {
                const html = renderMarkdown(handleRef.current?.view.state.doc.toString() ?? '');
                if (await copyToClipboard(html)) toast('已复制 HTML');
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
              <div className="pane-header">
                <span className="pane-title">Markdown 源码</span>
              </div>
              <div className="editor-host" ref={hostRef} />
            </div>
            <div className="splitter" />
            <div className="pane">
              <div className="pane-header">
                <span className="pane-title">阅读预览</span>
              </div>
              <div className="editor-host md-preview-host">
                <div className="md-preview" ref={previewRef} />
                {empty && <div className="md-empty">开始输入或拖入 .md 文件</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="status-bar">
          <span>GFM · Mermaid 图 · 安全过滤（脚本不执行）</span>
          <div className="toolbar-spacer" />
          <span>本地渲染</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT_ATTR + ',.md,.markdown'}
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
