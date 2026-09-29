import { useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { Tooltip } from '../../components/Tooltip';
import { useToast } from '../../components/Toast';
import { Select } from '../../components/Select';
import { Toggle } from '../../components/Toggle';
import { copyToClipboard } from '../../utils/clipboard';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function UuidPage() {
  const toast = useToast();
  const [count, setCount] = useState('5');
  const [upper, setUpper] = useState(false);
  const [noHyphen, setNoHyphen] = useState(false);
  const [list, setList] = useState<string[]>(() => [generateUuid()]);

  const generate = () => {
    let out = Array.from({ length: Number(count) }, generateUuid);
    if (noHyphen) out = out.map((u) => u.replace(/-/g, ''));
    if (upper) out = out.map((u) => u.toUpperCase());
    setList(out);
  };

  return (
    <ToolPage title="UUID 生成" subtitle="批量生成符合 RFC 4122 的 UUID v4，基于加密安全随机数。">
      <div className="tool-surface">
        <div className="toolbar" role="toolbar" aria-label="UUID 工具栏">
          <button className="btn btn-primary" onClick={generate}>
            <RefreshCw style={{ width: 14, height: 14 }} />
            生成
          </button>
          <Select
            label="数量"
            value={count}
            options={[
              { value: '1', label: '1 个' },
              { value: '5', label: '5 个' },
              { value: '10', label: '10 个' },
              { value: '50', label: '50 个' },
            ]}
            onChange={setCount}
          />
          <div className="popover-row" style={{ padding: '0 4px' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>大写</span>
            <Toggle label="大写" checked={upper} onChange={setUpper} />
          </div>
          <div className="popover-row" style={{ padding: '0 4px' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>去连字符</span>
            <Toggle label="去连字符" checked={noHyphen} onChange={setNoHyphen} />
          </div>
          <div className="toolbar-spacer" />
          <Tooltip label="复制全部">
            <button
              className="icon-btn"
              aria-label="复制全部"
              onClick={async () => {
                if (await copyToClipboard(list.join('\n'))) toast(`已复制 ${list.length} 个`);
              }}
            >
              <Copy />
            </button>
          </Tooltip>
        </div>

        <div className="tool-body">
          <div className="result-list">
            {list.map((u, i) => (
              <div className="result-row" key={u + i}>
                <span className="result-label">#{i + 1}</span>
                <span className="result-value">{u}</span>
                <Tooltip label="复制">
                  <button
                    className="icon-btn result-copy"
                    aria-label="复制"
                    onClick={async () => {
                      if (await copyToClipboard(u)) toast('已复制');
                    }}
                  >
                    <Copy />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        </div>

        <div className="status-bar">
          <span>UUID v4 · 122 位随机</span>
          <div className="toolbar-spacer" />
          <span>本地生成</span>
        </div>
      </div>
    </ToolPage>
  );
}
