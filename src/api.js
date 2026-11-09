import { transaction } from './db.js';
import { today, addDays, addMonths, monthStart, isDate, buckets, bucketKey } from './dates.js';

export class HttpError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}

export const STAGES = [
  { id: 'new_lead', label: 'New Lead', probability: 10 },
  { id: 'contacted', label: 'Contacted', probability: 20 },
  { id: 'qualified', label: 'Qualified', probability: 40 },
  { id: 'proposal', label: 'Proposal', probability: 60 },
  { id: 'negotiation', label: 'Negotiation', probability: 80 },
  { id: 'closed', label: 'Closed', probability: 100 },
];
const STAGE_IDS = STAGES.map((s) => s.id);
const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label ?? id;
const stageDefault = (id) => STAGES.find((s) => s.id === id)?.probability ?? 10;
const money = (v) => `£${Number(v).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
const now = () => new Date().toISOString();

// ---- input validation ------------------------------------------------------

function clean(body, spec) {
  const values = {};
  const errors = {};
  for (const [key, rule] of Object.entries(spec)) {
    const raw = body[key];
    const empty = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
    if (empty) {
      if (rule.required) errors[key] = `${rule.label} is required.`;
      values[key] = ['text', 'email', 'phone'].includes(rule.type) ? '' : null;
      continue;
    }
    switch (rule.type) {
      case 'text':
      case 'email':
      case 'phone': {
        const v = String(raw).trim();
        const max = rule.max ?? 200;
        if (v.length > max) errors[key] = `${rule.label} must be ${max} characters or fewer.`;
        else if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[key] = 'Enter a valid email address.';
        else if (rule.type === 'phone' && !/^[+()\d\s-]{7,25}$/.test(v)) errors[key] = 'Enter a valid phone number.';
        values[key] = v;
        break;
      }
      case 'date':
        if (!isDate(raw)) errors[key] = `${rule.label} must be a valid date.`;
        values[key] = raw;
        break;
      case 'enum':
        if (!rule.values.includes(raw)) errors[key] = `Choose a valid ${rule.label.toLowerCase()}.`;
        values[key] = raw;
        break;
      case 'id': {
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0) errors[key] = `Choose a valid ${rule.label.toLowerCase()}.`;
        values[key] = n;
        break;
      }
      case 'int': {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < rule.min || n > rule.maxValue) errors[key] = `${rule.label} must be a whole number from ${rule.min} to ${rule.maxValue}.`;
        values[key] = n;
        break;
      }
      case 'money': {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0 || n > 1e9) errors[key] = `${rule.label} must be a positive amount.`;
        else values[key] = Math.round(n * 100);
        break;
      }
      default:
        throw new Error(`Unknown rule ${rule.type}`);
    }
  }
  return { values, errors };
}

function finish(errors) {
  if (Object.keys(errors).length) throw new HttpError(422, 'Please fix the highlighted fields.', errors);
}

const CUSTOMER_SPEC = {
  name: { type: 'text', label: 'Name', required: true, max: 120 },
  company: { type: 'text', label: 'Company', max: 160 },
  email: { type: 'email', label: 'Email', max: 200 },
  phone: { type: 'phone', label: 'Phone' },
  location: { type: 'text', label: 'Location', max: 120 },
  status: { type: 'enum', label: 'Status', required: true, values: ['lead', 'active', 'on_hold', 'former'] },
  rep_id: { type: 'id', label: 'Sales representative' },
  notes: { type: 'text', label: 'Notes', max: 5000 },
};
const REP_SPEC = {
  name: { type: 'text', label: 'Name', required: true, max: 120 },
  email: { type: 'email', label: 'Email', required: true, max: 200 },
  phone: { type: 'phone', label: 'Phone' },
  role: { type: 'text', label: 'Role', required: true, max: 120 },
};
const DEAL_SPEC = {
  name: { type: 'text', label: 'Deal name', required: true, max: 160 },
  value: { type: 'money', label: 'Value', required: true },
  close_date: { type: 'date', label: 'Expected close date', required: true },
  stage: { type: 'enum', label: 'Stage', required: true, values: STAGE_IDS },
  outcome: { type: 'enum', label: 'Outcome', values: ['won', 'lost'] },
  probability: { type: 'int', label: 'Probability', min: 0, maxValue: 100 },
  notes: { type: 'text', label: 'Notes', max: 5000 },
  customer_id: { type: 'id', label: 'Customer', required: true },
  rep_id: { type: 'id', label: 'Sales representative', required: true },
  closed_on: { type: 'date', label: 'Closed on' },
};
const TASK_SPEC = {
  title: { type: 'text', label: 'Title', required: true, max: 200 },
  description: { type: 'text', label: 'Description', max: 5000 },
  due_date: { type: 'date', label: 'Due date', required: true },
  priority: { type: 'enum', label: 'Priority', required: true, values: ['low', 'medium', 'high'] },
  status: { type: 'enum', label: 'Status', required: true, values: ['todo', 'in_progress', 'done'] },
  rep_id: { type: 'id', label: 'Owner', required: true },
  customer_id: { type: 'id', label: 'Customer' },
  deal_id: { type: 'id', label: 'Deal' },
};

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const idParam = (q, name) => {
  const v = q.get(name);
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name} filter.`);
  return n;
};
const dateParam = (q, name) => {
  const v = q.get(name);
  if (!v) return null;
  if (!isDate(v)) throw new HttpError(400, 'One of the dates is not valid.');
  return v;
};
function orderBy(q, allowed, fallback) {
  const col = allowed[q.get('sort')] ?? allowed[fallback];
  const dir = q.get('dir') === 'desc' ? 'DESC' : 'ASC';
  return `ORDER BY ${col} ${dir}`;
}

// ---- api -------------------------------------------------------------------

export function createApi(db) {
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const run = (sql, ...p) => db.prepare(sql).run(...p);
  const count = (sql, ...p) => Number(one(sql, ...p).n);

  const log = ({ kind, message, customer_id = null, deal_id = null, actor = null }) =>
    run('INSERT INTO activity (kind,message,customer_id,deal_id,actor_id,created_at) VALUES (?,?,?,?,?,?)', kind, message, customer_id, deal_id, actor, now());

  const notify = (rep_id, type, title, body, link) =>
    run('INSERT INTO notifications (rep_id,type,title,body,link,created_at) VALUES (?,?,?,?,?,?)', rep_id, type, title, body, link, now());

  function sweepOverdue() {
    const t = today();
    run(`INSERT OR IGNORE INTO notifications (rep_id,type,title,body,link,dedupe_key,created_at)
         SELECT rep_id,'task_overdue','Task overdue',title,'#/tasks/'||id,'overdue:'||id||':'||due_date,?
         FROM tasks WHERE status <> 'done' AND due_date < ?`, now(), t);
  }

  const repExists = (id) => one('SELECT id,name,status FROM reps WHERE id=?', id);
  function requireActiveRep(id, field, errors, unchangedFrom) {
    if (id == null) return;
    const r = repExists(id);
    if (!r) errors[field] = 'That sales representative no longer exists.';
    else if (r.status !== 'active' && id !== unchangedFrom) errors[field] = `${r.name} is inactive. Choose an active representative.`;
  }

  // -- customers
  const CUSTOMER_SELECT = `SELECT c.*, r.name rep_name, r.status rep_status,
      (SELECT COUNT(*) FROM deals d WHERE d.customer_id=c.id AND d.stage<>'closed') open_deals,
      (SELECT COALESCE(SUM(d.value_p),0)/100.0 FROM deals d WHERE d.customer_id=c.id AND d.outcome='won') won_value
    FROM customers c LEFT JOIN reps r ON r.id=c.rep_id`;

  function getCustomer(id) {
    const c = one(`${CUSTOMER_SELECT} WHERE c.id=?`, id);
    if (!c) throw new HttpError(404, 'That customer could not be found.');
    return c;
  }

  function customerInput(body, existing) {
    const { values, errors } = clean(body, CUSTOMER_SPEC);
    requireActiveRep(values.rep_id, 'rep_id', errors, existing?.rep_id);
    finish(errors);
    return values;
  }

  // -- deals
  const DEAL_SELECT = `SELECT d.id,d.name,d.value_p/100.0 value,d.close_date,d.stage,d.outcome,d.probability,d.notes,
      d.customer_id,d.rep_id,d.closed_on,d.created_at,d.updated_at,
      c.name customer_name,c.company customer_company,r.name rep_name,r.status rep_status
    FROM deals d JOIN customers c ON c.id=d.customer_id JOIN reps r ON r.id=d.rep_id`;

  function getDeal(id) {
    const d = one(`${DEAL_SELECT} WHERE d.id=?`, id);
    if (!d) throw new HttpError(404, 'That deal could not be found.');
    return d;
  }

  function saveDeal(existing, input, actor) {
    const { values: v, errors } = clean(input, DEAL_SPEC);
    if (v.customer_id && !one('SELECT id FROM customers WHERE id=?', v.customer_id)) errors.customer_id = 'That customer no longer exists.';
    requireActiveRep(v.rep_id, 'rep_id', errors, existing?.rep_id);
    if (v.stage === 'closed') {
      if (!v.outcome) errors.outcome = 'Choose Won or Lost to close this deal.';
      v.closed_on = v.closed_on || existing?.closed_on || today();
      if (v.closed_on > today()) errors.closed_on = 'Closed on cannot be in the future.';
      if (v.outcome) v.probability = v.outcome === 'won' ? 100 : 0;
    } else {
      v.outcome = null;
      v.closed_on = null;
      if (existing?.stage === 'closed' && (v.probability === 100 || v.probability === 0 || v.probability == null)) v.probability = stageDefault(v.stage);
      if (v.probability == null) v.probability = stageDefault(v.stage);
    }
    finish(errors);

    const ts = now();
    let id = existing?.id;
    if (existing) {
      run(`UPDATE deals SET name=?,value_p=?,close_date=?,stage=?,outcome=?,probability=?,notes=?,customer_id=?,rep_id=?,closed_on=?,updated_at=? WHERE id=?`,
        v.name, v.value, v.close_date, v.stage, v.outcome, v.probability, v.notes, v.customer_id, v.rep_id, v.closed_on, ts, id);
    } else {
      id = Number(run(`INSERT INTO deals (name,value_p,close_date,stage,outcome,probability,notes,customer_id,rep_id,closed_on,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, v.name, v.value, v.close_date, v.stage, v.outcome, v.probability, v.notes, v.customer_id, v.rep_id, v.closed_on, ts, ts).lastInsertRowid);
    }

    const link = `#/deals/${id}`;
    const scope = { customer_id: v.customer_id, deal_id: id, actor };
    const stateText = () => (v.stage === 'closed' ? `Closed (${v.outcome === 'won' ? 'Won' : 'Lost'})` : stageLabel(v.stage));
    const announceClose = () => {
      const label = v.outcome === 'won' ? 'Won' : 'Lost';
      log({ ...scope, kind: `deal_${v.outcome}`, message: `Deal "${v.name}" marked ${label} at ${money(v.value / 100)}` });
      notify(v.rep_id, `deal_${v.outcome}`, `Deal marked ${label}`, `${v.name} (${money(v.value / 100)})`, link);
    };

    if (!existing) {
      log({ ...scope, kind: 'deal_created', message: `Deal "${v.name}" created in ${stateText()}` });
      notify(v.rep_id, 'deal_assigned', 'Deal assigned to you', v.name, link);
      if (v.stage === 'closed') announceClose();
    } else {
      let described = false;
      if (existing.rep_id !== v.rep_id) {
        const name = repExists(v.rep_id).name;
        log({ ...scope, kind: 'deal_assigned', message: `Deal "${v.name}" reassigned to ${name}` });
        notify(v.rep_id, 'deal_assigned', 'Deal assigned to you', v.name, link);
        described = true;
      }
      const stageChanged = existing.stage !== v.stage || existing.outcome !== v.outcome;
      if (stageChanged) {
        if (v.stage === 'closed') announceClose();
        else {
          const from = existing.stage === 'closed' ? `Closed (${existing.outcome === 'won' ? 'Won' : 'Lost'})` : stageLabel(existing.stage);
          log({ ...scope, kind: 'deal_stage', message: `Deal "${v.name}" moved from ${from} to ${stageLabel(v.stage)}` });
          notify(v.rep_id, 'deal_stage', `Deal moved to ${stageLabel(v.stage)}`, v.name, link);
        }
        described = true;
      }
      if (Math.round(existing.value * 100) !== v.value) {
        log({ ...scope, kind: 'deal_value', message: `Deal "${v.name}" value changed from ${money(existing.value)} to ${money(v.value / 100)}` });
        described = true;
      }
      const edited = existing.name !== v.name || existing.close_date !== v.close_date || existing.notes !== v.notes
        || existing.probability !== v.probability || existing.customer_id !== v.customer_id || existing.closed_on !== v.closed_on;
      if (edited && !described) log({ ...scope, kind: 'deal_updated', message: `Deal "${v.name}" details updated` });
    }
    return getDeal(id);
  }

  // -- tasks
  const TASK_SELECT = `SELECT t.*, r.name rep_name, r.status rep_status, c.name customer_name, d.name deal_name
    FROM tasks t JOIN reps r ON r.id=t.rep_id LEFT JOIN customers c ON c.id=t.customer_id LEFT JOIN deals d ON d.id=t.deal_id`;

  function getTask(id) {
    const t = one(`${TASK_SELECT} WHERE t.id=?`, id);
    if (!t) throw new HttpError(404, 'That task could not be found.');
    return t;
  }

  function saveTask(existing, input, actor) {
    const { values: v, errors } = clean(input, TASK_SPEC);
    requireActiveRep(v.rep_id, 'rep_id', errors, existing?.rep_id);
    if (v.customer_id && !one('SELECT id FROM customers WHERE id=?', v.customer_id)) errors.customer_id = 'That customer no longer exists.';
    if (v.deal_id) {
      const deal = one('SELECT customer_id FROM deals WHERE id=?', v.deal_id);
      if (!deal) errors.deal_id = 'That deal no longer exists.';
      else if (v.customer_id && v.customer_id !== deal.customer_id) errors.deal_id = 'This deal belongs to a different customer.';
      else v.customer_id = deal.customer_id;
    }
    finish(errors);

    const ts = now();
    const completedAt = v.status === 'done' ? existing?.completed_at || ts : null;
    let id = existing?.id;
    if (existing) {
      run(`UPDATE tasks SET title=?,description=?,due_date=?,priority=?,status=?,rep_id=?,customer_id=?,deal_id=?,completed_at=?,updated_at=? WHERE id=?`,
        v.title, v.description, v.due_date, v.priority, v.status, v.rep_id, v.customer_id, v.deal_id, completedAt, ts, id);
    } else {
      id = Number(run(`INSERT INTO tasks (title,description,due_date,priority,status,rep_id,customer_id,deal_id,completed_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`, v.title, v.description, v.due_date, v.priority, v.status, v.rep_id, v.customer_id, v.deal_id, completedAt, ts, ts).lastInsertRowid);
    }

    const scope = { customer_id: v.customer_id, deal_id: v.deal_id, actor };
    const link = `#/tasks/${id}`;
    if (!existing) {
      log({ ...scope, kind: 'task_created', message: `Task "${v.title}" created` });
      notify(v.rep_id, 'task_assigned', 'Task assigned to you', v.title, link);
    } else {
      if (existing.rep_id !== v.rep_id) {
        log({ ...scope, kind: 'task_assigned', message: `Task "${v.title}" reassigned to ${repExists(v.rep_id).name}` });
        notify(v.rep_id, 'task_assigned', 'Task assigned to you', v.title, link);
      }
      if (existing.status !== 'done' && v.status === 'done') log({ ...scope, kind: 'task_done', message: `Task "${v.title}" completed` });
      else if (existing.status === 'done' && v.status !== 'done') log({ ...scope, kind: 'task_reopened', message: `Task "${v.title}" reopened` });
    }
    return getTask(id);
  }

  // -- shared report maths
  function outcomeTotals(where, ...params) {
    const row = one(`SELECT
        COALESCE(SUM(CASE WHEN outcome='won' THEN 1 ELSE 0 END),0) won_count,
        COALESCE(SUM(CASE WHEN outcome='lost' THEN 1 ELSE 0 END),0) lost_count,
        COALESCE(SUM(CASE WHEN outcome='won' THEN value_p ELSE 0 END),0)/100.0 won_value,
        COALESCE(SUM(CASE WHEN outcome='lost' THEN value_p ELSE 0 END),0)/100.0 lost_value
      FROM deals WHERE stage='closed' AND ${where}`, ...params);
    const decided = Number(row.won_count) + Number(row.lost_count);
    return {
      won_count: Number(row.won_count),
      lost_count: Number(row.lost_count),
      won_value: row.won_value,
      lost_value: row.lost_value,
      win_rate: decided ? Number(row.won_count) / decided : null,
      avg_won: Number(row.won_count) ? row.won_value / Number(row.won_count) : null,
    };
  }

  function wonSeries(from, to, granularity, repId = null) {
    const series = buckets(from, to, granularity);
    const index = new Map(series.map((b) => [b.key, b]));
    const rows = all(`SELECT closed_on, value_p FROM deals WHERE outcome='won' AND closed_on BETWEEN ? AND ?${repId ? ' AND rep_id=?' : ''}`,
      ...(repId ? [from, to, repId] : [from, to]));
    for (const r of rows) {
      const b = index.get(bucketKey(r.closed_on, granularity));
      if (b) { b.value += r.value_p / 100; b.count += 1; }
    }
    return series;
  }

  function stageBreakdown(from, to, repId = null) {
    const repSql = repId ? ' AND rep_id=?' : '';
    const repArg = repId ? [repId] : [];
    const out = [];
    for (const s of STAGES.slice(0, 5)) {
      const r = one(`SELECT COUNT(*) n, COALESCE(SUM(value_p),0)/100.0 v FROM deals WHERE stage=?${repSql}`, s.id, ...repArg);
      out.push({ stage: s.id, label: s.label, kind: 'open', count: Number(r.n), value: r.v });
    }
    for (const oc of ['won', 'lost']) {
      const r = one(`SELECT COUNT(*) n, COALESCE(SUM(value_p),0)/100.0 v FROM deals WHERE outcome=?${from ? ' AND closed_on BETWEEN ? AND ?' : ''}${repSql}`,
        oc, ...(from ? [from, to] : []), ...repArg);
      out.push({ stage: `closed_${oc}`, label: `Closed: ${oc === 'won' ? 'Won' : 'Lost'}`, kind: oc, count: Number(r.n), value: r.v });
    }
    return out;
  }

  const activitySelect = `SELECT a.id,a.kind,a.message,a.customer_id,a.deal_id,a.created_at,r.name actor_name FROM activity a LEFT JOIN reps r ON r.id=a.actor_id`;

  function period(key) {
    const t = today();
    switch (key) {
      case 'this_month': return { key, label: 'This month', from: monthStart(t), to: t, granularity: 'week' };
      case 'last_30': return { key, label: 'Last 30 days', from: addDays(t, -29), to: t, granularity: 'week' };
      case 'last_90': return { key, label: 'Last 90 days', from: addDays(t, -89), to: t, granularity: 'week' };
      case 'ytd': return { key, label: 'This year', from: `${t.slice(0, 4)}-01-01`, to: t, granularity: 'month' };
      case 'last_12':
      case undefined:
      case null:
      case '': return { key: 'last_12', label: 'Last 12 months', from: addMonths(t, -11), to: t, granularity: 'month' };
      default: throw new HttpError(400, 'Unknown reporting period.');
    }
  }

  // ---- routes --------------------------------------------------------------
  const routes = [];
  const route = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>\\d+)')}$`), fn });

  route('GET', '/meta', () => ({
    today: today(),
    stages: STAGES,
    reps: all('SELECT id,name,status,role FROM reps ORDER BY name COLLATE NOCASE'),
    customers: all('SELECT id,name,company FROM customers ORDER BY name COLLATE NOCASE'),
    deals: all(`SELECT id,name,customer_id,stage,outcome FROM deals ORDER BY name COLLATE NOCASE`),
    locations: all(`SELECT DISTINCT location FROM customers WHERE location<>'' ORDER BY location COLLATE NOCASE`).map((r) => r.location),
  }));

  // customers
  route('GET', '/customers', ({ q }) => {
    const where = [];
    const p = [];
    if (q.get('q')) {
      const like = `%${escapeLike(q.get('q').trim())}%`;
      where.push(`(c.name LIKE ? ESCAPE '\\' OR c.company LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\' OR c.location LIKE ? ESCAPE '\\')`);
      p.push(like, like, like, like, like);
    }
    if (q.get('status')) { where.push('c.status=?'); p.push(q.get('status')); }
    if (q.get('location')) { where.push('c.location=?'); p.push(q.get('location')); }
    if (q.get('rep') === 'none') where.push('c.rep_id IS NULL');
    else if (q.get('rep')) { where.push('c.rep_id=?'); p.push(idParam(q, 'rep')); }
    const order = orderBy(q, { name: 'c.name COLLATE NOCASE', company: 'c.company COLLATE NOCASE', location: 'c.location COLLATE NOCASE', status: 'c.status', rep: 'r.name COLLATE NOCASE', created: 'c.created_at', won: 'won_value' }, 'name');
    return all(`${CUSTOMER_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${order}`, ...p);
  });
  route('POST', '/customers', ({ body, actor }) => {
    const v = customerInput(body);
    const ts = now();
    const id = Number(run(`INSERT INTO customers (name,company,email,phone,location,status,rep_id,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      v.name, v.company, v.email, v.phone, v.location, v.status, v.rep_id, v.notes, ts, ts).lastInsertRowid);
    log({ kind: 'customer_created', message: `Customer "${v.name}" added`, customer_id: id, actor });
    return getCustomer(id);
  });
  route('GET', '/customers/:id', ({ params }) => {
    const c = getCustomer(params.id);
    return {
      ...c,
      deals: all(`${DEAL_SELECT} WHERE d.customer_id=? ORDER BY d.stage='closed', d.close_date`, params.id),
      tasks: all(`${TASK_SELECT} WHERE t.customer_id=? ORDER BY t.status='done', t.due_date`, params.id),
      activity: all(`${activitySelect} WHERE a.customer_id=? ORDER BY a.created_at DESC, a.id DESC LIMIT 100`, params.id),
    };
  });
  route('PUT', '/customers/:id', ({ params, body, actor }) => {
    const existing = getCustomer(params.id);
    const v = customerInput(body, existing);
    run(`UPDATE customers SET name=?,company=?,email=?,phone=?,location=?,status=?,rep_id=?,notes=?,updated_at=? WHERE id=?`,
      v.name, v.company, v.email, v.phone, v.location, v.status, v.rep_id, v.notes, now(), params.id);
    if (existing.rep_id !== v.rep_id && v.rep_id) log({ kind: 'customer_assigned', message: `Customer assigned to ${repExists(v.rep_id).name}`, customer_id: params.id, actor });
    else if (existing.status !== v.status) log({ kind: 'customer_status', message: `Customer status changed to ${v.status.replace('_', ' ')}`, customer_id: params.id, actor });
    else log({ kind: 'customer_updated', message: 'Customer details updated', customer_id: params.id, actor });
    return getCustomer(params.id);
  });
  route('DELETE', '/customers/:id', ({ params, actor }) => {
    const c = getCustomer(params.id);
    run('DELETE FROM customers WHERE id=?', params.id);
    log({ kind: 'customer_deleted', message: `Customer "${c.name}" deleted`, actor });
  });

  // reps
  const repStats = `(SELECT COUNT(*) FROM customers c WHERE c.rep_id=r.id) customer_count,
    (SELECT COUNT(*) FROM deals d WHERE d.rep_id=r.id AND d.stage<>'closed') open_deals,
    (SELECT COALESCE(SUM(d.value_p),0)/100.0 FROM deals d WHERE d.rep_id=r.id AND d.stage<>'closed') open_value,
    (SELECT COALESCE(SUM(d.value_p),0)/100.0 FROM deals d WHERE d.rep_id=r.id AND d.outcome='won') won_value,
    (SELECT COUNT(*) FROM tasks t WHERE t.rep_id=r.id AND t.status<>'done') open_tasks`;
  function getRep(id) {
    const r = one(`SELECT r.*, ${repStats} FROM reps r WHERE r.id=?`, id);
    if (!r) throw new HttpError(404, 'That sales representative could not be found.');
    return r;
  }
  function repInput(body, id) {
    const { values, errors } = clean(body, REP_SPEC);
    if (values.email && one('SELECT id FROM reps WHERE email=? AND id<>?', values.email, id ?? 0)) errors.email = 'Another team member already uses this email.';
    finish(errors);
    return values;
  }
  route('GET', '/reps', ({ q }) => {
    const where = [];
    const p = [];
    if (q.get('q')) {
      const like = `%${escapeLike(q.get('q').trim())}%`;
      where.push(`(r.name LIKE ? ESCAPE '\\' OR r.email LIKE ? ESCAPE '\\' OR r.role LIKE ? ESCAPE '\\')`);
      p.push(like, like, like);
    }
    if (q.get('status')) { where.push('r.status=?'); p.push(q.get('status')); }
    const order = orderBy(q, { name: 'r.name COLLATE NOCASE', role: 'r.role COLLATE NOCASE', status: 'r.status', won: 'won_value', open: 'open_value', customers: 'customer_count' }, 'name');
    return all(`SELECT r.*, ${repStats} FROM reps r ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${order}`, ...p);
  });
  route('POST', '/reps', ({ body, actor }) => {
    const v = repInput(body);
    const ts = now();
    const id = Number(run(`INSERT INTO reps (name,email,phone,role,status,created_at,updated_at) VALUES (?,?,?,?,'active',?,?)`, v.name, v.email, v.phone, v.role, ts, ts).lastInsertRowid);
    log({ kind: 'rep_created', message: `${v.name} joined the sales team`, actor });
    return getRep(id);
  });
  route('GET', '/reps/:id', ({ params }) => {
    const r = getRep(params.id);
    const t = today();
    const from = addMonths(t, -11);
    return {
      ...r,
      customers: all(`${CUSTOMER_SELECT} WHERE c.rep_id=? ORDER BY c.name COLLATE NOCASE`, params.id),
      deals: all(`${DEAL_SELECT} WHERE d.rep_id=? ORDER BY d.stage='closed', d.close_date`, params.id),
      tasks: all(`${TASK_SELECT} WHERE t.rep_id=? ORDER BY t.status='done', t.due_date`, params.id),
      performance: {
        ...outcomeTotals('rep_id=?', params.id),
        open_value: r.open_value,
        open_deals: r.open_deals,
        overdue_tasks: count(`SELECT COUNT(*) n FROM tasks WHERE rep_id=? AND status<>'done' AND due_date<?`, params.id, t),
        won_by_month: wonSeries(from, t, 'month', params.id),
      },
    };
  });
  route('PUT', '/reps/:id', ({ params, body, actor }) => {
    getRep(params.id);
    const v = repInput(body, params.id);
    run('UPDATE reps SET name=?,email=?,phone=?,role=?,updated_at=? WHERE id=?', v.name, v.email, v.phone, v.role, now(), params.id);
    log({ kind: 'rep_updated', message: `${v.name}'s details updated`, actor });
    return getRep(params.id);
  });
  route('POST', '/reps/:id/deactivate', ({ params, body, actor }) => {
    const r = getRep(params.id);
    if (r.status === 'inactive') return r;
    const target = body.reassign_to ? Number(body.reassign_to) : null;
    if (target) {
      const dest = repExists(target);
      if (!dest || dest.status !== 'active' || target === params.id) throw new HttpError(422, 'Please fix the highlighted fields.', { reassign_to: 'Choose another active representative.' });
      const ts = now();
      const deals = Number(run(`UPDATE deals SET rep_id=?,updated_at=? WHERE rep_id=? AND stage<>'closed'`, target, ts, params.id).changes);
      const tasks = Number(run(`UPDATE tasks SET rep_id=?,updated_at=? WHERE rep_id=? AND status<>'done'`, target, ts, params.id).changes);
      const customers = Number(run(`UPDATE customers SET rep_id=?,updated_at=? WHERE rep_id=?`, target, ts, params.id).changes);
      if (deals + tasks + customers) {
        notify(target, 'deal_assigned', `Work reassigned from ${r.name}`, `${customers} customers, ${deals} open deals and ${tasks} open tasks`, `#/team/${target}`);
      }
    }
    run(`UPDATE reps SET status='inactive',updated_at=? WHERE id=?`, now(), params.id);
    log({ kind: 'rep_deactivated', message: `${r.name} deactivated`, actor });
    return getRep(params.id);
  });
  route('POST', '/reps/:id/reactivate', ({ params, actor }) => {
    const r = getRep(params.id);
    run(`UPDATE reps SET status='active',updated_at=? WHERE id=?`, now(), params.id);
    log({ kind: 'rep_reactivated', message: `${r.name} reactivated`, actor });
    return getRep(params.id);
  });

  // deals
  route('GET', '/deals', ({ q }) => {
    const where = [];
    const p = [];
    if (q.get('q')) {
      const like = `%${escapeLike(q.get('q').trim())}%`;
      where.push(`(d.name LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR c.company LIKE ? ESCAPE '\\')`);
      p.push(like, like, like);
    }
    if (q.get('stage')) { where.push('d.stage=?'); p.push(q.get('stage')); }
    if (q.get('rep')) { where.push('d.rep_id=?'); p.push(idParam(q, 'rep')); }
    if (q.get('customer')) { where.push('d.customer_id=?'); p.push(idParam(q, 'customer')); }
    if (q.get('outcome') === 'open') where.push(`d.stage<>'closed'`);
    else if (q.get('outcome')) { where.push('d.outcome=?'); p.push(q.get('outcome')); }
    const from = dateParam(q, 'close_from');
    const to = dateParam(q, 'close_to');
    if (from) { where.push('d.close_date>=?'); p.push(from); }
    if (to) { where.push('d.close_date<=?'); p.push(to); }
    const order = orderBy(q, { name: 'd.name COLLATE NOCASE', customer: 'c.name COLLATE NOCASE', rep: 'r.name COLLATE NOCASE', value: 'd.value_p', close_date: 'd.close_date', probability: 'd.probability', stage: `CASE d.stage ${STAGE_IDS.map((s, i) => `WHEN '${s}' THEN ${i}`).join(' ')} END` }, 'close_date');
    return all(`${DEAL_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${order}`, ...p);
  });
  route('POST', '/deals', ({ body, actor }) => saveDeal(null, body, actor));
  route('GET', '/deals/:id', ({ params }) => ({
    ...getDeal(params.id),
    tasks: all(`${TASK_SELECT} WHERE t.deal_id=? ORDER BY t.status='done', t.due_date`, params.id),
    activity: all(`${activitySelect} WHERE a.deal_id=? ORDER BY a.created_at DESC, a.id DESC LIMIT 100`, params.id),
  }));
  route('PUT', '/deals/:id', ({ params, body, actor }) => saveDeal(getDeal(params.id), body, actor));
  route('POST', '/deals/:id/move', ({ params, body, actor }) => {
    const d = getDeal(params.id);
    return saveDeal(d, { ...d, stage: body.stage, outcome: body.outcome ?? null, closed_on: body.closed_on ?? null }, actor);
  });
  route('DELETE', '/deals/:id', ({ params, actor }) => {
    const d = getDeal(params.id);
    run('DELETE FROM deals WHERE id=?', params.id);
    log({ kind: 'deal_deleted', message: `Deal "${d.name}" deleted`, customer_id: d.customer_id, actor });
  });

  // tasks
  route('GET', '/tasks', ({ q }) => {
    sweepOverdue();
    const t = today();
    const where = [];
    const p = [];
    if (q.get('q')) {
      const like = `%${escapeLike(q.get('q').trim())}%`;
      where.push(`(t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR d.name LIKE ? ESCAPE '\\')`);
      p.push(like, like, like, like);
    }
    const status = q.get('status');
    if (status === 'open') where.push(`t.status<>'done'`);
    else if (status) { where.push('t.status=?'); p.push(status); }
    if (q.get('priority')) { where.push('t.priority=?'); p.push(q.get('priority')); }
    if (q.get('rep')) { where.push('t.rep_id=?'); p.push(idParam(q, 'rep')); }
    const due = q.get('due');
    if (due === 'overdue') { where.push(`t.status<>'done' AND t.due_date<?`); p.push(t); }
    else if (due === 'today') { where.push('t.due_date=?'); p.push(t); }
    else if (due === 'upcoming') { where.push(`t.status<>'done' AND t.due_date>? AND t.due_date<=?`); p.push(t, addDays(t, 7)); }
    const from = dateParam(q, 'due_from');
    const to = dateParam(q, 'due_to');
    if (from) { where.push('t.due_date>=?'); p.push(from); }
    if (to) { where.push('t.due_date<=?'); p.push(to); }
    const order = orderBy(q, { title: 't.title COLLATE NOCASE', due_date: 't.due_date', priority: `CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`, status: 't.status', rep: 'r.name COLLATE NOCASE' }, 'due_date');
    return {
      items: all(`${TASK_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${order}`, ...p),
      counts: {
        open: count(`SELECT COUNT(*) n FROM tasks WHERE status<>'done'`),
        overdue: count(`SELECT COUNT(*) n FROM tasks WHERE status<>'done' AND due_date<?`, t),
        today: count(`SELECT COUNT(*) n FROM tasks WHERE status<>'done' AND due_date=?`, t),
        upcoming: count(`SELECT COUNT(*) n FROM tasks WHERE status<>'done' AND due_date>? AND due_date<=?`, t, addDays(t, 7)),
        done: count(`SELECT COUNT(*) n FROM tasks WHERE status='done'`),
      },
    };
  });
  route('POST', '/tasks', ({ body, actor }) => saveTask(null, body, actor));
  route('GET', '/tasks/:id', ({ params }) => getTask(params.id));
  route('PUT', '/tasks/:id', ({ params, body, actor }) => saveTask(getTask(params.id), body, actor));
  route('POST', '/tasks/:id/complete', ({ params, body, actor }) => {
    const t = getTask(params.id);
    return saveTask(t, { ...t, status: body.done === false ? 'todo' : 'done' }, actor);
  });
  route('DELETE', '/tasks/:id', ({ params, actor }) => {
    const t = getTask(params.id);
    run('DELETE FROM tasks WHERE id=?', params.id);
    log({ kind: 'task_deleted', message: `Task "${t.title}" deleted`, customer_id: t.customer_id, deal_id: t.deal_id, actor });
  });

  // dashboard
  route('GET', '/dashboard', ({ q }) => {
    sweepOverdue();
    const t = today();
    const p = period(q.get('period'));
    const open = one(`SELECT COUNT(*) n, COALESCE(SUM(value_p),0)/100.0 v FROM deals WHERE stage<>'closed'`);
    const totals = outcomeTotals('closed_on BETWEEN ? AND ?', p.from, p.to);
    return {
      period: p,
      total_customers: count('SELECT COUNT(*) n FROM customers'),
      new_customers: count(`SELECT COUNT(*) n FROM customers WHERE date(created_at,'localtime') BETWEEN ? AND ?`, p.from, p.to),
      active_deals: { count: Number(open.n), value: open.v },
      won: { count: totals.won_count, value: totals.won_value },
      lost: { count: totals.lost_count, value: totals.lost_value },
      win_rate: totals.win_rate,
      revenue_this_month: outcomeTotals('closed_on BETWEEN ? AND ?', monthStart(t), t).won_value,
      tasks: {
        due_today: count(`SELECT COUNT(*) n FROM tasks WHERE status<>'done' AND due_date=?`, t),
        overdue: count(`SELECT COUNT(*) n FROM tasks WHERE status<>'done' AND due_date<?`, t),
      },
      pipeline: stageBreakdown(p.from, p.to),
      revenue_series: wonSeries(p.from, p.to, p.granularity),
      recent_activity: all(`${activitySelect} ORDER BY a.created_at DESC, a.id DESC LIMIT 12`),
    };
  });

  // reports
  route('GET', '/reports', ({ q }) => {
    const t = today();
    const from = dateParam(q, 'from') ?? addMonths(t, -11);
    const to = dateParam(q, 'to') ?? t;
    if (from > to) throw new HttpError(422, 'The start date must be before the end date.', { from: 'Must be before the end date.' });
    const rep = idParam(q, 'rep');
    const repSql = rep ? ' AND rep_id=?' : '';
    const repArg = rep ? [rep] : [];
    const totals = outcomeTotals(`closed_on BETWEEN ? AND ?${repSql}`, from, to, ...repArg);
    const open = one(`SELECT COUNT(*) n, COALESCE(SUM(value_p),0)/100.0 v, COALESCE(SUM(value_p*probability),0)/10000.0 w FROM deals WHERE stage<>'closed'${repSql}`, ...repArg);
    const by_rep = all(`SELECT r.id, r.name, r.status,
        COALESCE(SUM(CASE WHEN d.outcome='won' AND d.closed_on BETWEEN ? AND ? THEN d.value_p END),0)/100.0 won_value,
        COALESCE(SUM(CASE WHEN d.outcome='won' AND d.closed_on BETWEEN ? AND ? THEN 1 END),0) won_count,
        COALESCE(SUM(CASE WHEN d.outcome='lost' AND d.closed_on BETWEEN ? AND ? THEN 1 END),0) lost_count,
        COALESCE(SUM(CASE WHEN d.stage<>'closed' THEN d.value_p END),0)/100.0 open_value
      FROM reps r LEFT JOIN deals d ON d.rep_id=r.id
      ${rep ? 'WHERE r.id=?' : ''} GROUP BY r.id ORDER BY won_value DESC, r.name`,
    from, to, from, to, from, to, ...repArg)
      .filter((r) => rep || r.status === 'active' || r.won_value > 0 || Number(r.lost_count) > 0)
      .map((r) => {
        const decided = Number(r.won_count) + Number(r.lost_count);
        return { ...r, won_count: Number(r.won_count), lost_count: Number(r.lost_count), win_rate: decided ? Number(r.won_count) / decided : null };
      });
    return {
      from, to,
      totals: { ...totals, open_count: Number(open.n), open_value: open.v, weighted_open: open.w },
      won_by_month: wonSeries(from, to, 'month', rep),
      by_rep,
      by_stage: stageBreakdown(from, to, rep),
    };
  });

  // notifications
  const requireActor = (actor) => { if (!actor) throw new HttpError(400, 'Choose who you are first.'); return actor; };
  const unreadFor = (actor) => (actor ? count('SELECT COUNT(*) n FROM notifications WHERE rep_id=? AND read_at IS NULL', actor) : 0);
  route('GET', '/notifications', ({ q, actor }) => {
    sweepOverdue();
    if (!actor) return { items: [], unread: 0 };
    const unreadOnly = q.get('filter') === 'unread';
    return {
      items: all(`SELECT * FROM notifications WHERE rep_id=?${unreadOnly ? ' AND read_at IS NULL' : ''} ORDER BY created_at DESC, id DESC LIMIT 200`, actor),
      unread: unreadFor(actor),
    };
  });
  route('GET', '/notifications/unread', ({ actor }) => { sweepOverdue(); return { unread: unreadFor(actor) }; });
  route('POST', '/notifications/read-all', ({ actor }) => {
    run('UPDATE notifications SET read_at=? WHERE rep_id=? AND read_at IS NULL', now(), requireActor(actor));
    return { unread: 0 };
  });
  route('POST', '/notifications/:id/read', ({ params, body, actor }) => {
    const res = run('UPDATE notifications SET read_at=? WHERE id=? AND rep_id=?', body.read === false ? null : now(), params.id, requireActor(actor));
    if (!Number(res.changes)) throw new HttpError(404, 'That notification could not be found.');
    return { unread: unreadFor(actor) };
  });

  return {
    sweepOverdue,
    handle(method, pathname, q, body, repHeader) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(pathname);
        if (!m) continue;
        const params = {};
        for (const [k, v] of Object.entries(m.groups ?? {})) params[k] = Number(v);
        const parsed = Number(repHeader);
        const actor = Number.isInteger(parsed) && parsed > 0 && one('SELECT id FROM reps WHERE id=?', parsed) ? parsed : null;
        const ctx = { q, body, params, actor };
        return method === 'GET' ? r.fn(ctx) : transaction(db, () => r.fn(ctx));
      }
      throw new HttpError(404, 'Not found.');
    },
  };
}
