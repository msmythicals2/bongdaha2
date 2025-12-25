// =======================
// BONGDAHA - main.js
// Real API (via your server.js routes)
// =======================

const state = {
  tab: "all",                 // all | live | finished | scheduled | favorite
  date: new Date(),           // selected date (device local)
  favorites: new Set(JSON.parse(localStorage.getItem("favMatches") || "[]")),
  carouselIndex: 0,
  lastFixtures: [],           // fixtures for selected date
  lastLive: [],               // live fixtures
  selectedLeagueId: null,     // optional filter if you later wire pinned leagues
};

// ---------- Helpers ----------
function pad2(n) { return String(n).padStart(2, "0"); }

function toYMD(d) {
  // local date -> YYYY-MM-DD
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

function formatHHMM(dateStr) {
  // dateStr is ISO. Display in device local time, 24h.
  const d = new Date(dateStr);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function isFinished(short) {
  return ["FT", "AET", "PEN"].includes(short);
}

function isLiveStatus(short) {
  // API-Sports typical live: 1H, 2H, HT, ET, BT, P, LIVE
  return ["1H", "2H", "HT", "ET", "BT", "P", "LIVE"].includes(short);
}

function isScheduled(short) {
  // Not started, Time to be defined
  return ["NS", "TBD"].includes(short);
}

function getStatusCellHTML(fx) {
  const short = fx?.fixture?.status?.short || "";
  const elapsed = fx?.fixture?.status?.elapsed;

  if (isLiveStatus(short) && typeof elapsed === "number") {
    return `<span class="live-dot"></span><span>${elapsed}'</span>`;
  }

  if (isScheduled(short)) {
    return `<span>${formatHHMM(fx.fixture.date)}</span>`;
  }

  if (isFinished(short)) {
    return `<span>FT</span>`;
  }

  // fallback
  if (typeof elapsed === "number") return `<span>${elapsed}'</span>`;
  return `<span>${short || "-"}</span>`;
}

function getScoreHTML(fx) {
  const short = fx?.fixture?.status?.short || "";
  const gh = fx?.goals?.home;
  const ga = fx?.goals?.away;

  if (isScheduled(short)) return `<span class="score">- : -</span>`;
  const s = `${gh ?? "-"} : ${ga ?? "-"}`;
  const cls = isLiveStatus(short) ? "score live" : "score";
  return `<span class="${cls}">${s}</span>`;
}

function getLeagueKey(fx) {
  // group by league id to avoid same-name collisions
  return String(fx?.league?.id ?? "0");
}

function getLeagueTitle(fx) {
  const country = fx?.league?.country || "";
  const name = fx?.league?.name || "";
  return `${country} - ${name}`;
}

function getLeagueFlagUrl(fx) {
  // API-Sports often provides league.flag as URL
  const url = fx?.league?.flag;
  return (typeof url === "string" && url.startsWith("http")) ? url : "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- API ----------
async function apiGetJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return [];
  return r.json();
}

async function loadFixturesByDate(dateObj) {
  const ymd = toYMD(dateObj);
  return apiGetJSON(`/api/fixtures?date=${encodeURIComponent(ymd)}`);
}

async function loadLive() {
  return apiGetJSON(`/api/live`);
}

async function loadNews() {
  return apiGetJSON(`/api/news`);
}

// ---------- Render: clock ----------
function updateClock() {
  const now = new Date();
  const txt = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const el = document.getElementById("clock");
  if (el) el.textContent = txt;
}

// ---------- Render: date strip ----------
function renderDateStrip() {
  const strip = document.getElementById("date-strip");
  if (!strip) return;

  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const base = new Date(state.date.getFullYear(), state.date.getMonth(), state.date.getDate());

  const chips = [];
  for (let i = -2; i <= 2; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);

    const isActive = toYMD(d) === toYMD(base);
    const label = i === 0 ? "TODAY" : days[d.getDay()];
    chips.push(`
      <div class="date-chip ${isActive ? "active" : ""}" data-ymd="${toYMD(d)}">
        <div class="d1">${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}</div>
        <div class="d2">${label}</div>
      </div>
    `);
  }

  strip.innerHTML = chips.join("");

  const dp = document.getElementById("datePicker");
  if (dp) dp.value = toYMD(state.date);
}

// ---------- Render: tabs ----------
function setActiveTab(tab) {
  state.tab = tab;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    const t = btn.getAttribute("data-tab");
    btn.classList.toggle("active", t === tab);
  });

  refreshCenter();
}

// ---------- Render: fixtures list ----------
function groupByLeague(items) {
  const groups = new Map();
  for (const fx of items) {
    const key = getLeagueKey(fx);
    if (!groups.has(key)) groups.set(key, { meta: fx, items: [] });
    groups.get(key).items.push(fx);
  }
  return [...groups.values()];
}

function applyTabFilter(allFixtures, liveFixtures) {
  // If you ever want "ALL includes live too", you can merge here.
  const mergedForFav = [...liveFixtures, ...allFixtures];

  if (state.tab === "live") {
    return liveFixtures;
  }

  if (state.tab === "favorite") {
    return mergedForFav.filter(fx => state.favorites.has(fx?.fixture?.id));
  }

  // all/finished/scheduled are based on selected date fixtures
  if (state.tab === "finished") {
    return allFixtures.filter(fx => isFinished(fx?.fixture?.status?.short || ""));
  }

  if (state.tab === "scheduled") {
    return allFixtures.filter(fx => isScheduled(fx?.fixture?.status?.short || ""));
  }

  // default all: show date fixtures
  return allFixtures;
}

function renderFixtures(fixtures, liveFixtures) {
  const container = document.getElementById("fixtures-container");
  if (!container) return;

  const list = applyTabFilter(fixtures, liveFixtures);

  // Optional league filter hook (not used unless you set selectedLeagueId)
  const filtered = state.selectedLeagueId
    ? list.filter(fx => Number(fx?.league?.id) === Number(state.selectedLeagueId))
    : list;

  if (!filtered.length) {
    container.innerHTML = `<div class="loading-placeholder">No matches</div>`;
    return;
  }

  const groups = groupByLeague(filtered);

  let html = "";
  for (const g of groups) {
    const fx0 = g.meta;
    const flagUrl = getLeagueFlagUrl(fx0);
    const leagueLogo = fx0?.league?.logo || "";
    const title = getLeagueTitle(fx0);

    html += `
      <div class="league-header">
        ${flagUrl ? `<img class="league-flag" src="${flagUrl}" alt="" />` : ""}
        ${leagueLogo ? `<img class="league-logo" src="${leagueLogo}" alt="" />` : ""}
        <span>${escapeHtml(title)}</span>
      </div>
    `;

    html += g.items.map(fx => {
      const id = fx?.fixture?.id;
      const homeName = fx?.teams?.home?.name || "";
      const awayName = fx?.teams?.away?.name || "";
      const homeLogo = fx?.teams?.home?.logo || "";
      const awayLogo = fx?.teams?.away?.logo || "";

      const short = fx?.fixture?.status?.short || "";
      const starOn = state.favorites.has(id);

      return `
        <div class="match-row" data-fixture-id="${id}">
          <div class="status-cell">${getStatusCellHTML(fx)}</div>

          <div class="star-btn ${starOn ? "on" : ""}" data-action="toggle-fav" title="Favorite">
            <i class="fa-${starOn ? "solid" : "regular"} fa-star"></i>
          </div>

          <div class="team home">
            <span class="team-name">${escapeHtml(homeName)}</span>
            ${homeLogo ? `<img class="team-logo" src="${homeLogo}" alt="" />` : ""}
          </div>

          <div class="score-cell">
            ${getScoreHTML(fx)}
          </div>

          <div class="team away">
            ${awayLogo ? `<img class="team-logo" src="${awayLogo}" alt="" />` : ""}
            <span class="team-name">${escapeHtml(awayName)}</span>
          </div>

          <div class="chart-btn" title="Stats">
            <i class="fa-solid fa-chart-line"></i>
          </div>
        </div>
      `;
    }).join("");
  }

  container.innerHTML = html;
}

// ---------- Right: Featured Live ----------
function renderFeaturedLive(liveFixtures) {
  const box = document.getElementById("live-carousel-content");
  if (!box) return;

  const live = liveFixtures || [];
  if (!live.length) {
    box.innerHTML = `<div class="loading-placeholder" style="padding:32px 10px;">No data</div>`;
    return;
  }

  const fx = live[(state.carouselIndex % live.length + live.length) % live.length];

  const flagUrl = getLeagueFlagUrl(fx);
  const leagueName = fx?.league?.name || "";
  const country = fx?.league?.country || "";
  const elapsed = fx?.fixture?.status?.elapsed;

  const home = fx?.teams?.home?.name || "";
  const away = fx?.teams?.away?.name || "";
  const homeLogo = fx?.teams?.home?.logo || "";
  const awayLogo = fx?.teams?.away?.logo || "";

  const gh = fx?.goals?.home ?? "-";
  const ga = fx?.goals?.away ?? "-";

  const topLine = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
      ${flagUrl ? `<img class="league-flag" src="${flagUrl}" alt="" />` : ""}
      <div style="font-size:10px;font-weight:900;letter-spacing:.25em;color:var(--green);text-transform:uppercase;">
        ${escapeHtml(country)} · ${escapeHtml(leagueName)}
      </div>
    </div>
  `;

  const timeBadge = (typeof elapsed === "number")
    ? `<div style="background:var(--red);padding:6px 10px;border-radius:6px;font-size:10px;font-weight:900;letter-spacing:.2em;">${elapsed}'</div>`
    : `<div style="background:#2d3439;padding:6px 10px;border-radius:6px;font-size:10px;font-weight:900;letter-spacing:.2em;">LIVE</div>`;

  box.innerHTML = `
    ${topLine}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;">
      <div style="width:110px;text-align:center;">
        ${homeLogo ? `<img src="${homeLogo}" style="width:34px;height:34px;object-fit:contain;margin:0 auto 8px;" />` : ""}
        <div style="font-size:10px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(home)}</div>
      </div>

      <div style="text-align:center;min-width:90px;">
        <div style="font-size:30px;font-weight:900;letter-spacing:-.04em;margin-bottom:10px;">${gh}-${ga}</div>
        ${timeBadge}
      </div>

      <div style="width:110px;text-align:center;">
        ${awayLogo ? `<img src="${awayLogo}" style="width:34px;height:34px;object-fit:contain;margin:0 auto 8px;" />` : ""}
        <div style="font-size:10px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(away)}</div>
      </div>
    </div>
  `;
}

// ---------- Right: News ----------
function renderNews(items) {
  const container = document.getElementById("news-container");
  if (!container) return;

  const news = Array.isArray(items) ? items : [];
  if (!news.length) {
    container.innerHTML = `<div class="loading-placeholder" style="padding:28px 10px;">No news</div>`;
    return;
  }

  container.innerHTML = news.slice(0, 12).map(n => {
    const title = n?.title || "";
    const link = n?.link || "#";
    const time = n?.pubDate ? new Date(n.pubDate).toLocaleString() : "";
    return `
      <div class="news-item" onclick="window.open('${link}', '_blank')">
        <div class="news-title">${escapeHtml(title)}</div>
        <div class="news-meta">
          <span class="tag">Trending</span>
          <span>•</span>
          <span>${escapeHtml(time)}</span>
        </div>
      </div>
    `;
  }).join("");
}

// ---------- Sidebar (simple + safe placeholders, keep structure) ----------
function renderPinnedLeagues() {
  const el = document.getElementById("pinned-leagues");
  if (!el) return;

  // You can adjust ids anytime. This keeps UI and structure.
  const pinned = [
    { id: 39, name: "Premier League", flag: "https://media.api-sports.io/flags/gb.svg" },
    { id: 140, name: "La Liga", flag: "https://media.api-sports.io/flags/es.svg" },
    { id: 135, name: "Serie A", flag: "https://media.api-sports.io/flags/it.svg" },
    { id: 78, name: "Bundesliga", flag: "https://media.api-sports.io/flags/de.svg" },
    { id: 61, name: "Ligue 1", flag: "https://media.api-sports.io/flags/fr.svg" },
    { id: 283, name: "V.League 1", flag: "https://media.api-sports.io/flags/vn.svg" },
  ];

  el.innerHTML = pinned.map(l => `
    <li class="p-2 rounded flex items-center gap-3 text-xs font-bold transition-all hover:bg-[#252b31] cursor-pointer"
        data-action="filter-league" data-league-id="${l.id}">
      <img class="league-flag" src="${l.flag}" alt="" />
      <span class="text-gray-400">${escapeHtml(l.name)}</span>
    </li>
  `).join("");
}

function renderCountries(fixtures) {
  const el = document.getElementById("countries-list");
  if (!el) return;

  // Build a small list from today fixtures (fallback to some defaults)
  const map = new Map();
  for (const fx of fixtures || []) {
    const country = fx?.league?.country;
    const flag = fx?.league?.flag;
    if (!country) continue;
    if (!map.has(country)) map.set(country, flag || "");
  }

  const arr = [...map.entries()].slice(0, 12);
  if (!arr.length) {
    const defaults = [
      ["England", "https://media.api-sports.io/flags/gb.svg"],
      ["Spain", "https://media.api-sports.io/flags/es.svg"],
      ["Italy", "https://media.api-sports.io/flags/it.svg"],
      ["Germany", "https://media.api-sports.io/flags/de.svg"],
      ["France", "https://media.api-sports.io/flags/fr.svg"],
      ["Vietnam", "https://media.api-sports.io/flags/vn.svg"],
    ];
    el.innerHTML = defaults.map(([n, f]) => `
      <div class="flex items-center gap-3 text-[11px] font-bold text-gray-500 hover:text-white cursor-pointer p-1.5 group transition-colors">
        ${f ? `<img class="league-flag" src="${f}" alt="" />` : ""}
        <span>${escapeHtml(n)}</span>
      </div>
    `).join("");
    return;
  }

  el.innerHTML = arr.map(([n, f]) => `
    <div class="flex items-center gap-3 text-[11px] font-bold text-gray-500 hover:text-white cursor-pointer p-1.5 group transition-colors">
      ${f ? `<img class="league-flag" src="${f}" alt="" />` : ""}
      <span>${escapeHtml(n)}</span>
    </div>
  `).join("");
}

// ---------- Live count badge ----------
function updateLiveBadge(liveFixtures) {
  const badge = document.getElementById("live-total-count");
  if (!badge) return;

  const count = (liveFixtures || []).length;
  badge.textContent = String(count);
  badge.classList.toggle("live-on", count > 0);
}

// ---------- Refresh ----------
async function refreshAll() {
  // Load in parallel
  const [fixtures, live, news] = await Promise.all([
    loadFixturesByDate(state.date),
    loadLive(),
    loadNews()
  ]);

  state.lastFixtures = Array.isArray(fixtures) ? fixtures : [];
  state.lastLive = Array.isArray(live) ? live : [];

  updateLiveBadge(state.lastLive);
  renderDateStrip();
  renderPinnedLeagues();
  renderCountries(state.lastFixtures);
  renderFeaturedLive(state.lastLive);
  renderNews(news);
  renderFixtures(state.lastFixtures, state.lastLive);
}

function refreshCenter() {
  renderFixtures(state.lastFixtures, state.lastLive);
}

// ---------- Events ----------
function bindEvents() {
  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      setActiveTab(tab);
    });
  });

  // Date navigation
  const prev = document.getElementById("btnPrevDay");
  const next = document.getElementById("btnNextDay");
  const dp = document.getElementById("datePicker");

  if (prev) prev.addEventListener("click", async () => {
    state.date.setDate(state.date.getDate() - 1);
    await refreshAll();
  });

  if (next) next.addEventListener("click", async () => {
    state.date.setDate(state.date.getDate() + 1);
    await refreshAll();
  });

  if (dp) dp.addEventListener("change", async () => {
    if (!dp.value) return;
    const [y, m, d] = dp.value.split("-").map(Number);
    state.date = new Date(y, m - 1, d);
    await refreshAll();
  });

  // Click date chip
  document.addEventListener("click", async (e) => {
    const chip = e.target.closest(".date-chip");
    if (!chip) return;

    const ymd = chip.getAttribute("data-ymd");
    if (!ymd) return;

    const [y, m, d] = ymd.split("-").map(Number);
    state.date = new Date(y, m - 1, d);
    await refreshAll();
  });

  // Toggle favorite + pinned league filter
  document.addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-action='toggle-fav']");
    if (favBtn) {
      const row = e.target.closest(".match-row");
      const id = Number(row?.getAttribute("data-fixture-id"));
      if (!id) return;

      if (state.favorites.has(id)) state.favorites.delete(id);
      else state.favorites.add(id);

      localStorage.setItem("favMatches", JSON.stringify([...state.favorites]));
      refreshCenter();
      return;
    }

    const lg = e.target.closest("[data-action='filter-league']");
    if (lg) {
      const leagueId = Number(lg.getAttribute("data-league-id"));
      state.selectedLeagueId = (state.selectedLeagueId === leagueId) ? null : leagueId;
      refreshCenter();
      return;
    }
  });

  // Featured live carousel
  const cPrev = document.getElementById("carousel-prev");
  const cNext = document.getElementById("carousel-next");

  if (cNext) cNext.addEventListener("click", () => {
    state.carouselIndex++;
    renderFeaturedLive(state.lastLive);
  });
  if (cPrev) cPrev.addEventListener("click", () => {
    state.carouselIndex--;
    renderFeaturedLive(state.lastLive);
  });
}

// ---------- Init ----------
async function init() {
  updateClock();
  setInterval(updateClock, 1000);

  bindEvents();
  await refreshAll();
}

// go
window.addEventListener("load", init);
