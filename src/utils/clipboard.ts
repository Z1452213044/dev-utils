export const SUPPORTED_EXTENSIONS = [
  'txt', 'json', 'xml', 'yaml', 'yml', 'md', 'csv', 'log',
  'cpp', 'cc', 'c', 'h', 'hpp', 'go', 'py', 'js', 'ts', 'tsx', 'jsx',
  'java', 'proto', 'conf', 'ini',
];

export const FILE_ACCEPT_ATTR = SUPPORTED_EXTENSIONS.map((e) => '.' + e).join(',');

export function fileExtension(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export async function readTextFile(file: File): Promise<string> {
  return file.text(); // UTF-8 by default
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function pasteFromClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/** 触发浏览器下载 data URL / blob URL。 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
