import { h, api, getMeta, money, percent, qs, pageHead, card, statTile, resultsArea, emptyState, ApiError, todayStr } from '../lib.js';
import { barChart, hBars } from '../charts.js';

function shift(months) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
const PRESETS = [
  ['This month', () => shift(0)],
  ['3 months', () => shift(2)],
  ['6 months', () => shift(5)],
  ['12 months', () => shift(11)],
  ['This year', () => `${new Date().getFullYear()}-01-01`],
];

export async function reportsView(root, ctx) {
  const state = { from: shift(11), to: todayStr(), rep: '', ...ctx.query };
  const meta = await getMeta();

  const from = h('input', { id: 'r-from', type: 'date', class: 'input input-sm', value: state.from, onchange: () => { state.from = from.value; results.run(); } });
  const to = h('input', { id: 'r-to', type: 'date', class: 'input input-sm', value: state.to, onchange: () => { state.to = to.value; results.run(); } });
  const rep = h('select', { id: 'r-rep', class: 'input input-sm', onchange: () => { state.rep = rep.value; results.run(); } },
    h('option', { value: '' }, 'All representatives'), meta.reps.map((r) => h('option', { value: r.id }, r.name)));
  rep.value = state.rep;

  const presets = h('div', { class: 'chips', role: 'group', 'aria-label': 'Date presets' }, PRESETS.map(([label, start]) => h('button', {
    type: 'button', class: 'chip', onclick: () => { state.from = start(); state.to = todayStr(); from.value = state.from; to.value = state.to; results.run(); },
  }, label)));

  const results = resultsArea(async () => {
    if (!state.from || !state.to) throw new ApiError('Choose both a start and an end date.', 422);
    const r = await api(`/reports${qs(state)}`);
    ctx.setQuery(state);
    const t = r.totals;
    const hasClosed = t.won_count + t.lost_count > 0;
    return h('div', { class: 'stack' },
      h('h2', { class: 'section-label section-won' }, 'Won revenue, in the selected dates'),
      h('div', { class: 'tiles' },
        statTile({ label: 'Won revenue', value: money(t.won_value), sub: `${t.won_count} deal${t.won_count === 1 ? '' : 's'} won`, tone: 'won' }),
        statTile({ label: 'Win rate', value: percent(t.win_rate), sub: `${t.won_count} won, ${t.lost_count} lost` }),
        statTile({ label: 'Average won deal', value: t.avg_won === null ? 'No data' : money(t.avg_won) }),
        statTile({ label: 'Lost value', value: money(t.lost_value), sub: `${t.lost_count} deal${t.lost_count === 1 ? '' : 's'} lost` })),
      h('h2', { class: 'section-label section-open' }, 'Open pipeline, as of today (not revenue)'),
      h('div', { class: 'tiles tiles-2' },
        statTile({ label: 'Open pipeline value', value: money(t.open_value), sub: `${t.open_count} open deal${t.open_count === 1 ? '' : 's'}`, tone: 'open' }),
        statTile({ label: 'Probability-weighted', value: money(t.weighted_open), sub: 'Each deal value times its probability', tone: 'open' })),
      h('div', { class: 'grid-2' },
        card('Won revenue by month', r.won_by_month.some((b) => b.value > 0)
          ? barChart(r.won_by_month, { caption: 'Won revenue by month', height: 260 })
          : emptyState({ title: 'No won revenue in these dates', text: 'Try a wider date range or a different representative.', iconName: 'reports' })),
        card('Revenue by sales representative', r.by_rep.length ? hBars(r.by_rep.map((x) => ({
          label: x.name, value: x.won_value, display: money(x.won_value), sub: `${x.won_count} won, ${x.lost_count} lost, ${percent(x.win_rate)} win rate`, tone: 'won', href: `#/team/${x.id}`,
        })), { caption: 'Revenue by sales representative', headers: ['Representative', 'Won revenue', 'Results'] }) : h('p', { class: 'muted pad' }, 'No data.'))),
      card('Deal count and value by pipeline stage', [
        hBars(r.by_stage.map((s) => ({
          label: s.label, value: s.value, display: money(s.value), sub: `${s.count} deal${s.count === 1 ? '' : 's'}`, tone: s.kind,
          href: s.kind === 'open' ? `#/deals?stage=${s.stage}` : `#/deals?outcome=${s.kind}`,
        })), { caption: 'Deals by pipeline stage', headers: ['Stage', 'Value', 'Deals'] }),
        h('p', { class: 'card-note' }, 'Blue bars are open pipeline as of today. Closed rows only count deals closed in the selected dates.'),
        !hasClosed && h('p', { class: 'card-note' }, 'No deals were closed in these dates.'),
      ]));
  });

  root.append(
    pageHead('Revenue reports', 'Calculated live from your deals.'),
    h('form', { class: 'filters', onsubmit: (e) => e.preventDefault() },
      h('div', { class: 'filter' }, h('label', { for: 'r-from' }, 'From'), from),
      h('div', { class: 'filter' }, h('label', { for: 'r-to' }, 'To'), to),
      h('div', { class: 'filter' }, h('label', { for: 'r-rep' }, 'Representative'), rep),
      presets),
    results.el);
  await results.run();
}
