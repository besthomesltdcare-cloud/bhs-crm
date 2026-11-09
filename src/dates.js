// Calendar dates are plain local 'YYYY-MM-DD' strings; event timestamps are ISO UTC.
const pad = (n) => String(n).padStart(2, '0');

export const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const fromDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => fromDate(new Date());
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return fromDate(d); };
export const monthStart = (s) => `${s.slice(0, 7)}-01`;
export const addMonths = (s, n) => { const d = toDate(monthStart(s)); d.setMonth(d.getMonth() + n); return fromDate(d); };
export const isDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromDate(toDate(s)) === s;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Monday of the week containing s.
const weekStart = (s) => addDays(s, -((toDate(s).getDay() + 6) % 7));

export function buckets(from, to, granularity) {
  const out = [];
  if (granularity === 'month') {
    for (let m = monthStart(from); m <= to; m = addMonths(m, 1)) {
      const d = toDate(m);
      out.push({ key: m.slice(0, 7), label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, value: 0, count: 0 });
    }
  } else {
    for (let w = weekStart(from); w <= to; w = addDays(w, 7)) {
      const d = toDate(w);
      out.push({ key: w, label: `${d.getDate()} ${MONTHS[d.getMonth()]}`, value: 0, count: 0 });
    }
  }
  return out;
}

export const bucketKey = (date, granularity) => (granularity === 'month' ? date.slice(0, 7) : weekStart(date));
