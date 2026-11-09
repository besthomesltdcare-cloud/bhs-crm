import { h, api, app, session, icon, skeleton, errorState, getMeta, toastError } from './lib.js';
import { dashboardView } from './views/dashboard.js';
import { customersView, customerDetailView } from './views/customers.js';
import { teamView, repDetailView } from './views/team.js';
import { dealsView, dealDetailView } from './views/deals.js';
import { tasksView } from './views/tasks.js';
import { reportsView } from './views/reports.js';
import { notificationsView } from './views/notifications.js';

const NAV = [
  { path: '', label: 'Dashboard', icon: 'dashboard' },
  { path: 'customers', label: 'Customers', icon: 'customers' },
  { path: 'team', label: 'Sales team', icon: 'team' },
  { path: 'deals', label: 'Deals', icon: 'deals' },
  { path: 'tasks', label: 'Tasks', icon: 'tasks' },
  { path: 'reports', label: 'Reports', icon: 'reports' },
];

const ROUTES = [
  [/^$/, dashboardView, ''],
  [/^customers$/, customersView, 'customers'],
  [/^customers\/(\d+)$/, customerDetailView, 'customers'],
  [/^team$/, teamView, 'team'],
  [/^team\/(\d+)$/, repDetailView, 'team'],
  [/^deals$/, dealsView, 'deals'],
  [/^deals\/(\d+)$/, dealDetailView, 'deals'],
  [/^tasks$/, tasksView, 'tasks'],
  [/^tasks\/(\d+)$/, tasksView, 'tasks'],
  [/^reports$/, reportsView, 'reports'],
  [/^notifications$/, notificationsView, 'notifications'],
];

const main = h('main', { id: 'main', class: 'main', tabindex: '-1' });
const navLinks = new Map();
const badgeEl = h('span', { class: 'bell-badge', hidden: true });
const bell = h('a', { href: '#/notifications', class: 'icon-btn bell' }, icon('bell', 20), badgeEl);
const userSelect = h('select', { id: 'current-user', class: 'input input-sm' });
const sidebar = h('nav', { class: 'sidebar', 'aria-label': 'Main' });
const scrim = h('div', { class: 'scrim', hidden: true });

function setDrawer(open) {
  sidebar.classList.toggle('open', open);
  scrim.hidden = !open;
}
scrim.addEventListener('click', () => setDrawer(false));

function shell() {
  sidebar.append(
    h('a', { class: 'brand', href: '#/' },
      h('img', { src: '/favicon.svg', alt: '', width: 32, height: 32 }),
      h('span', null, h('strong', null, 'Best Homes'), h('small', null, 'Support CRM'))),
    h('ul', { class: 'nav' }, NAV.map((n) => {
      const a = h('a', { href: `#/${n.path}`, onclick: () => setDrawer(false) }, icon(n.icon, 19), n.label);
      navLinks.set(n.path, a);
      return h('li', null, a);
    })),
    h('div', { class: 'user-box' }, h('label', { for: 'current-user' }, 'Signed in as'), userSelect));

  const topbar = h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Open menu', onclick: () => setDrawer(!sidebar.classList.contains('open')) }, icon('menu', 22)),
    h('span', { class: 'topbar-brand' }, 'Best Homes CRM'),
    bell);

  document.getElementById('app').append(h('div', { class: 'layout' }, sidebar, scrim, h('div', { class: 'content' }, topbar, main)));
}

async function refreshBadge() {
  try {
    const { unread } = await api('/notifications/unread');
    badgeEl.textContent = unread > 99 ? '99+' : String(unread);
    badgeEl.hidden = unread === 0;
    bell.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    document.title = `${unread ? `(${unread}) ` : ''}Best Homes CRM`;
  } catch { /* the next poll will retry */ }
}
app.refreshBadge = refreshBadge;

export async function loadUsers() {
  const meta = await getMeta();
  const active = meta.reps.filter((r) => r.status === 'active');
  // Default to the first person added to the team, not whoever sorts first alphabetically.
  if (!active.some((r) => r.id === session.repId)) session.repId = active.length ? Math.min(...active.map((r) => r.id)) : null;
  userSelect.replaceChildren(...(active.length ? active.map((r) => h('option', { value: r.id }, r.name)) : [h('option', { value: '' }, 'No team members yet')]));
  userSelect.value = session.repId ?? '';
}
userSelect.addEventListener('change', () => {
  session.repId = Number(userSelect.value) || null;
  refreshBadge();
  render({ keep: true });
});

let token = 0;
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path.replace(/\/$/, ''), query: Object.fromEntries(new URLSearchParams(query)) };
}

async function render({ keep = false } = {}) {
  const mine = ++token;
  const { path, query } = parseHash();
  const match = ROUTES.map(([re, view, section]) => ({ m: re.exec(path), view, section })).find((r) => r.m);

  for (const [p, a] of navLinks) {
    const current = match?.section === p;
    a.classList.toggle('active', current);
    if (current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  if (!match) {
    main.replaceChildren(errorState({ status: 404, message: 'That page does not exist.' }));
    return;
  }

  const timer = keep ? null : setTimeout(() => { if (mine === token) main.replaceChildren(skeleton()); }, 120);
  const next = h('div', { class: 'view' });
  const ctx = {
    params: match.m.slice(1).map(Number),
    query,
    setQuery(state) {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(state)) if (v !== '' && v != null) p.set(k, v);
      const s = p.toString();
      history.replaceState(null, '', `#/${path.split('/')[0]}${s ? `?${s}` : ''}`);
    },
  };
  try {
    await match.view(next, ctx);
    clearTimeout(timer);
    if (mine !== token) return;
    const y = window.scrollY;
    main.replaceChildren(next);
    if (keep) window.scrollTo(0, y);
    else {
      window.scrollTo(0, 0);
      next.querySelector('h1')?.focus({ preventScroll: true });
    }
  } catch (err) {
    clearTimeout(timer);
    if (mine !== token) return;
    main.replaceChildren(errorState(err, () => render()));
  }
}

app.reload = async () => {
  await loadUsers().catch(toastError);
  return render({ keep: true });
};

async function start() {
  shell();
  try { await loadUsers(); } catch (err) { main.replaceChildren(errorState(err, () => location.reload())); return; }
  window.addEventListener('hashchange', () => { setDrawer(false); refreshBadge(); render(); });
  refreshBadge();
  setInterval(refreshBadge, 30000);
  render();
}
start();
