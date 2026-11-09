// Create / edit / delete flows, shared by every screen that touches these records.
import { api, getMeta, formDialog, confirmDialog, toast, toastError, changed, opts, CUSTOMER_STATUS, TASK_STATUS, PRIORITY, STAGE_LABEL, todayStr, h, money } from './lib.js';

const activeReps = (meta, current) => meta.reps.filter((r) => r.status === 'active' || r.id === current)
  .map((r) => ({ value: r.id, label: r.status === 'active' ? r.name : `${r.name} (inactive)` }));
const customerOptions = (meta) => meta.customers.map((c) => ({ value: c.id, label: c.company ? `${c.name} (${c.company})` : c.name }));
const dealOptions = (meta, customerId) => meta.deals
  .filter((d) => !customerId || String(d.customer_id) === String(customerId))
  .map((d) => ({ value: d.id, label: d.name }));

const noReps = () => { toast('Add a sales representative first.', 'bad'); location.hash = '#/team'; };

export async function customerForm(existing, defaults = {}) {
  try {
    const meta = await getMeta();
    formDialog({
      title: existing ? `Edit ${existing.name}` : 'New customer',
      submitLabel: existing ? 'Save changes' : 'Add customer',
      values: existing ?? { status: 'lead', ...defaults },
      fields: [
        { name: 'name', label: 'Name', required: true },
        { name: 'company', label: 'Company' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone', type: 'tel' },
        { name: 'location', label: 'Location', placeholder: 'e.g. Bromley' },
        { name: 'status', label: 'Status', type: 'select', required: true, options: opts(CUSTOMER_STATUS) },
        { name: 'rep_id', label: 'Sales representative', type: 'select', placeholderOption: 'Unassigned', options: activeReps(meta, existing?.rep_id), full: true },
        { name: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      onSubmit: async (v) => {
        const saved = await api(existing ? `/customers/${existing.id}` : '/customers', { method: existing ? 'PUT' : 'POST', body: v });
        toast(existing ? 'Customer updated.' : 'Customer added.');
        if (!existing) location.hash = `#/customers/${saved.id}`; else changed();
      },
    });
  } catch (e) { toastError(e); }
}

export async function deleteCustomer(c, after) {
  try {
    const full = await api(`/customers/${c.id}`);
    const n = [full.deals.length && `${full.deals.length} deal${full.deals.length === 1 ? '' : 's'}`, full.tasks.length && `${full.tasks.length} task${full.tasks.length === 1 ? '' : 's'}`].filter(Boolean);
    const ok = await confirmDialog({
      title: 'Delete this customer?',
      message: `${c.name} will be permanently removed${n.length ? `, along with ${n.join(' and ')} linked to them` : ''}. Won revenue from those deals will also leave your reports. This cannot be undone.`,
      confirmLabel: 'Delete customer',
    });
    if (!ok) return;
    await api(`/customers/${c.id}`, { method: 'DELETE' });
    toast('Customer deleted.');
    if (after) after(); else changed();
  } catch (e) { toastError(e); }
}

export async function repForm(existing) {
  formDialog({
    title: existing ? `Edit ${existing.name}` : 'New sales representative',
    submitLabel: existing ? 'Save changes' : 'Add representative',
    values: existing ?? {},
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'role', label: 'Role', required: true, placeholder: 'e.g. Account Manager' },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel' },
    ],
    onSubmit: async (v) => {
      const saved = await api(existing ? `/reps/${existing.id}` : '/reps', { method: existing ? 'PUT' : 'POST', body: v });
      toast(existing ? 'Details updated.' : 'Representative added.');
      if (!existing) location.hash = `#/team/${saved.id}`; else changed();
    },
  });
}

export async function deactivateRep(rep) {
  try {
    const meta = await getMeta();
    const others = meta.reps.filter((r) => r.status === 'active' && r.id !== rep.id);
    const select = h('select', { id: 'reassign', class: 'input' }, h('option', { value: '' }, 'Leave assigned to them'), others.map((r) => h('option', { value: r.id }, r.name)));
    const ok = await confirmDialog({
      title: `Deactivate ${rep.name}?`,
      message: `They have ${rep.customer_count} customers, ${rep.open_deals} open deals and ${rep.open_tasks} open tasks. Their history and revenue are kept, and they can be reactivated later.`,
      confirmLabel: 'Deactivate',
      extra: h('div', { class: 'field' }, h('label', { for: 'reassign' }, 'Reassign customers and open work to'), select),
    });
    if (!ok) return;
    await api(`/reps/${rep.id}/deactivate`, { method: 'POST', body: { reassign_to: select.value || null } });
    toast(`${rep.name} deactivated.`);
    changed();
  } catch (e) { toastError(e); }
}

export async function reactivateRep(rep) {
  try {
    await api(`/reps/${rep.id}/reactivate`, { method: 'POST' });
    toast(`${rep.name} reactivated.`);
    changed();
  } catch (e) { toastError(e); }
}

export async function dealForm(existing, defaults = {}) {
  try {
    const meta = await getMeta();
    if (!meta.customers.length) { toast('Add a customer first.', 'bad'); location.hash = '#/customers'; return; }
    if (!meta.reps.some((r) => r.status === 'active')) { noReps(); return; }
    let probTouched = !!existing;
    const defaultProb = (stage) => meta.stages.find((s) => s.id === stage)?.probability ?? 10;
    const values = existing ?? { stage: 'new_lead', probability: defaultProb('new_lead'), ...defaults };
    formDialog({
      title: existing ? `Edit ${existing.name}` : 'New deal',
      submitLabel: existing ? 'Save changes' : 'Create deal',
      values,
      fields: [
        { name: 'name', label: 'Deal name', required: true, full: true },
        { name: 'customer_id', label: 'Customer', type: 'select', required: true, placeholderOption: 'Choose a customer', options: customerOptions(meta) },
        { name: 'rep_id', label: 'Sales representative', type: 'select', required: true, placeholderOption: 'Choose a representative', options: activeReps(meta, existing?.rep_id) },
        { name: 'value', label: 'Value (£)', type: 'number', required: true, min: 0, step: '0.01', inputmode: 'decimal' },
        { name: 'close_date', label: 'Expected close date', type: 'date', required: true },
        {
          name: 'stage', label: 'Stage', type: 'select', required: true, options: opts(STAGE_LABEL),
          onChange: ({ values: v, setValue }) => { if (!probTouched && v.stage !== 'closed') setValue('probability', defaultProb(v.stage)); },
        },
        { name: 'probability', label: 'Probability (%)', type: 'number', min: 0, max: 100, step: 1, showIf: (v) => v.stage !== 'closed', onChange: () => { probTouched = true; } },
        { name: 'outcome', label: 'Outcome', type: 'select', required: true, placeholderOption: 'Choose Won or Lost', options: [{ value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }], showIf: (v) => v.stage === 'closed' },
        { name: 'closed_on', label: 'Closed on', type: 'date', max: todayStr(), hint: 'Counts towards revenue on this date. Defaults to today.', showIf: (v) => v.stage === 'closed' },
        { name: 'notes', label: 'Notes', type: 'textarea', full: true },
      ],
      onSubmit: async (v) => {
        const saved = await api(existing ? `/deals/${existing.id}` : '/deals', { method: existing ? 'PUT' : 'POST', body: v });
        toast(existing ? 'Deal updated.' : 'Deal created.');
        if (!existing && !defaults.stay) location.hash = `#/deals/${saved.id}`; else changed();
      },
    });
  } catch (e) { toastError(e); }
}

export async function deleteDeal(d, after) {
  const ok = await confirmDialog({
    title: 'Delete this deal?',
    message: `"${d.name}" (${money(d.value)}) will be permanently removed and will no longer count in reports. Any linked tasks are kept but unlinked. This cannot be undone.`,
    confirmLabel: 'Delete deal',
  });
  if (!ok) return;
  try {
    await api(`/deals/${d.id}`, { method: 'DELETE' });
    toast('Deal deleted.');
    if (after) after(); else changed();
  } catch (e) { toastError(e); }
}

// Moves a deal. Moving to Closed always asks for the outcome first.
export async function moveDeal(deal, stage) {
  if (stage === deal.stage && stage !== 'closed') return;
  const send = async (body) => {
    await api(`/deals/${deal.id}/move`, { method: 'POST', body });
    toast(body.stage === 'closed' ? `Deal marked ${body.outcome === 'won' ? 'Won' : 'Lost'}.` : `Moved to ${STAGE_LABEL[body.stage]}.`);
    changed();
  };
  if (stage === 'closed') {
    formDialog({
      title: `Close "${deal.name}"`,
      submitLabel: 'Close deal',
      wide: false,
      values: { outcome: deal.outcome ?? '', closed_on: deal.closed_on ?? todayStr() },
      fields: [
        { name: 'outcome', label: 'Outcome', type: 'select', required: true, placeholderOption: 'Choose Won or Lost', options: [{ value: 'won', label: 'Won' }, { value: 'lost', label: 'Lost' }], full: true },
        { name: 'closed_on', label: 'Closed on', type: 'date', required: true, max: todayStr(), full: true },
      ],
      onSubmit: (v) => send({ stage: 'closed', outcome: v.outcome, closed_on: v.closed_on }),
    });
    return;
  }
  try { await send({ stage }); } catch (e) { toastError(e); }
}

export async function taskForm(existing, defaults = {}) {
  try {
    const meta = await getMeta();
    if (!meta.reps.some((r) => r.status === 'active')) { noReps(); return; }
    const current = existing ?? { priority: 'medium', status: 'todo', due_date: todayStr(), ...defaults };
    formDialog({
      title: existing ? 'Edit task' : 'New task',
      submitLabel: existing ? 'Save changes' : 'Create task',
      values: current,
      fields: [
        { name: 'title', label: 'Title', required: true, full: true },
        { name: 'description', label: 'Description', type: 'textarea', full: true },
        { name: 'due_date', label: 'Due date', type: 'date', required: true },
        { name: 'priority', label: 'Priority', type: 'select', required: true, options: opts(PRIORITY) },
        { name: 'status', label: 'Status', type: 'select', required: true, options: opts(TASK_STATUS) },
        { name: 'rep_id', label: 'Owner', type: 'select', required: true, placeholderOption: 'Choose an owner', options: activeReps(meta, existing?.rep_id) },
        {
          name: 'customer_id', label: 'Customer', type: 'select', placeholderOption: 'No customer', options: customerOptions(meta),
          onChange: ({ values: v, refreshOptions }) => refreshOptions('deal_id', [{ value: '', label: 'No deal' }, ...dealOptions(meta, v.customer_id)]),
        },
        { name: 'deal_id', label: 'Deal', type: 'select', placeholderOption: 'No deal', options: dealOptions(meta, current.customer_id) },
      ],
      onSubmit: async (v) => {
        await api(existing ? `/tasks/${existing.id}` : '/tasks', { method: existing ? 'PUT' : 'POST', body: v });
        toast(existing ? 'Task updated.' : 'Task created.');
        changed();
      },
    });
  } catch (e) { toastError(e); }
}

export async function setTaskDone(task, done) {
  try {
    await api(`/tasks/${task.id}/complete`, { method: 'POST', body: { done } });
    toast(done ? 'Task completed.' : 'Task reopened.');
    changed();
  } catch (e) { toastError(e); }
}

export async function deleteTask(t) {
  const ok = await confirmDialog({ title: 'Delete this task?', message: `"${t.title}" will be permanently removed. This cannot be undone.`, confirmLabel: 'Delete task' });
  if (!ok) return;
  try {
    await api(`/tasks/${t.id}`, { method: 'DELETE' });
    toast('Task deleted.');
    changed();
  } catch (e) { toastError(e); }
}
