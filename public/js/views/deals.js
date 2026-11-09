import { h, api, getMeta, money, moneyShort, fmtDate, qs, pageHead, button, iconButton, dataTable, filterBar, resultsArea, emptyState, card, activityList, stageBadge, repName, opts, STAGE_LABEL, STAGE_ORDER, icon, outcomeBadge, dayDiff } from '../lib.js';
import { dealForm, deleteDeal, moveDeal, taskForm } from '../forms.js';
import { taskMiniTable, facts } from './common.js';

const prevStage = (d) => STAGE_ORDER[STAGE_ORDER.indexOf(d.stage) - 1];
const nextStage = (d) => STAGE_ORDER[STAGE_ORDER.indexOf(d.stage) + 1];

function dealCard(d) {
  const prev = prevStage(d);
  const next = nextStage(d);
  const late = d.stage !== 'closed' && dayDiff(d.close_date) < 0;
  return h('article', {
    class: `deal-card${d.stage === 'closed' ? ` deal-${d.outcome}` : ''}`, draggable: 'true',
    ondragstart: (e) => { e.dataTransfer.setData('text/plain', String(d.id)); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); },
    ondragend: (e) => e.currentTarget.classList.remove('dragging'),
    dataset: { dealId: d.id },
  },
  h('a', { class: 'deal-name', href: `#/deals/${d.id}` }, d.name),
  h('div', { class: 'deal-customer' }, d.customer_company || d.customer_name),
  h('div', { class: 'deal-row' }, h('strong', null, money(d.value)), d.stage === 'closed' ? outcomeBadge(d.outcome) : h('span', { class: 'muted' }, `${d.probability}%`)),
  h('div', { class: 'deal-meta' }, h('span', null, d.rep_name), h('span', { class: late ? 'late' : undefined }, d.stage === 'closed' ? fmtDate(d.closed_on) : `${late ? 'Late: ' : ''}${fmtDate(d.close_date)}`)),
  h('div', { class: 'deal-move' },
    prev ? iconButton('left', `Move ${d.name} back to ${STAGE_LABEL[prev]}`, () => moveDeal(d, prev)) : h('span'),
    next ? h('button', { class: 'btn btn-sm', type: 'button', 'aria-label': `Move ${d.name} forward to ${STAGE_LABEL[next]}`, onclick: () => moveDeal(d, next) }, next === 'closed' ? 'Close deal' : STAGE_LABEL[next], icon('right', 14)) : h('span')));
}

function pipelineBoard(rows) {
  const byId = new Map(rows.map((d) => [d.id, d]));
  return h('div', { class: 'board', tabindex: '0', role: 'group', 'aria-label': 'Deal pipeline' }, STAGE_ORDER.map((stage) => {
    const items = rows.filter((d) => d.stage === stage);
    const total = items.filter((d) => stage !== 'closed' || d.outcome === 'won').reduce((s, d) => s + d.value, 0);
    return h('section', {
      class: 'column',
      'aria-label': STAGE_LABEL[stage],
      ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('drop'); },
      ondragleave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drop'); },
      ondrop: (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drop');
        const d = byId.get(Number(e.dataTransfer.getData('text/plain')));
        if (d && d.stage !== stage) moveDeal(d, stage);
      },
    },
    h('header', { class: 'column-head' },
      h('h2', null, STAGE_LABEL[stage], h('span', { class: 'count' }, items.length)),
      h('span', { class: 'column-total' }, stage === 'closed' ? `${moneyShort(total)} won` : moneyShort(total))),
    h('div', { class: 'column-body' }, items.length ? items.map(dealCard) : h('p', { class: 'column-empty' }, 'No deals here')));
  }));
}

export async function dealsView(root, ctx) {
  const state = { view: 'board', q: '', stage: '', rep: '', customer: '', outcome: '', close_from: '', close_to: '', sort: 'close_date', dir: 'asc', ...ctx.query };
  const meta = await getMeta();

  const viewBtn = (id, label, iconName) => h('button', {
    type: 'button', class: 'seg-btn', 'aria-pressed': String(state.view === id),
    onclick: () => { state.view = id; seg.querySelectorAll('.seg-btn').forEach((b, i) => b.setAttribute('aria-pressed', String(['board', 'table'][i] === id))); results.run(); },
  }, icon(iconName, 16), label);
  const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Deals view' }, viewBtn('board', 'Pipeline', 'board'), viewBtn('table', 'Table', 'list'));

  const results = resultsArea(async () => {
    const { view, sort, dir, ...filters } = state;
    const rows = await api(`/deals${qs({ ...filters, sort, dir })}`);
    ctx.setQuery(state);
    const filtered = Object.values(filters).some(Boolean);
    if (!rows.length && (view === 'table' || filtered)) {
      return emptyState({
        title: filtered ? 'No deals match these filters' : 'No deals yet',
        text: filtered ? 'Try clearing a filter or widening the dates.' : 'Create your first deal to fill the pipeline.',
        iconName: 'deals',
        action: filtered ? null : button('Create deal', () => dealForm(), { primary: true, iconName: 'plus' }),
      });
    }
    const open = rows.filter((d) => d.stage !== 'closed');
    const won = rows.filter((d) => d.outcome === 'won');
    const summary = h('p', { class: 'result-count' }, `${rows.length} deal${rows.length === 1 ? '' : 's'}: ${money(open.reduce((s, d) => s + d.value, 0))} open pipeline, ${money(won.reduce((s, d) => s + d.value, 0))} won`);
    if (view === 'board') return h('div', null, summary, pipelineBoard(rows));
    return h('div', null, summary, dataTable({
      caption: 'Deals',
      rows,
      sort,
      dir,
      onSort: (s, d) => { state.sort = s; state.dir = d; results.run(); },
      columns: [
        { label: 'Deal', sort: 'name', render: (d) => h('a', { class: 'strong', href: `#/deals/${d.id}` }, d.name) },
        { label: 'Customer', sort: 'customer', render: (d) => h('a', { href: `#/customers/${d.customer_id}` }, d.customer_name) },
        { label: 'Representative', sort: 'rep', render: repName },
        { label: 'Stage', sort: 'stage', render: stageBadge },
        { label: 'Value', sort: 'value', class: 'num', render: (d) => money(d.value) },
        { label: 'Probability', sort: 'probability', class: 'num', render: (d) => `${d.probability}%` },
        { label: 'Expected close', sort: 'close_date', render: (d) => fmtDate(d.close_date) },
        {
          label: 'Actions', hideLabel: true, class: 'cell-actions',
          render: (d) => [iconButton('edit', `Edit ${d.name}`, () => dealForm(d)), iconButton('trash', `Delete ${d.name}`, () => deleteDeal(d), 'icon-danger')],
        },
      ],
    }));
  });

  root.append(
    pageHead('Deals', 'Track every opportunity from first lead to close.', [seg, button('New deal', () => dealForm(), { primary: true, iconName: 'plus' })]),
    filterBar([
      { name: 'q', label: 'Search', type: 'search', placeholder: 'Deal or customer' },
      { name: 'stage', label: 'Stage', type: 'select', all: 'All stages', options: opts(STAGE_LABEL) },
      { name: 'outcome', label: 'Outcome', type: 'select', all: 'All outcomes', options: [{ value: 'open', label: 'Open' }, { value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }] },
      { name: 'rep', label: 'Representative', type: 'select', all: 'All representatives', options: meta.reps.map((r) => ({ value: r.id, label: r.name })) },
      { name: 'customer', label: 'Customer', type: 'select', all: 'All customers', options: meta.customers.map((c) => ({ value: c.id, label: c.name })) },
      { name: 'close_from', label: 'Close date from', type: 'date' },
      { name: 'close_to', label: 'Close date to', type: 'date' },
    ], state, results.run),
    results.el);
  await results.run();
}

function stageStepper(d) {
  return h('ol', { class: 'stepper', 'aria-label': 'Deal stage' }, STAGE_ORDER.map((stage) => {
    const idx = STAGE_ORDER.indexOf(stage);
    const cur = STAGE_ORDER.indexOf(d.stage);
    const current = idx === cur;
    const cls = `step${current ? ' step-current' : idx < cur ? ' step-past' : ''}${stage === 'closed' && d.stage === 'closed' ? ` step-${d.outcome}` : ''}`;
    const label = stage === 'closed' && d.stage === 'closed' ? `Closed: ${d.outcome === 'won' ? 'Won' : 'Lost'}` : STAGE_LABEL[stage];
    return h('li', null, h('button', {
      type: 'button', class: cls, 'aria-current': current ? 'step' : undefined,
      'aria-label': current ? `${label}, current stage${stage === 'closed' ? '. Change outcome' : ''}` : `Move to ${label}`,
      onclick: () => { if (!current || stage === 'closed') moveDeal(d, stage); },
    }, label));
  }));
}

export async function dealDetailView(root, ctx) {
  const [id] = ctx.params;
  const d = await api(`/deals/${id}`);
  root.append(
    h('a', { class: 'back', href: '#/deals' }, '← All deals'),
    pageHead(d.name, h('a', { href: `#/customers/${d.customer_id}` }, d.customer_company ? `${d.customer_name}, ${d.customer_company}` : d.customer_name), [
      button('Edit', () => dealForm(d), { iconName: 'edit' }),
      button('Delete', () => deleteDeal(d, () => { location.hash = '#/deals'; }), { iconName: 'trash', danger: true }),
    ]),
    card(null, stageStepper(d)),
    h('div', { class: 'grid-side' },
      h('div', { class: 'stack' },
        card('Details', [facts([
          ['Outcome', d.stage === 'closed' ? outcomeBadge(d.outcome) : stageBadge(d)],
          ['Value', h('strong', null, money(d.value))],
          ['Probability', `${d.probability}%`],
          ['Expected close', fmtDate(d.close_date)],
          d.closed_on && ['Closed on', fmtDate(d.closed_on)],
          ['Representative', h('a', { href: `#/team/${d.rep_id}` }, repName(d))],
        ]), d.notes && h('div', { class: 'notes' }, h('h3', null, 'Notes'), h('p', null, d.notes))])),
      h('div', { class: 'stack' },
        card(`Tasks (${d.tasks.length})`, taskMiniTable(d.tasks), button('Add task', () => taskForm(null, { customer_id: d.customer_id, deal_id: d.id, rep_id: d.rep_id }), { small: true, iconName: 'plus' })),
        card('Activity history', activityList(d.activity)))));
}
