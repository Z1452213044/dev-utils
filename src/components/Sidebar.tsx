import { Monitor, Moon, Sun, Settings as SettingsIcon, PanelLeft, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { Popover } from './Popover';
import { useSettings } from '../app/settings';
import type { Appearance } from '../app/settings';

export interface ToolDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface ToolGroup {
  label: string | null;
  tools: ToolDef[];
}

interface SidebarProps {
  groups: ToolGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  settingsActive: boolean;
}

function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <rect width="64" height="64" rx="15" fill="#0071e3" />
      <path d="M17 25h22M25 39h22" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  );
}

function AppearanceIcon() {
  return (
    <svg
      className="sidebar-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Sidebar({ groups, activeId, onSelect, collapsed, onToggleCollapse, settingsActive }: SidebarProps) {
  const { settings, update } = useSettings();

  const appearanceOptions: { value: Appearance; label: string; icon: LucideIcon }[] = [
    { value: 'system', label: '跟随系统', icon: Monitor },
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'dark', label: '深色', icon: Moon },
  ];

  const renderItem = (item: { id: string; label: string; icon: LucideIcon; active: boolean; onClick: () => void }) => {
    const Icon = item.icon;
    const button = (
      <button
        aria-current={item.active ? 'page' : undefined}
        className={`sidebar-item ${item.active ? 'active' : ''}`}
        onClick={item.onClick}
        tabIndex={collapsed ? -1 : 0}
      >
        <Icon className="sidebar-icon" />
        <span className="sidebar-label">{item.label}</span>
      </button>
    );
    return collapsed ? (
      <Tooltip key={item.id} label={item.label} placement="bottom">
        <span style={{ display: 'block' }}>{button}</span>
      </Tooltip>
    ) : (
      <div key={item.id}>{button}</div>
    );
  };

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="工具导航">
      <div className="sidebar-brand">
        <BrandMark />
        {!collapsed && <div className="brand-name">开发者工具箱</div>}
        <button
          className="icon-btn sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          tabIndex={0}
        >
          <PanelLeft />
        </button>
      </div>

      <div className="sidebar-scroll">
        {groups.map((group, gi) => (
          <div key={gi}>
            {!collapsed && group.label && <div className="sidebar-category">{group.label}</div>}
            <div className="sidebar-nav" aria-label={group.label ?? '工具'}>
              {group.tools.map((tool) =>
                renderItem({ ...tool, active: activeId === tool.id, onClick: () => onSelect(tool.id) }),
              )}
            </div>
            {gi < groups.length - 1 && <div style={{ height: 'var(--sp-3)' }} />}
          </div>
        ))}
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-footer">
        <Popover
          align="left"
          label="外观"
          trigger={
            <Tooltip label={collapsed ? '外观' : ''} placement="bottom">
              <button className="sidebar-item" aria-haspopup="menu">
                <AppearanceIcon />
                <span className="sidebar-label">外观</span>
              </button>
            </Tooltip>
          }
        >
          {(close) => (
            <div role="menu" aria-label="主题">
              <div className="popover-title">主题</div>
              {appearanceOptions.map((o) => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.value}
                    role="menuitemradio"
                    aria-checked={settings.appearance === o.value}
                    className="popover-item"
                    onClick={() => {
                      update({ appearance: o.value });
                      close();
                    }}
                  >
                    {settings.appearance === o.value ? <Check className="check" /> : <span className="placeholder" />}
                    <Icon style={{ width: 14, height: 14, marginRight: 6 }} />
                    {o.label}
                  </button>
                );
              })}
            </div>
          )}
        </Popover>

        {renderItem({
          id: 'settings',
          label: '设置',
          icon: SettingsIcon,
          active: settingsActive,
          onClick: () => onSelect('settings'),
        })}
      </div>
    </nav>
  );
}
