/** JWT 工具：解析、生成（可选 HMAC 签名）与签名验证。全部基于 Web Crypto，本地完成。 */

import { decodeBase64, encodeBase64, bytesToBase64 } from './base64Codec';

export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

export function parseJwt(token: string): JwtParts | null {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts.some((p) => p === '')) return null;
  try {
    const header = JSON.parse(decodeBase64(parts[0])) as Record<string, unknown>;
    const payload = JSON.parse(decodeBase64(parts[1])) as Record<string, unknown>;
    return { header, payload, signature: parts[2] };
  } catch {
    return null;
  }
}

export interface ClaimInfo {
  key: string;
  value: string;
}

/** 从 payload 中提取常见时间声明并转成本地可读时间。 */
export function timeClaims(payload: Record<string, unknown>): ClaimInfo[] {
  const out: ClaimInfo[] = [];
  for (const key of ['exp', 'iat', 'nbf']) {
    const v = payload[key];
    if (typeof v === 'number') {
      const ms = v < 1e12 ? v * 1000 : v;
      out.push({ key, value: new Date(ms).toLocaleString('zh-CN', { hour12: false }) });
    }
  }
  return out;
}

export function expiryState(payload: Record<string, unknown>): 'valid' | 'expired' | 'none' {
  const exp = payload['exp'];
  if (typeof exp !== 'number') return 'none';
  const ms = exp < 1e12 ? exp * 1000 : exp;
  return Date.now() < ms ? 'valid' : 'expired';
}

/* ==================== 时间声明增强 ==================== */

const toMs = (v: number) => (v < 1e12 ? v * 1000 : v);

/** 把毫秒差格式化为粗粒度中文时长，例如「3 小时 5 分」「45 秒」。 */
export function formatDuration(ms: number): string {
  const abs = Math.max(0, Math.floor(ms / 1000));
  if (abs >= 86400) {
    const d = Math.floor(abs / 86400);
    const h = Math.floor((abs % 86400) / 3600);
    return h > 0 ? `${d} 天 ${h} 小时` : `${d} 天`;
  }
  if (abs >= 3600) {
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
  }
  if (abs >= 60) return `${Math.floor(abs / 60)} 分钟`;
  return `${abs} 秒`;
}

export type TokenTimeState = 'active' | 'expired' | 'pending';

/** 结合 exp 与 nbf 判断 token 当前是否可用。 */
export function tokenTimeState(
  payload: Record<string, unknown>,
  now = Date.now(),
): TokenTimeState {
  const exp = payload['exp'];
  if (typeof exp === 'number' && now >= toMs(exp)) return 'expired';
  const nbf = payload['nbf'];
  if (typeof nbf === 'number' && now < toMs(nbf)) return 'pending';
  return 'active';
}

export interface ClaimTimeInfo {
  key: 'exp' | 'iat' | 'nbf';
  readable: string;
  relative: string;
  state: 'past' | 'future';
}

/** iat / nbf / exp 的可读时间 + 相对描述（已过期多久 / 剩余多久 / 何时生效）。 */
export function claimTimeInfo(
  payload: Record<string, unknown>,
  now = Date.now(),
): ClaimTimeInfo[] {
  const out: ClaimTimeInfo[] = [];
  for (const key of ['exp', 'iat', 'nbf'] as const) {
    const v = payload[key];
    if (typeof v !== 'number') continue;
    const ms = toMs(v);
    const readable = new Date(ms).toLocaleString('zh-CN', { hour12: false });
    const diff = ms - now;
    let relative: string;
    if (key === 'iat') {
      relative = diff <= 0 ? `生成于 ${formatDuration(-diff)}前` : `${formatDuration(diff)}后才生成`;
    } else if (key === 'exp') {
      relative = diff > 0 ? `剩余 ${formatDuration(diff)}` : `已过期 ${formatDuration(-diff)}`;
    } else {
      relative = diff > 0 ? `${formatDuration(diff)}后生效` : `已生效 ${formatDuration(-diff)}`;
    }
    out.push({ key, readable, relative, state: diff > 0 ? 'future' : 'past' });
  }
  return out;
}

/* ==================== 生成与签名（HS256/384/512） ==================== */

export type HsAlg = 'HS256' | 'HS384' | 'HS512';

const ALG_HASH: Record<HsAlg, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
};

export function isHsAlg(alg: string): alg is HsAlg {
  return alg in ALG_HASH;
}

/** 把 header JSON 中的 alg 字段替换为指定值（解析失败时返回原文）。 */
export function updateAlgInHeader(headerJson: string, alg: string): string {
  try {
    const obj = JSON.parse(headerJson) as Record<string, unknown>;
    obj['alg'] = alg;
    if (alg !== 'none') delete obj['alg_none_stub'];
    return JSON.stringify(obj, null, 2);
  } catch {
    return headerJson;
  }
}

/** 把 payload 中的 exp 更新为 now + seconds（解析失败时返回原文）。 */
export function updateExpInPayload(payloadJson: string, seconds: number, now = Date.now()): string {
  try {
    const obj = JSON.parse(payloadJson) as Record<string, unknown>;
    obj['exp'] = Math.floor(now / 1000) + seconds;
    if (typeof obj['iat'] !== 'number') obj['iat'] = Math.floor(now / 1000);
    return JSON.stringify(obj, null, 2);
  } catch {
    return payloadJson;
  }
}

/** 仅编码：header.payload.（签名为空串，即 alg=none 的未签名 token）。 */
export function encodeJwt(headerJson: string, payloadJson: string, signature = ''): string {
  return `${encodeBase64(headerJson, true)}.${encodeBase64(payloadJson, true)}.${signature}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSign(input: string, secret: string, alg: HsAlg): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: ALG_HASH[alg] },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return bytesToBase64(new Uint8Array(sig), true);
}

/** 生成带 HMAC 签名的 JWT。secret 为空时不抛错，返回仅编码结果。 */
export async function signJwt(
  headerJson: string,
  payloadJson: string,
  secret: string,
  alg: HsAlg,
): Promise<string> {
  const signingInput = encodeJwt(headerJson, payloadJson, '').slice(0, -1); // 去掉尾部点
  if (secret === '') return `${signingInput}.`;
  const sig = await hmacSign(signingInput, secret, alg);
  return `${signingInput}.${sig}`;
}

export interface VerifyResult {
  ok: boolean;
  /** ok=false 时的人类可读原因；ok=true 时为 undefined。 */
  reason?: string;
  /** token header 中声明的算法。 */
  alg?: string;
}

/**
 * 验证 JWT 签名（仅支持 HS256/384/512 共享密钥）。
 * 结果与「是否成功解析」无关——签名无效也可能解析成功。
 */
export async function verifyJwtSignature(
  token: string,
  secret: string,
  expectAlg?: HsAlg,
): Promise<VerifyResult> {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts.some((p) => p === '')) {
    return { ok: false, reason: '不是「header.payload.signature」三段式 token' };
  }
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(decodeBase64(parts[0])) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: 'Header 无法解析（不是合法 Base64URL JSON）' };
  }
  const tokenAlg = typeof header['alg'] === 'string' ? header['alg'] : '';
  if (!tokenAlg) return { ok: false, reason: 'Header 中没有 alg 声明', alg: tokenAlg };
  if (expectAlg && tokenAlg !== expectAlg) {
    return { ok: false, reason: `Header 声明 alg=${tokenAlg}，与所选 ${expectAlg} 不一致`, alg: tokenAlg };
  }
  if (!isHsAlg(tokenAlg)) {
    return {
      ok: false,
      reason: `算法 ${tokenAlg} 需要${tokenAlg.startsWith('ES') ? '公钥' : '公私钥'}验证，暂未支持（当前支持 HS256/384/512）`,
      alg: tokenAlg,
    };
  }
  if (secret === '') return { ok: false, reason: '请输入 Secret 密钥', alg: tokenAlg };
  const expected = await hmacSign(`${parts[0]}.${parts[1]}`, secret, tokenAlg);
  return { ok: timingSafeEqual(expected, parts[2]), alg: tokenAlg };
}
