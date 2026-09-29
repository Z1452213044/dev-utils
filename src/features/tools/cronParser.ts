/** 轻量 cron 解析：6 段「秒 分 时 日 月 周」，兼容 5 段（秒自动为 0）。支持 * , - /。 */

export interface CronFields {
  second: number[];
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[]; // 0=周日 … 6=周六，7 也视为周日
}

export interface CronParseResult {
  fields: CronFields;
  error: null;
}

export type CronParseError = { error: string; field: string };

function parseField(field: string, min: number, max: number): number[] | string {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) return `步进「${stepPart}」无效`;

    let start = min;
    let end = max;
    if (rangePart !== '*') {
      const m = rangePart.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return `「${rangePart}」不是有效值`;
      start = Number(m[1]);
      end = m[2] === undefined ? start : Number(m[2]);
      if (start < min || start > max || end < min || end > max) return `值超出范围 ${min}-${max}`;
      if (end < start) return `区间 ${start}-${end} 无效`;
    }
    if (stepPart !== undefined && rangePart === '*') {
      start = min;
    }
    for (let v = start; v <= end; v += step) values.add(v);
  }
  return Array.from(values).sort((a, b) => a - b);
}

export function parseCron(expr: string): CronParseResult | CronParseError {
  let parts = expr.trim().split(/\s+/);
  if (parts.length === 5) parts = ['0', ...parts]; // 5 段兼容：秒补 0
  if (parts.length !== 6) return { error: '需要 6 个字段：秒 分 时 日 月 周', field: '整体' };

  const second = parseField(parts[0], 0, 59);
  if (typeof second === 'string') return { error: second, field: '秒' };
  const minute = parseField(parts[1], 0, 59);
  if (typeof minute === 'string') return { error: minute, field: '分钟' };
  const hour = parseField(parts[2], 0, 23);
  if (typeof hour === 'string') return { error: hour, field: '小时' };
  const dayOfMonth = parseField(parts[3], 1, 31);
  if (typeof dayOfMonth === 'string') return { error: dayOfMonth, field: '日' };
  const month = parseField(parts[4], 1, 12);
  if (typeof month === 'string') return { error: month, field: '月' };
  const dayOfWeek = parseField(parts[5], 0, 7);
  if (typeof dayOfWeek === 'string') return { error: dayOfWeek, field: '星期' };

  return {
    fields: {
      second,
      minute,
      hour,
      dayOfMonth,
      month,
      dayOfWeek: Array.from(new Set(dayOfWeek.map((d) => (d === 7 ? 0 : d)))).sort((a, b) => a - b),
    },
    error: null,
  };
}

const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/** 生成人性化中文描述（尽力而为，不追求穷举自然语言）。 */
export function describeCron(fields: CronFields): string {
  const parts: string[] = [];
  const pad2 = (n: number) => String(n).padStart(2, '0');

  const everySecond = fields.second.length === 60;
  const everyMinute = fields.minute.length === 60;
  const everyHour = fields.hour.length === 24;
  const secSuffix = () => {
    if (everySecond) return '，每秒';
    return `，第 ${fields.second.join('、')} 秒`;
  };

  if (everyMinute && everyHour) {
    if (everySecond) {
      parts.push('每秒');
    } else {
      parts.push(`每分钟的第 ${fields.second.join('、')} 秒`);
    }
  } else if (everyHour) {
    parts.push(`每小时的第 ${fields.minute.join('、')} 分${secSuffix()}`);
  } else {
    const times: string[] = [];
    const singleSecond = fields.second.length === 1;
    outer: for (const hour of fields.hour) {
      for (const minute of fields.minute) {
        if (singleSecond) {
          times.push(`${pad2(hour)}:${pad2(minute)}:${pad2(fields.second[0])}`);
        } else {
          times.push(`${pad2(hour)}:${pad2(minute)}`);
        }
        if (times.length > 12) {
          times.push('…');
          break outer;
        }
      }
    }
    parts.push(`每天 ${times.join('、')}${singleSecond ? '' : secSuffix()}`);
  }

  if (fields.dayOfMonth.length !== 31) {
    parts.push(`仅在 ${fields.dayOfMonth.join('、')} 号`);
  }
  if (fields.month.length !== 12) {
    parts.push(`仅在 ${fields.month.map((m) => MONTH_NAMES[m - 1]).join('、')}`);
  }
  if (fields.dayOfWeek.length !== 7) {
    parts.push(`仅在 ${fields.dayOfWeek.map((d) => WEEK_NAMES[d]).join('、')}`);
  }

  return parts.join('，');
}

/** 计算从 after 之后的下一次执行时间（秒级精度，最多向后扫描 4 年）。 */
export function nextCronExecution(fields: CronFields, after: Date): Date | null {
  const domRestricted = fields.dayOfMonth.length !== 31;
  const dowRestricted = fields.dayOfWeek.length !== 7;

  const cursor = new Date(after.getTime());
  cursor.setMilliseconds(0);
  cursor.setSeconds(cursor.getSeconds() + 1);

  const limit = new Date(after.getTime() + 4 * 366 * 24 * 3600 * 1000);
  while (cursor <= limit) {
    const monthOk = fields.month.includes(cursor.getMonth() + 1);
    if (!monthOk) {
      // 跳到下月 1 日
      cursor.setMonth(cursor.getMonth() + 1, 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    const dayOk =
      domRestricted && dowRestricted
        ? fields.dayOfMonth.includes(cursor.getDate()) || fields.dayOfWeek.includes(cursor.getDay())
        : (domRestricted ? fields.dayOfMonth.includes(cursor.getDate()) : true) &&
          (dowRestricted ? fields.dayOfWeek.includes(cursor.getDay()) : true);
    if (!dayOk) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    for (const hour of fields.hour) {
      for (const minute of fields.minute) {
        for (const second of fields.second) {
          const candidate = new Date(cursor);
          candidate.setHours(hour, minute, second, 0);
          if (candidate > after) return candidate;
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return null;
}

export function nextCronExecutions(fields: CronFields, after: Date, count: number): Date[] {
  const out: Date[] = [];
  let cursor = after;
  for (let i = 0; i < count; i++) {
    const next = nextCronExecution(fields, cursor);
    if (!next) break;
    out.push(next);
    cursor = next;
  }
  return out;
}
