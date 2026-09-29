export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export function modKey(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}
