// ==========================================
// BONGDAHA - main.js (FINAL INTEGRATED VERSION)
// ==========================================

const state = {
  tab: "all",
  date: new Date(),
  favorites: new Set(JSON.parse(localStorage.getItem("favMatches") || "[]")),
  carouselIndex: 0,
  lastFixtures: [],
  lastLive: [],
  selectedLeagueId: null,
};

// Match Detail panel runtime state
state.detailMatchId = null;
state.detailRefreshTimer = null;


// 1. 定义 COMPETITIONS 固定联赛数据
const COMPETITION_DATA = [
  { id: 39, name: "Premier League", country: "England", logo: "https://media.api-sports.io/football/leagues/39.png" },
  { id: 140, name: "La Liga", country: "Spain", logo: "https://media.api-sports.io/football/leagues/140.png" },
  { id: 135, name: "Serie A", country: "Italy", logo: "https://media.api-sports.io/football/leagues/135.png" },
  { id: 78, name: "Bundesliga", country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png" },
  { id: 61, name: "Ligue 1", country: "France", logo: "https://media.api-sports.io/football/leagues/61.png" },
  { id: 271, name: "V.League 1", country: "Vietnam", logo: "https://media.api-sports.io/football/leagues/271.png" },
  { id: 88, name: "Eredivisie", country: "Netherlands", logo: "https://media.api-sports.io/football/leagues/88.png" },
  { id: 203, name: "Süper Lig", country: "Turkiye", logo: "https://media.api-sports.io/football/leagues/203.png" },
  { id: 40, name: "Championship", country: "England", logo: "https://media.api-sports.io/football/leagues/40.png" },
  { id: 2, name: "Champions League", country: "UEFA", logo: "https://media.api-sports.io/football/leagues/2.png" },
  { id: 3, name: "Europa League", country: "UEFA", logo: "https://media.api-sports.io/football/leagues/3.png" },
  { id: 848, name: "Conference League", country: "UEFA", logo: "https://media.api-sports.io/football/leagues/848.png" },
  { id: 94, name: "Primeira Liga", country: "Portugal", logo: "https://media.api-sports.io/football/leagues/94.png" },
  { id: 179, name: "Premiership", country: "Scotland", logo: "https://media.api-sports.io/football/leagues/179.png" },
  { id: 144, name: "Belgian Pro League", country: "Belgium", logo: "https://media.api-sports.io/football/leagues/144.png" },
  { id: 1, name: "World Cup 2026", country: "International", logo: "https://media.api-sports.io/football/leagues/1.png" }
];

// ---------- Helpers ----------
function pad2(n) { return String(n).padStart(2, "0"); }
function toYMD(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}
function formatHHMM(dateStr) {
  const d = new Date(dateStr);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function isFinished(s) { return ["FT", "AET", "PEN"].includes(s); }
function isLiveStatus(s) { return ["1H","2H","HT","ET","BT","P","LIVE"].includes(s); }
function isScheduled(s) { return ["NS","TBD"].includes(s); }
function escapeHtml(s) {
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

// ---------- API ----------
async function apiGetJSON(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  return await r.json();
}

const loadFixturesByDate = d => apiGetJSON(`/api/fixtures?date=${toYMD(d)}`);
const loadLive = () => apiGetJSON(`/api/live`);
const loadNews = () => apiGetJSON(`/api/news`);

// ---------- Clock ----------
function updateClock() {
  const n = new Date();
  const el = document.getElementById("clock");
  if (!el) return;
  el.textContent = `${pad2(n.getDate())}/${pad2(n.getMonth()+1)}/${n.getFullYear()} ${pad2(n.getHours())}:${pad2(n.getMinutes())}:${pad2(n.getSeconds())}`;
}

// ---------- Date strip ----------
function renderDateStrip() {
  const strip = document.getElementById("date-strip");
  if (!strip) return;
  const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const todayYMD = toYMD(new Date());
  const base = new Date(state.date);
  const baseYMD = toYMD(base);
  let html = "";
  for (let i = -2; i <= 2; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ymd = toYMD(d);
    const label = ymd === todayYMD ? "TODAY" : days[d.getDay()];
    html += `<div class="date-chip ${ymd===baseYMD?"active":""}" data-ymd="${ymd}">
        <div class="d1">${pad2(d.getDate())}/${pad2(d.getMonth()+1)}</div>
        <div class="d2">${label}</div>
      </div>`;
  }
  strip.innerHTML = html;
  const dp = document.getElementById("datePicker");
  if (dp) dp.value = baseYMD;
}

function renderCompetitions() {
  const topContainer = document.getElementById('top-competitions');
  const allContainer = document.getElementById('all-competitions');
  if (!topContainer || !allContainer) return;
  const createItem = (c) => `
    <li class="flex items-center gap-3 p-2 hover:bg-[#252b31] rounded-md cursor-pointer group transition-colors ${state.selectedLeagueId === c.id ? 'bg-[#252b31]' : ''}" 
        data-action="filter-league" data-league-id="${c.id}">
        <img src="${c.logo}" class="w-8 h-8 object-contain bg-[#1a1e22] p-1 rounded-md">
        <div class="flex flex-col min-w-0">
            <span class="text-[12px] font-bold text-gray-200 group-hover:text-[#00e676] truncate">${escapeHtml(c.name)}</span>
            <span class="text-[10px] text-gray-500">${escapeHtml(c.country)}</span>
        </div>
    </li>`;
  topContainer.innerHTML = COMPETITION_DATA.slice(0, 6).map(createItem).join('');
  allContainer.innerHTML = COMPETITION_DATA.slice(6).map(createItem).join('');
}

function renderLeftSidebar(fixtures) {
  const countryList = document.getElementById("countries-list");
  const pinnedList = document.getElementById("pinned-leagues");
  if (!fixtures) return;
  const leaguesMap = new Map();
  fixtures.forEach(f => {
    if (!leaguesMap.has(f.league.id)) leaguesMap.set(f.league.id, f.league);
  });
  if (countryList) {
    let cHtml = "";
    leaguesMap.forEach(l => {
      const activeCls = state.selectedLeagueId === l.id ? "bg-[#252b31] border-l-2 border-[#00e676]" : "";
      cHtml += `<div class="flex items-center gap-3 p-2 hover:bg-[#252b31] rounded-sm cursor-pointer group ${activeCls}" data-action="filter-league" data-league-id="${l.id}">
          <img src="${l.flag || l.logo}" class="w-4 h-3 object-cover rounded-[1px] opacity-80 group-hover:opacity-100">
          <span class="text-[11px] font-medium text-gray-400 group-hover:text-[#00e676] truncate">${escapeHtml(l.name)}</span>
        </div>`;
    });
    countryList.innerHTML = cHtml || '<div class="text-[10px] text-gray-600 p-2">No leagues</div>';
  }
  if (pinnedList) {
    const pinnedMap = new Map();
    fixtures.forEach(f => {
      if (state.favorites.has(f.fixture.id) && !pinnedMap.has(f.league.id)) pinnedMap.set(f.league.id, f.league);
    });
    let pHtml = "";
    pinnedMap.forEach(l => {
      pHtml += `<li class="flex items-center gap-3 p-2 hover:bg-[#252b31] rounded-sm cursor-pointer group" data-action="filter-league" data-league-id="${l.id}">
          <i class="fa-solid fa-thumbtack text-[10px] text-[#00e676]"></i>
          <span class="text-[11px] text-gray-300 group-hover:text-white truncate">${escapeHtml(l.name)}</span>
        </li>`;
    });
    pinnedList.innerHTML = pHtml || '<div class="text-[10px] text-gray-700 px-2 italic">No pinned items</div>';
  }
}

// ---------- Fixtures ----------
function applyTabFilter(all, live) {
  if (state.tab === "live") return live;
  if (state.tab === "favorite") return [...all, ...live].filter(f => state.favorites.has(f.fixture.id));
  if (state.tab === "finished") return all.filter(f => isFinished(f.fixture.status.short));
  if (state.tab === "scheduled") return all.filter(f => isScheduled(f.fixture.status.short));
  return all;
}

function renderFixtures(fixtures, live) {
  const el = document.getElementById("fixtures-container");
  if (!el) return;
  let list = applyTabFilter(fixtures, live);
  if (state.selectedLeagueId) list = list.filter(f => f.league.id === state.selectedLeagueId);
  if (!list.length) {
    el.innerHTML = `<div class="loading-placeholder">No matches found</div>`;
    return;
  }
  const map = new Map();
  list.forEach(f => {
    if (!map.has(f.league.id)) map.set(f.league.id, { fx: f, items: [] });
    map.get(f.league.id).items.push(f);
  });
  let html = "";
  map.forEach(g => {
    const l = g.fx.league;
    html += `<div class="league-header">
        ${l.flag ? `<img class="league-flag" src="${l.flag}">` : ""}
        ${l.logo ? `<img class="league-logo" src="${l.logo}">` : ""}
        <span>${escapeHtml(l.country)} - ${escapeHtml(l.name)}</span>
      </div>`;
    html += g.items.map(f => {
      const s = f.fixture.status.short;
      const isLive = isLiveStatus(s);
      const liveCls = isLive ? "score live" : "score";
      return `<div class="match-row" data-fixture-id="${f.fixture.id}">
          <div class="status-cell">
            ${isLive ? `<span class="live-dot"></span>${f.fixture.status.elapsed}'` : isScheduled(s) ? formatHHMM(f.fixture.date) : "FT"}
          </div>
          <div class="star-btn ${state.favorites.has(f.fixture.id) ? "on" : ""}" data-action="toggle-fav">
            <i class="fa-${state.favorites.has(f.fixture.id) ? "solid" : "regular"} fa-star"></i>
          </div>
          <div class="team home">
            <span class="team-name">${escapeHtml(f.teams.home.name)}</span>
            <img class="team-logo" src="${f.teams.home.logo}">
          </div>
          <div class="score-cell">
            <span class="${liveCls}">${f.goals.home ?? "-"} : ${f.goals.away ?? "-"}</span>
          </div>
          <div class="team away">
            <img class="team-logo" src="${f.teams.away.logo}">
            <span class="team-name">${escapeHtml(f.teams.away.name)}</span>
          </div>
          <div class="match-actions">
            <span class="live-indicator ${isLive ? 'active' : ''}">LIVE</span>
            <div class="chart-btn" data-action="open-details">
                <i class="fa-solid fa-chart-line"></i>
            </div>
          </div>
        </div>`;
    }).join("");
  });
  el.innerHTML = html;
}

// ---------- Right Sidebar ----------
function renderFeaturedLive(live = []) {
  const box = document.getElementById("live-carousel-content");
  if (!box) return;
  if (!live.length) {
    box.innerHTML = `<div class="loading-placeholder">No live matches</div>`;
    return;
  }
  const fx = live[state.carouselIndex % live.length];
  box.innerHTML = `
    <div class="text-center">
      <div class="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">${escapeHtml(fx.league.name)}</div>
      <div class="flex items-center justify-around gap-2 mt-4">
        <div class="text-center">
          <img src="${fx.teams.home.logo}" class="w-10 h-10 mx-auto mb-2 object-contain">
          <div class="text-[11px] font-bold w-20 truncate">${escapeHtml(fx.teams.home.name)}</div>
        </div>
        <div class="text-xl font-black text-[#00e676]">${fx.goals.home ?? 0} : ${fx.goals.away ?? 0}</div>
        <div class="text-center">
          <img src="${fx.teams.away.logo}" class="w-10 h-10 mx-auto mb-2 object-contain">
          <div class="text-[11px] font-bold w-20 truncate">${escapeHtml(fx.teams.away.name)}</div>
        </div>
      </div>
      <div class="mt-4 text-[10px] text-red-500 font-bold animate-pulse">${fx.fixture.status.elapsed}' LIVE</div>
    </div>
  `;
}

function renderNews(items) {
  const el = document.getElementById("news-container");
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div class="loading-placeholder">No news available</div>`;
    return;
  }
  el.innerHTML = items.slice(0,6).map(n => `
    <div class="news-item" onclick="window.open('${n.link}','_blank')">
      <div class="news-title">${escapeHtml(n.title)}</div>
      <div class="news-meta">
        <span class="tag">Breaking</span>
        <span>Latest Update</span>
      </div>
    </div>`).join("");
}

function updateLiveBadge(live) {
  const b = document.getElementById("live-total-count");
  if (!b) return;
  b.textContent = live.length;
  b.classList.toggle("live-on", live.length>0);
}

// ---------- Match Detail Panel Logic ----------
async function openMatchDetails(matchId) {
  console.log("OPEN MATCH DETAILS:", matchId);

  const panel  = document.getElementById("match-detail-panel");
  const body   = document.getElementById("right-panel-body");
  const loader = document.getElementById("modal-loader");

  if (!panel || !body || !loader) {
    console.error("Detail panel DOM missing");
    return;
  }

panel.classList.remove("hidden");
panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

state.detailMatchId = matchId;
startDetailAutoRefresh();

  body.innerHTML = "";
  loader.style.display = "flex";

  try {
    const result = await apiGetJSON(`/api/fixture-detail?id=${matchId}`);
    const match = result?.response?.[0];

    loader.style.display = "none";

    if (!match) {
      body.innerHTML = `<div class="loading-placeholder">No match data</div>`;
      return;
    }

    body.innerHTML = `
      <div class="modal-header-box">
        <div class="team">
          <img class="team-logo" src="${match.teams.home.logo}">
          <div class="team-name">${match.teams.home.name}</div>
        </div>

        <div class="score-big">
          ${match.goals.home ?? 0} - ${match.goals.away ?? 0}
        </div>

        <div class="team">
          <img class="team-logo" src="${match.teams.away.logo}">
          <div class="team-name">${match.teams.away.name}</div>
        </div>
      </div>

      <div class="modal-tabs" id="right-panel-tabs">
  <div class="modal-tab-item active" data-target="summary">Summary</div>
  <div class="modal-tab-item" data-target="stats">Stats</div>
  <div class="modal-tab-item" data-target="lineups">Lineups</div>
</div>


      <div id="right-panel-tab-content">
        ${renderSummary(match)}
      </div>
    `;

    document
      .getElementById("right-panel-tabs")
      .addEventListener("click", e => {
        const tab = e.target.closest(".modal-tab-item");
        if (!tab) return;

        document.querySelectorAll(".modal-tab-item")
          .forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        const target = tab.dataset.target;
        const content = document.getElementById("right-panel-tab-content");

       if (target === "summary") content.innerHTML = renderSummary(match);
       else if (target === "stats") content.innerHTML = renderStats(match);
       else if (target === "lineups") content.innerHTML = renderLineups(match);

      });

  } catch (err) {
    console.error(err);
    loader.style.display = "none";
    body.innerHTML = `<div class="loading-placeholder">Load failed</div>`;
  }
}


function stopDetailAutoRefresh() {
  if (state.detailRefreshTimer) {
    clearInterval(state.detailRefreshTimer);
    state.detailRefreshTimer = null;
  }
}

function startDetailAutoRefresh() {
  stopDetailAutoRefresh();

  state.detailRefreshTimer = setInterval(async () => {
    const panel = document.getElementById("match-detail-panel");
    if (!panel || panel.classList.contains("hidden")) return;
    if (!state.detailMatchId) return;

    const result = await apiGetJSON(`/api/fixture-detail?id=${state.detailMatchId}`);
    const match = result?.response?.[0];
    if (!match) return;

    // 只刷新内容，不关 panel
    const content = document.getElementById("right-panel-tab-content");
    const tabs = document.getElementById("right-panel-tabs");
    if (!content || !tabs) return;

    const active = tabs.querySelector(".modal-tab-item.active")?.dataset?.target || "summary";
    if (active === "summary") content.innerHTML = renderSummary(match);
    else if (active === "stats") content.innerHTML = renderStats(match);
    else if (active === "lineups") content.innerHTML = renderLineups(match);
  }, 15000); // 15秒一次（你配额多可以更频密）
}


function renderSummary(match) {
  if (!Array.isArray(match.events) || !match.events.length) {
    return `<div class="loading-placeholder">No events</div>`;
  }

  const rows = match.events
    .map(ev => {
      const isHome = ev.team?.id === match.teams.home.id;

     const name =
  ev.player?.name ||
  ev.assist?.name ||
  ev.player_in?.name ||
  ev.player_out?.name ||
  "";

      if (!name) return null; // 彻底过滤“空白行”

      let icon = "⚽";
      if (ev.type === "Card") icon = ev.detail === "Yellow Card" ? "🟨" : "🟥";
      if (ev.type === "subst") icon = "🔄";

      const t = ev.time?.elapsed != null ? `${ev.time.elapsed}'` : "";

      return `
        <div class="event-row">
          <div class="event-time">${t}</div>

          <div class="event-side home ${isHome ? "show" : ""}">
            ${isHome ? escapeHtml(name) : ""}
          </div>

          <div class="event-mid">
            <span class="event-icon">${icon}</span>
          </div>

          <div class="event-side away ${!isHome ? "show" : ""}">
            ${!isHome ? escapeHtml(name) : ""}
          </div>
        </div>
      `;
    })
    .filter(Boolean);

  if (!rows.length) {
    return `<div class="loading-placeholder">No visible events</div>`;
  }

  return `
    <div class="events-container events-2col">
      ${rows.join("")}
    </div>
  `;
}


// ---------- Stats ----------
function renderStats(match) {
  if (!Array.isArray(match.statistics) || match.statistics.length < 2) {
    return `<div class="loading-placeholder">No stats</div>`;
  }

  const homeStats = match.statistics[0]?.statistics || [];
  const awayStats = match.statistics[1]?.statistics || [];

  const types = [
    "Ball Possession",
    "Total Shots",
    "Shots on Goal",
    "Corner Kicks"
  ];

  const getValNum = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseInt(v.replace("%",""), 10) || 0;
    return 0;
  };

  return `
    <div class="stats-container">
      ${types.map(type => {
        const hRaw = homeStats.find(s => s.type === type)?.value ?? 0;
        const aRaw = awayStats.find(s => s.type === type)?.value ?? 0;

        const h = getValNum(hRaw);
        const a = getValNum(aRaw);

        const total = (h + a) || 1;
        const hPct = Math.round((h / total) * 100);
        const aPct = 100 - hPct;

        const homeLead = h > a;
        const awayLead = a > h;

        return `
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-side ${homeLead ? "lead" : ""}">${escapeHtml(String(hRaw))}</span>
              <span class="stat-type">${escapeHtml(type)}</span>
              <span class="stat-side ${awayLead ? "lead" : ""}">${escapeHtml(String(aRaw))}</span>
            </div>

            <div class="stat-bar-bg">
              <div class="stat-bar-home ${homeLead ? "lead" : ""}" style="width:${hPct}%"></div>
              <div class="stat-bar-away ${awayLead ? "lead" : ""}" style="width:${aPct}%"></div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ---------- Lineups (FINAL CLEAN VERSION) ----------
function renderLineups(match) {
  const ROW_GAP = 8.5;   // 每一排垂直间距（%）
  const LEFT_MIN = 12;   // 左边界（%）
  const LEFT_MAX = 88;   // 右边界（%）

  const lineups = match.lineups;
  if (!Array.isArray(lineups) || lineups.length < 2) {
    return `<div class="loading-placeholder">No lineups</div>`;
  }

  const home =
    lineups.find(x => x.team?.id === match.teams.home.id) || lineups[0];
  const away =
    lineups.find(x => x.team?.id === match.teams.away.id) || lineups[1];

  const renderSide = (team, isAway) => {
    const players = team.startXI || [];
    if (!players.length) return "";

    // ① 按 row 分组
    const rows = {};
    players.forEach(p => {
      const grid = p.player?.grid;
      if (!grid) return;

      const [row, col] = grid.split(":").map(Number);
      if (!rows[row]) rows[row] = [];
      rows[row].push({ player: p.player, col });
    });

    // ② 行内按 col 排序（左 → 右）
    Object.values(rows).forEach(arr => {
      arr.sort((a, b) => a.col - b.col);
    });

    // ③ 渲染
    return Object.entries(rows).map(([rowStr, rowPlayers]) => {
      const row = Number(rowStr);
      const count = rowPlayers.length;

      const span = LEFT_MAX - LEFT_MIN;
      const step = (count <= 1) ? 0 : span / (count - 1);

      return rowPlayers.map((item, i) => {
        const left = (count <= 1)
          ? 50
          : LEFT_MIN + step * i;

        const top = isAway
          ? row * ROW_GAP
          : 100 - row * ROW_GAP;

        const pl = item.player;

        return `
          <div class="player-dot ${isAway ? "away-p" : "home-p"}"
               style="left:${left}%; top:${top}%;">

            <div class="shirt">${pl.number ?? ""}</div>
            <div class="name">
              ${escapeHtml(pl.name.split(" ").slice(-1)[0])}
            </div>

          </div>
        `;
      }).join("");
    }).join("");
  };

  return `
    <div class="lineup-container">
      <div class="pitch">
        <div class="pitch-markings">
          <div class="half-line"></div>
          <div class="center-circle"></div>
          <div class="penalty-area top"></div>
          <div class="penalty-area bottom"></div>
          <div class="goal-area top"></div>
          <div class="goal-area bottom"></div>
        </div>

        <div class="team-label away-label">
          ${escapeHtml(away.team.name)} · ${away.formation || ""}
        </div>

        <div class="team-label home-label">
          ${escapeHtml(home.team.name)} · ${home.formation || ""}
        </div>

        ${renderSide(away, true)}
        ${renderSide(home, false)}
      </div>
    </div>
  `;
}

// ---------- Refresh & Events ----------
async function refreshAll() {
  const [fx, live, news] = await Promise.all([loadFixturesByDate(state.date), loadLive(), loadNews()]);
  state.lastFixtures = fx || [];
  state.lastLive = live || [];
  updateLiveBadge(state.lastLive);
  renderDateStrip();
  renderCompetitions();
  renderFeaturedLive(state.lastLive);
  renderNews(news || []);
  renderFixtures(state.lastFixtures, state.lastLive);
  renderLeftSidebar(state.lastFixtures);
}

function refreshCenter() {
  renderFixtures(state.lastFixtures, state.lastLive);
  renderCompetitions();
  renderLeftSidebar(state.lastFixtures);
}

function bindEvents() {

  // 防止重复绑定全局 click
  if (window.__GLOBAL_CLICK_BOUND__) return;
  window.__GLOBAL_CLICK_BOUND__ = true;

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      state.tab = btn.dataset.tab;
      state.selectedLeagueId = null;
      document.querySelectorAll(".tab-btn").forEach(b =>
        b.classList.toggle("active", b === btn)
      );
      await refreshAll();
    });
  });

  // Sidebar Toggle
  const compBtn = document.getElementById('toggle-competitions');
  const allCompList = document.getElementById('all-competitions');
  const chevron = document.getElementById('comp-chevron');
  if (compBtn && allCompList) {
    compBtn.addEventListener('click', () => {
      const isHidden = allCompList.classList.contains('hidden');
      allCompList.classList.toggle('hidden');
      if (chevron) chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    });
  }

  // Right Panel Close Button
 document.getElementById("close-right-panel")?.addEventListener("click", () => {
  document.getElementById("match-detail-panel").classList.add("hidden");
  state.detailMatchId = null;
  stopDetailAutoRefresh();
});


  // Date Nav
  const prev = document.getElementById("btnPrevDay");
  const next = document.getElementById("btnNextDay");
  const dp = document.getElementById("datePicker");
  async function onDateChange(d) {
    state.date = d;
    state.selectedLeagueId = null;
    await refreshAll();
  }
  prev?.addEventListener("click", () => { const d = new Date(state.date); d.setDate(d.getDate() - 1); onDateChange(d); });
  next?.addEventListener("click", () => { const d = new Date(state.date); d.setDate(d.getDate() + 1); onDateChange(d); });
  dp?.addEventListener("change", () => { const [y, m, d] = dp.value.split("-").map(Number); onDateChange(new Date(y, m - 1, d)); });

  // Carousel
  document.getElementById("carousel-prev")?.addEventListener("click", () => { state.carouselIndex = state.carouselIndex > 0 ? state.carouselIndex - 1 : 0; renderFeaturedLive(state.lastLive); });
  document.getElementById("carousel-next")?.addEventListener("click", () => { state.carouselIndex++; renderFeaturedLive(state.lastLive); });

  // Global Clicks (Fav, Filter, Details)
document.addEventListener("click", e => {

  // ===== 日期 chip =====
  const chip = e.target.closest(".date-chip");
  if (chip) {
    const [y, m, d] = chip.dataset.ymd.split("-").map(Number);
    state.date = new Date(y, m - 1, d);
    state.selectedLeagueId = null;
    refreshAll();
    return;
  }

  // ===== 收藏星号 =====
  const fav = e.target.closest("[data-action='toggle-fav']");
  if (fav) {
    const row = fav.closest(".match-row");
    if (!row) return;
    const id = Number(row.dataset.fixtureId);

    if (state.favorites.has(id)) {
      state.favorites.delete(id);
    } else {
      state.favorites.add(id);
    }

    localStorage.setItem("favMatches", JSON.stringify([...state.favorites]));
    refreshCenter();
    return;
  }

  // ===== 左侧 / pinned / competitions 联赛筛选 =====
  const lg = e.target.closest("[data-action='filter-league']");
  if (lg) {
    const lid = Number(lg.dataset.leagueId);
    state.selectedLeagueId =
      state.selectedLeagueId === lid ? null : lid;
    refreshCenter();
    return;
  }

  // ===== Chart → Match Detail Panel（你刚修好的）=====
  const detailsBtn =
    e.target.closest("[data-action='open-details']") ||
    e.target.closest(".chart-btn");

  if (detailsBtn) {
    const row = detailsBtn.closest(".match-row");
    if (!row) return;

    const matchId = Number(row.dataset.fixtureId);
    openMatchDetails(matchId);
  }
});
}


// ---------- Init ----------
async function init() {
  updateClock();
  setInterval(updateClock, 1000);
  bindEvents();
  await refreshAll();
}
setInterval(() => { refreshAll(); }, 60000);
window.addEventListener("load", init);