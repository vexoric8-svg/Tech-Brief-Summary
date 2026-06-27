/* Markets page — candlestick chart with crosshair, OHLC legend, pan + zoom.
   Vanilla canvas, no dependencies. Reads stocks.json (OHLC + volume). */
(() => {
  const DATA_URL = './stocks.json';
  const UP = '#2f8f5b';
  const DOWN = '#c5482f';

  const $ = (id) => document.getElementById(id);
  const sel = $('ticker');
  const priceEl = $('quote-price');
  const changeEl = $('quote-change');
  const updatedEl = $('stocks-updated');
  const canvas = $('chart');
  const legendEl = $('chart-legend');
  const emptyEl = $('chart-empty');
  const rangesEl = $('ranges');
  const typesEl = $('chart-types');
  if (!sel || !canvas) return;
  const ctx = canvas.getContext('2d');

  let stocks = [];
  let cur = null;
  let full = [];
  let count = 63;          // visible candles
  let start = 0;           // index of first visible candle
  let type = 'line';       // line chart (candles toggle removed)
  let hover = -1;          // hovered visible index
  let geo = null;          // layout snapshot for pointer math
  const pointers = new Map();
  let pinch = null;
  let panLast = null;

  const L = { padTop: 10, axR: 56, axB: 20, volH: 40, gap: 8, padL: 2 };

  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const fmt = (v, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtVol = (v) => v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v);
  const fmtDate = (iso, yr = true) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, yr ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }); };

  function clampWindow() {
    count = Math.max(5, Math.min(Math.round(count), Math.max(5, full.length)));
    if (count > full.length) count = full.length;
    start = Math.max(0, Math.min(Math.round(start), full.length - count));
  }
  const visible = () => full.slice(start, start + count);

  function niceTicks(min, max, n) {
    const span = (max - min) || 1;
    const mag = Math.pow(10, Math.floor(Math.log10(span / n)));
    const norm = (span / n) / mag;
    const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
    return ticks;
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const vis = visible();
    if (vis.length < 1) { geo = null; return; }

    const plotL = L.padL, plotR = W - L.axR, plotW = plotR - plotL;
    const priceTop = L.padTop, priceBot = H - L.axB - L.volH - L.gap, priceH = priceBot - priceTop;
    const volBot = H - L.axB;
    const slot = plotW / vis.length;
    let lo = Infinity, hi = -Infinity, vmax = 0;
    for (const k of vis) { lo = Math.min(lo, k.l); hi = Math.max(hi, k.h); vmax = Math.max(vmax, k.v || 0); }
    const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const X = (i) => plotL + (i + 0.5) * slot;
    const Y = (p) => priceTop + (1 - (p - lo) / (hi - lo)) * priceH;
    geo = { plotL, plotR, slot, n: vis.length };

    const line = css('--line') || '#e4dbca';
    const muted = css('--muted') || '#807769';
    ctx.font = '11px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    for (const t of niceTicks(lo, hi, 4)) {
      const y = Y(t);
      ctx.globalAlpha = 0.55; ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(plotL, y); ctx.lineTo(plotR, y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = muted; ctx.textAlign = 'left';
      ctx.fillText(fmt(t, t < 10 ? 2 : 0), plotR + 6, y);
    }

    if (vmax > 0) {
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < vis.length; i++) {
        const k = vis[i], bh = (k.v / vmax) * L.volH, bw = Math.max(1, slot * 0.6);
        ctx.fillStyle = k.c >= k.o ? UP : DOWN;
        ctx.fillRect(X(i) - bw / 2, volBot - bh, bw, bh);
      }
      ctx.globalAlpha = 1;
    }

    if (type === 'line') {
      ctx.beginPath();
      vis.forEach((k, i) => { const x = X(i), y = Y(k.c); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = vis[vis.length - 1].c >= vis[0].c ? UP : DOWN;
      ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    } else {
      const bw = Math.max(1, slot * 0.62);
      for (let i = 0; i < vis.length; i++) {
        const k = vis[i], up = k.c >= k.o, col = up ? UP : DOWN, x = X(i);
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, Y(k.h)); ctx.lineTo(x, Y(k.l)); ctx.stroke();
        const yO = Y(k.o), yC = Y(k.c);
        ctx.fillRect(x - bw / 2, Math.min(yO, yC), bw, Math.max(1, Math.abs(yC - yO)));
      }
    }

    ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const nlab = Math.min(4, vis.length);
    for (let j = 0; j < nlab; j++) {
      const i = nlab === 1 ? 0 : Math.round(j * (vis.length - 1) / (nlab - 1));
      ctx.fillText(fmtDate(vis[i].d, false), X(i), H - 6);
    }

    if (hover >= 0 && hover < vis.length) {
      const k = vis[hover], x = X(hover), yc = Y(k.c);
      ctx.save();
      ctx.strokeStyle = muted; ctx.globalAlpha = 0.6; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x, priceTop); ctx.lineTo(x, volBot); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(plotL, yc); ctx.lineTo(plotR, yc); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = css('--text') || '#2b2620';
      ctx.fillRect(plotR, yc - 9, L.axR, 18);
      ctx.fillStyle = css('--bg') || '#f1ebe0'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(k.c), plotR + 6, yc);
    }

    updateLegend(hover >= 0 && hover < vis.length ? vis[hover] : vis[vis.length - 1]);
  }

  function updateLegend(k) {
    if (!k || !legendEl || !cur) return;
    const up = k.c >= k.o, chg = k.o ? (k.c - k.o) / k.o * 100 : 0;
    const span = (t, cls) => { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = t; return s; };
    const r1 = document.createElement('div'); r1.className = 'legend__row';
    r1.append(span(cur.ticker, 'legend__tk'), span(fmtDate(k.d), 'legend__dt'));
    const r2 = document.createElement('div'); r2.className = 'legend__row legend__ohlc';
    r2.append(span('O ' + fmt(k.o)), span('H ' + fmt(k.h)), span('L ' + fmt(k.l)), span('C ' + fmt(k.c)),
      span((up ? '+' : '') + chg.toFixed(2) + '%', up ? 'up' : 'down'), span('Vol ' + fmtVol(k.v || 0)));
    legendEl.replaceChildren(r1, r2);
  }

  function updateQuote() {
    if (!full.length) { priceEl.textContent = '—'; changeEl.textContent = ''; changeEl.className = 'quote__change'; return; }
    const last = full[full.length - 1], prev = full.length > 1 ? full[full.length - 2] : last;
    const diff = last.c - prev.c, pct = prev.c ? diff / prev.c * 100 : 0, up = diff >= 0;
    priceEl.textContent = '$' + fmt(last.c);
    changeEl.textContent = `${up ? '▲' : '▼'} ${fmt(Math.abs(diff))} (${up ? '+' : ''}${pct.toFixed(2)}%) today`;
    changeEl.className = 'quote__change ' + (up ? 'up' : 'down');
  }

  function render() {
    full = (cur && cur.series) || [];
    emptyEl.hidden = full.length > 0;
    if (legendEl) legendEl.style.display = full.length > 0 ? '' : 'none';
    clampWindow();
    updateQuote();
    draw();
  }

  function selectTicker(ticker) {
    cur = stocks.find((s) => s.ticker === ticker) || stocks[0] || null;
    full = (cur && cur.series) || [];
    count = Math.min(count, Math.max(5, full.length));
    start = Math.max(0, full.length - count);
    hover = -1;
    render();
  }

  function setRange(days) {
    count = Math.min(days, Math.max(5, full.length));
    start = Math.max(0, full.length - count);
    hover = -1;
    [...rangesEl.children].forEach((b) => b.classList.toggle('is-active', Number(b.dataset.range) === days));
    draw();
  }

  function setType(t) {
    type = t;
    [...typesEl.children].forEach((b) => b.classList.toggle('is-active', b.dataset.type === t));
    draw();
  }

  /* ---- interaction ---- */
  const localX = (clientX) => clientX - canvas.getBoundingClientRect().left;
  function idxAt(x) {
    if (!geo) return -1;
    const rel = (x - geo.plotL) / (geo.plotR - geo.plotL);
    return Math.max(0, Math.min(geo.n - 1, Math.floor(rel * geo.n)));
  }
  function zoomAt(x, factor) {
    const i = idxAt(x); if (i < 0) return;
    const anchor = start + i;
    const frac = geo ? i / geo.n : 0.5;
    count = Math.max(5, Math.min(Math.round(count * factor), full.length));
    start = Math.round(anchor - frac * count);
    clampWindow(); draw();
  }
  function panBy(dxPixels) {
    if (!geo) return;
    start = start - Math.round(dxPixels / geo.slot);
    clampWindow(); draw();
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      pinch = { dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), mid: (p[0].x + p[1].x) / 2, count, start };
    } else if (e.pointerType === 'mouse') {
      panLast = e.clientX;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2 && pinch) {
      const p = [...pointers.values()];
      const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const mid = (p[0].x + p[1].x) / 2;
      count = Math.max(5, Math.min(Math.round(pinch.count * (pinch.dist / Math.max(1, dist))), full.length));
      start = Math.round(pinch.start - (mid - pinch.mid) / (geo ? geo.slot : 1));
      clampWindow(); draw();
      return;
    }
    if (e.pointerType === 'mouse' && (e.buttons & 1) && panLast != null) {
      panBy(e.clientX - panLast); panLast = e.clientX; return;
    }
    hover = idxAt(localX(e.clientX)); draw();
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (e.pointerType === 'mouse') panLast = null;
    if (pointers.size === 0 && e.pointerType !== 'mouse') { hover = -1; draw(); }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !(e.buttons & 1)) { hover = -1; draw(); } });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(localX(e.clientX), e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });

  sel.addEventListener('change', () => selectTicker(sel.value));
  rangesEl.addEventListener('click', (e) => { const b = e.target.closest('.range'); if (b) setRange(Number(b.dataset.range)); });
  if (typesEl) typesEl.addEventListener('click', (e) => { const b = e.target.closest('.ctype'); if (b) setType(b.dataset.type); });
  window.addEventListener('resize', () => { if (cur) draw(); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (cur) draw(); }).observe(canvas);

  async function load() {
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      stocks = Array.isArray(data.stocks) ? data.stocks : [];
      updatedEl.textContent = data.updated ? 'As of ' + fmtDate(data.updated.slice(0, 10)) : '';
      sel.replaceChildren(...stocks.map((s) => {
        const o = document.createElement('option'); o.value = s.ticker; o.textContent = `${s.name} (${s.ticker})`; return o;
      }));
      selectTicker(stocks[0] && stocks[0].ticker);
    } catch (e) {
      console.error('Failed to load stocks.json:', e);
      updatedEl.textContent = 'Couldn’t load market data';
      emptyEl.hidden = false;
    }
  }

  const pages = $('pages');
  const dots = [...document.querySelectorAll('.dot')];
  if (pages) {
    pages.addEventListener('scroll', () => {
      const idx = Math.round(pages.scrollLeft / pages.clientWidth);
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
    }, { passive: true });
    dots.forEach((d, i) => d.addEventListener('click', () => pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' })));
  }

  load();
})();
