import { Monitor, Moon, Sun, ShieldCheck } from 'lucide-react';
import { useSettings } from '../../app/settings';
import type { Appearance, DiffMode } from '../../app/settings';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Toggle } from '../../components/Toggle';
import { Select } from '../../components/Select';

export default function SettingsPage() {
  const { settings, update } = useSettings();

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">设置</h1>
        <p className="page-subtitle">外观、编辑器与隐私偏好。所有设置仅保存在本设备。</p>
      </header>

      <div className="page-content settings-scroll">
        <div className="settings-panel">
          <section className="settings-group">
            <h2 className="settings-group-title">外观</h2>
            <div className="settings-card">
              <div className="settings-row">
                <span className="settings-row-label">主题</span>
                <SegmentedControl<Appearance>
                  ariaLabel="主题"
                  value={settings.appearance}
                  onChange={(appearance) => update({ appearance })}
                  options={[
                    { value: 'system', label: '跟随系统', icon: Monitor },
                    { value: 'light', label: '浅色', icon: Sun },
                    { value: 'dark', label: '深色', icon: Moon },
                  ]}
                />
              </div>
            </div>
          </section>

          <section className="settings-group">
            <h2 className="settings-group-title">编辑器</h2>
            <div className="settings-card">
              <div className="settings-row">
                <span className="settings-row-label">字号</span>
                <Select
                  label="字号"
                  value={String(settings.editorFontSize)}
                  options={[
                    { value: '12', label: '12 px' },
                    { value: '13', label: '13 px' },
                    { value: '14', label: '14 px' },
                    { value: '15', label: '15 px' },
                    { value: '16', label: '16 px' },
                    { value: '18', label: '18 px' },
                  ]}
                  onChange={(v) => update({ editorFontSize: Number(v) })}
                />
              </div>
              <div className="settings-row">
                <span className="settings-row-label">Tab 大小</span>
                <Select
                  label="Tab 大小"
                  value={String(settings.tabSize)}
                  options={[
                    { value: '2', label: '2' },
                    { value: '4', label: '4' },
                    { value: '8', label: '8' },
                  ]}
                  onChange={(v) => update({ tabSize: Number(v) })}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">自动换行</div>
                  <div className="settings-row-caption">长行自动换行，而不是横向滚动</div>
                </div>
                <Toggle
                  label="自动换行"
                  checked={settings.wordWrap}
                  onChange={(wordWrap) => update({ wordWrap })}
                />
              </div>
            </div>
          </section>

          <section className="settings-group">
            <h2 className="settings-group-title">文本对比</h2>
            <div className="settings-card">
              <div className="settings-row">
                <span className="settings-row-label">默认显示模式</span>
                <SegmentedControl<DiffMode>
                  ariaLabel="默认显示模式"
                  value={settings.defaultDiffMode}
                  onChange={(defaultDiffMode) => update({ defaultDiffMode })}
                  options={[
                    { value: 'side', label: '并排' },
                    { value: 'inline', label: '行内' },
                  ]}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">默认忽略空白字符</div>
                  <div className="settings-row-caption">每次开始新的文本对比时默认启用</div>
                </div>
                <Toggle
                  label="默认忽略空白字符"
                  checked={settings.defaultIgnoreWhitespace}
                  onChange={(defaultIgnoreWhitespace) => update({ defaultIgnoreWhitespace })}
                />
              </div>
            </div>
          </section>

          <section className="settings-group">
            <h2 className="settings-group-title">隐私</h2>
            <div className="settings-card">
              <div className="privacy-note">
                <ShieldCheck />
                <span>所有文本处理均在当前浏览器本地完成，内容不会上传到服务器。</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
