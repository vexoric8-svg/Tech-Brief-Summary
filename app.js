/* Morning Tech Brief — reads news.json and renders it.
   Each day is ONE summary (a block of text, optional bullets). The morning
   routine only ever edits news.json; this file renders whatever's there. */

const DATA_URL = './news.json';

const feedEl = document.getElementById('feed');
const updatedEl = document.getElementById('updated');
const refreshBtn = document.getElementById('refresh');

/* ---------- Helpers ---------- */

function fmtDayLabel(isoDate) {
  // "YYYY-MM-DD" parsed as a local calendar day (avoid TZ shifting the date)
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

function isToday(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
}

function relTime(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/* ---------- Rendering ---------- */

// Turn a summary string into safe DOM nodes:
// blank line = new paragraph; lines starting with - * • become a bullet list.
function renderSummary(text) {
  const frag = document.createDocumentFragment();
  let para = [];
  let list = null;

  const flushPara = () => {
    if (para.length) { frag.appendChild(el('p', 'brief__p', para.join(' '))); para = []; }
  };
  const flushList = () => {
    if (list) { frag.appendChild(list); list = null; }
  };

  for (const raw of String(text).replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') { flushPara(); flushList(); continue; }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (!list) list = el('ul', 'brief__list');
      list.appendChild(el('li', null, bullet[1]));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return frag;
}

function renderDay(day) {
  const section = el('section', 'day');
  if (isToday(day.date)) section.classList.add('day--today');

  const header = el('div', 'day__header');
  header.appendChild(el('span', 'day__date', fmtDayLabel(day.date)));
  if (isToday(day.date)) header.appendChild(el('span', 'day__badge', 'Today'));
  section.appendChild(header);

  const card = el('article', 'card brief');
  if (day.headline) card.appendChild(el('h2', 'brief__headline', day.headline));
  if (day.summary) card.appendChild(renderSummary(day.summary));
  section.appendChild(card);

  return section;
}

function renderData(data) {
  const days = Array.isArray(data.days) ? [...data.days] : [];
  days.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  if (days.length === 0) {
    showNotice('No briefing yet', 'Your first summary will appear here tomorrow morning.');
    updatedEl.textContent = '';
    return;
  }

  feedEl.replaceChildren(...days.map(renderDay));
  updatedEl.textContent = data.updated ? `Updated ${relTime(data.updated)}` : '';
}

function showNotice(title, body, withRetry) {
  const wrap = el('div', 'notice');
  wrap.appendChild(el('p', null, title));
  if (body) {
    const small = el('p', null, body);
    small.style.fontSize = '14px';
    small.style.color = 'var(--faint)';
    wrap.appendChild(small);
  }
  if (withRetry) {
    const btn = el('button', null, 'Try again');
    btn.addEventListener('click', () => load());
    wrap.appendChild(btn);
  }
  feedEl.replaceChildren(wrap);
}

/* ---------- Data loading ---------- */

let loading = false;

async function load() {
  if (loading) return;
  loading = true;
  refreshBtn.classList.add('is-spinning');
  try {
    // cache-bust so a fresh morning push shows up immediately
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderData(await res.json());
  } catch (err) {
    console.error('Failed to load news.json:', err);
    if (!feedEl.querySelector('.day')) {
      showNotice("Couldn't load the briefing", 'Check your connection and try again.', true);
    }
    updatedEl.textContent = 'Offline — showing last loaded';
  } finally {
    loading = false;
    refreshBtn.classList.remove('is-spinning');
  }
}

refreshBtn.addEventListener('click', () => load());

// Refresh when returning to the tab/app
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') load();
});

load();

/* ---------- PWA service worker ----------
   Skip on localhost so local previews always show fresh files; full offline /
   install behaviour still applies on the deployed HTTPS site. */
const isLocalhost = ['localhost', '127.0.0.1', ''].includes(location.hostname);
if ('serviceWorker' in navigator && !isLocalhost) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed:', e));
  });
}

/* ---------- Push notifications ---------- */
const VAPID_PUBLIC_KEY =
  'BGMasodHWnEB9rWST7aEksZIOWIekTCIwAlVa0YJGXEGh5cIFt69hReAbcYkBdBX2e_D9tu-rWVERWA52UBaEuI';

const notifyBtn = document.getElementById('notify');
const sheet = document.getElementById('notif-sheet');
const sheetMsg = document.getElementById('notif-msg');
const sheetSub = document.getElementById('notif-sub');
const sheetCopy = document.getElementById('notif-copy');
const sheetClose = document.getElementById('notif-close');

function openSheet(message, subscription) {
  sheetMsg.textContent = message;
  const hasSub = Boolean(subscription);
  sheetSub.hidden = !hasSub;
  sheetCopy.hidden = !hasSub;
  if (hasSub) sheetSub.value = subscription;
  sheetCopy.textContent = 'Copy';
  sheet.hidden = false;
}
if (sheetClose) sheetClose.addEventListener('click', () => { sheet.hidden = true; });
if (sheetCopy) sheetCopy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(sheetSub.value); sheetCopy.textContent = 'Copied!'; }
  catch { sheetSub.focus(); sheetSub.select(); }
});

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function enableNotifications() {
  if (isLocalhost) {
    openSheet('Notifications only work on the published site. Open the live app, add it to your Home Screen, then tap the bell there.');
    return;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    openSheet('Your browser can’t do notifications here. On iPhone: open this app from your Home Screen icon (Share → Add to Home Screen first), then tap the bell.');
    return;
  }
  let permission;
  try { permission = await Notification.requestPermission(); }
  catch { openSheet('Could not request notification permission.'); return; }
  if (permission !== 'granted') {
    openSheet('Notifications are turned off for this app. Enable them in your settings, then tap the bell again.');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    openSheet('Almost done — copy the text below and paste it into your morning routine where it says SUBSCRIPTION (just once). Then you’ll get a ping each morning.', JSON.stringify(sub));
  } catch (e) {
    console.error('Subscribe failed:', e);
    openSheet('Something went wrong subscribing. On iPhone, make sure you opened the app from its Home Screen icon, then try again.');
  }
}
if (notifyBtn) notifyBtn.addEventListener('click', enableNotifications);
