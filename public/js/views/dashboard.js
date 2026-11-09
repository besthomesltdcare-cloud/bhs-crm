import { h, api, money, percent, pageHead, card, statTile, activityList, emptyState, qs } from '../lib.js';
import { barChart, hBars } from '../charts.js';

const PERIODS = [
  ['this_month', 'This month'], ['last_30', 'Last 30 days'], ['last_90', 'Last 90 days'], ['ytd', 'This year'], ['last_12', 'Last 12 months'],
];

export async function dashboardView(root, ctx) {
  const state = { period: ctx.query.period || 'last_12' };
  const d = await api(`/dashboard${qs(state)}`);
  const empty = !d.total_customers && !d.active_deals.count && !d.won.count && !d.lost.count;

  const select = h('select', { id: 'period', class: 'input input-sm', onchange: () => { location.hash = `#/?period=${select.value}`; } },
    PERIODS.map(([v, l]) => h('option', { value: v }, l)));
  select.value = d.period.key;
  const period = h('div', { class: 'period' }, h('label', { for: 'period' }, 'Reporting period'), select);

  root.append(pageHead('Dashboard', 'How the business development pipeline is doing.', period));

  if (empty) {
    root.append(emptyState({
      title: 'Your CRM is empty', text: 'Add your first customer to start tracking deals, tasks and revenue.', iconName: 'customers',
      action: h('a', { class: 'btn btn-primary', href: '#/customers' }, 'Go to customers'),
    }));
  }

  const decided = d.won.count + d.lost.count;
  root.append(h('div', { class: 'tiles' },
    statTile({ label: 'Revenue won this month', value: money(d.revenue_this_month), sub: 'Always the current calendar month', tone: 'won', href: '#/reports' }),
    statTile({ label: 'Active deals', value: d.active_deals.count, sub: `${money(d.active_deals.value)} open pipeline`, href: '#/deals?outcome=open' }),
    statTile({ label: 'Total customers', value: d.total_customers, sub: `${d.new_customers} new, ${d.period.label.toLowerCase()}`, href: '#/customers' }),
    statTile({ label: 'Deals won', value: d.won.count, sub: `${money(d.won.value)}, ${d.period.label.toLowerCase()}`, href: '#/deals?outcome=won' }),
    statTile({ label: 'Deals lost', value: d.lost.count, sub: decided ? `${percent(d.win_rate)} win rate` : `${d.period.label}`, href: '#/deals?outcome=lost' }),
    statTile({ label: 'Tasks due today', value: d.tasks.due_today, sub: d.tasks.due_today ? 'Still to do' : 'Nothing due today', href: '#/tasks?due=today' }),
    statTile({ label: 'Overdue tasks', value: d.tasks.overdue, sub: d.tasks.overdue ? 'Need attention' : 'All caught up', tone: d.tasks.overdue ? 'bad' : undefined, href: '#/tasks?due=overdue' }),
  ));

  const hasRevenue = d.revenue_series.some((b) => b.value > 0);
  root.append(h('div', { class: 'grid-2' },
    card(`Won revenue, ${d.period.label.toLowerCase()}`,
      hasRevenue ? barChart(d.revenue_series, { caption: 'Won revenue over time' })
        : emptyState({ title: 'No revenue in this period', text: 'Choose a longer period, or close a deal as Won.', iconName: 'reports' })),
    card('Sales pipeline', [hBars(d.pipeline.map((s) => ({
      label: s.label,
      value: s.value,
      display: money(s.value),
      sub: `${s.count} deal${s.count === 1 ? '' : 's'}`,
      tone: s.kind,
      href: s.kind === 'open' ? `#/deals?stage=${s.stage}` : `#/deals?outcome=${s.kind}`,
    })), { caption: 'Sales pipeline by stage', headers: ['Stage', 'Value', 'Deals'] }),
    h('p', { class: 'card-note' }, `Closed rows cover ${d.period.label.toLowerCase()}. Open stages are current.`)]),
  ));
  root.append(card('Recent activity', activityList(d.recent_activity, { emptyText: 'Activity will appear here as your team works.' })));
}
