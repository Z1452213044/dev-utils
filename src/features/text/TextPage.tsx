import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  ClipboardPaste,
  Eraser,
  FolderOpen,
  Undo2,
  Scissors,
  ListX,
  CopyX,
  ArrowDownAZ,
  ArrowUpAZ,
  CaseUpper,
  CaseLower,
  AlignLeft,
  ArrowRightLeft,
  ArrowLeftRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createEditor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { undo } from '@codemirror/commands';
import { Popover } from '../../components/Popover';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { useSettings } from '../../app/settings';
import { copyToClipboard, pasteFromClipboard, readTextFile, FILE_ACCEPT_ATTR } from '../../utils/clipboard';
import { applyTextOperation, textStats } from './textProcessor';
import type { TextOperationId, TextStats } from './textProcessor';

interface OpDef {
  id: TextOperationId;
  label: string;
  icon: LucideIcon;
}

const TIDY_OPS: OpDef[] = [
  { id: 'trim', label: '去除首尾空格', icon: Scissors },
  { id: 'removeEmptyLines', label: '去除空行', icon: ListX },
  { id: 'removeDuplicateLines', label: '去除重复行', icon: CopyX },
  { id: 'trimEachLine', label: '每行去除首尾空格', icon: AlignLeft },
];

const CONVERT_OPS: OpDef[] = [
  { id: 'uppercase', label: '转为大写', icon: CaseUpper },
  { id: 'lowercase', label: '转为小写', icon: CaseLower },
  { id: 'lfToCrlf', label: 'LF → CRLF', icon: ArrowRightLeft },
  { id: 'crlfToLf', label: 'CRLF → LF', icon: ArrowLeftRight },
];

const SORT_OPS: OpDef[] = [
  { id: 'sortAsc', label: '升序排列', icon: ArrowDownAZ },
  { id: 'sortDesc', label: '降序排列', icon: ArrowUpAZ },
];

function OpMenu({
  title,
  icon: TitleIcon,
  ops,
  onPick,
}: {
  title: string;
  icon: LucideIcon;
  ops: OpDef[];
  onPick: (id: TextOperationId) => void;
}) {
  return (
    <Popover
      label={title}
      trigger={
        <Tooltip label={title}>
          <button className="icon-btn" aria-label={title}>
            <TitleIcon />
          </button>
        </Tooltip>
      }
    >
      {(close) => (
        <div role="menu" aria-label={title}>
          <div className="popover-title">{title}</div>
          {ops.map((op) => {
            const Icon = op.icon;
            return (
              <button
                key={op.id}
                role="menuitem"
                className="popover-item"
                onClick={() => {
                  onPick(op.id);
                  close();
                }}
              >
                <span className="placeholder" />
                <Icon style={{ width: 14, height: 14, marginRight: 6, color: 'var(--text-tertiary)' }} />
                {op.label}
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

export default function TextPage() {
  const { settings } = useSettings();
  const toast = useToast();

  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<TextStats>({ characters: 0, words: 0, lines: 0 });
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createEditor({
      parent: hostRef.current,
      doc: '',
      wordWrap: settings.wordWrap,
      tabSize: settings.tabSize,
      onChange: (text) => setStats(textStats(text)),
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

  const applyOp = useCallback(
    (id: TextOperationId) => {
      const handle = handleRef.current;
      if (!handle) return;
      const text = handle.view.state.doc.toString();
      const next = applyTextOperation(id, text);
      if (next === text) {
        toast('没有需要修改的内容');
        return;
      }
      handle.view.dispatch({
        changes: { from: 0, to: text.length, insert: next },
        userEvent: 'input.change',
      });
      setStats(textStats(next));
    },
    [toast],
  );

  const doCopy = async () => {
    const text = handleRef.current?.view.state.doc.toString() ?? '';
    if (await copyToClipboard(text)) toast('已复制');
  };

  const doPaste = useCallback(async () => {
    const text = await pasteFromClipboard();
    if (text == null) {
      toast('剪贴板不可用');
      return;
    }
    const handle = handleRef.current;
    if (!handle) return;
    handle.view.dispatch({
      changes: { from: 0, to: handle.view.state.doc.length, insert: text },
      userEvent: 'input.paste',
    });
    setStats(textStats(text));
  }, [toast]);

  const doClear = () => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.view.dispatch({
      changes: { from: 0, to: handle.view.state.doc.length, insert: '' },
      userEvent: 'input.delete',
    });
    setStats({ characters: 0, words: 0, lines: 0 });
  };

  const doUndo = () => {
    const handle = handleRef.current;
    if (handle) undo(handle.view);
  };

  const loadFile = (file: File) => {
    void readTextFile(file).then((text) => {
      const handle = handleRef.current;
      if (!handle) return;
      handle.view.dispatch({
        changes: { from: 0, to: handle.view.state.doc.length, insert: text },
        userEvent: 'input.paste',
      });
      setStats(textStats(text));
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
        <h1 className="page-title">文本工具</h1>
        <p className="page-subtitle">快速整理、转换和处理文本内容。</p>
      </header>

      <div className="page-content">
        <div className="diff-surface">
          <div className="toolbar" role="toolbar" aria-label="文本工具栏">
            <OpMenu title="整理" icon={Scissors} ops={TIDY_OPS} onPick={applyOp} />
            <OpMenu title="转换" icon={ArrowRightLeft} ops={CONVERT_OPS} onPick={applyOp} />
            <OpMenu title="排序" icon={ArrowDownAZ} ops={SORT_OPS} onPick={applyOp} />

            <div className="toolbar-spacer" />

            <Tooltip label="撤销">
              <button className="icon-btn" aria-label="撤销" onClick={doUndo}>
                <Undo2 />
              </button>
            </Tooltip>
            <Tooltip label="粘贴">
              <button className="icon-btn" aria-label="粘贴" onClick={doPaste}>
                <ClipboardPaste />
              </button>
            </Tooltip>
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
          </div>

          <div className="diff-body">
            <div className="pane">
              <div className="editor-host" ref={hostRef} />
            </div>
          </div>

          <div className="status-bar">
            <span>
              {stats.characters.toLocaleString()} 字符
              <span className="dot"> · </span>
              {stats.words.toLocaleString()} 单词
              <span className="dot"> · </span>
              {stats.lines.toLocaleString()} 行
            </span>
            <div className="toolbar-spacer" />
            <span>UTF-8</span>
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
