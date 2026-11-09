import { h, api, getMeta, money, qs, pageHead, button, iconButton, dataTable, filterBar, resultsArea, emptyState, card, activityList, customerStatusBadge, repName, opts, CUSTOMER_STATUS } from '../lib.js';
import { customerForm, deleteCustomer, dealForm, taskForm } from '../forms.js';
import { dealMiniTable, taskMiniTable, facts } from './common.js';

export async function customersView(root, ctx) {
  const state = { q: '', status: '', rep: '', location: '', sort: 'name', dir: 'asc', ...ctx.query };
  const meta = await getMeta();

  const results = resultsArea(async () => {
    const rows = await api(`/customers${qs(state)}`);
    ctx.setQuery(state);
    if (!rows.length) {
      const filtered = state.q || state.status || state.rep || state.location;
      return emptyState({
        title: filtered ? 'No customers match these filters' : 'No customers yet',
        text: filtered ? 'Try clearing a filter or searching for something else.' : 'Add your first customer to get started.',
        iconName: 'customers',
        action: filtered ? null : button('Add customer', () => customerForm(), { primary: true, iconName: 'plus' }),
      });
    }
    return h('div', null,
      h('p', { class: 'result-count' }, `${rows.length} customer${rows.length === 1 ? '' : 's'}`),
      dataTable({
        caption: 'Customers',
        rows,
        sort: state.sort,
        dir: state.dir,
        onSort: (s, d) => { state.sort = s; state.dir = d; results.run(); },
        columns: [
          { label: 'Name', sort: 'name', render: (c) => h('a', { class: 'strong', href: `#/customers/${c.id}` }, c.name) },
          { label: 'Company', sort: 'company', render: (c) => c.company },
          { label: 'Location', sort: 'location', render: (c) => c.location },
          { label: 'Status', sort: 'status', render: (c) => customerStatusBadge(c.status) },
          { label: 'Representative', sort: 'rep', render: repName },
          { label: 'Open deals', class: 'num', render: (c) => c.open_deals },
          { label: 'Won value', sort: 'won', class: 'num', render: (c) => money(c.won_value) },
          {
            label: 'Actions', hideLabel: true, class: 'cell-actions',
            render: (c) => [iconButton('edit', `Edit ${c.name}`, () => customerForm(c)), iconButton('trash', `Delete ${c.name}`, () => deleteCustomer(c), 'icon-danger')],
          },
        ],
      }));
  });

  root.append(
    pageHead('Customers', 'Everyone you work with or refer from.', button('New customer', () => customerForm(), { primary: true, iconName: 'plus' })),
    filterBar([
      { name: 'q', label: 'Search', type: 'search', placeholder: 'Name, company, email, phone' },
      { name: 'status', label: 'Status', type: 'select', all: 'All statuses', options: opts(CUSTOMER_STATUS) },
      { name: 'rep', label: 'Representative', type: 'select', all: 'All representatives', options: [{ value: 'none', label: 'Unassigned' }, ...meta.reps.map((r) => ({ value: r.id, label: r.name }))] },
      { name: 'location', label: 'Location', type: 'select', all: 'All locations', options: meta.locations.map((l) => ({ value: l, label: l })) },
    ], state, results.run),
    results.el);
  await results.run();
}

export async function customerDetailView(root, ctx) {
  const [id] = ctx.params;
  const c = await api(`/customers/${id}`);
  const openDeals = c.deals.filter((d) => d.stage !== 'closed');
  root.append(
    h('a', { class: 'back', href: '#/customers' }, '← All customers'),
    pageHead(c.name, c.company, [
      button('Edit', () => customerForm(c), { iconName: 'edit' }),
      button('Delete', () => deleteCustomer(c, () => { location.hash = '#/customers'; }), { iconName: 'trash', danger: true }),
    ]),
    h('div', { class: 'grid-side' },
      h('div', { class: 'stack' },
        card('Details', [facts([
          ['Status', customerStatusBadge(c.status)],
          ['Email', c.email && h('a', { href: `mailto:${c.email}` }, c.email)],
          ['Phone', c.phone && h('a', { href: `tel:${c.phone.replace(/\s/g, '')}` }, c.phone)],
          ['Location', c.location],
          ['Representative', c.rep_id ? h('a', { href: `#/team/${c.rep_id}` }, repName(c)) : repName(c)],
          ['Open pipeline', money(openDeals.reduce((s, d) => s + d.value, 0))],
          ['Won value', money(c.won_value)],
        ]), c.notes && h('div', { class: 'notes' }, h('h3', null, 'Notes'), h('p', null, c.notes))])),
      h('div', { class: 'stack' },
        card(`Deals (${c.deals.length})`, dealMiniTable(c.deals, { showCustomer: false }), button('Add deal', () => dealForm(null, { customer_id: c.id, rep_id: c.rep_id ?? '', stay: true }), { small: true, iconName: 'plus' })),
        card(`Tasks (${c.tasks.length})`, taskMiniTable(c.tasks), button('Add task', () => taskForm(null, { customer_id: c.id, rep_id: c.rep_id ?? '' }), { small: true, iconName: 'plus' })),
        card('Activity history', activityList(c.activity)))));
}
