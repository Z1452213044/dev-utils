import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { createEditor } from '../../editor/cmSetup';
import type { EditorHandle } from '../../editor/cmSetup';
import { setRegexMatches, regexMatchExtension } from './regexDecorations';

interface MatchInfo {
  text: string;
  index: number;
  groups: string[];
}

export default function RegexPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<EditorHandle | null>(null);
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchInfo[]>([]);

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = createEditor({
      parent: hostRef.current,
      doc: '',
      extra: [regexMatchExtension],
      onChange: (t) => setText(t),
    });
    handleRef.current = handle;
    return () => {
      handle.view.destroy();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = handleRef.current?.view;
    if (!view) return;
    let regex: RegExp | null = null;
    try {
      regex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setMatches([]);
      view.dispatch({ effects: setRegexMatches.of([]) });
      return;
    }
    if (pattern === '') {
      setMatches([]);
      view.dispatch({ effects: setRegexMatches.of([]) });
      return;
    }
    const found: MatchInfo[] = [];
    const ranges: { from: number; to: number }[] = [];
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = regex.exec(text)) !== null) {
      if (m[0] === '') {
        regex.lastIndex++;
        continue;
      }
      found.push({ text: m[0], index: m.index, groups: m.slice(1).map((g) => g ?? '') });
      ranges.push({ from: m.index, to: m.index + m[0].length });
      if (++guard > 10000) break;
    }
    setMatches(found);
    view.dispatch({ effects: setRegexMatches.of(ranges) });
  }, [pattern, flags, text]);

  const doClear = () => {
    handleRef.current?.view.dispatch({
      changes: { from: 0, to: handleRef.current!.view.state.doc.length, insert: '' },
    });
  };

  const setFlag = (f: string) => {
    setFlags((prev) => (prev.includes(f) ? prev.replace(f, '') : prev + f));
  };

  return (
    <ToolPage title="正则测试" subtitle="实时测试正则表达式，编辑器内直接高亮全部匹配。">
      <div className="diff-surface">
        <div className="toolbar" role="toolbar" aria-label="正则工具栏">
          <input
            className="tool-input"
            style={{ flex: 1, minWidth: 200, fontFamily: 'var(--font-mono)' }}
            placeholder="输入正则表达式，例如 \\d+ 或 [A-Za-z]+"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            spellCheck={false}
          />
          <div className="segmented">
            {['g', 'i', 'm', 's', 'u'].map((f) => (
              <button
                key={f}
                className={`segmented-option ${flags.includes(f) ? '' : ''}`}
                aria-checked={flags.includes(f)}
                role="radio"
                onClick={() => setFlag(f)}
                style={{ fontFamily: 'var(--font-mono)', minWidth: 32 }}
                title={f}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="toolbar-spacer" />
          <Tooltip label="清空文本">
            <button className="icon-btn" aria-label="清空文本" onClick={doClear}>
              <Eraser />
            </button>
          </Tooltip>
        </div>

        <div className="diff-body" style={{ minHeight: 200 }}>
          <div className="pane">
            <div className="pane-header">
              <span className="pane-title">测试文本</span>
              {error === null && pattern !== '' && (
                <span className="pane-filename">{matches.length} 处匹配</span>
              )}
            </div>
            <div className="editor-host" ref={hostRef} />
          </div>
        </div>

        <div className="status-bar">
          {error !== null && <span className="status-error">正则无效：{error}</span>}
          {error === null && pattern === '' && <span>输入正则后实时显示匹配结果</span>}
          {error === null && pattern !== '' && matches.length === 0 && <span>无匹配</span>}
          {error === null && pattern !== '' && matches.length > 0 && (
            <span className="status-ok">共 {matches.length} 处匹配</span>
          )}
        </div>
      </div>

      {matches.length > 0 && (
        <div style={{ height: 'var(--sp-5)' }} />
      )}
      {matches.length > 0 && (
        <div className="tool-surface">
          <div className="tool-body">
            <div className="section-label">匹配结果</div>
            <div className="result-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {matches.map((m, i) => (
                <div className="result-row" key={i}>
                  <span className="result-label">#{i + 1} @ {m.index}</span>
                  <span className="result-value">
                    {m.text}
                    {m.groups.length > 0 && (
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        {'  组: ' + m.groups.map((g, gi) => `$${gi + 1}=「${g}」`).join(' ')}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ToolPage>
  );
}
