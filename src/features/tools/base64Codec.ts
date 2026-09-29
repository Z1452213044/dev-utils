/** Base64 编解码（UTF-8 安全，支持 URL-safe 变体）。 */

export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
}

export function base64ToBytes(b64: string): Uint8Array {
  let normalized = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4 !== 0) normalized += '=';
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeBase64(text: string, urlSafe = false): string {
  return bytesToBase64(new TextEncoder().encode(text), urlSafe);
}

export function decodeBase64(b64: string): string {
  return new TextDecoder().decode(base64ToBytes(b64));
}

export function isValidBase64(input: string): boolean {
  const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  return /^[A-Za-z0-9+/]*$/.test(normalized) && normalized.length % 4 !== 1;
}
