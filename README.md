# Golden Insights — Portfolio Site

Free static site showcasing the [Golden Insights](https://www.youtube.com/@golden_insights)
YouTube channel: all tutorials, interactive Tableau Public dashboards, and downloadable
design assets. Hosted on GitHub Pages.

## How it works

- Plain HTML/CSS/JS — no build step, no dependencies, nothing to install.
- All content renders from JSON files in `data/`:
  - `videos.json` — every video (id, title, date, views, topic tags)
  - `dashboards.json` — Tableau Public vizzes (embed URL, preview image)
  - `shorts.json` — Sunny's corner 🐕
  - `assets.json` — downloadable asset packs (files live in `downloads/`)
- A GitHub Action (`.github/workflows/sync-videos.yml`) runs every Monday, checks the
  channel's RSS feed, and adds any new videos automatically. You never have to touch it.

## Common edits

| I want to… | Do this |
| --- | --- |
| Add an asset pack | Drop the file in `downloads/`, add an entry to `data/assets.json` |
| Re-tag or hide a video | Edit its entry in `data/videos.json` (delete the entry to hide) |
| Add a new dashboard | Add an entry to `data/dashboards.json` (copy an existing one, swap the workbook/view names) |
| Change colors | Edit the variables at the top of `css/style.css` |
| Pull in new videos now | Actions tab → "Sync new YouTube videos" → Run workflow |

## Preview locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
