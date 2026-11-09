import { h, api, getMeta, qs, pageHead, button, iconButton, dataTable, filterBar, resultsArea, emptyState, modal, toastError, repName, dueLabel, priorityBadge, badge, fmtDate, fmtDateTime, opts, TASK_STATUS, PRIORITY, todayStr } from '../lib.js';
import { taskForm, deleteTask, setTaskDone } from '../forms.js';
import { doneBox, facts } from './common.js';

const statusBadge = (t) => badge(TASK_STATUS[t.status], t.status === 'done' ? 'good' : t.status === 'in_progress' ? 'info' : 'neutral');

function linkedTo(t) {
  if (!t.customer_id && !t.deal_id) return h('span', { class: 'muted' }, 'Not linked');
  return h('span', { class: 'linked' },
    t.customer_id && h('a', { href: `#/customers/${t.customer_id}` }, t.customer_name),
    t.deal_id && h('a', { class: 'muted-link', href: `#/deals/${t.deal_id}` }, t.deal_name));
}

async function showTask(id, onClose) {
  try {
    const t = await api(`/tasks/${id}`);
    let m;
    const after = (fn) => () => { m.close(); fn(); };
    m = modal({
      title: t.title,
      onClose,
      body: [
        t.description && h('p', { class: 'task-desc' }, t.description),
        facts([
          ['Due', dueLabel(t)],
          ['Due date', fmtDate(t.due_date)],
          ['Priority', priorityBadge(t.priority)],
          ['Status', statusBadge(t)],
          ['Owner', repName(t)],
          ['Linked to', linkedTo(t)],
          t.completed_at && ['Completed', fmtDateTime(t.completed_at)],
        ]),
      ],
      footer: [
        button('Delete', after(() => deleteTask(t)), { iconName: 'trash', danger: true }),
        button('Edit', after(() => taskForm(t)), { iconName: 'edit' }),
        button(t.status === 'done' ? 'Reopen' : 'Mark complete', after(() => setTaskDone(t, t.status !== 'done')), { primary: true, iconName: 'check' }),
      ],
    });
  } catch (e) { toastError(e); onClose?.(); }
}

export async function tasksView(root, ctx) {
  const state = { q: '', status: 'open', priority: '', rep: '', due: '', due_from: '', due_to: '', sort: 'due_date', dir: 'asc', ...ctx.query };
  if (ctx.query.due && !ctx.query.status) state.status = '';
  const meta = await getMeta();
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Quick views' });
  let filterEl;

  const setQuick = (patch) => {
    Object.assign(state, { due: '', status: '', due_from: '', due_to: '' }, patch);
    const next = buildFilters();
    filterEl.replaceWith(next);
    filterEl = next;
    results.run();
  };

  const results = resultsArea(async () => {
    const { items, counts } = await api(`/tasks${qs(state)}`);
    ctx.setQuery(state);
    const chip = (label, n, patch, active, tone) => h('button', { type: 'button', class: `chip${tone ? ` chip-${tone}` : ''}`, 'aria-pressed': String(active), onclick: () => setQuick(patch) }, label, h('span', { class: 'chip-n' }, n));
    chips.replaceChildren(
      chip('Open', counts.open, { status: 'open' }, state.status === 'open' && !state.due),
      chip('Overdue', counts.overdue, { due: 'overdue' }, state.due === 'overdue', counts.overdue ? 'bad' : undefined),
      chip('Due today', counts.today, { due: 'today', status: 'open' }, state.due === 'today'),
      chip('Next 7 days', counts.upcoming, { due: 'upcoming' }, state.due === 'upcoming'),
      chip('Completed', counts.done, { status: 'done' }, state.status === 'done'));
    if (!items.length) {
      const any = counts.open + counts.done > 0;
      return emptyState({
        title: any ? 'No tasks match this view' : 'No tasks yet',
        text: any ? 'Try another quick view or clear a filter.' : 'Create a task to keep follow-ups on track.',
        iconName: 'tasks',
        action: any ? null : button('Create task', () => taskForm(), { primary: true, iconName: 'plus' }),
      });
    }
    const today = todayStr();
    return h('div', null,
      h('p', { class: 'result-count' }, `${items.length} task${items.length === 1 ? '' : 's'}`),
      dataTable({
        caption: 'Tasks',
        rows: items,
        sort: state.sort,
        dir: state.dir,
        onSort: (s, d) => { state.sort = s; state.dir = d; results.run(); },
        rowClass: (t) => (t.status === 'done' ? 'row-done' : t.due_date < today ? 'row-overdue' : t.due_date === today ? 'row-today' : undefined),
        columns: [
          { label: 'Done', hideLabel: true, class: 'cell-check', render: (t) => doneBox(t) },
          { label: 'Task', sort: 'title', render: (t) => h('a', { class: `strong${t.status === 'done' ? ' struck' : ''}`, href: `#/tasks/${t.id}` }, t.title) },
          { label: 'Due', sort: 'due_date', render: dueLabel },
          { label: 'Priority', sort: 'priority', render: (t) => priorityBadge(t.priority) },
          { label: 'Status', sort: 'status', render: statusBadge },
          { label: 'Owner', sort: 'rep', render: repName },
          { label: 'Linked to', render: linkedTo },
          {
            label: 'Actions', hideLabel: true, class: 'cell-actions',
            render: (t) => [iconButton('edit', `Edit ${t.title}`, () => taskForm(t)), iconButton('trash', `Delete ${t.title}`, () => deleteTask(t), 'icon-danger')],
          },
        ],
      }));
  });

  const buildFilters = () => filterBar([
    { name: 'q', label: 'Search', type: 'search', placeholder: 'Task, customer or deal' },
    { name: 'status', label: 'Status', type: 'select', all: 'All statuses', options: [{ value: 'open', label: 'Open (not completed)' }, ...opts(TASK_STATUS)] },
    { name: 'priority', label: 'Priority', type: 'select', all: 'All priorities', options: opts(PRIORITY) },
    { name: 'rep', label: 'Owner', type: 'select', all: 'All owners', options: meta.reps.map((r) => ({ value: r.id, label: r.name })) },
    { name: 'due_from', label: 'Due from', type: 'date' },
    { name: 'due_to', label: 'Due to', type: 'date' },
  ], state, results.run);

  filterEl = buildFilters();
  root.append(pageHead('Tasks', 'Follow-ups for the whole team.', button('New task', () => taskForm(), { primary: true, iconName: 'plus' })), chips, filterEl, results.el);
  await results.run();

  if (ctx.params.length) showTask(ctx.params[0], () => { if (location.hash.startsWith('#/tasks/')) location.hash = '#/tasks'; });
}
