import { useMemo, useState } from 'react';
import { Eraser } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { parseCron, describeCron, nextCronExecutions } from './cronParser';

const FIELD_NAMES = ['秒', '分钟', '小时', '日', '月', '星期'];

export default function CronPage() {
  const [expr, setExpr] = useState('*/5 * * * * *');

  const parsed = useMemo(() => parseCron(expr), [expr]);
  const fields = 'fields' in parsed ? parsed.fields : null;
  const errorField = 'fields' in parsed ? null : parsed.field;
  const errorMsg = 'fields' in parsed ? null : parsed.error;

  const description = fields ? describeCron(fields) : null;
  const nextRuns = useMemo(
    () => (fields ? nextCronExecutions(fields, new Date(), 5) : []),
    [fields],
  );

  const fieldValues = fields
    ? [fields.second, fields.minute, fields.hour, fields.dayOfMonth, fields.month, fields.dayOfWeek]
    : null;

  return (
    <ToolPage title="Cron 解析" subtitle="解析 6 段 cron 表达式（秒 分 时 日 月 周），兼容 5 段（秒自动为 0）。">
      <div className="tool-surface">
        <div className="tool-body">
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="tool-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="例如 */5 * * * * * 或 0 9 * * 1-5"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              spellCheck={false}
            />
            <Tooltip label="清空">
              <button
                className="icon-btn"
                aria-label="清空"
                onClick={() => setExpr('')}
              >
                <Eraser />
              </button>
            </Tooltip>
          </div>

          {errorField && errorMsg && (
            <span className="status-error" style={{ fontSize: 12.5 }}>
              {errorField}字段：{errorMsg}
            </span>
          )}

          {fields && (
            <table className="kv-table cron-table">
              <thead>
                <tr>
                  {FIELD_NAMES.map((name) => (
                    <th key={name}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {fieldValues!.map((values, i) => (
                    <td key={i}>
                      {values.length ===
                      [60, 60, 24, 31, 12, 7][i]
                        ? '*'
                        : values.join(', ')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {fields && description && (
        <>
          <div style={{ height: 'var(--sp-5)' }} />
          <div className="tool-surface">
            <div className="tool-body">
              <div className="section-label">含义</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{description}</div>
            </div>
          </div>

          <div style={{ height: 'var(--sp-5)' }} />

          <div className="tool-surface">
            <div className="tool-body">
              <div className="section-label">未来 5 次执行（本地时间）</div>
              <div className="result-list">
                {nextRuns.map((d, i) => (
                  <div className="result-row" key={i}>
                    <span className="result-label">#{i + 1}</span>
                    <span className="result-value">{d.toLocaleString('zh-CN', { hour12: false })}</span>
                  </div>
                ))}
                {nextRuns.length === 0 && (
                  <div className="result-row">
                    <span className="result-label">提示</span>
                    <span className="result-value" style={{ color: 'var(--text-tertiary)' }}>
                      未来 4 年内没有匹配的执行时间
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </ToolPage>
  );
}
