import type { ReactNode } from 'react';

/** 新工具统一页面骨架：标题 + 副标题 + 内容卡片容器。 */
export function ToolPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </header>
      <div className="page-content">{children}</div>
    </div>
  );
}

/** 结果行：左侧标签 + 右侧 mono 值 + 可选复制。 */
export function ResultRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="result-row">
      <span className="result-label">{label}</span>
      <span className="result-value" title={value}>
        {value || '—'}
      </span>
      {onCopy && (
        <button className="icon-btn result-copy" aria-label={`复制${label}`} onClick={onCopy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      )}
    </div>
  );
}
