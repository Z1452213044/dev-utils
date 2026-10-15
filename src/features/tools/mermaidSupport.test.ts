import { describe, expect, it } from 'vitest';
import { isMermaidLang, mermaidPlaceholderHtml, MERMAID_PLACEHOLDER_CLASS, MERMAID_SRC_ATTR } from './mermaidSupport';

describe('mermaid 语言识别', () => {
  it('识别 mermaid 代码块', () => {
    expect(isMermaidLang('mermaid')).toBe(true);
    expect(isMermaidLang('  Mermaid  ')).toBe(true);
  });

  it('不误伤其它语言', () => {
    expect(isMermaidLang('mermaidjs')).toBe(false);
    expect(isMermaidLang('js')).toBe(false);
    expect(isMermaidLang(undefined)).toBe(false);
    expect(isMermaidLang('')).toBe(false);
  });
});

describe('mermaid 占位符', () => {
  it('带占位类与源码属性', () => {
    const html = mermaidPlaceholderHtml('graph TD\nA-->B');
    expect(html).toContain(`class="${MERMAID_PLACEHOLDER_CLASS}"`);
    expect(html).toContain(MERMAID_SRC_ATTR);
    expect(html).toContain(encodeURIComponent('graph TD\nA-->B'));
  });

  it('对 HTML 特殊字符做转义', () => {
    const html = mermaidPlaceholderHtml('graph TD\nA["<img src=x onerror=alert(1)>"]-->B');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img src=x');
  });

  it('编码后的源码可以原样还原', () => {
    const code = 'sequenceDiagram\nAlice->>Bob: 你好 <script>alert(1)</script>';
    const html = mermaidPlaceholderHtml(code);
    const encoded = /data-mermaid-src="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(decodeURIComponent(encoded)).toBe(code);
  });
});
