import { h, api, money, percent, qs, pageHead, button, iconButton, dataTable, filterBar, resultsArea, emptyState, card, statTile, badge, customerStatusBadge } from '../lib.js';
import { repForm, deactivateRep, reactivateRep } from '../forms.js';
import { barChart } from '../charts.js';
import { dealMiniTable, taskMiniTable, facts } from './common.js';

const statusBadge = (s) => (s === 'active' ? badge('Active', 'good') : badge('Inactive', 'neutral'));

export async function teamView(root, ctx) {
  const state = { q: '', status: '', sort: 'name', dir: 'asc', ...ctx.query };
  const results = resultsArea(async () => {
    const rows = await api(`/reps${qs(state)}`);
    ctx.setQuery(state);
    if (!rows.length) {
      const filtered = state.q || state.status;
      return emptyState({
        title: filtered ? 'Nobody matches these filters' : 'No sales representatives yet',
        text: filtered ? 'Try clearing a filter.' : 'Add your team so customers, deals and tasks can be assigned.',
        iconName: 'team',
        action: filtered ? null : button('Add representative', () => repForm(), { primary: true, iconName: 'plus' }),
      });
    }
    return dataTable({
      caption: 'Sales representatives',
      rows,
      sort: state.sort,
      dir: state.dir,
      onSort: (s, d) => { state.sort = s; state.dir = d; results.run(); },
      rowClass: (r) => (r.status === 'inactive' ? 'row-muted' : undefined),
      columns: [
        { label: 'Name', sort: 'name', render: (r) => h('a', { class: 'strong', href: `#/team/${r.id}` }, r.name) },
        { label: 'Role', sort: 'role', render: (r) => r.role },
        { label: 'Status', sort: 'status', render: (r) => statusBadge(r.status) },
        { label: 'Customers', sort: 'customers', class: 'num', render: (r) => r.customer_count },
        { label: 'Open pipeline', sort: 'open', class: 'num', render: (r) => money(r.open_value) },
        { label: 'Won revenue', sort: 'won', class: 'num', render: (r) => money(r.won_value) },
        { label: 'Actions', hideLabel: true, class: 'cell-actions', render: (r) => iconButton('edit', `Edit ${r.name}`, () => repForm(r)) },
      ],
    });
  });
  root.append(
    pageHead('Sales team', 'Who owns which customers, deals and tasks.', button('New representative', () => repForm(), { primary: true, iconName: 'plus' })),
    filterBar([
      { name: 'q', label: 'Search', type: 'search', placeholder: 'Name, email or role' },
      { name: 'status', label: 'Status', type: 'select', all: 'All statuses', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
    ], state, results.run),
    results.el);
  await results.run();
}

export async function repDetailView(root, ctx) {
  const [id] = ctx.params;
  const r = await api(`/reps/${id}`);
  const p = r.performance;
  root.append(
    h('a', { class: 'back', href: '#/team' }, '← Sales team'),
    pageHead(r.name, r.role, [
      button('Edit', () => repForm(r), { iconName: 'edit' }),
      r.status === 'active'
        ? button('Deactivate', () => deactivateRep(r), { danger: true })
        : button('Reactivate', () => reactivateRep(r)),
    ]),
    h('div', { class: 'tiles' },
      statTile({ label: 'Won revenue (all time)', value: money(p.won_value), sub: `${p.won_count} deals won`, tone: 'won' }),
      statTile({ label: 'Open pipeline', value: money(p.open_value), sub: `${p.open_deals} open deals` }),
      statTile({ label: 'Win rate', value: percent(p.win_rate), sub: `${p.won_count} won, ${p.lost_count} lost` }),
      statTile({ label: 'Average won deal', value: p.avg_won === null ? 'No data' : money(p.avg_won) }),
      statTile({ label: 'Overdue tasks', value: p.overdue_tasks, tone: p.overdue_tasks ? 'bad' : undefined, sub: `${r.open_tasks} open in total` })),
    h('div', { class: 'grid-side' },
      h('div', { class: 'stack' },
        card('Details', facts([
          ['Status', statusBadge(r.status)],
          ['Email', h('a', { href: `mailto:${r.email}` }, r.email)],
          ['Phone', r.phone && h('a', { href: `tel:${r.phone.replace(/\s/g, '')}` }, r.phone)],
        ])),
        card(`Customers (${r.customers.length})`, r.customers.length
          ? h('ul', { class: 'simple-list' }, r.customers.map((c) => h('li', null, h('a', { href: `#/customers/${c.id}` }, c.name), customerStatusBadge(c.status))))
          : h('p', { class: 'muted pad' }, 'No customers assigned.'))),
      h('div', { class: 'stack' },
        card('Won revenue, last 12 months', p.won_by_month.some((b) => b.value > 0) ? barChart(p.won_by_month, { caption: `Won revenue for ${r.name}`, height: 200 }) : h('p', { class: 'muted pad' }, 'No won revenue in the last 12 months.')),
        card(`Deals (${r.deals.length})`, dealMiniTable(r.deals, { showRep: false })),
        card(`Tasks (${r.tasks.length})`, taskMiniTable(r.tasks, { showOwner: false })))));
}
