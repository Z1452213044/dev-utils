import { useEffect, useState } from 'react';
import {
  FileDiff,
  Braces,
  Type,
  Binary,
  Link2,
  KeyRound,
  Hash,
  Fingerprint,
  Clock,
  ArrowLeftRight,
  Regex as RegexIcon,
  CalendarClock,
  BookOpen,
  Code2,
  QrCode,
  Lock,
  Quote,
  WrapText,
  Menu,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import type { ToolGroup } from '../components/Sidebar';
import { Popover } from '../components/Popover';
import { modKey } from '../utils/platform';
import { SettingsProvider } from './settings';
import DiffPage from '../features/diff/DiffPage';
import JsonPage from '../features/json/JsonPage';
import TextPage from '../features/text/TextPage';
import Base64Page from '../features/tools/Base64Page';
import UrlPage from '../features/tools/UrlPage';
import JwtPage from '../features/tools/JwtPage';
import TimestampPage from '../features/tools/TimestampPage';
import YamlPage from '../features/tools/YamlPage';
import RadixPage from '../features/tools/RadixPage';
import RegexPage from '../features/tools/RegexPage';
import UuidPage from '../features/tools/UuidPage';
import HashPage from '../features/tools/HashPage';
import CronPage from '../features/tools/CronPage';
import MarkdownPage from '../features/tools/MarkdownPage';
import HtmlPage from '../features/tools/HtmlPage';
import QrPage from '../features/tools/QrPage';
import PasswordPage from '../features/tools/PasswordPage';
import EscapePage from '../features/tools/EscapePage';
import LineEndingPage from '../features/tools/LineEndingPage';
import SettingsPage from '../features/settings/SettingsPage';

const GROUPS: ToolGroup[] = [
  {
    label: '工具',
    tools: [
      { id: 'diff', label: '文本对比', icon: FileDiff },
      { id: 'json', label: 'JSON 格式化', icon: Braces },
      { id: 'text', label: '文本工具', icon: Type },
      { id: 'markdown', label: 'Markdown 阅读', icon: BookOpen },
      { id: 'html', label: 'HTML 预览', icon: Code2 },
    ],
  },
  {
    label: '编码与加密',
    tools: [
      { id: 'base64', label: 'Base64', icon: Binary },
      { id: 'url', label: 'URL 编解码', icon: Link2 },
      { id: 'escape', label: 'HTML/Unicode 转义', icon: Quote },
      { id: 'jwt', label: 'JWT 工具', icon: KeyRound },
      { id: 'hash', label: 'Hash 计算', icon: Hash },
      { id: 'password', label: '密码生成', icon: Lock },
      { id: 'uuid', label: 'UUID 生成', icon: Fingerprint },
    ],
  },
  {
    label: '格式与转换',
    tools: [
      { id: 'timestamp', label: '时间戳', icon: Clock },
      { id: 'radix', label: '进制转换', icon: ArrowLeftRight },
      { id: 'yaml', label: 'JSON ↔ YAML', icon: Braces },
      { id: 'lineending', label: '换行符转换', icon: WrapText },
      { id: 'qrcode', label: '二维码生成', icon: QrCode },
    ],
  },
  {
    label: '文本与正则',
    tools: [
      { id: 'regex', label: '正则测试', icon: RegexIcon },
      { id: 'cron', label: 'Cron 解析', icon: CalendarClock },
    ],
  },
];

const PAGES: Record<string, React.ComponentType> = {
  diff: DiffPage,
  json: JsonPage,
  text: TextPage,
  base64: Base64Page,
  url: UrlPage,
  jwt: JwtPage,
  hash: HashPage,
  uuid: UuidPage,
  timestamp: TimestampPage,
  radix: RadixPage,
  yaml: YamlPage,
  regex: RegexPage,
  cron: CronPage,
  markdown: MarkdownPage,
  html: HtmlPage,
  qrcode: QrPage,
  password: PasswordPage,
  escape: EscapePage,
  lineending: LineEndingPage,
};

function Shell() {
  const [active, setActive] = useState('diff');
  const [collapsed, setCollapsed] = useState(false);

  // 移动端底栏固定展示的常用工具；其余收进「更多」菜单
  const MOBILE_MAIN = ['diff', 'json', 'text', 'base64'];
  const allTools = GROUPS.flatMap((g) => g.tools);
  const mobileMain = allTools.filter((t) => MOBILE_MAIN.includes(t.id));

  // Ctrl/Cmd + O opens a file in the active tool
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modKey(e) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('dt-open-file'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 全局兜底：文件拖到未处理区域时阻止浏览器默认打开行为
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  const settingsActive = active === 'settings';
  const ActivePage = PAGES[active];

  return (
    <div className="app">
      <Sidebar
        groups={GROUPS}
        activeId={active}
        onSelect={setActive}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        settingsActive={settingsActive}
      />

      <main className="workspace">
        {ActivePage && <ActivePage />}
        {settingsActive && <SettingsPage />}
      </main>

      {/* Mobile bottom navigation */}
      <div className="bottom-nav" aria-label="工具导航">
        {mobileMain.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              aria-current={active === tool.id ? 'page' : undefined}
              className={`sidebar-item ${active === tool.id ? 'active' : ''}`}
              onClick={() => setActive(tool.id)}
            >
              <Icon className="sidebar-icon" />
              <span className="sidebar-label">{tool.label}</span>
            </button>
          );
        })}
        <Popover
          label="更多工具"
          trigger={
            <button
              className={`sidebar-item ${allTools.some((t) => t.id === active) ? '' : 'active'}`}
              aria-label="更多工具"
            >
              <Menu className="sidebar-icon" />
              <span className="sidebar-label">更多</span>
            </button>
          }
        >
          {(close) => (
            <div className="more-menu" role="menu">
              {GROUPS.map((group) => (
                <div key={group.label} className="more-group">
                  <div className="more-group-label">{group.label}</div>
                  <div className="more-group-items">
                    {group.tools.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.id}
                          role="menuitem"
                          className={`more-item ${active === tool.id ? 'active' : ''}`}
                          onClick={() => {
                            setActive(tool.id);
                            close();
                          }}
                        >
                          <Icon className="more-item-icon" />
                          {tool.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="more-group">
                <div className="more-group-label">其他</div>
                <div className="more-group-items">
                  <button
                    role="menuitem"
                    className={`more-item ${active === 'settings' ? 'active' : ''}`}
                    onClick={() => {
                      setActive('settings');
                      close();
                    }}
                  >
                    <svg className="more-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    设置
                  </button>
                </div>
              </div>
            </div>
          )}
        </Popover>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}
