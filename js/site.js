/* Golden Insights — shared rendering helpers.
   All pages render from the JSON files in /data. */

const GI = {
  channelUrl: "https://www.youtube.com/@golden_insights",
  tableauProfile: "https://public.tableau.com/app/profile/samantha.cohn",

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

  /* --- video card: thumbnail first, swap to iframe on click (lite embed) --- */
  videoCard(v) {
    const card = GI.el(`
      <article class="card">
        <div class="media" title="Play video">
          <img loading="lazy" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="${GI.esc(v.title)}">
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

  /* --- sunny short card: opens the Short on YouTube --- */
  shortCard(s) {
    const card = GI.el(`
      <a class="sunny-card" href="https://www.youtube.com/shorts/${s.id}" target="_blank" rel="noopener" title="${GI.esc(s.title)}">
        <img loading="lazy" src="https://i.ytimg.com/vi/${s.id}/oar2.jpg"
             onerror="this.src='https://i.ytimg.com/vi/${s.id}/hqdefault.jpg';this.onerror=null" alt="${GI.esc(s.title)}">
        <div class="label">${GI.esc(s.title)}</div>
      </a>`);
    return card;
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
  const [videos, dashboards, shorts] = await Promise.all([
    GI.load("videos"), GI.load("dashboards"), GI.load("shorts"),
  ]);

  const featured = [...videos].sort((a, b) => b.views - a.views).slice(0, 3);
  GI.mount("#featured", featured.map(GI.videoCard));

  const latest = videos.slice(0, 6);
  GI.mount("#latest", latest.map(GI.videoCard));

  const topDash = [...dashboards].sort((a, b) => b.views - a.views).slice(0, 6);
  GI.mount("#top-dashboards", topDash.map(GI.dashCard));

  GI.mount("#sunny-row", shorts.slice(0, 12).map(GI.shortCard));

  const stats = document.querySelector("#hero-stats");
  if (stats) stats.textContent =
    `${videos.length} tutorials · ${dashboards.length} dashboards · ${shorts.length} Sunny shorts`;
}

async function initVideos() {
  const videos = await GI.load("videos");
  const shorts = await GI.load("shorts");

  const tagCounts = {};
  videos.forEach(v => (v.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const tags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

  const chips = document.querySelector("#chips");
  let activeTag = "All";
  const allTags = ["All", ...tags];
  allTags.forEach(t => {
    const c = GI.el(`<button class="chip${t === "All" ? " active" : ""}">${GI.esc(t)}${t === "All" ? "" : ` (${tagCounts[t]})`}</button>`);
    c.addEventListener("click", () => {
      activeTag = t;
      chips.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      render();
    });
    chips.appendChild(c);
  });

  const search = document.querySelector("#search");
  const sort = document.querySelector("#sort");
  search.addEventListener("input", render);
  sort.addEventListener("change", render);

  function render() {
    const q = search.value.trim().toLowerCase();
    let list = videos.filter(v =>
      (activeTag === "All" || (v.tags || []).includes(activeTag)) &&
      (!q || v.title.toLowerCase().includes(q)));
    if (sort.value === "views") list = [...list].sort((a, b) => b.views - a.views);
    if (sort.value === "oldest") list = [...list].reverse();
    GI.mount("#video-grid", list.map(GI.videoCard));
    document.querySelector("#result-count").textContent =
      `${list.length} video${list.length === 1 ? "" : "s"}`;
  }
  render();

  GI.mount("#sunny-row", shorts.map(GI.shortCard));
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
