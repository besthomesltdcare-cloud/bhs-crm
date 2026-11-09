import { h, api, app, session, pageHead, button, resultsArea, emptyState, fmtDateTime, timeAgo, icon, toast, toastError, iconButton } from '../lib.js';

const ICON_FOR = { task_assigned: 'tasks', task_overdue: 'alert', deal_assigned: 'deals', deal_stage: 'deals', deal_won: 'check', deal_lost: 'x' };
const TONE_FOR = { task_overdue: 'bad', deal_won: 'good', deal_lost: 'bad' };

export async function notificationsView(root, ctx) {
  const state = { filter: ctx.query.filter || '' };

  const markRead = async (n, read) => {
    await api(`/notifications/${n.id}/read`, { method: 'POST', body: { read } });
    app.refreshBadge();
  };

  const tab = (value, label) => h('button', {
    type: 'button', class: 'seg-btn', 'aria-pressed': String(state.filter === value),
    onclick: () => { state.filter = value; tabs.querySelectorAll('.seg-btn').forEach((b, i) => b.setAttribute('aria-pressed', String(['', 'unread'][i] === value))); results.run(); },
  }, label);
  const tabs = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Show' }, tab('', 'All'), tab('unread', 'Unread'));

  const allRead = button('Mark all as read', async () => {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      toast('All notifications marked as read.');
      app.refreshBadge();
      results.run();
    } catch (e) { toastError(e); }
  }, { iconName: 'check' });

  const results = resultsArea(async () => {
    const { items, unread } = await api(`/notifications${state.filter ? `?filter=${state.filter}` : ''}`);
    ctx.setQuery(state);
    allRead.disabled = unread === 0;
    if (!session.repId) return emptyState({ title: 'Add your team first', text: 'Notifications are sent to sales representatives.', iconName: 'bell' });
    if (!items.length) {
      return emptyState({
        title: state.filter ? 'You are all caught up' : 'No notifications yet',
        text: state.filter ? 'There are no unread notifications.' : 'Assignments, overdue tasks and deal changes will appear here.',
        iconName: 'bell',
      });
    }
    return h('ul', { class: 'notes-list' }, items.map((n) => {
      const unreadNow = !n.read_at;
      return h('li', { class: `note${unreadNow ? ' note-unread' : ''}` },
        h('span', { class: `note-icon note-icon-${TONE_FOR[n.type] || 'info'}` }, icon(ICON_FOR[n.type] || 'bell', 16)),
        h('div', { class: 'note-main' },
          h('a', {
            class: 'note-title', href: n.link || '#/notifications',
            onclick: () => { if (unreadNow) markRead(n, true).catch(toastError); },
          }, n.title),
          h('p', { class: 'note-body' }, n.body),
          h('time', { class: 'note-time', datetime: n.created_at, title: fmtDateTime(n.created_at) }, `${timeAgo(n.created_at)} · ${fmtDateTime(n.created_at)}`)),
        unreadNow && h('span', { class: 'sr-only' }, 'Unread'),
        iconButton(unreadNow ? 'check' : 'refresh', unreadNow ? `Mark "${n.title}" as read` : `Mark "${n.title}" as unread`, async () => {
          try { await markRead(n, unreadNow ? true : false); results.run(); } catch (e) { toastError(e); }
        }));
    }));
  });

  root.append(pageHead('Notifications', 'What needs your attention.', [tabs, allRead]), results.el);
  await results.run();
}
