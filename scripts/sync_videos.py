#!/usr/bin/env python3
"""Merge new videos from the channel's RSS feed into data/videos.json.

YouTube's free RSS feed returns the latest 15 uploads — plenty for a weekly
sync. Existing entries are never modified or removed, so manual edits
(tags, ordering, hidden videos) are preserved. Run from the repo root.
"""
import json
import re
import urllib.request
from pathlib import Path

CHANNEL_ID = "UCAzenLudT0voc1zsZUOFfAw"  # @golden_insights
FEED_URL = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
DATA = Path(__file__).resolve().parent.parent / "data" / "videos.json"

# Topic keywords — same rules used for the original backfill.
TAGS = [
    ("Full Dashboard Builds", r"beyond basic charts|dashboard tutorial|hr dashboard|finance dashboard|orders dashboard|fitness dashboard|workout|build a dashboard|notification center|liquid glass dashboard|ai design"),
    ("KPI & Cards", r"\bkpi|card|scorecard|summary cards"),
    ("Charts", r"chart|donut|pie\b|sankey|radial|histogram|treemap|dot plot|bubble|waffle|waterfall|heatmap|hexagon|calendar|sparkline|bar-in-bar|area|line graph"),
    ("Maps", r"\bmaps?\b|pins? on a map|hex maps|map switcher"),
    ("Filters & Interactivity", r"filter|toggle|button|drill down|drill-down|parameter|action|navigation|search|slider|date picker|switcher|carousel|expand|click|interactive|drop down|tabs|set actions|highlight"),
    ("Design & UX", r"gradient|rounded|glow|shadow|glass|neon|color palette|background|container|design|modern|dark mode|light/dark|icons?|shapes?|aesthetic|psychology|ux|alignment|format"),
    ("Calculations & LOD", r"\blod\b|level of detail|calculat|aggregate|measure names|bin\b"),
    ("Quick Tips & Fixes", r"fix|error|tips?|trick|hack|minute|quick|fast|easy|simple|under \d|seconds"),
]


def auto_tags(title: str) -> list:
    t = title.lower()
    tags = [name for name, pat in TAGS if re.search(pat, t)]
    return tags or ["Tutorials"]


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def is_short(video_id: str) -> bool:
    """The site is videos-only. Shorts return 200 at the /shorts/ URL;
    regular videos respond with a redirect (303) to /watch."""
    url = f"https://www.youtube.com/shorts/{video_id}"
    try:
        opener = urllib.request.build_opener(_NoRedirect)
        code = opener.open(urllib.request.Request(url, method="HEAD"), timeout=30).status
    except urllib.error.HTTPError as e:
        code = e.code
    except Exception:
        import subprocess
        out = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", url],
                             capture_output=True, text=True, timeout=60).stdout
        code = int(out or 0)
    return code == 200


def fetch_feed() -> list:
    try:
        with urllib.request.urlopen(FEED_URL, timeout=30) as r:
            xml = r.read().decode("utf-8")
    except Exception:
        # some local Python installs lack SSL certs; curl is everywhere
        import subprocess
        xml = subprocess.run(["curl", "-sf", FEED_URL], capture_output=True,
                             text=True, check=True, timeout=60).stdout
    entries = []
    for block in re.findall(r"<entry>(.*?)</entry>", xml, re.S):
        vid = re.search(r"<yt:videoId>([^<]+)</yt:videoId>", block).group(1)
        title = re.search(r"<title>([^<]*)</title>", block).group(1)
        title = title.replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">")
        published = re.search(r"<published>([^<]+)</published>", block).group(1)[:10]
        entries.append({"id": vid, "title": title, "date": published})
    return entries


def main():
    videos = json.loads(DATA.read_text())
    known = {v["id"] for v in videos}
    added = []
    for e in fetch_feed():
        if e["id"] in known:
            continue
        if is_short(e["id"]):
            print(f"Skipping Short: {e['id']}  {e['title']}")
            continue
        added.append({
            "id": e["id"],
            "title": e["title"],
            "length": "",
            "views": 0,
            "date": e["date"],
            "dateApprox": False,
            "tags": auto_tags(e["title"]),
        })
    if not added:
        print("No new videos.")
        return
    # newest first, prepended to keep the existing order intact
    videos = sorted(added, key=lambda v: v["date"], reverse=True) + videos
    DATA.write_text(json.dumps(videos, indent=1) + "\n")
    print(f"Added {len(added)} new video(s):")
    for v in added:
        print(f"  {v['id']}  {v['title']}")


if __name__ == "__main__":
    main()
