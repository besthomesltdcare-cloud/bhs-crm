// Compact deal and task lists used on customer and representative profiles.
import { h, money, fmtDate, stageBadge, dataTable, repName, dueLabel, priorityBadge, TASK_STATUS, badge } from '../lib.js';
import { setTaskDone } from '../forms.js';

export function dealMiniTable(deals, { showCustomer = true, showRep = true } = {}) {
  if (!deals.length) return h('p', { class: 'muted pad' }, 'No deals yet.');
  return dataTable({
    caption: 'Deals',
    rows: deals,
    columns: [
      { label: 'Deal', render: (d) => h('a', { class: 'strong', href: `#/deals/${d.id}` }, d.name) },
      showCustomer && { label: 'Customer', render: (d) => h('a', { href: `#/customers/${d.customer_id}` }, d.customer_name) },
      showRep && { label: 'Representative', render: repName },
      { label: 'Stage', render: stageBadge },
      { label: 'Value', class: 'num', render: (d) => money(d.value) },
      { label: 'Expected close', render: (d) => fmtDate(d.close_date) },
    ].filter(Boolean),
  });
}

export function taskMiniTable(tasks, { showOwner = true } = {}) {
  if (!tasks.length) return h('p', { class: 'muted pad' }, 'No tasks yet.');
  return dataTable({
    caption: 'Tasks',
    rows: tasks,
    rowClass: (t) => (t.status !== 'done' && t.due_date < new Date().toLocaleDateString('en-CA') ? 'row-overdue' : undefined),
    columns: [
      { label: 'Done', hideLabel: true, class: 'cell-check', render: (t) => doneBox(t) },
      { label: 'Task', render: (t) => h('a', { class: `strong${t.status === 'done' ? ' struck' : ''}`, href: `#/tasks/${t.id}` }, t.title) },
      { label: 'Due', render: dueLabel },
      { label: 'Priority', render: (t) => priorityBadge(t.priority) },
      { label: 'Status', render: (t) => badge(TASK_STATUS[t.status], t.status === 'done' ? 'good' : t.status === 'in_progress' ? 'info' : 'neutral') },
      showOwner && { label: 'Owner', render: repName },
    ].filter(Boolean),
  });
}

export function doneBox(task) {
  return h('input', {
    type: 'checkbox', class: 'check', checked: task.status === 'done',
    'aria-label': task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`,
    onchange: (e) => setTaskDone(task, e.target.checked),
  });
}

export function facts(rows) {
  return h('dl', { class: 'facts' }, rows.filter(Boolean).map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v === '' || v === null || v === undefined ? h('span', { class: 'muted' }, 'Not set') : v))));
}
