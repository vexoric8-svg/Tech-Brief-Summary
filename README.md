# Morning Tech Brief

A clean, dark, mobile-first web app that shows a daily tech-news summary. It's a
static site (plain HTML/CSS/JS, no build step) hosted on **GitHub Pages**, and it
reads a single data file: [`news.json`](news.json).

A scheduled Claude routine updates `news.json` each morning and pushes it. GitHub
Pages redeploys automatically, so opening the site on your phone shows the latest
briefing. Add it to your home screen for an app-like (PWA) experience.

## How it works

```
morning routine  ──edits──▶  news.json  ──git push──▶  GitHub Pages  ──▶  your phone
```

The web app **only ever reads `news.json`**. The routine **only ever edits `news.json`**.
Nothing else needs to change day to day.

## Data format (`news.json`)

Each morning is **one summary** (a block of text), not a list of articles.

```jsonc
{
  "updated": "2026-06-15T06:45:00Z",   // ISO timestamp of the last update (UTC)
  "days": [                             // newest day first
    {
      "date": "2026-06-15",             // YYYY-MM-DD (local calendar day)
      "headline": "One-line gist of the morning (optional)",
      "summary": "The morning's tech-news summary as plain text.\n\nBlank lines start new paragraphs. Lines beginning with - * or • render as bullets:\n- like this\n- and this"
    }
  ]
}
```

`summary` is the only content field that matters. `headline` is an optional one-liner shown in bold above it.

### Rules for the morning routine
- **Prepend** today's entry to the front of `days` (newest first). Don't delete past days.
- If today's date already exists in `days`, **replace** that entry instead of adding a duplicate.
- Always set `updated` to the current time.
- Keep the file valid JSON (no trailing commas, no comments).

## Files
| File | Purpose |
|---|---|
| `index.html` | App shell |
| `styles.css` | Sleek dark theme |
| `app.js` | Loads `news.json`, renders days/cards, handles refresh + offline |
| `news.json` | **The data** — the only file the routine edits |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA: installable + works offline |

## Local preview
```bash
node scripts/serve.mjs    # dependency-free static server → http://localhost:5050
```
