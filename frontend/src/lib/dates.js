export const TZ = 'Asia/Dushanbe';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function parts(date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  const y = +p.year, m = +p.month, d = +p.day;
  const wd = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return { y, m, d, H: p.hour, M: p.minute, wd };
}

const pad = (n) => String(n).padStart(2, '0');

export function dayKey(date = new Date()) {
  const p = parts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function keyWeekday(key) {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 7));
}

export function nextWeekend(todayKey) {
  const wd = keyWeekday(todayKey);
  return wd >= 5 ? todayKey : addDays(todayKey, 5 - wd);
}
