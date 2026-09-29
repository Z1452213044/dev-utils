import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download } from 'lucide-react';
import { ToolPage } from '../../components/ToolPage';
import { useToast } from '../../components/Toast';
import { Select } from '../../components/Select';
import { copyToClipboard, downloadDataUrl } from '../../utils/clipboard';


const LEVELS = [
  { value: 'L', label: 'L · 低（7%）' },
  { value: 'M', label: 'M · 中（15%）' },
  { value: 'Q', label: 'Q · 较高（25%）' },
  { value: 'H', label: 'H · 高（30%）' },
] as const;

type Level = (typeof LEVELS)[number]['value'];

export default function QrPage() {
  const toast = useToast();
  const [text, setText] = useState('');
  const [size, setSize] = useState('320');
  const [level, setLevel] = useState<Level>('M');
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const generate = useCallback(
    async (value: string, px: number, lvl: Level) => {
      if (value.trim() === '') {
        setDataUrl(null);
        setError(null);
        return;
      }
      pendingRef.current = true;
      try {
        const url = await QRCode.toDataURL(value, {
          width: px,
          margin: 2,
          errorCorrectionLevel: lvl,
          color: { dark: '#1d1d1f', light: '#ffffff' },
        });
        setDataUrl(url);
        setError(null);
      } catch (err) {
        setDataUrl(null);
        setError('生成失败：' + (err as Error).message);
      }
      pendingRef.current = false;
    },
    [],
  );

  useEffect(() => {
    const t = setTimeout(() => void generate(text, Number(size), level), 250);
    return () => clearTimeout(t);
  }, [text, size, level, generate]);

  const fileBase = 'qrcode-' + Date.now();

  return (
    <ToolPage title="二维码生成" subtitle="将文本、链接生成 PNG 二维码，本地渲染不上传。">
      <div className="tool-surface">
        <div className="tool-body">
          <textarea
            className="tool-input"
            placeholder="输入文本或链接，例如 https://example.com"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            spellCheck={false}
          />
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="section-label" style={{ margin: 0 }}>尺寸</span>
            <Select
              label="尺寸"
              value={size}
              options={[
                { value: '240', label: '240 px' },
                { value: '320', label: '320 px' },
                { value: '480', label: '480 px' },
                { value: '640', label: '640 px' },
              ]}
              onChange={setSize}
            />
            <span className="section-label" style={{ margin: 0 }}>纠错级别</span>
            <Select
              label="纠错级别"
              value={level}
              options={LEVELS.map((l) => ({ value: l.value, label: l.label }))}
              onChange={(v) => setLevel(v as Level)}
            />
          </div>

          {error && <span className="status-error" style={{ fontSize: 12.5 }}>{error}</span>}

          {dataUrl && (
            <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <img
                src={dataUrl}
                alt="二维码"
                style={{ width: 200, height: 200, borderRadius: 'var(--radius-m)', boxShadow: 'var(--shadow-surface)' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => downloadDataUrl(dataUrl, fileBase + '.png')}
                >
                  <Download style={{ width: 14, height: 14 }} />
                  下载 PNG
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    if (await copyToClipboard(text)) toast('已复制内容');
                  }}
                >
                  <Copy style={{ width: 14, height: 14 }} />
                  复制文本
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  尺寸 {size}×{size} · 纠错 {level}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="status-bar">
          <span>{error ?? (dataUrl ? '二维码已生成' : '输入内容后自动生成')}</span>
          <div className="toolbar-spacer" />
          <span>本地渲染</span>
        </div>
      </div>
    </ToolPage>
  );
}
