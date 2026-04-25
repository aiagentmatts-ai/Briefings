# Publishing Daily Briefings to your iPhone

This app is a Progressive Web App (PWA). To use it on your iPhone, you need to host the files at a public URL and add the page to your home screen. Recommended path: GitHub Pages.

## One-time setup

### 1. Create a GitHub repo

1. Go to https://github.com/new
2. Name it something like `briefings` (any name works)
3. Make it **public** (required for free GitHub Pages)
4. Skip README/license — leave empty
5. Create the repo

### 2. Push the app code

From this folder:

```bash
git init
git add index.html app.js styles.css sw.js manifest.json icons data
git commit -m "Initial daily briefings app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

> **Note:** the `design/` folder and `serve.ps1` are for local dev — exclude them from the push if you prefer (`git rm -r --cached design serve.ps1` or add to `.gitignore`).

### 3. Enable GitHub Pages

1. Repo → **Settings** → **Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` / `/ (root)`
4. Save. Wait ~30 seconds for the first deploy.
5. Your URL is `https://<your-username>.github.io/<your-repo>/`

### 4. Add to iPhone home screen

1. Open the URL in Safari (must be Safari, not Chrome) on your iPhone.
2. Tap the **Share** icon (square with arrow)
3. **Add to Home Screen**
4. Name it "Briefing" → Add

The icon on your home screen now opens the app full-screen with no browser chrome.

## Publishing the daily briefings

The app reads two files at the same base URL:

- `data/morning.json`
- `data/evening.json`

Tell Claude (or your automation) to write the daily briefings to these two files in the repo, then commit and push. The app will fetch fresh data on every launch (network-first, falls back to cached version).

### JSON shapes

**morning.json**
```json
{
  "date": "2026-04-25",
  "type": "morning",
  "generated_at": "2026-04-25T07:00:00-04:00",
  "sections": [
    {
      "id": "national-politics",
      "label": "National Politics",
      "count": 6,
      "stories": [
        {
          "headline": "...",
          "summary": "...",
          "source": "Punchbowl News",
          "time": "3h ago",
          "flagged": true
        }
      ]
    }
  ]
}
```

The first section's first story is treated as the "Top Story" in widgets. `count` is the badge number on category cells; if absent, the app falls back to `stories.length`. `flagged: true` shows a ⚡ marker in the detail view.

**evening.json**
```json
{
  "date": "2026-04-25",
  "type": "evening",
  "generated_at": "2026-04-25T21:00:00-04:00",
  "weather": {
    "home": { "city": "Harrisburg, PA", "hi": 87, "lo": 63, "condition": "Partly sunny" },
    "travel": null
  },
  "calendar": [
    { "time": "12:15 PM", "title": "Eva teeth cleaning", "calendar": "Personal", "color": "#16A34A" }
  ],
  "tasks": {
    "due_tomorrow": [
      { "task": "Check on Omega Speedmaster", "project": null, "done": false }
    ],
    "overdue": [
      { "task": "EV Fees", "project": "Miscellaneous", "due": "2026-03-05" }
    ]
  }
}
```

Set `weather.travel` to an object (same shape as `home`) when traveling tomorrow — the widgets will render a second weather column with a ✈ marker.

## Pointing the iPhone app at the published URL

By default the app fetches from `./data` (relative to where it's hosted). If you host the briefings at a different URL than the app code (e.g., the briefings live in a separate private gist or a different repo), open the app → **⚙ Settings** → **Briefings URL** and paste the base URL there. The app caches the value and refetches.

## Local development

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Open http://localhost:3000 in Chrome. Use DevTools → Toggle Device Toolbar (Cmd/Ctrl+Shift+M) → iPhone 14 Pro to preview at phone size.

The local server reads from `data/morning.json` and `data/evening.json` (renamed from the original `sample-*.json`). Sample files are kept in the folder as fallback — the app will try them if the canonical names 404.
