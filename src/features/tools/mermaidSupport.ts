// Mermaid 图表支持：占位符生成 + 懒加载渲染。
// 设计约定：
// - renderMarkdown 阶段把 ```mermaid 代码块替换为占位 div（data 属性携带源码），
//   保证 DOMPurify 消毒链路不变；
// - 预览阶段懒加载 mermaid（单独 chunk），把占位符替换为 SVG；
// - 渲染失败时保留源码并标记错误样式，不阻塞其余内容。

export const MERMAID_PLACEHOLDER_CLASS = 'md-mermaid';
export const MERMAID_SRC_ATTR = 'data-mermaid-src';

export function isMermaidLang(lang: string | undefined): boolean {
  return (lang ?? '').trim().toLowerCase() === 'mermaid';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mermaidPlaceholderHtml(code: string): string {
  const encoded = encodeURIComponent(code);
  const visible = escapeHtml(code);
  return (
    `<div class="${MERMAID_PLACEHOLDER_CLASS}" ${MERMAID_SRC_ATTR}="${encoded}">` +
    `<pre>${visible}</pre>` +
    `</div>`
  );
}

type MermaidModule = typeof import('mermaid');

let mermaidPromise: Promise<MermaidModule> | null = null;

function currentTheme(): MermaidTheme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
}

type MermaidTheme = 'default' | 'dark';

let initializedTheme: MermaidTheme | null = null;

function loadMermaid(): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      initializedTheme = currentTheme();
      mod.default.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: initializedTheme,
        fontFamily: 'inherit',
      });
      return mod;
    });
  }
  return mermaidPromise;
}

// 浅色/深色主题切换后需要重新初始化，否则图表配色不会跟着变。
async function ensureMermaid(): Promise<MermaidModule['default']> {
  const mod = await loadMermaid();
  const theme = currentTheme();
  if (initializedTheme !== theme) {
    initializedTheme = theme;
    mod.default.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      fontFamily: 'inherit',
    });
  }
  return mod.default;
}

let renderSeq = 0;

export async function renderMermaidBlocks(root: HTMLElement | null): Promise<void> {
  if (!root) return;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(`.${MERMAID_PLACEHOLDER_CLASS}[${MERMAID_SRC_ATTR}]`));
  if (blocks.length === 0) return;

  let mermaid: MermaidModule['default'];
  try {
    mermaid = await ensureMermaid();
  } catch {
    // 动态加载失败（如网络被禁的离线部署残留），保留源码展示。
    return;
  }

  for (const block of blocks) {
    const encoded = block.getAttribute(MERMAID_SRC_ATTR);
    if (!encoded) continue;
    const code = decodeURIComponent(encoded);
    block.classList.remove('md-mermaid-err');
    try {
      renderSeq += 1;
      const { svg } = await mermaid.render(`md-mermaid-${renderSeq}`, code);
      block.innerHTML = svg;
      block.classList.add('md-mermaid-ok');
    } catch {
      // 语法错误：回退为源码展示，标记错误态。
      block.innerHTML = `<pre>${escapeHtml(code)}</pre>`;
      block.classList.add('md-mermaid-err');
    }
  }
}
