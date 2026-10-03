/** 将 pg 返回的 DATE 值统一格式化为 YYYY-MM-DD */
export function toDateStr(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
  }
  return String(v as string).slice(0, 10);
}

/** 今天（可偏移天数），格式 YYYY-MM-DD */
export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
