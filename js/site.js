/* Golden Insights — shared rendering helpers.
   All pages render from the JSON files in /data. */

const GI = {
  channelUrl: "https://www.youtube.com/@golden_insights",
  tableauProfile: "https://public.tableau.com/app/profile/samantha.cohn",

  /* Curated topic order for shelves, chips, and the home browse section.
     Tags not listed here still show up, appended after these. */
  topics: [
    { tag: "Charts", icon: "📊" },
    { tag: "Design & UX", icon: "🎨" },
    { tag: "Filters & Interactivity", icon: "🎛️" },
    { tag: "Quick Tips & Fixes", icon: "⚡" },
    { tag: "Full Dashboard Builds", icon: "🏗️" },
    { tag: "KPI & Cards", icon: "📈" },
    { tag: "Calculations & LOD", icon: "🧮" },
    { tag: "Maps", icon: "🗺️" },
    { tag: "Tutorials", icon: "🎓", label: "More tutorials" },
  ],

  async load(name) {
    const res = await fetch(`data/${name}.json`);
    return res.json();
  },

  fmtViews(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  },

  fmtDate(iso, approx) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    const s = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    return approx ? "~" + s : s;
  },

  el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  },

  esc(s) {
    return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },

  tagCounts(videos) {
    const counts = {};
    videos.forEach(v => (v.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return counts;
  },

  orderedTags(counts) {
    const known = GI.topics.map(t => t.tag).filter(t => counts[t]);
    const extra = Object.keys(counts).filter(t => !known.includes(t))
      .sort((a, b) => counts[b] - counts[a]);
    return [...known, ...extra];
  },

  topicInfo(tag) {
    return GI.topics.find(t => t.tag === tag) || { tag, icon: "📺" };
  },

  /* --- video card: thumbnail first, swap to iframe on click (lite embed) ---
     hq720 is true 16:9; hqdefault is 4:3 with black bars baked in, so it is
     only a last-resort fallback after the (also 16:9) mqdefault. */
  videoCard(v) {
    const card = GI.el(`
      <article class="card">
        <div class="media" title="Play video">
          <img loading="lazy" src="https://i.ytimg.com/vi/${v.id}/hq720.jpg"
               onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v.id}/mqdefault.jpg'"
               alt="${GI.esc(v.title)}">
          ${v.length ? `<span class="duration">${v.length}</span>` : ""}
          <div class="play"><span>&#9658;</span></div>
        </div>
        <div class="body">
          <div class="title">${GI.esc(v.title)}</div>
          <div class="tags">${(v.tags || []).map(t => `<span class="tag">${GI.esc(t)}</span>`).join("")}</div>
          <div class="meta">${GI.fmtViews(v.views)} views · ${GI.fmtDate(v.date, v.dateApprox)}</div>
        </div>
      </article>`);
    card.querySelector(".media").addEventListener("click", () => {
      card.querySelector(".media").innerHTML =
        `<iframe src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="${GI.esc(v.title)}"></iframe>`;
    }, { once: true });
    return card;
  },

  /* --- dashboard card: static preview, opens interactive viz in a modal --- */
  dashCard(d) {
    const card = GI.el(`
      <article class="card dash">
        <div class="media" title="Open interactive dashboard">
          <img loading="lazy" src="${d.previewImg}" alt="${GI.esc(d.title)}"
               onerror="this.parentElement.style.background='var(--gold-soft)';this.remove()">
          <div class="play"><span>&#10530;</span></div>
        </div>
        <div class="body">
          <div class="title">${GI.esc(d.title)}</div>
          <div class="meta">${GI.fmtViews(d.views)} views on Tableau Public${d.favorites ? ` · ♥ ${d.favorites}` : ""}</div>
        </div>
      </article>`);
    card.querySelector(".media").addEventListener("click", () => GI.openViz(d));
    return card;
  },

  openViz(d) {
    const overlay = GI.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-head">
            <h3>${GI.esc(d.title)}</h3>
            <a class="open-ext" href="${d.profileUrl}" target="_blank" rel="noopener">Open on Tableau Public ↗</a>
            <button aria-label="Close">✕</button>
          </div>
          <div class="modal-body"></div>
        </div>
      </div>`);
    const viz = document.createElement("tableau-viz");
    viz.setAttribute("src", d.vizUrl);
    viz.setAttribute("toolbar", "hidden");
    viz.setAttribute("hide-tabs", "");
    viz.style.width = "100%";
    overlay.querySelector(".modal-body").appendChild(viz);
    const close = () => overlay.remove();
    overlay.querySelector("button").addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
    document.body.appendChild(overlay);
  },

  mount(sel, nodes) {
    const root = document.querySelector(sel);
    root.innerHTML = "";
    nodes.forEach(n => root.appendChild(n));
    return root;
  },
};

/* ---------- page initializers ---------- */

async function initHome() {
  const [videos, dashboards] = await Promise.all([
    GI.load("videos"), GI.load("dashboards"),
  ]);

  const counts = GI.tagCounts(videos);
  GI.mount("#topics", GI.orderedTags(counts).map(tag => {
    const t = GI.topicInfo(tag);
    return GI.el(`
      <a class="topic-card" href="videos.html#topic=${encodeURIComponent(tag)}">
        <span class="ico">${t.icon}</span>
        <span class="name">${GI.esc(t.label || tag)}</span>
        <span class="n">${counts[tag]} video${counts[tag] === 1 ? "" : "s"}</span>
      </a>`);
  }));

  const featured = [...videos].sort((a, b) => b.views - a.views).slice(0, 3);
  GI.mount("#featured", featured.map(GI.videoCard));

  const latest = videos.slice(0, 6);
  GI.mount("#latest", latest.map(GI.videoCard));

  const topDash = [...dashboards].sort((a, b) => b.views - a.views).slice(0, 6);
  GI.mount("#top-dashboards", topDash.map(GI.dashCard));

  const stats = document.querySelector("#hero-stats");
  if (stats) stats.textContent =
    `${videos.length} free tutorials · ${dashboards.length} interactive dashboards`;
}

async function initVideos() {
  const videos = await GI.load("videos");
  const counts = GI.tagCounts(videos);
  const tags = GI.orderedTags(counts);

  const chips = document.querySelector("#chips");
  const search = document.querySelector("#search");
  const sort = document.querySelector("#sort");
  const grid = document.querySelector("#video-grid");
  const note = document.querySelector("#result-count");

  let activeTag = "All";
  const fromHash = decodeURIComponent((location.hash.match(/topic=([^&]+)/) || [, ""])[1]);
  if (tags.includes(fromHash)) activeTag = fromHash;

  const chipEls = {};
  ["All", ...tags].forEach(t => {
    const c = GI.el(`<button class="chip">${GI.esc(t)}${t === "All" ? "" : ` (${counts[t]})`}</button>`);
    c.addEventListener("click", () => selectTag(t));
    chipEls[t] = c;
    chips.appendChild(c);
  });

  function selectTag(t) {
    activeTag = t;
    history.replaceState(null, "", t === "All"
      ? location.pathname : `#topic=${encodeURIComponent(t)}`);
    render();
  }

  window.addEventListener("hashchange", () => {
    const t = decodeURIComponent((location.hash.match(/topic=([^&]+)/) || [, "All"])[1]);
    if (t === activeTag) return;
    activeTag = tags.includes(t) ? t : "All";
    render();
  });

  search.addEventListener("input", render);
  sort.addEventListener("change", render);

  /* One horizontally scrollable shelf per topic (browse mode). */
  function shelf(tag) {
    const t = GI.topicInfo(tag);
    const vids = videos.filter(v => (v.tags || []).includes(tag))
      .sort((a, b) => b.views - a.views);
    const sec = GI.el(`
      <section class="shelf">
        <div class="section-head">
          <h2>${t.icon} ${GI.esc(t.label || tag)}</h2>
          <span class="count-pill">${vids.length}</span>
          <a class="more" href="#topic=${encodeURIComponent(tag)}">See all →</a>
          <div class="shelf-nav">
            <button type="button" aria-label="Scroll ${GI.esc(tag)} left">&#8249;</button>
            <button type="button" aria-label="Scroll ${GI.esc(tag)} right">&#8250;</button>
          </div>
        </div>
        <div class="shelf-row"></div>
      </section>`);
    const row = sec.querySelector(".shelf-row");
    vids.forEach(v => row.appendChild(GI.videoCard(v)));
    sec.querySelector(".more").addEventListener("click", e => {
      e.preventDefault();
      selectTag(tag);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    const [prev, next] = sec.querySelectorAll(".shelf-nav button");
    const page = dir => row.scrollBy({ left: dir * (row.clientWidth - 120), behavior: "smooth" });
    prev.addEventListener("click", () => page(-1));
    next.addEventListener("click", () => page(1));
    return sec;
  }

  function render() {
    Object.entries(chipEls).forEach(([t, c]) => c.classList.toggle("active", t === activeTag));
    const q = search.value.trim().toLowerCase();

    if (activeTag === "All" && !q) {
      grid.className = "shelves";
      GI.mount("#video-grid", tags.map(shelf));
      note.textContent = `${videos.length} tutorials across ${tags.length} topics — scroll a row, or search to see everything at once`;
      return;
    }

    grid.className = "grid";
    let list = videos.filter(v =>
      (activeTag === "All" || (v.tags || []).includes(activeTag)) &&
      (!q || v.title.toLowerCase().includes(q)));
    if (sort.value === "views") list = [...list].sort((a, b) => b.views - a.views);
    if (sort.value === "oldest") list = [...list].reverse();
    GI.mount("#video-grid", list.map(GI.videoCard));
    note.textContent = `${list.length} video${list.length === 1 ? "" : "s"}`;
  }
  render();
}

async function initDashboards() {
  const dashboards = await GI.load("dashboards");
  const search = document.querySelector("#search");
  function render() {
    const q = search.value.trim().toLowerCase();
    const list = dashboards.filter(d => !q || d.title.toLowerCase().includes(q));
    GI.mount("#dash-grid", list.map(GI.dashCard));
    document.querySelector("#result-count").textContent =
      `${list.length} dashboard${list.length === 1 ? "" : "s"} — click any to interact with it right here`;
  }
  search.addEventListener("input", render);
  render();
}

async function initAssets() {
  const assets = await GI.load("assets");
  GI.mount("#asset-grid", assets.map(a => GI.el(`
    <article class="card asset-card">
      ${a.preview ? `<div class="media"><img loading="lazy" src="${a.preview}" alt="${GI.esc(a.title)}"></div>` : ""}
      <div class="body">
        <div class="title">${GI.esc(a.title)}</div>
        <div class="desc">${GI.esc(a.description)}</div>
        <a class="btn btn-gold" href="${a.file}" download>Download ${a.format ? "(" + GI.esc(a.format) + ")" : ""}</a>
      </div>
    </article>`)));
}
