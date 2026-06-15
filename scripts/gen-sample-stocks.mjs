// Generates a sample stocks.json so the chart has data to render during development.
// The morning routine overwrites this file with real prices. Pure Node, no deps.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'stocks.json');

// deterministic RNG so the sample is stable
let seed = 1234567;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

const TODAY = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15
const iso = (d) => d.toISOString().slice(0, 10);

function weekdaysBack(n) {
  const days = [];
  let d = new Date(TODAY);
  while (days.length < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.unshift(new Date(d));
    d = new Date(d.getTime() - 86400000);
  }
  return days;
}

function walk(base, vol, dates) {
  let p = base;
  return dates.map((d) => {
    p = Math.max(1, p * (1 + (rnd() - 0.5) * vol));
    return { d: iso(d), c: Math.round(p * 100) / 100 };
  });
}

const dates = weekdaysBack(252); // ~1 year of trading days
const stocks = [
  { ticker: 'MSFT', name: 'Microsoft', base: 430, vol: 0.020 },
  { ticker: 'NVDA', name: 'NVIDIA', base: 118, vol: 0.035 },
  { ticker: 'GOOGL', name: 'Alphabet (Google)', base: 175, vol: 0.025 },
  { ticker: 'TSLA', name: 'Tesla', base: 240, vol: 0.040 },
  { ticker: 'AMD', name: 'AMD', base: 160, vol: 0.035 },
  { ticker: 'INTC', name: 'Intel', base: 32, vol: 0.030 },
].map((s) => ({ ticker: s.ticker, name: s.name, currency: 'USD', series: walk(s.base, s.vol, dates) }));

// SpaceX — IPO 2026-06-12, only a couple of trading days so far
stocks.push({
  ticker: 'SPCX', name: 'SpaceX', currency: 'USD',
  series: [{ d: '2026-06-12', c: 135.00 }, { d: '2026-06-15', c: 148.20 }],
});

writeFileSync(out, JSON.stringify({ updated: '2026-06-15T06:45:00Z', stocks }, null, 2) + '\n');
console.log('wrote stocks.json:', stocks.length, 'tickers,', dates.length, 'days each (SPCX:', stocks[stocks.length - 1].series.length, 'pts)');
