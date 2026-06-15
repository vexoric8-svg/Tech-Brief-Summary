/* Markets page — reads stocks.json and draws an interactive line chart.
   Vanilla canvas, no dependencies. */
(() => {
  const DATA_URL = './stocks.json';
  const UP = '#2f8f5b';
  const DOWN = '#c5482f';

  const sel = document.getElementById('ticker');
  const priceEl = document.getElementById('quote-price');
  const changeEl = document.getElementById('quote-change');
  const updatedEl = document.getElementById('stocks-updated');
  const canvas = document.getElementById('chart');
  const tip = document.getElementById('chart-tip');
  const emptyEl = document.getElementById('chart-empty');
  const rangesEl = document.getElementById('ranges');
  if (!sel || !canvas) return;
  const ctx = canvas.getContext('2d');

  let stocks = [];
  let current = null;
  let rangeDays = 63;
  let view = [];
  let geom = null;

  const lineVar = () => getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#ddd';
  const fmtPrice = (v) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  function computeView() {
    const series = (current && current.series) || [];
    view = series.slice(Math.max(0, series.length - rangeDays));
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (view.length < 2) { geom = null; return; }

    const padX = 2, padTop = 10, padBot = 10;
    const closes = view.map((p) => p.c);
    let min = Math.min(...closes), max = Math.max(...closes);
    if (min === max) { min -= 1; max += 1; }
    const x = (i) => padX + (i / (view.length - 1)) * (w - padX * 2);
    const y = (c) => padTop + (1 - (c - min) / (max - min)) * (h - padTop - padBot);
    geom = { x, y };

    const up = view[view.length - 1].c >= view[0].c;
    const color = up ? UP : DOWN;

    ctx.beginPath();
    ctx.moveTo(x(0), y(view[0].c));
    for (let i = 1; i < view.length; i++) ctx.lineTo(x(i), y(view[i].c));
    ctx.lineTo(x(view.length - 1), h - padBot);
    ctx.lineTo(x(0), h - padBot);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padTop, 0, h);
    grad.addColorStop(0, color + '22');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x(0), y(view[0].c));
    for (let i = 1; i < view.length; i++) ctx.lineTo(x(i), y(view[i].c));
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function updateQuote() {
    if (view.length === 0) { priceEl.textContent = '—'; changeEl.textContent = ''; changeEl.className = 'quote__change'; return; }
    const last = view[view.length - 1].c;
    const first = view[0].c;
    const diff = last - first;
    const pct = first ? (diff / first) * 100 : 0;
    const up = diff >= 0;
    priceEl.textContent = fmtPrice(last);
    changeEl.textContent = `${up ? '▲' : '▼'} ${fmtPrice(Math.abs(diff))} (${up ? '+' : ''}${pct.toFixed(2)}%)`;
    changeEl.className = 'quote__change ' + (up ? 'up' : 'down');
  }

  function render() {
    computeView();
    emptyEl.hidden = view.length >= 2;
    updateQuote();
    draw();
  }

  function selectTicker(ticker) {
    current = stocks.find((s) => s.ticker === ticker) || stocks[0] || null;
    render();
  }

  function setRange(days) {
    rangeDays = days;
    [...rangesEl.children].forEach((b) => b.classList.toggle('is-active', Number(b.dataset.range) === days));
    render();
  }

  function scrub(clientX) {
    if (!geom || view.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    let i = Math.round(((clientX - rect.left) - 2) / (w - 4) * (view.length - 1));
    i = Math.max(0, Math.min(view.length - 1, i));
    draw();
    const cx = geom.x(i), cy = geom.y(view[i].c);
    ctx.beginPath();
    ctx.moveTo(cx, 8); ctx.lineTo(cx, h - 8);
    ctx.lineWidth = 1; ctx.strokeStyle = lineVar(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = view[view.length - 1].c >= view[0].c ? UP : DOWN;
    ctx.fill();
    tip.hidden = false;
    tip.textContent = `${fmtDate(view[i].d)} · ${fmtPrice(view[i].c)}`;
    tip.style.left = Math.max(46, Math.min(w - 46, cx)) + 'px';
  }
  function endScrub() { tip.hidden = true; draw(); }

  canvas.addEventListener('pointermove', (e) => scrub(e.clientX));
  canvas.addEventListener('pointerdown', (e) => scrub(e.clientX));
  canvas.addEventListener('pointerleave', endScrub);
  canvas.addEventListener('pointercancel', endScrub);
  window.addEventListener('resize', () => { if (current) draw(); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (current) draw(); }).observe(canvas);

  sel.addEventListener('change', () => selectTicker(sel.value));
  rangesEl.addEventListener('click', (e) => {
    const b = e.target.closest('.range');
    if (b) setRange(Number(b.dataset.range));
  });

  async function load() {
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      stocks = Array.isArray(data.stocks) ? data.stocks : [];
      updatedEl.textContent = data.updated ? 'As of ' + fmtDate(data.updated.slice(0, 10)) : '';
      sel.replaceChildren(...stocks.map((s) => {
        const o = document.createElement('option');
        o.value = s.ticker;
        o.textContent = `${s.name} (${s.ticker})`;
        return o;
      }));
      selectTicker(stocks[0] && stocks[0].ticker);
    } catch (e) {
      console.error('Failed to load stocks.json:', e);
      updatedEl.textContent = 'Couldn’t load market data';
      emptyEl.hidden = false;
    }
  }

  /* ---- swipe page dots ---- */
  const pages = document.getElementById('pages');
  const dots = [...document.querySelectorAll('.dot')];
  function syncDots() {
    const idx = Math.round(pages.scrollLeft / pages.clientWidth);
    dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
  }
  if (pages) {
    pages.addEventListener('scroll', syncDots, { passive: true });
    dots.forEach((d, i) => d.addEventListener('click', () => {
      pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' });
    }));
  }

  load();
})();
