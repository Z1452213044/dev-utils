import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  Copy,
  ClipboardPaste,
  FolderOpen,
  Eraser,
  SlidersHorizontal,
  FileDiff,
  Eye,
} from 'lucide-react';
import { EditorView } from '@codemirror/view';
import { createEditor, languageFor, languageById, HIGHLIGHT_LANGUAGES } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Popover } from '../../components/Popover';
import { Select } from '../../components/Select';
import { Toggle } from '../../components/Toggle';
import { useToast } from '../../components/Toast';
import { Tooltip } from '../../components/Tooltip';
import { useSettings } from '../../app/settings';
import {
  copyToClipboard,
  pasteFromClipboard,
  readTextFile,
  FILE_ACCEPT_ATTR,
} from '../../utils/clipboard';
import { computeDiff, computeCollapseRuns, computeInlineCollapseRuns } from './diffEngine';
import type { DiffResult, DiffOptions, ChunkKind, CollapseRun } from './diffEngine';
import { setSideDiff, setInlineDiff, sideDiffField, inlineDiffField } from './diffDecorations';

type Mode = 'side' | 'inline';
type Side = 'left' | 'right';

interface DiffUiOptions extends DiffOptions {
  hideUnchanged: boolean;
}

const COLLAPSE_CONTEXT = 2;
const COLLAPSE_MIN_RUN = 6;

export default function DiffPage() {
  const { settings } = useSettings();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(settings.defaultDiffMode);
  const [opts, setOpts] = useState<DiffUiOptions>({
    ignoreWhitespace: settings.defaultIgnoreWhitespace,
    ignoreCase: false,
    trimLines: false,
    hideUnchanged: false,
  });
  const [result, setResult] = useState<DiffResult | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [splitPct, setSplitPct] = useState(50);
  const [dragOver, setDragOver] = useState<Side | null>(null);
  const [names, setNames] = useState<{ left: string | null; right: string | null }>({
    left: null,
    right: null,
  });

  const leftHostRef = useRef<HTMLDivElement>(null);
  const rightHostRef = useRef<HTMLDivElement>(null);
  const inlineHostRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<EditorHandle | null>(null);
  const rightRef = useRef<EditorHandle | null>(null);
  const inlineRef = useRef<EditorHandle | null>(null);
  const textsRef = useRef({ left: '', right: '' });
  const namesRef = useRef(names);
  namesRef.current = names;
  const resultRef = useRef(result);
  resultRef.current = result;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const wrapRef = useRef(settings.wordWrap);
  wrapRef.current = settings.wordWrap;
  const focusedSideRef = useRef<Side>('left');
  const syncingRef = useRef(false);
  const navIndexRef = useRef(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileSideRef = useRef<Side>('left');
  const diffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sideCollapseRef = useRef<{ left: CollapseRun[]; right: CollapseRun[] }>({ left: [], right: [] });
  const [langOverride, setLangOverride] = useState('auto');
  const langOverrideRef = useRef(langOverride);
  langOverrideRef.current = langOverride;

  /** 按当前语言覆盖设置应用高亮。 */
  const applyHighlight = useCallback((side: Side) => {
    const handle = side === 'left' ? leftRef.current : rightRef.current;
    if (!handle) return;
    const override = langOverrideRef.current;
    if (override === 'auto') {
      handle.setLanguage(languageFor(namesRef.current[side], textsRef.current[side]));
    } else {
      handle.setLanguage(languageById(override));
    }
  }, []);

  /* ---------------- Diff scheduling（Web Worker，主线程零卡顿） ---------------- */

  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  const latestReqRef = useRef(0);

  // Worker 初始化 + 结果接收
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./diff.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ id: number; result: DiffResult }>) => {
        // 只接受最新一次请求的结果，跳过过期计算
        if (e.data.id !== latestReqRef.current) return;
        setResult(e.data.result);
        navIndexRef.current = -1;
      };
      worker.onerror = () => {
        workerRef.current = null; // 失败时回退到主线程计算
      };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }
    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

  const runDiff = useCallback(() => {
    const { left, right } = textsRef.current;
    const opts: DiffOptions = {
      ignoreWhitespace: optsRef.current.ignoreWhitespace,
      ignoreCase: optsRef.current.ignoreCase,
      trimLines: optsRef.current.trimLines,
    };
    if (workerRef.current) {
      const id = ++seqRef.current;
      latestReqRef.current = id;
      workerRef.current.postMessage({ id, original: left, modified: right, opts });
    } else {
      // 回退：主线程计算
      const r = computeDiff(left, right, opts);
      setResult(r);
      navIndexRef.current = -1;
    }
  }, []);

  const scheduleDiff = useCallback(() => {
    if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
    diffTimerRef.current = setTimeout(runDiff, 220);
  }, [runDiff]);

  const flushDiff = useCallback(() => {
    if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
    runDiff();
  }, [runDiff]);

  /* ---------------- Scroll sync ---------------- */

  const hiddenAbove = useCallback(
    (side: Side, line: number): number => {
      const runs = sideCollapseRef.current[side];
      const fromKey = side === 'left' ? 'leftFrom' : 'rightFrom';
      const toKey = side === 'left' ? 'leftTo' : 'rightTo';
      let count = 0;
      for (const run of runs) {
        const f = run[fromKey];
        if (f >= line) break;
        count += Math.min(run[toKey], line - 1) - f + 1;
      }
      return count;
    },
    [],
  );

  const syncScroll = useCallback(
    (fromSide: Side, toSide: Side) => {
      if (syncingRef.current || wrapRef.current) return;
      const from = fromSide === 'left' ? leftRef.current : rightRef.current;
      const to = toSide === 'left' ? leftRef.current : rightRef.current;
      if (!from || !to) return;
      const fromEl = from.view.scrollDOM;
      const toEl = to.view.scrollDOM;

      const res = resultRef.current;
      if (!res || res.chunks.length === 0) {
        syncingRef.current = true;
        toEl.scrollTop = fromEl.scrollTop;
        requestAnimationFrame(() => {
          syncingRef.current = false;
        });
        return;
      }

      const lineHeight = from.view.defaultLineHeight || 21;
      const runsTo = toSide === 'left' ? sideCollapseRef.current.left : sideCollapseRef.current.right;
      const visibleOf = (side: Side, n: number) =>
        n <= 0 ? 0 : n - hiddenAbove(side, n);

      const anchors: { lv: number; rv: number }[] = [{ lv: 0, rv: 0 }];
      for (const chunk of res.chunks) {
        anchors.push({
          lv: visibleOf('left' as Side, Math.max(chunk.leftEnd, 0)),
          rv: visibleOf('right' as Side, Math.max(chunk.rightEnd, 0)),
        });
      }
      anchors.push({
        lv: visibleOf('left', res.leftLines) + 1,
        rv: visibleOf('right', res.rightLines) + 1,
      });
      void runsTo;

      const f = fromEl.scrollTop / lineHeight + 1;
      let target: number;
      const last = anchors[anchors.length - 1];
      if (f <= 0) {
        target = 0;
      } else if (f >= last.lv) {
        target = last.rv + (f - last.lv);
      } else {
        let i = 0;
        while (i < anchors.length - 2 && anchors[i + 1].lv < f) i++;
        const a = anchors[i];
        const b = anchors[i + 1];
        const t = b.lv === a.lv ? 0 : (f - a.lv) / (b.lv - a.lv);
        target = a.rv + t * (b.rv - a.rv);
      }

      const maxScroll = Math.max(0, toEl.scrollHeight - toEl.clientHeight);
      syncingRef.current = true;
      toEl.scrollTop = Math.max(0, Math.min((target - 1) * lineHeight, maxScroll));
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    },
    [hiddenAbove],
  );

  /* ---------------- Editor creation (side mode) ---------------- */

  useEffect(() => {
    if (!leftHostRef.current || !rightHostRef.current) return;

    const onChange = (side: Side) => (text: string) => {
      textsRef.current[side] = text;
      setHasContent(textsRef.current.left !== '' || textsRef.current.right !== '');
      scheduleDiff();
    };

    leftRef.current = createEditor({
      parent: leftHostRef.current,
      doc: textsRef.current.left,
      wordWrap: settings.wordWrap,
      tabSize: settings.tabSize,
      onChange: onChange('left'),
      extra: [sideDiffField],
    });
    rightRef.current = createEditor({
      parent: rightHostRef.current,
      doc: textsRef.current.right,
      wordWrap: settings.wordWrap,
      tabSize: settings.tabSize,
      onChange: onChange('right'),
      extra: [sideDiffField],
    });

    const l = leftRef.current.view;
    const r = rightRef.current.view;

    l.contentDOM.addEventListener('focus', () => (focusedSideRef.current = 'left'));
    r.contentDOM.addEventListener('focus', () => (focusedSideRef.current = 'right'));

    const onScrollL = () => syncScroll('left', 'right');
    const onScrollR = () => syncScroll('right', 'left');
    l.scrollDOM.addEventListener('scroll', onScrollL, { passive: true });
    r.scrollDOM.addEventListener('scroll', onScrollR, { passive: true });

    runDiff();

    return () => {
      l.scrollDOM.removeEventListener('scroll', onScrollL);
      r.scrollDOM.removeEventListener('scroll', onScrollR);
      leftRef.current?.view.destroy();
      rightRef.current?.view.destroy();
      leftRef.current = null;
      rightRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Apply decorations when result/options change ---------------- */

  useEffect(() => {
    const res = result;
    if (!res) return;
    const hide = opts.hideUnchanged;

    const leftRows = res.pairs.flatMap((p) => (p.left ? [p.left] : []));
    const rightRows = res.pairs.flatMap((p) => (p.right ? [p.right] : []));
    const collapse = hide
      ? computeCollapseRuns(res.pairs, { context: COLLAPSE_CONTEXT, minRun: COLLAPSE_MIN_RUN })
      : [];
    sideCollapseRef.current = { left: collapse, right: collapse };

    leftRef.current?.view.dispatch({
      effects: setSideDiff.of({ rows: leftRows, collapse, side: 'left' }),
    });
    rightRef.current?.view.dispatch({
      effects: setSideDiff.of({ rows: rightRows, collapse, side: 'right' }),
    });

    if (mode === 'inline' && inlineRef.current) {
      const inlineCollapse = hide
        ? computeInlineCollapseRuns(res.inline, { context: COLLAPSE_CONTEXT, minRun: COLLAPSE_MIN_RUN })
        : [];
      const text = res.inline.map((row) => row.text).join('\n');
      const iv = inlineRef.current;
      if (iv.view.state.doc.toString() !== text) {
        iv.view.dispatch({ changes: { from: 0, to: iv.view.state.doc.length, insert: text } });
      }
      iv.view.dispatch({ effects: setInlineDiff.of({ rows: res.inline, collapse: inlineCollapse }) });
    }
  }, [result, opts.hideUnchanged, mode]);

  /* ---------------- Mode switch: remeasure hidden views ---------------- */

  useEffect(() => {
    if (mode === 'side') {
      // Views were hidden with display:none — ask CodeMirror to remeasure.
      leftRef.current?.view.requestMeasure();
      rightRef.current?.view.requestMeasure();
    }
  }, [mode]);

  /* ---------------- Inline editor lifecycle ---------------- */

  useEffect(() => {
    if (mode !== 'inline' || !inlineHostRef.current) return;
    const handle = createEditor({
      parent: inlineHostRef.current,
      doc: '',
      readOnly: true,
      wordWrap: settings.wordWrap,
      tabSize: settings.tabSize,
      extra: [inlineDiffField],
    });
    inlineRef.current = handle;

    const res = resultRef.current;
    if (res) {
      const text = res.inline.map((row) => row.text).join('\n');
      handle.view.dispatch({ changes: { from: 0, to: handle.view.state.doc.length, insert: text } });
      const inlineCollapse = optsRef.current.hideUnchanged
        ? computeInlineCollapseRuns(res.inline, { context: COLLAPSE_CONTEXT, minRun: COLLAPSE_MIN_RUN })
        : [];
      handle.view.dispatch({ effects: setInlineDiff.of({ rows: res.inline, collapse: inlineCollapse }) });
    }

    return () => {
      handle.view.destroy();
      inlineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* ---------------- Settings propagation ---------------- */

  useEffect(() => {
    leftRef.current?.setWordWrap(settings.wordWrap);
    rightRef.current?.setWordWrap(settings.wordWrap);
    inlineRef.current?.setWordWrap(settings.wordWrap);
    leftRef.current?.setTabSize(settings.tabSize);
    rightRef.current?.setTabSize(settings.tabSize);
  }, [settings.wordWrap, settings.tabSize]);

  /* ---------------- Chunk navigation ---------------- */

  const navDiff = useCallback(
    (dir: 1 | -1, kind?: ChunkKind) => {
      const res = resultRef.current;
      if (!res || res.chunks.length === 0) return;
      let chunks = res.chunks;
      if (kind && kind !== 'modified') {
        const filtered = res.chunks.filter((c) => c.kind === kind);
        if (filtered.length > 0) chunks = filtered;
      } else if (kind === 'modified') {
        const filtered = res.chunks.filter((c) => c.kind === 'modified' || c.kind === 'mixed');
        if (filtered.length > 0) chunks = filtered;
      }
      if (chunks.length === 0) return;

      navIndexRef.current = (navIndexRef.current + dir + chunks.length) % chunks.length;
      const chunk = chunks[navIndexRef.current];

      if (modeRef.current === 'inline') {
        const iv = inlineRef.current;
        if (iv) {
          const line = Math.min(Math.max(chunk.inlineStart, 1), iv.view.state.doc.lines);
          iv.view.dispatch({
            effects: EditorView.scrollIntoView(iv.view.state.doc.line(line).from, { y: 'center' }),
          });
          iv.view.focus();
        }
        return;
      }

      const useLeft = chunk.leftStart > 0;
      const handle = useLeft ? leftRef.current : rightRef.current;
      const rawLine = useLeft ? chunk.leftStart : chunk.rightStart;
      if (handle && rawLine > 0) {
        const line = Math.min(rawLine, handle.view.state.doc.lines);
        handle.view.dispatch({
          effects: EditorView.scrollIntoView(handle.view.state.doc.line(line).from, { y: 'center' }),
        });
        handle.view.focus();
      }
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        navDiff(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        flushDiff();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navDiff, flushDiff]);

  /* ---------------- Files ---------------- */

  const loadFile = useCallback(
    (side: Side, file: File) => {
      void readTextFile(file).then((text) => {
        const handle = side === 'left' ? leftRef.current : rightRef.current;
        if (!handle) return;
        handle.setDoc(text);
        if (langOverrideRef.current === 'auto') handle.setLanguage(languageFor(file.name));
        else handle.setLanguage(languageById(langOverrideRef.current));
        setNames((n) => ({ ...n, [side]: file.name }));
        flushDiff();
      });
    },
    [flushDiff],
  );

  const openFile = useCallback((side: Side) => {
    pendingFileSideRef.current = side;
    fileInputRef.current?.click();
  }, []);

  useEffect(() => {
    const onOpenEvent = () => openFile(focusedSideRef.current);
    document.addEventListener('dt-open-file', onOpenEvent);
    return () => document.removeEventListener('dt-open-file', onOpenEvent);
  }, [openFile]);

  /* ---------------- Actions ---------------- */

  const applyDoc = useCallback((side: Side, text: string, name: string | null) => {
    const handle = side === 'left' ? leftRef.current : rightRef.current;
    if (!handle) return;
    handle.setDoc(text);
    handle.setLanguage(languageFor(name));
    setNames((n) => ({ ...n, [side]: name }));
  }, []);

  const swap = useCallback(() => {
    const { left, right } = textsRef.current;
    const nl = namesRef.current.right;
    const nr = namesRef.current.left;
    textsRef.current = { left: right, right: left };
    leftRef.current?.setDoc(right);
    leftRef.current?.setLanguage(
      langOverrideRef.current === 'auto' ? languageFor(nl) : languageById(langOverrideRef.current),
    );
    rightRef.current?.setDoc(left);
    rightRef.current?.setLanguage(
      langOverrideRef.current === 'auto' ? languageFor(nr) : languageById(langOverrideRef.current),
    );
    setNames({ left: nl, right: nr });
    flushDiff();
  }, [flushDiff]);

  const clearSide = useCallback(
    (side: Side) => {
      applyDoc(side, '', null);
      textsRef.current[side] = '';
      setHasContent(textsRef.current.left !== '' || textsRef.current.right !== '');
      flushDiff();
    },
    [applyDoc, flushDiff],
  );

  const copySide = useCallback(
    async (side: Side) => {
      if (await copyToClipboard(textsRef.current[side])) toast('已复制');
    },
    [toast],
  );

  const pasteInto = useCallback(
    async (side: Side) => {
      const text = await pasteFromClipboard();
      if (text == null) {
        // 剪贴板读取被拒绝时：聚焦编辑器，让用户直接 Ctrl+V（编辑器始终可见）
        flushDiff();
        setTimeout(() => (side === 'left' ? leftRef.current : rightRef.current)?.view.focus(), 0);
        toast('请在编辑器中按 Ctrl+V 粘贴');
        return;
      }
      applyDoc(side, text, null);
      textsRef.current[side] = text;
      setHasContent(true);
      flushDiff();
      setTimeout(() => (side === 'left' ? leftRef.current : rightRef.current)?.view.focus(), 0);
    },
    [applyDoc, flushDiff, toast],
  );

  /* ---------------- Drag & drop ---------------- */

  const onDrop = (side: Side) => (e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(side, file);
  };

  const onDragOver = (side: Side) => (e: DragEvent) => {
    e.preventDefault();
    setDragOver(side);
  };

  /* ---------------- Splitter ---------------- */

  const onSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const body = e.currentTarget.parentElement;
    if (!body) return;
    document.body.style.cursor = 'col-resize';
    const move = (ev: MouseEvent) => {
      const rect = body.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(80, Math.max(20, pct)));
    };
    const up = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  /* ---------------- Render ---------------- */

  const stats = result?.stats;
  const identicalDocs = result != null && result.chunks.length === 0 && hasContent;
  const optionsActive = opts.ignoreWhitespace || opts.ignoreCase || opts.trimLines;

  const paneHeader = (side: Side, title: string) => (
    <div className="pane-header">
      <span className="pane-title">{title}</span>
      {names[side] && <span className="pane-filename">{names[side]}</span>}
      <Tooltip label="复制内容">
        <button className="icon-btn" aria-label="复制内容" onClick={() => copySide(side)}>
          <Copy />
        </button>
      </Tooltip>
      <Tooltip label="打开文件">
        <button className="icon-btn" aria-label="打开文件" onClick={() => openFile(side)}>
          <FolderOpen />
        </button>
      </Tooltip>
      <Tooltip label="清空">
        <button className="icon-btn" aria-label="清空" onClick={() => clearSide(side)}>
          <Eraser />
        </button>
      </Tooltip>
    </div>
  );

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">文本对比</h1>
        <p className="page-subtitle">精确查看两段文本之间的新增、删除与修改。</p>
      </header>

      <div className="page-content">
        <div className="diff-surface">
          <div className="toolbar" role="toolbar" aria-label="文本对比工具栏">
            <SegmentedControl<Mode>
              ariaLabel="显示模式"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'side', label: '并排' },
                { value: 'inline', label: '行内' },
              ]}
            />

            {stats && stats.total > 0 && (
              <div className="diff-summary" aria-label="差异统计">
                {stats.added > 0 && (
                  <Tooltip label="新增">
                    <button className="summary-chip added" onClick={() => navDiff(1, 'added')}>
                      +{stats.added}
                    </button>
                  </Tooltip>
                )}
                {stats.removed > 0 && (
                  <Tooltip label="删除">
                    <button className="summary-chip removed" onClick={() => navDiff(1, 'removed')}>
                      −{stats.removed}
                    </button>
                  </Tooltip>
                )}
                {stats.modified > 0 && (
                  <Tooltip label="修改">
                    <button className="summary-chip modified" onClick={() => navDiff(1, 'modified')}>
                      ~{stats.modified}
                    </button>
                  </Tooltip>
                )}
                <span className="summary-total">{stats.total} 处差异</span>
              </div>
            )}
            {identicalDocs && <span className="summary-total">内容相同</span>}

            <div className="toolbar-spacer" />

            <button
              className={`btn btn-ghost ${opts.hideUnchanged ? 'btn-toggle-on' : ''}`}
              aria-pressed={opts.hideUnchanged}
              aria-label="只查看 Diff"
              title="隐藏未修改的行，只看有差异的部分（保留上下文 2 行）"
              onClick={() => {
                setOpts((o) => ({ ...o, hideUnchanged: !o.hideUnchanged }));
                setTimeout(flushDiff, 0);
              }}
            >
              <Eye style={{ width: 14, height: 14 }} />
              只查看 Diff{opts.hideUnchanged ? '：开' : ''}
            </button>

            <Tooltip label="上一个差异（Shift+F7）">
              <button
                className="icon-btn"
                aria-label="上一个差异"
                disabled={!stats || stats.total === 0}
                onClick={() => navDiff(-1)}
              >
                <ChevronUp />
              </button>
            </Tooltip>
            <Tooltip label="下一个差异（F7）">
              <button
                className="icon-btn"
                aria-label="下一个差异"
                disabled={!stats || stats.total === 0}
                onClick={() => navDiff(1)}
              >
                <ChevronDown />
              </button>
            </Tooltip>

            <div className="toolbar-sep" />

            <Popover
              label="更多选项"
              trigger={
                <Tooltip label="更多选项">
                  <button className={`icon-btn ${optionsActive ? 'active' : ''}`} aria-label="更多选项">
                    <SlidersHorizontal />
                  </button>
                </Tooltip>
              }
            >
              <div className="popover-title">对比选项</div>
              <div className="popover-row">
                <span>语法高亮</span>
                <Select
                  label="语法高亮"
                  value={langOverride}
                  options={HIGHLIGHT_LANGUAGES}
                  onChange={(v) => {
                    setLangOverride(v);
                    setTimeout(() => {
                      applyHighlight('left');
                      applyHighlight('right');
                    }, 0);
                  }}
                />
              </div>
              {(
                [
                  ['ignoreWhitespace', '忽略空白字符'],
                  ['ignoreCase', '忽略大小写'],
                  ['trimLines', '去除行首尾空格'],
                ] as const
              ).map(([key, label]) => (
                <div className="popover-row" key={key}>
                  <span>{label}</span>
                  <Toggle
                    label={label}
                    checked={opts[key]}
                    onChange={(v) => {
                      setOpts((o) => ({ ...o, [key]: v }));
                      setTimeout(flushDiff, 0);
                    }}
                  />
                </div>
              ))}
            </Popover>

            <div className="toolbar-sep" />

            <Tooltip label="交换左右文本">
              <button className="icon-btn" aria-label="交换左右文本" onClick={swap}>
                <ArrowLeftRight />
              </button>
            </Tooltip>
            <Tooltip label="清空两侧">
              <button
                className="icon-btn"
                aria-label="清空两侧"
                onClick={() => {
                  clearSide('left');
                  clearSide('right');
                }}
              >
                <Eraser />
              </button>
            </Tooltip>
          </div>

          <div className="diff-body">
            <div
              className={`diff-split ${mode === 'side' ? '' : 'hidden'}`}
              style={{ '--split': `${splitPct}%` } as CSSProperties}
            >
              <div
                className={`pane ${dragOver === 'left' ? 'dropping' : ''}`}
                onDragOver={onDragOver('left')}
                onDragLeave={() => setDragOver(null)}
                onDrop={onDrop('left')}
              >
                {paneHeader('left', '原始文本')}
                <div className="editor-host" ref={leftHostRef} />
                {!hasContent && (
                  <div className="empty-state" aria-label="开始使用">
                    <div className="empty-icon-wrap">
                      <FileDiff className="empty-icon" />
                    </div>
                    <div className="empty-text">点击任意位置开始输入，或拖入文件 / 粘贴</div>
                    <div className="empty-caption">所有内容仅在当前设备处理</div>
                    <div className="empty-actions">
                      <button className="btn btn-secondary" onClick={() => pasteInto('left')}>
                        <ClipboardPaste style={{ width: 14, height: 14 }} />
                        粘贴
                      </button>
                      <button className="btn btn-secondary" onClick={() => openFile('left')}>
                        <FolderOpen style={{ width: 14, height: 14 }} />
                        打开文件
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div
                className="splitter"
                role="separator"
                aria-label="调整两侧宽度"
                aria-orientation="vertical"
                onMouseDown={onSplitMouseDown}
                onDoubleClick={() => setSplitPct(50)}
              />

              <div
                className={`pane ${dragOver === 'right' ? 'dropping' : ''}`}
                onDragOver={onDragOver('right')}
                onDragLeave={() => setDragOver(null)}
                onDrop={onDrop('right')}
              >
                {paneHeader('right', '修改后文本')}
                <div className="editor-host" ref={rightHostRef} />
              </div>
            </div>

            <div className={`diff-inline-pane pane ${mode === 'inline' && hasContent ? '' : 'hidden'}`}>
              <div className="pane-header">
                <span className="pane-title">行内对比</span>
                <span className="pane-filename">切换到「并排」可编辑</span>
              </div>
              <div className="editor-host" ref={inlineHostRef} />
            </div>

          </div>

          <div className="status-bar">
            <span>
              {stats && stats.total > 0
                ? `${stats.total} 处差异`
                : identicalDocs
                  ? '内容相同'
                  : '等待输入'}
            </span>
            <div className="toolbar-spacer" />
            <span>UTF-8</span>
            <span className="dot">·</span>
            <span>{Math.max(result?.leftLines ?? 0, result?.rightLines ?? 0)} 行</span>
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
          if (file) loadFile(pendingFileSideRef.current, file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
