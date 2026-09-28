const STORAGE_KEY = "cdReservationApp_v2";

const defaultDB = {
  artists: [],
  cds: [],
  reservations: []
};

let db = loadDB();
let currentPage = "home";
let pageStack = [];
let selectedCDId = null;
let editingReservationId = null;
let reservationDraft = null;
let cdDraft = null;
let artistDraft = null;

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultDB);
    const parsed = JSON.parse(raw);
    return {
      artists: Array.isArray(parsed.artists) ? parsed.artists : [],
      cds: Array.isArray(parsed.cds) ? parsed.cds : [],
      reservations: Array.isArray(parsed.reservations) ? parsed.reservations : []
    };
  } catch {
    return structuredClone(defaultDB);
  }
}

function saveDB() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function yen(n) {
  return `¥${Number(n || 0).toLocaleString("ja-JP")}`;
}

function formatDate(date) {
  if (!date) return "-";
  return new Date(date + "T00:00:00").toLocaleDateString("ja-JP");
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function artistById(id) {
  return db.artists.find(a => a.id === id);
}

function cdById(id) {
  return db.cds.find(c => c.id === id);
}

function reservationById(id) {
  return db.reservations.find(r => r.id === id);
}

function activeReservations() {
  return db.reservations.filter(r => r.status !== "cancelled");
}

function reservedQuantityForCD(cdId, formatId = null) {
  return activeReservations().reduce((sum, r) => {
    if (r.cdId !== cdId) return sum;
    const item = r.items?.find(i => i.formatId === formatId);
    return sum + (item?.quantity || 0);
  }, 0);
}

function reservationCountForCD(cdId) {
  return activeReservations().filter(r => r.cdId === cdId).length;
}

function unpaidForCD(cdId) {
  return activeReservations()
    .filter(r => r.cdId === cdId && r.paymentStatus === "unpaid")
    .reduce((sum, r) => sum + Number(r.total || 0), 0);
}

function formatCountsForCD(cd) {
  return cd.formats.map(f => ({
    name: f.name,
    count: activeReservations()
      .filter(r => r.cdId === cd.id)
      .reduce((sum, r) => {
        const item = r.items?.find(i => i.formatId === f.id);
        return sum + Number(item?.quantity || 0);
      }, 0)
  }));
}

function bonusCountsForCD(cd) {
  const common = cd.earlyBonusEnabled ? { [cd.earlyBonusName || "共通早期予約特典"]: 0 } : {};
  const formats = {};
  cd.formats.forEach(f => {
    if (f.bonusType === "has" && f.bonusName) formats[f.bonusName] = 0;
  });

  activeReservations()
    .filter(r => r.cdId === cd.id)
    .forEach(r => {
      if (r.bonusType === "early") {
        const key = cd.earlyBonusName || "共通早期予約特典";
        if (key in common) common[key] += 1;
      } else if (r.bonusType === "format") {
        const f = cd.formats.find(x => x.id === r.bonusFormatId);
        const key = f?.bonusName || "形態別特典";
        formats[key] = (formats[key] || 0) + 1;
      }
    });

  return [
    ...Object.entries(common).map(([name, count]) => ({ name, count })),
    ...Object.entries(formats).map(([name, count]) => ({ name, count }))
  ];
}

function pageHeader(title, back = false) {
  return `
    <header class="app-header">
      <div class="header-inner">
        ${back ? `<button class="icon-btn" onclick="goBack()">‹</button>` : ""}
        <div class="header-title">${escapeHtml(title)}</div>
        ${!back ? `<button class="icon-btn" onclick="navigate('menu')">☰</button>` : ""}
      </div>
    </header>
  `;
}

function bottomNav(active) {
  const items = [
    ["home", "⌂", "ホーム"],
    ["cds", "💿", "CD一覧"],
    ["reservations", "📋", "予約一覧"],
    ["artists", "🎤", "アーティスト"],
    ["menu", "☰", "メニュー"]
  ];

  return `
    <nav class="bottom-nav">
      <div class="bottom-nav-inner">
        ${items.map(([id, icon, label]) => `
          <button class="nav-item ${active === id ? "active" : ""}" onclick="navigate('${id}', true)">
            <span class="nav-icon">${icon}</span>${label}
          </button>
        `).join("")}
      </div>
    </nav>
  `;
}

function render() {
  const app = document.getElementById("app");
  let content = "";

  switch (currentPage) {
    case "home": content = renderHome(); break;
    case "artists": content = renderArtists(); break;
    case "artistAdd": content = renderArtistAdd(); break;
    case "cds": content = renderCDs(); break;
    case "cdAdd": content = renderCDAdd(); break;
    case "cdDetail": content = renderCDDetail(); break;
    case "reservationAdd": content = renderReservationAdd(); break;
    case "reservations": content = renderReservations(); break;
    case "reservationDetail": content = renderReservationDetail(); break;
    case "menu": content = renderMenu(); break;
    default: content = renderHome();
  }

  app.innerHTML = content;
}

function navigate(page, fromNav = false) {
  if (fromNav) {
    pageStack = [];
  } else if (currentPage !== page) {
    pageStack.push(currentPage);
  }
  currentPage = page;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goBack() {
  if (pageStack.length) {
    currentPage = pageStack.pop();
  } else {
    currentPage = "home";
  }
  render();
}

function renderHome() {
  const active = activeReservations();
  const unpaid = active.filter(r => r.paymentStatus === "unpaid").reduce((s, r) => s + Number(r.total || 0), 0);
  const reserved = active.filter(r => r.status === "reserved").length;
  const received = active.filter(r => r.status === "received").length;

  return `
    ${pageHeader("CD予約管理")}
    <main class="page">
      <section class="hero">
        <h1>CD予約管理システム</h1>
        <div class="muted">自分のアーティスト・CD・予約をまとめて管理できます。</div>
      </section>

      <div class="grid-2">
        <div class="stat-card">
          <div class="stat-label">登録アーティスト</div>
          <div class="stat-value">${db.artists.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">登録CD</div>
          <div class="stat-value">${db.cds.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">予約済み</div>
          <div class="stat-value">${reserved}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">未払い</div>
          <div class="stat-value">${yen(unpaid)}</div>
        </div>
      </div>

      <h2 class="section-title">よく使う操作</h2>
      <div class="quick-actions">
        <button class="quick-action" onclick="navigate('artistAdd')">
          <strong>🎤 アーティスト登録</strong>
          <span>好きなアーティストを追加</span>
        </button>
        <button class="quick-action" onclick="navigate('cdAdd')">
          <strong>💿 CDを登録</strong>
          <span>形態・価格・特典も設定</span>
        </button>
        <button class="quick-action" onclick="startNewReservation()">
          <strong>📝 予約を登録</strong>
          <span>複数形態をまとめて予約</span>
        </button>
        <button class="quick-action" onclick="navigate('reservations')">
          <strong>📋 予約を確認</strong>
          <span>支払いや受取状況を確認</span>
        </button>
      </div>

      <h2 class="section-title">最近の予約</h2>
      ${active.slice().sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5).map(reservationCard).join("") || `
        <div class="card empty">
          <div class="empty-icon">📭</div>
          まだ予約がありません。
        </div>
      `}

      ${received ? `<div class="small muted">受け取り済みの予約：${received}件</div>` : ""}
    </main>
    ${bottomNav("home")}
  `;
}

function renderArtists() {
  const sorted = [...db.artists].sort((a,b) => a.name.localeCompare(b.name, "ja"));
  return `
    ${pageHeader("アーティスト")}
    <main class="page">
      <div class="row-between">
        <div class="muted small">${db.artists.length}件登録</div>
        <button class="btn btn-primary btn-small" onclick="navigate('artistAdd')">＋ 登録</button>
      </div>

      <div style="height:10px"></div>

      ${sorted.map(a => `
        <div class="card">
          <div class="row-between">
            <div>
              <div class="card-title">🎤 ${escapeHtml(a.name)}</div>
              ${a.memo ? `<div class="card-subtitle">${escapeHtml(a.memo)}</div>` : ""}
            </div>
            <div class="row">
              <span class="pill">${db.cds.filter(c => c.artistId === a.id).length} CD</span>
              <button class="btn btn-small" onclick="editArtist('${a.id}')">編集</button>
            </div>
          </div>
        </div>
      `).join("") || `
        <div class="card empty">
          <div class="empty-icon">🎤</div>
          <div>まだアーティストが登録されていません。</div>
          <div style="height:12px"></div>
          <button class="btn btn-primary" onclick="navigate('artistAdd')">最初のアーティストを登録</button>
        </div>
      `}
    </main>
    ${bottomNav("artists")}
  `;
}

function renderArtistAdd() {
  const editing = !!artistDraft?.id;
  const d = artistDraft || { name: "", memo: "" };

  return `
    ${pageHeader(editing ? "アーティスト編集" : "アーティスト登録", true)}
    <main class="page">
      <div class="card">
        <div class="form-group">
          <label class="form-label required">アーティスト名</label>
          <input id="artistName" type="text" value="${escapeHtml(d.name)}" placeholder="例：Aぇ! group">
        </div>

        <div class="form-group">
          <label class="form-label">メモ</label>
          <textarea id="artistMemo" placeholder="自由にメモ">${escapeHtml(d.memo || "")}</textarea>
        </div>

        <div class="sticky-actions">
          <button class="btn btn-primary full" onclick="saveArtist()">${editing ? "変更を保存" : "アーティストを登録"}</button>
        </div>
      </div>
    </main>
  `;
}

function saveArtist() {
  const name = document.getElementById("artistName").value.trim();
  const memo = document.getElementById("artistMemo").value.trim();

  if (!name) {
    showToast("アーティスト名を入力してください");
    return;
  }

  if (artistDraft?.id) {
    const a = artistById(artistDraft.id);
    if (a) {
      a.name = name;
      a.memo = memo;
    }
    showToast("アーティストを更新しました");
  } else {
    db.artists.push({
      id: uid("artist"),
      name,
      memo,
      createdAt: new Date().toISOString()
    });
    showToast("アーティストを登録しました");
  }

  artistDraft = null;
  saveDB();
  navigate("artists");
}

function editArtist(id) {
  const a = artistById(id);
  if (!a) return;
  artistDraft = structuredClone(a);
  navigate("artistAdd");
}

function renderCDs() {
  const cds = [...db.cds].sort((a,b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
  return `
    ${pageHeader("CD一覧")}
    <main class="page">
      <div class="toolbar">
        <input class="search-input" id="cdSearch" type="text" placeholder="CD名・アーティスト名で検索" oninput="filterCDCards()">
        <button class="btn btn-primary btn-small" onclick="navigate('cdAdd')">＋ CD登録</button>
      </div>

      <div id="cdCards">
        ${cds.map(cdCard).join("") || `
          <div class="card empty">
            <div class="empty-icon">💿</div>
            <div>まだCDが登録されていません。</div>
            <div style="height:12px"></div>
            <button class="btn btn-primary" onclick="navigate('cdAdd')">最初のCDを登録</button>
          </div>
        `}
      </div>
    </main>
    ${bottomNav("cds")}
  `;
}

function cdCard(cd) {
  const artist = artistById(cd.artistId);
  const counts = formatCountsForCD(cd);
  const countText = counts.map(x => `${escapeHtml(x.name)} × ${x.count}`).join(" / ");
  const unpaid = unpaidForCD(cd.id);

  return `
    <div class="card clickable cd-item"
         data-search="${escapeHtml(`${cd.title} ${artist?.name || ""}`.toLowerCase())}"
         onclick="openCD('${cd.id}')">
      <div class="cd-card">
        ${cd.image ? `<img class="cover" src="${cd.image}" alt="">` : `<div class="cover-placeholder">💿</div>`}
        <div class="cd-info">
          <div class="cd-title">${escapeHtml(cd.title)}</div>
          <div class="cd-meta">${escapeHtml(artist?.name || "アーティスト未設定")} ／ 発売日 ${formatDate(cd.releaseDate)}</div>
          <div class="small">${countText || "まだ予約なし"}</div>
          <div style="height:7px"></div>
          <div class="row wrap">
            <span class="pill">予約 ${reservationCountForCD(cd.id)}件</span>
            ${unpaid ? `<span class="pill pill-warning">未払い ${yen(unpaid)}</span>` : ""}
          </div>
        </div>
      </div>
    </div>
  `;
}

function filterCDCards() {
  const q = document.getElementById("cdSearch")?.value.trim().toLowerCase() || "";
  document.querySelectorAll(".cd-item").forEach(el => {
    el.style.display = el.dataset.search.includes(q) ? "" : "none";
  });
}

function openCD(id) {
  selectedCDId = id;
  navigate("cdDetail");
}

function renderCDDetail() {
  const cd = cdById(selectedCDId);
  if (!cd) return renderCDs();

  const artist = artistById(cd.artistId);
  const formatCounts = formatCountsForCD(cd);
  const bonusCounts = bonusCountsForCD(cd);

  return `
    ${pageHeader("CD詳細", true)}
    <main class="page">
      <div class="card">
        <div class="cd-card">
          ${cd.image ? `<img class="cover" src="${cd.image}" alt="">` : `<div class="cover-placeholder">💿</div>`}
          <div class="cd-info">
            <div class="cd-title">${escapeHtml(cd.title)}</div>
            <div class="cd-meta">${escapeHtml(artist?.name || "アーティスト未設定")}</div>
            <div class="small">発売日：${formatDate(cd.releaseDate)}</div>
          </div>
        </div>
        ${cd.memo ? `<div class="divider"></div><div class="small">${escapeHtml(cd.memo)}</div>` : ""}
      </div>

      <section class="card">
        <h2 class="section-title" style="margin-top:0">形態・価格・特典</h2>
        <table class="formats-table">
          <thead>
            <tr>
              <th>形態</th>
              <th>価格</th>
              <th>形態別特典</th>
            </tr>
          </thead>
          <tbody>
            ${cd.formats.map(f => `
              <tr>
                <td>${escapeHtml(f.name)}</td>
                <td>${yen(f.price)}</td>
                <td>${f.bonusType === "has" ? escapeHtml(f.bonusName) : "なし"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="divider"></div>
        <div class="small">
          <strong>全形態共通早期予約特典：</strong>
          ${cd.earlyBonusEnabled ? escapeHtml(cd.earlyBonusName || "あり") : "なし"}
        </div>
      </section>

      <section class="card">
        <h2 class="section-title" style="margin-top:0">形態ごとの予約数</h2>
        ${formatCounts.map(x => `
          <div class="summary-row">
            <span>${escapeHtml(x.name)}</span>
            <strong>${x.count}枚</strong>
          </div>
        `).join("")}
      </section>

      <section class="card">
        <h2 class="section-title" style="margin-top:0">特典ごとの予約数</h2>
        ${bonusCounts.length ? bonusCounts.map(x => `
          <div class="summary-row">
            <span>${escapeHtml(x.name)}</span>
            <strong>${x.count}件</strong>
          </div>
        `).join("") : `<div class="muted small">特典付きの予約はありません。</div>`}
        <div class="summary-row">
          <span>特典なし</span>
          <strong>${activeReservations().filter(r => r.cdId === cd.id && r.bonusType === "none").length}件</strong>
        </div>
      </section>

      <section class="card">
        <h2 class="section-title" style="margin-top:0">未払い金額</h2>
        <div style="font-size:24px;font-weight:900">${yen(unpaidForCD(cd.id))}</div>
      </section>

      <div class="row">
        <button class="btn btn-primary full" onclick="startNewReservation('${cd.id}')">このCDを予約する</button>
      </div>
    </main>
  `;
}

function renderCDAdd() {
  const d = cdDraft || {
    artistId: "",
    title: "",
    releaseDate: "",
    image: "",
    memo: "",
    formats: [
      { id: uid("fmt"), name: "", price: "", bonusType: "none", bonusName: "" }
    ],
    earlyBonusEnabled: false,
    earlyBonusName: ""
  };

  cdDraft = d;

  if (!db.artists.length) {
    return `
      ${pageHeader("CD登録", true)}
      <main class="page">
        <div class="card">
          <div class="notice">先にアーティストを1件以上登録してください。</div>
          <div style="height:12px"></div>
          <button class="btn btn-primary full" onclick="navigate('artistAdd')">アーティストを登録する</button>
        </div>
      </main>
    `;
  }

  return `
    ${pageHeader("CD登録", true)}
    <main class="page">
      <div class="card">
        <h2 class="section-title" style="margin-top:0">基本情報</h2>

        <div class="form-group">
          <label class="form-label required">アーティスト</label>
          <select id="cdArtist">
            <option value="">選択してください</option>
            ${db.artists.map(a => `<option value="${a.id}" ${d.artistId === a.id ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("")}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label required">CDタイトル</label>
          <input id="cdTitle" type="text" value="${escapeHtml(d.title)}" placeholder="例：○○ 1st Album">
        </div>

        <div class="form-group">
          <label class="form-label">発売日</label>
          <input id="cdReleaseDate" type="date" value="${escapeHtml(d.releaseDate)}">
        </div>

        <div class="form-group">
          <label class="form-label">ジャケット画像</label>
          <input class="file-input" id="cdImageFile" type="file" accept="image/*" onchange="previewCDImage(event)">
          <div style="height:10px"></div>
          <div id="imagePreviewWrap">
            ${d.image ? `<img class="image-preview" src="${d.image}" alt="">` : ""}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">メモ</label>
          <textarea id="cdMemo" placeholder="自由にメモ">${escapeHtml(d.memo)}</textarea>
        </div>
      </div>

      <div class="card">
        <div class="row-between">
          <h2 class="section-title" style="margin:0">形態・価格・形態別特典</h2>
          <button class="btn btn-secondary btn-small" onclick="addCDFormat()">＋ 形態追加</button>
        </div>

        <div style="height:10px"></div>
        <div id="formatEditor">
          ${d.formats.map((f, i) => formatEditor(f, i)).join("")}
        </div>
      </div>

      <div class="card">
        <h2 class="section-title" style="margin-top:0">全形態共通早期予約特典</h2>

        <div class="radio-group">
          <label class="choice">
            <input type="radio" name="earlyBonus" value="no" ${!d.earlyBonusEnabled ? "checked" : ""} onchange="toggleEarlyBonus(false)">
            <span>なし</span>
          </label>
          <label class="choice">
            <input type="radio" name="earlyBonus" value="yes" ${d.earlyBonusEnabled ? "checked" : ""} onchange="toggleEarlyBonus(true)">
            <span>あり</span>
          </label>
        </div>

        <div id="earlyBonusInput" style="${d.earlyBonusEnabled ? "" : "display:none"};margin-top:12px">
          <label class="form-label">特典名</label>
          <input id="earlyBonusName" type="text" value="${escapeHtml(d.earlyBonusName)}" placeholder="例：トレカ">
        </div>
      </div>

      <div class="sticky-actions">
        <button class="btn btn-primary full" onclick="saveCD()">CDを登録する</button>
      </div>
    </main>
  `;
}

function formatEditor(f, i) {
  return `
    <div class="format-box">
      <div class="row-between">
        <h3>形態 ${i + 1}</h3>
        ${cdDraft.formats.length > 1 ? `<button class="btn btn-ghost btn-small format-remove" onclick="removeCDFormat('${f.id}')">削除</button>` : ""}
      </div>

      <div class="form-group">
        <label class="form-label required">形態名</label>
        <input type="text" value="${escapeHtml(f.name)}" placeholder="例：初回限定盤A"
               onchange="updateDraftFormat('${f.id}', 'name', this.value)">
      </div>

      <div class="form-group">
        <label class="form-label required">価格</label>
        <input type="number" min="0" value="${escapeHtml(f.price)}" placeholder="例：3960"
               onchange="updateDraftFormat('${f.id}', 'price', this.value)">
      </div>

      <div class="form-group">
        <label class="form-label">形態別特典</label>
        <div class="radio-group">
          <label class="choice">
            <input type="radio" name="bonus_${f.id}" ${f.bonusType === "none" ? "checked" : ""} onchange="updateDraftFormat('${f.id}', 'bonusType', 'none'); render()">
            <span>なし</span>
          </label>
          <label class="choice">
            <input type="radio" name="bonus_${f.id}" ${f.bonusType === "has" ? "checked" : ""} onchange="updateDraftFormat('${f.id}', 'bonusType', 'has'); render()">
            <span>あり</span>
          </label>
        </div>
        ${f.bonusType === "has" ? `
          <div style="margin-top:10px">
            <input type="text" value="${escapeHtml(f.bonusName)}" placeholder="例：フォトカード"
                   onchange="updateDraftFormat('${f.id}', 'bonusName', this.value)">
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function updateDraftFormat(id, key, value) {
  const f = cdDraft.formats.find(x => x.id === id);
  if (!f) return;
  f[key] = key === "price" ? Number(value) : value;
}

function addCDFormat() {
  syncCDBasicFields();
  cdDraft.formats.push({
    id: uid("fmt"),
    name: "",
    price: "",
    bonusType: "none",
    bonusName: ""
  });
  render();
}

function removeCDFormat(id) {
  syncCDBasicFields();
  cdDraft.formats = cdDraft.formats.filter(f => f.id !== id);
  render();
}

function toggleEarlyBonus(value) {
  syncCDBasicFields();
  cdDraft.earlyBonusEnabled = value;
  render();
}

function syncCDBasicFields() {
  if (!cdDraft) return;
  const artist = document.getElementById("cdArtist");
  const title = document.getElementById("cdTitle");
  const releaseDate = document.getElementById("cdReleaseDate");
  const memo = document.getElementById("cdMemo");
  const earlyName = document.getElementById("earlyBonusName");

  if (artist) cdDraft.artistId = artist.value;
  if (title) cdDraft.title = title.value;
  if (releaseDate) cdDraft.releaseDate = releaseDate.value;
  if (memo) cdDraft.memo = memo.value;
  if (earlyName) cdDraft.earlyBonusName = earlyName.value;

  cdDraft.formats.forEach(f => {
    const boxes = document.querySelectorAll(`.format-box`);
  });
}

function previewCDImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    cdDraft.image = e.target.result;
    document.getElementById("imagePreviewWrap").innerHTML =
      `<img class="image-preview" src="${e.target.result}" alt="">`;
  };
  reader.readAsDataURL(file);
}

function saveCD() {
  syncCDBasicFields();

  if (!cdDraft.artistId || !cdDraft.title.trim()) {
    showToast("アーティストとCDタイトルを入力してください");
    return;
  }

  const formats = cdDraft.formats.map(f => ({
    ...f,
    name: String(f.name || "").trim(),
    price: Number(f.price || 0),
    bonusName: String(f.bonusName || "").trim(),
    bonusType: f.bonusType === "has" ? "has" : "none"
  }));

  if (formats.some(f => !f.name || f.price <= 0)) {
    showToast("形態名と価格を確認してください");
    return;
  }

  if (formats.some(f => f.bonusType === "has" && !f.bonusName)) {
    showToast("形態別特典名を入力してください");
    return;
  }

  if (cdDraft.earlyBonusEnabled && !cdDraft.earlyBonusName.trim()) {
    showToast("共通早期予約特典名を入力してください");
    return;
  }

  const newCD = {
    id: cdDraft.id || uid("cd"),
    artistId: cdDraft.artistId,
    title: cdDraft.title.trim(),
    releaseDate: cdDraft.releaseDate,
    image: cdDraft.image || "",
    memo: cdDraft.memo || "",
    formats,
    earlyBonusEnabled: !!cdDraft.earlyBonusEnabled,
    earlyBonusName: cdDraft.earlyBonusName.trim(),
    createdAt: cdDraft.createdAt || new Date().toISOString()
  };

  const idx = db.cds.findIndex(c => c.id === newCD.id);
  if (idx >= 0) db.cds[idx] = newCD;
  else db.cds.push(newCD);

  saveDB();
  selectedCDId = newCD.id;
  cdDraft = null;
  showToast(idx >= 0 ? "CDを更新しました" : "CDを登録しました");
  navigate("cdDetail");
}

function startNewReservation(cdId = null) {
  if (!db.cds.length) {
    showToast("先にCDを登録してください");
    navigate("cdAdd");
    return;
  }

  reservationDraft = {
    cdId: cdId || db.cds[0].id,
    items: {},
    bonusType: "none",
    bonusFormatId: "",
    store: "",
    orderMethod: "store",
    receiveMethod: "store",
    paymentStatus: "unpaid",
    shippingEnabled: false,
    shippingFee: 0,
    pointsEnabled: false,
    pointsUsed: 0,
    reservationDate: today(),
    memo: ""
  };

  const cd = cdById(reservationDraft.cdId);
  cd.formats.forEach(f => reservationDraft.items[f.id] = 0);
  navigate("reservationAdd");
}

function renderReservationAdd() {
  if (!reservationDraft) startNewReservation();
  const d = reservationDraft;
  const cd = cdById(d.cdId);

  if (!cd) {
    reservationDraft = null;
    return renderCDs();
  }

  const totals = calculateReservation(d, cd);

  return `
    ${pageHeader("予約登録", true)}
    <main class="page">
      <div class="card">
        <div class="form-group">
          <label class="form-label required">CD</label>
          <select onchange="changeReservationCD(this.value)">
            ${db.cds.map(c => `
              <option value="${c.id}" ${c.id === d.cdId ? "selected" : ""}>
                ${escapeHtml(artistById(c.artistId)?.name || "")} ／ ${escapeHtml(c.title)}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="divider"></div>

        <h2 class="section-title" style="margin-top:0">形態・数量</h2>
        ${cd.formats.map(f => `
          <div class="format-box">
            <div class="row-between">
              <div>
                <strong>${escapeHtml(f.name)}</strong>
                <div class="small muted">${yen(f.price)}</div>
              </div>
              <div class="qty-control">
                <button onclick="changeQty('${f.id}', -1)">−</button>
                <input type="number" min="0" value="${Number(d.items[f.id] || 0)}"
                       onchange="setQty('${f.id}', this.value)">
                <button onclick="changeQty('${f.id}', 1)">＋</button>
              </div>
            </div>
          </div>
        `).join("")}

        <div class="small muted">
          合計枚数：${totals.quantity}枚 ／ 商品小計：${yen(totals.subtotal)}
        </div>
      </div>

      <div class="card">
        <h2 class="section-title" style="margin-top:0">特典</h2>
        <div class="radio-group">
          ${cd.earlyBonusEnabled ? `
            <label class="choice">
              <input type="radio" name="reservationBonus" value="early"
                     ${d.bonusType === "early" ? "checked" : ""}
                     onchange="setReservationBonus('early')">
              <span>共通早期予約特典</span>
            </label>
          ` : ""}
          ${cd.formats.some(f => f.bonusType === "has") ? `
            <label class="choice">
              <input type="radio" name="reservationBonus" value="format"
                     ${d.bonusType === "format" ? "checked" : ""}
                     onchange="setReservationBonus('format')">
              <span>形態別特典</span>
            </label>
          ` : ""}
          <label class="choice">
            <input type="radio" name="reservationBonus" value="none"
                   ${d.bonusType === "none" ? "checked" : ""}
                   onchange="setReservationBonus('none')">
            <span>特典なし</span>
          </label>
        </div>

        ${d.bonusType === "early" ? `
          <div class="notice" style="margin-top:10px">
            ${escapeHtml(cd.earlyBonusName || "共通早期予約特典")}
          </div>
        ` : ""}

        ${d.bonusType === "format" ? `
          <div style="margin-top:10px">
            <label class="form-label">どの形態の特典か</label>
            <select onchange="reservationDraft.bonusFormatId=this.value">
              <option value="">選択してください</option>
              ${cd.formats.filter(f => f.bonusType === "has").map(f => `
                <option value="${f.id}" ${d.bonusFormatId === f.id ? "selected" : ""}>
                  ${escapeHtml(f.name)}：${escapeHtml(f.bonusName)}
                </option>
              `).join("")}
            </select>
          </div>
        ` : ""}
      </div>

      <div class="card">
        <h2 class="section-title" style="margin-top:0">購入・受取</h2>

        <div class="form-group">
          <label class="form-label">店舗・サイト</label>
          <input id="reservationStore" type="text" value="${escapeHtml(d.store)}" placeholder="例：タワーレコード">
        </div>

        <div class="form-group">
          <label class="form-label">注文方法</label>
          <div class="radio-group">
            <label class="choice"><input type="radio" name="orderMethod" ${d.orderMethod === "store" ? "checked" : ""} onchange="reservationDraft.orderMethod='store'"><span>店舗</span></label>
            <label class="choice"><input type="radio" name="orderMethod" ${d.orderMethod === "online" ? "checked" : ""} onchange="reservationDraft.orderMethod='online'"><span>オンライン</span></label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">受取方法</label>
          <div class="radio-group">
            <label class="choice"><input type="radio" name="receiveMethod" ${d.receiveMethod === "store" ? "checked" : ""} onchange="reservationDraft.receiveMethod='store'"><span>店頭受取</span></label>
            <label class="choice"><input type="radio" name="receiveMethod" ${d.receiveMethod === "delivery" ? "checked" : ""} onchange="reservationDraft.receiveMethod='delivery'"><span>配送</span></label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">支払い状況</label>
          <div class="radio-group">
            <label class="choice"><input type="radio" name="paymentStatus" ${d.paymentStatus === "paid" ? "checked" : ""} onchange="reservationDraft.paymentStatus='paid'"><span>支払い済み</span></label>
            <label class="choice"><input type="radio" name="paymentStatus" ${d.paymentStatus === "unpaid" ? "checked" : ""} onchange="reservationDraft.paymentStatus='unpaid'"><span>未払い</span></label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">送料</label>
          <div class="check-group">
            <label class="choice">
              <input type="checkbox" ${d.shippingEnabled ? "checked" : ""} onchange="reservationDraft.shippingEnabled=this.checked; render()">
              <span>送料あり</span>
            </label>
          </div>
          ${d.shippingEnabled ? `
            <div style="margin-top:10px">
              <input type="number" min="0" value="${Number(d.shippingFee || 0)}" placeholder="送料"
                     onchange="reservationDraft.shippingFee=Number(this.value||0); render()">
            </div>
          ` : ""}
        </div>

        <div class="form-group">
          <label class="form-label">ポイント</label>
          <div class="check-group">
            <label class="choice">
              <input type="checkbox" ${d.pointsEnabled ? "checked" : ""} onchange="reservationDraft.pointsEnabled=this.checked; render()">
              <span>ポイントを使用</span>
            </label>
          </div>
          ${d.pointsEnabled ? `
            <div style="margin-top:10px">
              <input type="number" min="0" value="${Number(d.pointsUsed || 0)}" placeholder="使用ポイント"
                     onchange="reservationDraft.pointsUsed=Number(this.value||0); render()">
            </div>
          ` : ""}
        </div>

        <div class="form-group">
          <label class="form-label">予約日</label>
          <input type="date" value="${escapeHtml(d.reservationDate)}" onchange="reservationDraft.reservationDate=this.value">
        </div>

        <div class="form-group">
          <label class="form-label">メモ</label>
          <textarea id="reservationMemo" placeholder="自由にメモ">${escapeHtml(d.memo)}</textarea>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title" style="margin-top:0">金額</h2>
        <div class="total-box">
          <div class="total-line"><span>商品小計</span><strong>${yen(totals.subtotal)}</strong></div>
          <div class="total-line"><span>送料</span><strong>${yen(totals.shipping)}</strong></div>
          <div class="total-line"><span>ポイント</span><strong>−${yen(totals.points)}</strong></div>
          <div class="total-line grand"><span>合計</span><strong>${yen(totals.total)}</strong></div>
        </div>
      </div>

      <div class="sticky-actions">
        <button class="btn btn-primary full" onclick="saveReservation()">予約を保存する</button>
      </div>
    </main>
  `;
}

function changeReservationCD(id) {
  const old = reservationDraft;
  const cd = cdById(id);
  if (!cd) return;

  reservationDraft = {
    ...old,
    cdId: id,
    items: {},
    bonusType: "none",
    bonusFormatId: ""
  };
  cd.formats.forEach(f => reservationDraft.items[f.id] = 0);
  render();
}

function changeQty(formatId, delta) {
  const current = Number(reservationDraft.items[formatId] || 0);
  reservationDraft.items[formatId] = Math.max(0, current + delta);
  render();
}

function setQty(formatId, value) {
  reservationDraft.items[formatId] = Math.max(0, Number(value || 0));
  render();
}

function setReservationBonus(type) {
  reservationDraft.bonusType = type;
  if (type !== "format") reservationDraft.bonusFormatId = "";
  render();
}

function calculateReservation(d, cd) {
  const quantity = cd.formats.reduce((sum, f) => sum + Number(d.items[f.id] || 0), 0);
  const subtotal = cd.formats.reduce((sum, f) => sum + Number(f.price || 0) * Number(d.items[f.id] || 0), 0);
  const shipping = d.shippingEnabled ? Number(d.shippingFee || 0) : 0;
  const points = d.pointsEnabled ? Number(d.pointsUsed || 0) : 0;
  const total = Math.max(0, subtotal + shipping - points);

  return { quantity, subtotal, shipping, points, total };
}

function saveReservation() {
  const store = document.getElementById("reservationStore");
  const memo = document.getElementById("reservationMemo");
  if (store) reservationDraft.store = store.value.trim();
  if (memo) reservationDraft.memo = memo.value.trim();

  const cd = cdById(reservationDraft.cdId);
  if (!cd) return;

  const totals = calculateReservation(reservationDraft, cd);

  if (totals.quantity <= 0) {
    showToast("予約する枚数を1枚以上にしてください");
    return;
  }

  if (reservationDraft.bonusType === "format" && !reservationDraft.bonusFormatId) {
    showToast("形態別特典を選択してください");
    return;
  }

  const reservation = {
    id: editingReservationId || uid("res"),
    orderNumber: editingReservationId
      ? reservationById(editingReservationId)?.orderNumber
      : makeOrderNumber(),
    cdId: reservationDraft.cdId,
    items: cd.formats.map(f => ({
      formatId: f.id,
      quantity: Number(reservationDraft.items[f.id] || 0)
    })).filter(i => i.quantity > 0),
    bonusType: reservationDraft.bonusType,
    bonusFormatId: reservationDraft.bonusFormatId || "",
    store: reservationDraft.store,
    orderMethod: reservationDraft.orderMethod,
    receiveMethod: reservationDraft.receiveMethod,
    paymentStatus: reservationDraft.paymentStatus,
    shippingEnabled: reservationDraft.shippingEnabled,
    shippingFee: Number(reservationDraft.shippingFee || 0),
    pointsEnabled: reservationDraft.pointsEnabled,
    pointsUsed: Number(reservationDraft.pointsUsed || 0),
    reservationDate: reservationDraft.reservationDate,
    memo: reservationDraft.memo,
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    points: totals.points,
    total: totals.total,
    status: editingReservationId
      ? (reservationById(editingReservationId)?.status || "reserved")
      : "reserved",
    createdAt: editingReservationId
      ? reservationById(editingReservationId)?.createdAt
      : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const idx = db.reservations.findIndex(r => r.id === reservation.id);
  if (idx >= 0) db.reservations[idx] = reservation;
  else db.reservations.push(reservation);

  saveDB();
  editingReservationId = reservation.id;
  reservationDraft = null;
  showToast(idx >= 0 ? "予約を更新しました" : "予約を保存しました");
  navigate("reservationDetail");
}

function makeOrderNumber() {
  const date = today().replaceAll("-", "");
  const num = activeReservations().length + 1;
  return `R-${date}-${String(num).padStart(3, "0")}`;
}

function reservationCard(r) {
  const cd = cdById(r.cdId);
  if (!cd) return "";
  const artist = artistById(cd.artistId);
  const items = r.items.map(item => {
    const f = cd.formats.find(x => x.id === item.formatId);
    return `${escapeHtml(f?.name || "")} × ${item.quantity}`;
  }).join(" / ");

  return `
    <div class="card clickable" onclick="openReservation('${r.id}')">
      <div class="row-between">
        <div>
          <div class="card-title">${escapeHtml(cd.title)}</div>
          <div class="card-subtitle">${escapeHtml(artist?.name || "")} ／ ${formatDate(r.reservationDate)}</div>
        </div>
        <span class="pill ${r.status === "received" ? "pill-success" : "pill-warning"}">
          ${r.status === "received" ? "受け取り済み" : "予約済み"}
        </span>
      </div>
      <div class="divider"></div>
      <div class="small">${items}</div>
      <div style="height:7px"></div>
      <div class="row-between">
        <span class="small">${r.paymentStatus === "paid" ? "支払い済み" : "未払い"}</span>
        <strong>${yen(r.total)}</strong>
      </div>
    </div>
  `;
}

function renderReservations() {
  return `
    ${pageHeader("予約一覧")}
    <main class="page">
      <div class="card">
        <div class="form-group">
          <input id="reservationSearch" type="text" placeholder="CD名・アーティスト名・店舗で検索" oninput="filterReservations()">
        </div>

        <div class="grid-2">
          <select id="reservationStatusFilter" onchange="filterReservations()">
            <option value="all">予約状況：すべて</option>
            <option value="reserved">予約済み</option>
            <option value="received">受け取り済み</option>
          </select>
          <select id="reservationPaymentFilter" onchange="filterReservations()">
            <option value="all">支払い：すべて</option>
            <option value="paid">支払い済み</option>
            <option value="unpaid">未払い</option>
          </select>
        </div>
      </div>

      <div id="reservationCards">
        ${renderReservationCards(activeReservations())}
      </div>
    </main>
    ${bottomNav("reservations")}
  `;
}

function renderReservationCards(list) {
  const sorted = [...list].sort((a,b) => (b.reservationDate || "").localeCompare(a.reservationDate || ""));
  if (!sorted.length) {
    return `<div class="card empty"><div class="empty-icon">📭</div>条件に一致する予約がありません。</div>`;
  }
  return sorted.map(reservationCard).join("");
}

function filterReservations() {
  const q = document.getElementById("reservationSearch")?.value.trim().toLowerCase() || "";
  const status = document.getElementById("reservationStatusFilter")?.value || "all";
  const payment = document.getElementById("reservationPaymentFilter")?.value || "all";

  const list = activeReservations().filter(r => {
    const cd = cdById(r.cdId);
    const artist = cd ? artistById(cd.artistId) : null;
    const text = `${cd?.title || ""} ${artist?.name || ""} ${r.store || ""}`.toLowerCase();

    return (
      text.includes(q) &&
      (status === "all" || r.status === status) &&
      (payment === "all" || r.paymentStatus === payment)
    );
  });

  document.getElementById("reservationCards").innerHTML = renderReservationCards(list);
}

function openReservation(id) {
  editingReservationId = id;
  navigate("reservationDetail");
}

function renderReservationDetail() {
  const r = reservationById(editingReservationId);
  if (!r) return renderReservations();

  const cd = cdById(r.cdId);
  if (!cd) return renderReservations();

  const artist = artistById(cd.artistId);
  const bonusText =
    r.bonusType === "early"
      ? cd.earlyBonusName || "共通早期予約特典"
      : r.bonusType === "format"
        ? (() => {
            const f = cd.formats.find(x => x.id === r.bonusFormatId);
            return f ? `${f.name}：${f.bonusName}` : "形態別特典";
          })()
        : "特典なし";

  return `
    ${pageHeader("予約詳細", true)}
    <main class="page">
      <div class="card">
        <div class="row-between">
          <div>
            <div class="small muted">${escapeHtml(r.orderNumber)}</div>
            <h2 class="card-title">${escapeHtml(cd.title)}</h2>
            <div class="card-subtitle">${escapeHtml(artist?.name || "")}</div>
          </div>
          <span class="pill ${r.status === "received" ? "pill-success" : "pill-warning"}">
            ${r.status === "received" ? "受け取り済み" : "予約済み"}
          </span>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title" style="margin-top:0">予約内容</h2>
        ${r.items.map(item => {
          const f = cd.formats.find(x => x.id === item.formatId);
          return `
            <div class="summary-row">
              <span>${escapeHtml(f?.name || "")}</span>
              <strong>${item.quantity}枚 × ${yen(f?.price || 0)}</strong>
            </div>
          `;
        }).join("")}
        <div class="summary-row"><span>特典</span><strong>${escapeHtml(bonusText)}</strong></div>
        <div class="summary-row"><span>予約日</span><strong>${formatDate(r.reservationDate)}</strong></div>
      </div>

      <div class="card">
        <h2 class="section-title" style="margin-top:0">購入・受取</h2>
        <div class="summary-list">
          <div class="summary-row"><span>店舗・サイト</span><strong>${escapeHtml(r.store || "-")}</strong></div>
          <div class="summary-row"><span>注文方法</span><strong>${r.orderMethod === "online" ? "オンライン" : "店舗"}</strong></div>
          <div class="summary-row"><span>受取方法</span><strong>${r.receiveMethod === "delivery" ? "配送" : "店頭受取"}</strong></div>
          <div class="summary-row"><span>支払い</span><strong>${r.paymentStatus === "paid" ? "支払い済み" : "未払い"}</strong></div>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title" style="margin-top:0">金額</h2>
        <div class="total-box">
          <div class="total-line"><span>商品小計</span><strong>${yen(r.subtotal)}</strong></div>
          <div class="total-line"><span>送料</span><strong>${yen(r.shipping)}</strong></div>
          <div class="total-line"><span>ポイント</span><strong>−${yen(r.points)}</strong></div>
          <div class="total-line grand"><span>合計</span><strong>${yen(r.total)}</strong></div>
        </div>
      </div>

      ${r.memo ? `<div class="card"><h2 class="section-title" style="margin-top:0">メモ</h2><div class="small">${escapeHtml(r.memo)}</div></div>` : ""}

      <div class="row wrap">
        ${r.status === "reserved" ? `
          <button class="btn btn-primary full" onclick="confirmReceive('${r.id}')">受け取り完了</button>
        ` : ""}
        <button class="btn full" onclick="editReservation('${r.id}')">予約を編集</button>
        ${r.status === "reserved" ? `
          <button class="btn btn-danger full" onclick="confirmCancelReservation('${r.id}')">予約を取り消す</button>
        ` : ""}
      </div>
    </main>
  `;
}

function editReservation(id) {
  const r = reservationById(id);
  if (!r) return;
  reservationDraft = {
    cdId: r.cdId,
    items: {},
    bonusType: r.bonusType,
    bonusFormatId: r.bonusFormatId || "",
    store: r.store || "",
    orderMethod: r.orderMethod || "store",
    receiveMethod: r.receiveMethod || "store",
    paymentStatus: r.paymentStatus || "unpaid",
    shippingEnabled: !!r.shippingEnabled,
    shippingFee: Number(r.shippingFee || 0),
    pointsEnabled: !!r.pointsEnabled,
    pointsUsed: Number(r.pointsUsed || 0),
    reservationDate: r.reservationDate || today(),
    memo: r.memo || ""
  };

  const cd = cdById(r.cdId);
  cd.formats.forEach(f => {
    const item = r.items.find(x => x.formatId === f.id);
    reservationDraft.items[f.id] = item?.quantity || 0;
  });

  editingReservationId = id;
  navigate("reservationAdd");
}

function confirmReceive(id) {
  showModal(`
    <h2>受け取り完了に変更しますか？</h2>
    <p class="muted small">
      この操作を行うと、予約状況が「受け取り済み」に変更されます。<br>
      よろしいですか？
    </p>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">キャンセル</button>
      <button class="btn btn-primary" onclick="completeReceive('${id}')">受け取り完了</button>
    </div>
  `);
}

function completeReceive(id) {
  const r = reservationById(id);
  if (!r) return;
  r.status = "received";
  r.updatedAt = new Date().toISOString();
  saveDB();
  closeModal();
  showToast("受け取り済みに変更しました");
  render();
}

function confirmCancelReservation(id) {
  showModal(`
    <h2>予約を取り消しますか？</h2>
    <p class="muted small">
      この予約は通常の予約一覧・集計から除外されます。<br>
      本当に取り消してよいですか？
    </p>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">キャンセル</button>
      <button class="btn btn-danger" onclick="cancelReservation('${id}')">予約を取り消す</button>
    </div>
  `);
}

function cancelReservation(id) {
  const r = reservationById(id);
  if (!r) return;
  r.status = "cancelled";
  r.updatedAt = new Date().toISOString();
  saveDB();
  closeModal();
  showToast("予約を取り消しました");
  currentPage = "reservations";
  pageStack = [];
  render();
}

function renderMenu() {
  return `
    ${pageHeader("メニュー")}
    <main class="page">
      <div class="card">
        <h2 class="section-title" style="margin-top:0">データについて</h2>
        <div class="notice">
          このアプリでは、アーティスト・CD・予約データをこのブラウザのlocalStorageに保存しています。
        </div>
        <div style="height:10px"></div>
        <div class="small muted">
          同じURLを別の人が開いても、その人のブラウザには別のデータとして保存されます。
          ただし、同じ人がスマートフォンとPCで使った場合も、それぞれ別データになります。
        </div>
      </div>

      <div class="card">
        <h2 class="section-title" style="margin-top:0">データ管理</h2>
        <button class="btn full" onclick="exportData()">データを書き出す</button>
        <div style="height:8px"></div>
        <button class="btn full" onclick="document.getElementById('importFile').click()">データを読み込む</button>
        <input id="importFile" type="file" accept="application/json" style="display:none" onchange="importData(event)">
        <div style="height:8px"></div>
        <button class="btn btn-danger full" onclick="confirmClearData()">すべてのデータを削除</button>
      </div>

      <div class="card">
        <h2 class="section-title" style="margin-top:0">登録状況</h2>
        <div class="summary-row"><span>アーティスト</span><strong>${db.artists.length}件</strong></div>
        <div class="summary-row"><span>CD</span><strong>${db.cds.length}件</strong></div>
        <div class="summary-row"><span>有効な予約</span><strong>${activeReservations().length}件</strong></div>
        <div class="summary-row"><span>取り消し済み</span><strong>${db.reservations.filter(r => r.status === "cancelled").length}件</strong></div>
      </div>
    </main>
    ${bottomNav("menu")}
  `;
}

function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cd予約管理バックアップ_${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("データを書き出しました");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported || !Array.isArray(imported.artists) || !Array.isArray(imported.cds) || !Array.isArray(imported.reservations)) {
        throw new Error("invalid");
      }
      db = imported;
      saveDB();
      showToast("データを読み込みました");
      render();
    } catch {
      showToast("正しいバックアップファイルではありません");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function confirmClearData() {
  showModal(`
    <h2>すべてのデータを削除しますか？</h2>
    <p class="muted small">
      アーティスト、CD、予約のすべてがこのブラウザから削除されます。<br>
      必要なら先に「データを書き出す」でバックアップしてください。
    </p>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">キャンセル</button>
      <button class="btn btn-danger" onclick="clearData()">すべて削除</button>
    </div>
  `);
}

function clearData() {
  db = structuredClone(defaultDB);
  saveDB();
  closeModal();
  currentPage = "home";
  pageStack = [];
  showToast("データを削除しました");
  render();
}

function showModal(html) {
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) closeModal()">
      <div class="modal">${html}</div>
    </div>
  `;
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function showToast(message) {
  const root = document.getElementById("toastRoot");
  root.innerHTML = `<div class="toast">${escapeHtml(message)}</div>`;
  setTimeout(() => {
    root.innerHTML = "";
  }, 2200);
}

window.addEventListener("load", () => {
  render();
});
