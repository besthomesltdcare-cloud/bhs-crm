// Shared helpers: DOM building, API calls, formatting, dialogs, forms, tables and filters.
// All user text goes through text nodes, so stored data can never inject markup.

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' && 'value' in el) el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
}
function append(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  apply(el, props);
  append(el, kids);
  return el;
}
export function svg(tag, props, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, props);
  append(el, kids);
  return el;
}

const ICONS = {
  dashboard: 'M4 13h7V4H4zM13 20h7v-9h-7zM13 9h7V4h-7zM4 20h7v-5H4z',
  customers: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-6A3.5 3.5 0 0 0 3 18.500V20M9.500 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM21 20v-1.500a3.500 3.500 0 0 0-2.500-3.300M15.500 4.300a3.500 3.500 0 0 1 0 6.400',
  team: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.500 20a7.500 7.500 0 0 1 15 0',
  deals: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z',
  tasks: 'M9 11l2.500 2.500L16 9M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  reports: 'M4 20V4M4 20h16M8.500 16v-5M13 16V8M17.500 16v-3',
  bell: 'M6 9.500a6 6 0 0 1 12 0c0 6 2.500 7.500 2.500 7.500h-17S6 15.500 6 9.500zM10 20.500a2.200 2.200 0 0 0 4 0',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9a2.800 2.800 0 0 0-4-4L4 16zM13.500 6.500l4 4',
  trash: 'M4 7h16M9.500 7V4.500h5V7M6.500 7l1 13h9l1-13M10 11v5.500M14 11v5.500',
  check: 'M5 12.500l4.500 4.500L19 7.500',
  x: 'M6 6l12 12M18 6L6 18',
  left: 'M14.500 6l-6 6 6 6',
  right: 'M9.500 6l6 6-6 6',
  alert: 'M12 4 2.500 20h19zM12 10v4.500M12 17.500v.1',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5.300l3.300 2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  board: 'M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v14h-4z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.1M4 12h.1M4 18h.1',
  refresh: 'M20 11a8 8 0 1 0-2.300 6.300M20 5v6h-6',
  drag: 'M9 6h.1M9 12h.1M9 18h.1M15 6h.1M15 12h.1M15 18h.1',
  phone: 'M5 4h4l1.500 5-2.300 1.500a12 12 0 0 0 5.300 5.300L15 13.500l5 1.500v4a1.500 1.500 0 0 1-1.600 1.500A15.500 15.500 0 0 1 3.500 5.600 1.500 1.500 0 0 1 5 4z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  pin: 'M12 21s7-6.100 7-11.500a7 7 0 0 0-14 0C5 14.900 12 21 12 21zM12 12a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
};
export function icon(name, size = 18) {
  return svg('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon' },
    svg('path', { d: ICONS[name] }));
}

// ---- API -------------------------------------------------------------------

export class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields; }
}

const USER_KEY = 'bh-crm-user';
export const session = {
  get repId() { try { return Number(localStorage.getItem(USER_KEY)) || null; } catch { return null; } },
  set repId(v) { try { localStorage.setItem(USER_KEY, String(v ?? '')); } catch { /* preference only */ } },
};

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (session.repId) headers['X-Rep-Id'] = String(session.repId);
  if (method === 'POST' || method === 'PUT') headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: (method === 'POST' || method === 'PUT') ? JSON.stringify(body ?? {}) : undefined });
  } catch {
    throw new ApiError('Could not reach the CRM. Check that it is still running, then try again.', 0);
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* handled below */ }
  if (!res.ok) throw new ApiError(data?.error || 'Something went wrong. Please try again.', res.status, data?.fields);
  return data;
}

export const getMeta = () => api('/meta');

export function qs(state) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) if (v !== '' && v !== null && v !== undefined) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Set by main.js; re-runs the current screen after data changes.
export const app = { reload: () => {}, refreshBadge: () => {} };

export function changed() { app.reload(); app.refreshBadge(); }

// ---- formatting ------------------------------------------------------------

const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 });
export const money = (v) => (Number.isInteger(Math.round((v ?? 0) * 100) / 100) ? gbp0 : gbp2).format(v ?? 0);
export function moneyShort(v) {
  if (Math.abs(v) >= 1e6) return `£${(v / 1e6).toFixed(1).replace(/\.0$/, '')}m`;
  if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(v >= 1e5 ? 0 : 1).replace(/\.0$/, '')}k`;
  return gbp0.format(v);
}
export const percent = (v) => (v === null || v === undefined ? 'No data' : `${Math.round(v * 100)}%`);

const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export function fmtDate(s) {
  if (!s) return '';
  return parseDay(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return fmtDateTime(iso).slice(0, -7);
}
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dayDiff(s) { return Math.round((parseDay(s) - parseDay(todayStr())) / 86400000); }

export const CUSTOMER_STATUS = { lead: 'Lead', active: 'Active', on_hold: 'On hold', former: 'Former' };
export const TASK_STATUS = { todo: 'To do', in_progress: 'In progress', done: 'Completed' };
export const PRIORITY = { high: 'High', medium: 'Medium', low: 'Low' };
export const STAGE_LABEL = { new_lead: 'New Lead', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', closed: 'Closed' };
export const STAGE_ORDER = Object.keys(STAGE_LABEL);

export const opts = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));

export function badge(text, tone = 'neutral', iconName) {
  return h('span', { class: `badge badge-${tone}` }, iconName && icon(iconName, 13), text);
}
export function outcomeBadge(outcome) {
  return outcome === 'won' ? badge('Won', 'good', 'check') : badge('Lost', 'bad', 'x');
}
export function stageBadge(deal) {
  return deal.stage === 'closed' ? outcomeBadge(deal.outcome) : badge(STAGE_LABEL[deal.stage], 'info');
}
export function customerStatusBadge(status) {
  const tone = { lead: 'info', active: 'good', on_hold: 'warn', former: 'neutral' }[status];
  return badge(CUSTOMER_STATUS[status], tone);
}
export function priorityBadge(p) {
  return badge(PRIORITY[p], { high: 'bad', medium: 'warn', low: 'neutral' }[p]);
}
export function repName(row) {
  if (!row.rep_name) return h('span', { class: 'muted' }, 'Unassigned');
  return row.rep_status === 'inactive' ? [row.rep_name, ' ', badge('Inactive', 'neutral')] : row.rep_name;
}
export function dueLabel(task) {
  const d = dayDiff(task.due_date);
  if (task.status === 'done') return h('span', { class: 'muted' }, fmtDate(task.due_date));
  if (d < 0) return h('span', { class: 'due due-overdue' }, icon('alert', 14), `Overdue by ${-d} day${d === -1 ? '' : 's'}`);
  if (d === 0) return h('span', { class: 'due due-today' }, icon('clock', 14), 'Due today');
  if (d <= 7) return h('span', { class: 'due due-soon' }, d === 1 ? 'Tomorrow' : `In ${d} days`);
  return fmtDate(task.due_date);
}

// ---- toasts ----------------------------------------------------------------

export function toast(message, tone = 'good') {
  const el = h('div', { class: `toast toast-${tone}` }, icon(tone === 'good' ? 'check' : 'alert', 16), h('span', null, message));
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), tone === 'good' ? 3500 : 7000);
}
export const toastError = (err) => toast(err?.message || 'Something went wrong. Please try again.', 'bad');

// ---- dialogs ---------------------------------------------------------------

export function modal({ title, body, footer, wide, onClose }) {
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close' }, icon('x'));
  const heading = h('h2', { class: 'dialog-title' }, title);
  const el = h('dialog', { class: `dialog${wide ? ' dialog-wide' : ''}`, 'aria-label': title },
    h('div', { class: 'dialog-head' }, heading, closeBtn),
    h('div', { class: 'dialog-body' }, body),
    footer && h('div', { class: 'dialog-foot' }, footer));
  const close = () => el.close();
  closeBtn.addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  el.addEventListener('close', () => { el.remove(); onClose?.(); });
  document.body.append(el);
  el.showModal();
  return { el, close };
}

export function confirmDialog({ title, message, confirmLabel = 'Delete', danger = true, extra }) {
  return new Promise((resolve) => {
    let result = false;
    const cancel = h('button', { class: 'btn', type: 'button', autofocus: true }, 'Cancel');
    const ok = h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button' }, confirmLabel);
    const m = modal({ title, body: [h('p', { class: 'confirm-text' }, message), extra], footer: [cancel, ok], onClose: () => resolve(result) });
    cancel.addEventListener('click', () => m.close());
    ok.addEventListener('click', () => { result = true; m.close(); });
    cancel.focus();
  });
}

// A form in a dialog. fields: [{name,label,type,required,options,hint,full,showIf,onChange,min,max,step,placeholder}]
export function formDialog({ title, submitLabel = 'Save', fields, values = {}, onSubmit, wide = true }) {
  const inputs = new Map();
  const rows = new Map();
  const state = { ...values };
  const errorBanner = h('div', { class: 'form-error', role: 'alert', hidden: true });

  const read = () => {
    const out = { ...state };
    for (const [name, input] of inputs) out[name] = input.value;
    return out;
  };
  const setValue = (name, value) => { const input = inputs.get(name); if (input) input.value = value ?? ''; };
  const applyShowIf = () => {
    const vals = read();
    for (const f of fields) {
      if (f.showIf) rows.get(f.name).hidden = !f.showIf(vals);
    }
  };
  const refreshOptions = (name, options) => {
    const input = inputs.get(name);
    const keep = input.value;
    input.replaceChildren(...options.map((o) => h('option', { value: o.value }, o.label)));
    input.value = options.some((o) => String(o.value) === String(keep)) ? keep : '';
  };
  const showFieldError = (name, message) => {
    const row = rows.get(name);
    const input = inputs.get(name);
    if (!row || !input) return false;
    const err = row.querySelector('.field-error');
    err.textContent = message || '';
    err.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    return true;
  };

  const grid = h('div', { class: 'form-grid' });
  for (const f of fields) {
    const id = `f-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
    const errId = `${id}-err`;
    const common = { id, name: f.name, 'aria-describedby': errId, required: f.required, class: 'input', placeholder: f.placeholder };
    let input;
    if (f.type === 'select') {
      const options = [...(f.placeholderOption ? [{ value: '', label: f.placeholderOption }] : []), ...f.options];
      input = h('select', common, options.map((o) => h('option', { value: o.value }, o.label)));
    } else if (f.type === 'textarea') {
      input = h('textarea', { ...common, rows: 3 });
    } else {
      input = h('input', { ...common, type: f.type || 'text', min: f.min, max: f.max, step: f.step, inputmode: f.inputmode, autocomplete: 'off' });
    }
    if (state[f.name] !== undefined && state[f.name] !== null) input.value = state[f.name];
    inputs.set(f.name, input);
    input.addEventListener('input', () => showFieldError(f.name, ''));
    input.addEventListener('change', () => { applyShowIf(); f.onChange?.({ values: read(), setValue, refreshOptions }); });
    const row = h('div', { class: `field${f.full ? ' field-full' : ''}` },
      h('label', { for: id }, f.label, f.required && h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')),
      input,
      f.hint && h('p', { class: 'field-hint' }, f.hint),
      h('p', { class: 'field-error', id: errId, hidden: true }));
    rows.set(f.name, row);
    grid.append(row);
  }

  const cancel = h('button', { class: 'btn', type: 'button' }, 'Cancel');
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, submitLabel);
  const form = h('form', { novalidate: true }, errorBanner, grid);
  const formId = `form-${Math.random().toString(36).slice(2, 8)}`;
  form.id = formId;
  save.setAttribute('form', formId);

  const m = modal({ title, body: form, footer: [cancel, save], wide });
  cancel.addEventListener('click', () => m.close());
  applyShowIf();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.hidden = true;
    const vals = read();
    let firstBad = null;
    for (const f of fields) {
      if (rows.get(f.name).hidden) { showFieldError(f.name, ''); continue; }
      const input = inputs.get(f.name);
      let msg = '';
      if (f.required && !String(vals[f.name] ?? '').trim()) msg = `${f.label} is required.`;
      else if (input.validity && !input.validity.valid) {
        if (f.type === 'email') msg = 'Enter a valid email address.';
        else if (f.type === 'number') msg = `Enter a number${f.min !== undefined ? ` of ${f.min} or more` : ''}${f.max !== undefined ? ` and no more than ${f.max}` : ''}.`;
        else msg = 'Check this value.';
      }
      showFieldError(f.name, msg);
      if (msg && !firstBad) firstBad = input;
    }
    if (firstBad) { firstBad.focus(); return; }
    const payload = {};
    for (const f of fields) payload[f.name] = rows.get(f.name).hidden ? null : vals[f.name];
    save.disabled = true;
    const label = save.textContent;
    save.textContent = 'Saving…';
    try {
      await onSubmit(payload);
      m.close();
    } catch (err) {
      save.disabled = false;
      save.textContent = label;
      let placed = false;
      if (err.fields) {
        for (const [name, message] of Object.entries(err.fields)) {
          if (showFieldError(name, message)) {
            if (!placed) inputs.get(name).focus();
            placed = true;
          }
        }
      }
      if (!placed || err.status !== 422) {
        errorBanner.textContent = err.message;
        errorBanner.hidden = false;
      }
    }
  });
  return m;
}

// ---- tables ----------------------------------------------------------------

export function dataTable({ columns, rows, sort, dir, onSort, rowClass, caption }) {
  const head = h('tr', null, columns.map((c) => {
    if (!c.sort) return h('th', { scope: 'col', class: c.class }, c.label && h('span', { class: c.hideLabel ? 'sr-only' : undefined }, c.label));
    const active = sort === c.sort;
    return h('th', { scope: 'col', class: c.class, 'aria-sort': active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none' },
      h('button', {
        class: 'th-btn', type: 'button',
        onclick: () => onSort(c.sort, active && dir === 'asc' ? 'desc' : 'asc'),
      }, c.label, h('span', { class: 'sort-mark', 'aria-hidden': 'true' }, active ? (dir === 'desc' ? '↓' : '↑') : '')));
  }));
  const body = rows.map((row) => h('tr', { class: rowClass?.(row) },
    columns.map((c) => h('td', { class: c.class, dataset: { label: c.label || '' } }, c.render(row)))));
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' }, caption && h('caption', { class: 'sr-only' }, caption), h('thead', null, head), h('tbody', null, body)));
}

// ---- states ----------------------------------------------------------------

export function emptyState({ title, text, action, iconName = 'search' }) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-icon' }, icon(iconName, 24)), h('h3', null, title), text && h('p', null, text), action);
}
export function skeleton() {
  return h('div', { class: 'skeleton-page', 'aria-busy': 'true', 'aria-label': 'Loading' },
    h('div', { class: 'sk sk-title' }),
    h('div', { class: 'sk-grid' }, [1, 2, 3, 4].map(() => h('div', { class: 'sk sk-tile' }))),
    h('div', { class: 'sk sk-block' }));
}
export function errorState(err, retry) {
  return h('div', { class: 'empty', role: 'alert' }, h('div', { class: 'empty-icon empty-icon-bad' }, icon('alert', 24)),
    h('h3', null, err.status === 404 ? 'Not found' : 'That did not load'),
    h('p', null, err.message),
    err.status === 404
      ? h('a', { class: 'btn', href: '#/' }, 'Back to dashboard')
      : h('button', { class: 'btn', type: 'button', onclick: retry }, icon('refresh', 16), 'Try again'));
}

export function pageHead(title, subtitle, actions) {
  return h('header', { class: 'page-head' },
    h('div', null, h('h1', { tabindex: '-1', class: 'page-title' }, title), subtitle && h('p', { class: 'page-sub' }, subtitle)),
    actions && h('div', { class: 'page-actions' }, actions));
}
export function button(label, onclick, { primary, iconName, danger, small, ariaLabel, type = 'button' } = {}) {
  return h('button', { type, onclick, 'aria-label': ariaLabel, class: `btn${primary ? ' btn-primary' : ''}${danger ? ' btn-danger-ghost' : ''}${small ? ' btn-sm' : ''}` }, iconName && icon(iconName, 16), label);
}
export function iconButton(iconName, label, onclick, extra = '') {
  return h('button', { type: 'button', class: `icon-btn ${extra}`, 'aria-label': label, title: label, onclick }, icon(iconName, 16));
}
export function card(title, body, action) {
  return h('section', { class: 'card' }, title && h('div', { class: 'card-head' }, h('h2', null, title), action), body);
}

export function statTile({ label, value, sub, href, tone }) {
  const inner = [h('span', { class: 'tile-label' }, label), h('span', { class: `tile-value${tone ? ` tone-${tone}` : ''}` }, value), sub && h('span', { class: 'tile-sub' }, sub)];
  return href ? h('a', { class: 'tile tile-link', href }, inner) : h('div', { class: 'tile' }, inner);
}

export function activityList(items, { emptyText = 'Nothing has happened here yet.' } = {}) {
  if (!items.length) return h('p', { class: 'muted pad' }, emptyText);
  return h('ol', { class: 'activity' }, items.map((a) => {
    const href = a.deal_id ? `#/deals/${a.deal_id}` : a.customer_id ? `#/customers/${a.customer_id}` : null;
    return h('li', null,
      h('span', { class: `activity-dot activity-${a.kind.startsWith('deal_w') ? 'won' : a.kind.startsWith('deal_l') ? 'lost' : 'other'}`, 'aria-hidden': 'true' }),
      h('div', null,
        href ? h('a', { href, class: 'activity-msg' }, a.message) : h('span', { class: 'activity-msg' }, a.message),
        h('div', { class: 'activity-meta' }, h('time', { datetime: a.created_at, title: fmtDateTime(a.created_at) }, timeAgo(a.created_at)), a.actor_name && ` · ${a.actor_name}`)));
  }));
}

// ---- filters ---------------------------------------------------------------

// defs: [{name,label,type:'search'|'select'|'date',options,all}]. onChange fires with the updated state.
export function filterBar(defs, state, onChange) {
  let timer;
  const controls = new Map();
  const clearBtn = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Clear filters');
  const hasAny = () => defs.some((d) => state[d.name]);
  const sync = () => { clearBtn.hidden = !hasAny(); };
  const bar = h('form', { class: 'filters', role: 'search', onsubmit: (e) => e.preventDefault() }, defs.map((d) => {
    const id = `flt-${d.name}`;
    let input;
    if (d.type === 'select') {
      input = h('select', { id, class: 'input input-sm', onchange: () => { state[d.name] = input.value; sync(); onChange(); } },
        h('option', { value: '' }, d.all || 'All'), d.options.map((o) => h('option', { value: o.value }, o.label)));
    } else if (d.type === 'date') {
      input = h('input', { id, type: 'date', class: 'input input-sm', onchange: () => { state[d.name] = input.value; sync(); onChange(); } });
    } else {
      input = h('input', {
        id, type: 'search', class: 'input input-sm', placeholder: d.placeholder || 'Search',
        oninput: () => { clearTimeout(timer); timer = setTimeout(() => { state[d.name] = input.value; sync(); onChange(); }, 250); },
      });
    }
    input.value = state[d.name] ?? '';
    controls.set(d.name, input);
    return h('div', { class: `filter${d.type === 'search' ? ' filter-search' : ''}` }, h('label', { for: id }, d.label), input);
  }), clearBtn);
  clearBtn.addEventListener('click', () => {
    for (const d of defs) { state[d.name] = ''; controls.get(d.name).value = ''; }
    sync();
    onChange();
  });
  sync();
  return bar;
}

// Runs async loads for a results area, dropping stale responses and showing busy/error states.
export function resultsArea(load) {
  const el = h('div', { class: 'results', 'aria-live': 'polite' });
  let token = 0;
  const run = async () => {
    const mine = ++token;
    el.setAttribute('aria-busy', 'true');
    el.classList.add('is-loading');
    try {
      const content = await load();
      if (mine !== token) return;
      el.replaceChildren(content);
    } catch (err) {
      if (mine !== token) return;
      el.replaceChildren(errorState(err, run));
    } finally {
      if (mine === token) { el.removeAttribute('aria-busy'); el.classList.remove('is-loading'); }
    }
  };
  return { el, run };
}
