import { describe, it, expect } from 'vitest';
import { encodeBase64, decodeBase64, isValidBase64 } from './base64Codec';
import {
  parseJwt,
  timeClaims,
  expiryState,
  encodeJwt,
  signJwt,
  verifyJwtSignature,
  tokenTimeState,
  claimTimeInfo,
  formatDuration,
  updateAlgInHeader,
  updateExpInPayload,
} from './jwtCodec';
import { md5Hex } from './md5';
import { parseCron, describeCron, nextCronExecutions } from './cronParser';

describe('base64', () => {
  it('round-trips ASCII and UTF-8', () => {
    for (const text of ['hello', '开发者工具箱', 'mix 混合 123 !@#']) {
      expect(decodeBase64(encodeBase64(text))).toBe(text);
    }
  });

  it('URL-safe variant avoids + and /', () => {
    const std = encodeBase64('subjects?±<<');
    const url = encodeBase64('subjects?±<<', true);
    expect(url).not.toMatch(/[+/]/);
    expect(url.includes('=')).toBe(false);
    expect(decodeBase64(std)).toBe(decodeBase64(url));
  });

  it('validates base64 input', () => {
    expect(isValidBase64('aGVsbG8=')).toBe(true);
    expect(isValidBase64('aGVsbG8')).toBe(true); // 无 padding 可接受
    expect(isValidBase64('not*valid')).toBe(false);
  });
});

describe('jwt', () => {
  const b64 = (obj: unknown) => encodeBase64(JSON.stringify(obj), true);
  const makeToken = (header: unknown, payload: unknown) =>
    `${b64(header)}.${b64(payload)}.sig`;

  it('parses header and payload', () => {
    const token = makeToken({ alg: 'HS256', typ: 'JWT' }, { sub: 'user1', exp: 4102444800 });
    const parsed = parseJwt(token);
    expect(parsed).not.toBeNull();
    expect(parsed!.header['alg']).toBe('HS256');
    expect(parsed!.payload['sub']).toBe('user1');
    expect(parsed!.signature).toBe('sig');
  });

  it('rejects malformed tokens', () => {
    expect(parseJwt('abc')).toBeNull();
    expect(parseJwt('a.b')).toBeNull();
    expect(parseJwt('..sig')).toBeNull();
    expect(parseJwt('!!!.???...')).toBeNull();
  });

  it('extracts time claims and expiry state', () => {
    const payload = { exp: 4102444800, iat: 1600000000 };
    const claims = timeClaims(payload);
    expect(claims).toHaveLength(2);
    expect(claims[0].key).toBe('exp');
    expect(expiryState(payload)).toBe('valid');
    expect(expiryState({ exp: 1000 })).toBe('expired');
    expect(expiryState({})).toBe('none');
  });

  it('encodes without signature (trailing dot)', () => {
    const token = encodeJwt('{"alg":"none"}', '{"sub":"u1"}');
    expect(token.endsWith('.')).toBe(true);
    // 空签名（第三段为空）不符合三段式要求，parseJwt 拒绝
    expect(parseJwt(token)).toBeNull();
    expect(decodeBase64(token.split('.')[1])).toBe('{"sub":"u1"}');
  });

  it('signs and verifies HS256 round-trip', async () => {
    const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
    const payload = JSON.stringify({ sub: 'u1', exp: 4102444800 });
    const token = await signJwt(header, payload, 'secret-key', 'HS256');
    expect(token.split('.')).toHaveLength(3);
    const r = await verifyJwtSignature(token, 'secret-key');
    expect(r.ok).toBe(true);
    expect(r.alg).toBe('HS256');
  });

  it('supports HS384 and HS512', async () => {
    for (const alg of ['HS384', 'HS512'] as const) {
      const header = JSON.stringify({ alg });
      const token = await signJwt(header, '{"sub":"u1"}', 'k', alg);
      const r = await verifyJwtSignature(token, 'k');
      expect(r.ok).toBe(true);
    }
  });

  it('rejects wrong secret and tampered payload', async () => {
    const header = JSON.stringify({ alg: 'HS256' });
    const token = await signJwt(header, '{"sub":"u1"}', 'right', 'HS256');
    expect((await verifyJwtSignature(token, 'wrong')).ok).toBe(false);
    // 篡改 payload
    const parts = token.split('.');
    const tampered = `${parts[0]}.${encodeBase64('{"sub":"evil"}', true)}.` + parts[2];
    expect((await verifyJwtSignature(tampered, 'right')).ok).toBe(false);
  });

  it('rejects unsupported algorithms with clear reason', async () => {
    const token = `${encodeBase64('{"alg":"RS256"}', true)}.${encodeBase64('{"sub":"u1"}', true)}.sig`;
    const r = await verifyJwtSignature(token, 'k');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('RS256');
    expect(r.reason).toContain('公');
  });

  it('reports alg mismatch when expected algorithm given', async () => {
    const header = JSON.stringify({ alg: 'HS256' });
    const token = await signJwt(header, '{}', 'k', 'HS256');
    const r = await verifyJwtSignature(token, 'k', 'HS512');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('不一致');
  });

  it('evaluates token time state with exp and nbf', () => {
    const now = Date.now();
    expect(tokenTimeState({ exp: Math.floor(now / 1000) + 3600 }, now)).toBe('active');
    expect(tokenTimeState({ exp: Math.floor(now / 1000) - 10 }, now)).toBe('expired');
    expect(tokenTimeState({ nbf: Math.floor(now / 1000) + 3600 }, now)).toBe('pending');
    expect(tokenTimeState({ nbf: Math.floor(now / 1000) - 10 }, now)).toBe('active');
  });

  it('builds relative descriptions for time claims', () => {
    const now = Date.now();
    const info = claimTimeInfo(
      { exp: Math.floor(now / 1000) + 3600, nbf: Math.floor(now / 1000) - 60, iat: Math.floor(now / 1000) - 120 },
      now,
    );
    expect(info).toHaveLength(3);
    const exp = info.find((c) => c.key === 'exp')!;
    expect(exp.relative).toContain('剩余');
    const iat = info.find((c) => c.key === 'iat')!;
    expect(iat.relative).toContain('生成于');
    expect(formatDuration(3600 * 1000)).toContain('小时');
    expect(formatDuration(45 * 1000)).toContain('秒');
  });

  it('updates alg in header and exp in payload', () => {
    expect(JSON.parse(updateAlgInHeader('{"alg":"HS256","typ":"JWT"}', 'HS512')).alg).toBe('HS512');
    expect(updateAlgInHeader('not-json', 'HS512')).toBe('not-json');
    const updated = JSON.parse(updateExpInPayload('{"sub":"u1"}', 3600, 1700000000000));
    expect(updated.exp).toBe(1700003600);
    expect(updated.iat).toBe(1700000000);
  });
});

describe('md5', () => {
  it('matches known RFC 1321 vectors', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5Hex('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5Hex('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
  });
});

describe('cron', () => {
  it('parses basic expressions', () => {
    const r = parseCron('*/5 * * * *');
    expect('fields' in r).toBe(true);
    if ('fields' in r) {
      expect(r.fields.minute).toHaveLength(12);
      expect(r.fields.hour).toHaveLength(24);
    }
  });

  it('reports errors with field info', () => {
    const r = parseCron('61 * * * *');
    expect('error' in r).toBe(true);
    if (!('fields' in r)) {
      expect(r.error).toContain('0-59');
      expect(r.field).toBe('分钟');
    }
    expect('fields' in parseCron('* * * *')).toBe(false); // 字段数量错误
  });

  it('describes common expressions in Chinese', () => {
    const r = parseCron('0 9 * * 1-5');
    if ('fields' in r) {
      const d = describeCron(r.fields);
      expect(d).toContain('09:00');
      expect(d).toContain('周一');
    }
  });

  it('computes next executions', () => {
    const after = new Date('2026-01-01T10:03:00');
    const r = parseCron('*/5 * * * *');
    if ('fields' in r) {
      const next = nextCronExecutions(r.fields, after, 3);
      expect(next).toHaveLength(3);
      expect(next[0].getMinutes()).toBe(5);
      expect(next[1].getMinutes()).toBe(10);
      expect(next[2].getMinutes()).toBe(15);
    }
  });

  it('skips non-matching days', () => {
    const after = new Date('2026-01-05T23:59:00'); // 周一
    const r = parseCron('0 9 * * 1'); // 每周一 9 点
    if ('fields' in r) {
      const next = nextCronExecutions(r.fields, after, 1);
      expect(next[0].getDay()).toBe(1);
      expect(next[0].getTime()).toBeGreaterThan(after.getTime());
    }
  });

  it('parses 6-field expressions with seconds', () => {
    const r = parseCron('*/10 * * * * *');
    expect('fields' in r).toBe(true);
    if ('fields' in r) {
      expect(r.fields.second).toHaveLength(6);
      expect(r.fields.second[0]).toBe(0);
      expect(r.fields.second[5]).toBe(50);
    }
  });

  it('treats 5-field input as seconds=0', () => {
    const r = parseCron('*/5 * * * *');
    expect('fields' in r).toBe(true);
    if ('fields' in r) {
      expect(r.fields.second).toEqual([0]);
      expect(r.fields.minute).toHaveLength(12);
    }
  });

  it('reports seconds field errors', () => {
    const r = parseCron('99 * * * * *');
    expect('error' in r).toBe(true);
    if (!('fields' in r)) {
      expect(r.error).toContain('0-59');
      expect(r.field).toBe('秒');
    }
  });

  it('computes second-precision next executions', () => {
    const after = new Date('2026-01-01T10:03:02');
    const r = parseCron('*/15 * * * * *'); // 每 15 秒
    if ('fields' in r) {
      const next = nextCronExecutions(r.fields, after, 3);
      expect(next).toHaveLength(3);
      expect(next[0].getSeconds()).toBe(15);
      expect(next[1].getSeconds()).toBe(30);
      expect(next[2].getSeconds()).toBe(45);
    }
  });

  it('describes seconds in Chinese', () => {
    const every30 = parseCron('*/30 * * * * *');
    if ('fields' in every30) {
      expect(describeCron(every30.fields)).toContain('第 0、30 秒');
    }
    const fixed = parseCron('30 * * * * *');
    if ('fields' in fixed) {
      expect(describeCron(fixed.fields)).toContain('第 30 秒');
    }
    const everySecond = parseCron('* * * * * *');
    if ('fields' in everySecond) {
      expect(describeCron(everySecond.fields)).toBe('每秒');
    }
  });
});
