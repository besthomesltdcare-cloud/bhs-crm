// Small SVG/HTML charts. One series each, one axis, thin rounded bars, hover tooltips, table fallback.
import { h, svg, money, moneyShort } from './lib.js';

// A round tick step giving at most four gridlines above zero.
function niceScale(v) {
  if (v <= 0) return { max: 1000, step: 250 };
  const rough = v / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rough);
  return { max: Math.ceil(v / step) * step, step };
}

const tableFor = (caption, headers, rows) => h('details', { class: 'chart-table' },
  h('summary', null, 'View as table'),
  h('div', { class: 'table-wrap' }, h('table', { class: 'table table-plain' },
    h('caption', { class: 'sr-only' }, caption),
    h('thead', null, h('tr', null, headers.map((x) => h('th', { scope: 'col' }, x)))),
    h('tbody', null, rows.map((r) => h('tr', null, r.map((c) => h('td', null, c))))))));

// Vertical bars over time. data: [{label,value,count}]
export function barChart(data, { color = 'var(--chart-won)', caption = 'Won revenue', height = 240 } = {}) {
  const wrap = h('div', { class: 'chart' });
  const tip = h('div', { class: 'chart-tip', hidden: true });
  const plot = h('div', { class: 'chart-plot' });
  wrap.append(plot, tip, tableFor(caption, ['Period', 'Won revenue', 'Deals won'], data.map((d) => [d.label, money(d.value), d.count])));

  const draw = (width) => {
    if (width <= 0) return;
    const m = { top: 22, right: 8, bottom: 26, left: 48 };
    const iw = width - m.left - m.right;
    const ih = height - m.top - m.bottom;
    const { max, step: tick } = niceScale(Math.max(...data.map((d) => d.value), 0));
    const y = (v) => m.top + ih - (v / max) * ih;
    const step = iw / data.length;
    const bw = Math.min(30, Math.max(6, step * 0.56));
    const labelEvery = Math.max(1, Math.ceil(52 / step));
    const maxIdx = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
    const root = svg('svg', { width, height, role: 'img', 'aria-label': `${caption} chart. A table view is available below.` });

    for (let v = 0; v <= max; v += tick) {
      root.append(svg('line', { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v), class: v === 0 ? 'axis-base' : 'axis-grid' }));
      root.append(svg('text', { x: m.left - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'axis-text' }, moneyShort(v)));
    }
    data.forEach((d, i) => {
      const cx = m.left + step * i + step / 2;
      if (d.value > 0) {
        const top = y(d.value);
        const barH = Math.max(3, m.top + ih - top);
        const r = Math.min(4, bw / 2, barH);
        const x = cx - bw / 2;
        const yt = m.top + ih - barH;
        root.append(svg('path', {
          d: `M${x},${m.top + ih}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + bw - r}Q${x + bw},${yt} ${x + bw},${yt + r}V${m.top + ih}Z`,
          style: { fill: color },
        }));
        if (i === maxIdx) root.append(svg('text', { x: cx, y: yt - 7, 'text-anchor': 'middle', class: 'axis-text axis-strong' }, moneyShort(d.value)));
      }
      if ((data.length - 1 - i) % labelEvery === 0) root.append(svg('text', { x: cx, y: height - 8, 'text-anchor': 'middle', class: 'axis-text' }, d.label));
      const hit = svg('rect', { x: m.left + step * i, y: m.top, width: step, height: ih, fill: 'transparent' });
      hit.addEventListener('pointerenter', () => {
        tip.replaceChildren(h('strong', null, d.label), h('span', null, `${money(d.value)} won`), h('span', { class: 'muted' }, `${d.count} deal${d.count === 1 ? '' : 's'}`));
        tip.hidden = false;
        const tw = tip.offsetWidth;
        tip.style.left = `${Math.min(Math.max(0, cx - tw / 2), width - tw)}px`;
        tip.style.top = `${Math.max(0, y(d.value) - tip.offsetHeight - 8)}px`;
      });
      hit.addEventListener('pointerleave', () => { tip.hidden = true; });
      root.append(hit);
    });
    plot.replaceChildren(root);
  };

  plot.style.height = `${height}px`;
  let last = 0;
  const ro = new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w !== last) { last = w; draw(w); }
  });
  ro.observe(plot);
  return wrap;
}

// Horizontal labelled bars. rows: [{label,value,display,sub,tone,href}]
export function hBars(rows, { caption = 'Breakdown', headers = ['Item', 'Value', 'Detail'] } = {}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const list = h('ul', { class: 'hbars' }, rows.map((r) => {
    const name = r.href ? h('a', { href: r.href }, r.label) : r.label;
    return h('li', null,
      h('div', { class: 'hbar-top' }, h('span', { class: 'hbar-label' }, name), h('span', { class: 'hbar-value' }, r.display), r.sub && h('span', { class: 'hbar-sub' }, r.sub)),
      h('div', { class: 'hbar-track', 'aria-hidden': 'true' }, h('div', { class: `hbar-fill hbar-${r.tone || 'open'}`, style: { width: `${r.value > 0 ? Math.max(1.5, (r.value / max) * 100) : 0}%` } })));
  }));
  return h('div', { 'aria-label': caption }, list, tableFor(caption, headers, rows.map((r) => [r.label, r.display, r.sub || ''])));
}
