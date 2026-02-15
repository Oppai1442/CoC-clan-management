/****************
 * Author: Oppai1442
 * Oppai REST-ish Web API for Google Sheets
 ****************/

function doGet(e) {
  try {
    const req = buildReq_(e);
    const route = req.path;

    if (route === "/api/v1/health") return jsonOut_({ ok: true, ts: new Date().toISOString() });
    if (route === "/api/v1/member-events") return handleMemberEvents_(req);
    if (route === "/api/v1/war/history") return handleWarHistory_(req);
    if (route === "/api/v1/war/members") return handleWarMembers_(req);
    if (route === "/api/v1/war/attacks") return handleWarAttacks_(req);
    if (route === "/api/v1/war/stats-current") return handleWarStatsCurrent_(req);
    if (route === "/api/v1/war/recommend") return handleWarRecommend_(req);
    if (route === "/api/v1/cwl/season-history") return handleCwlSeasonHistory_(req);
    if (route === "/api/v1/cwl/rounds") return handleCwlRounds_(req);
    if (route === "/api/v1/cwl/round-members") return handleCwlRoundMembers_(req);
    if (route === "/api/v1/cwl/round-attacks") return handleCwlRoundAttacks_(req);
    if (route === "/api/v1/raid/seasons") return handleRaidSeasons_(req);
    if (route === "/api/v1/raid/members") return handleRaidMembers_(req);
    
    // Management & Auth
    if (route === "/api/v1/clan/members") return handleClanMembers_(req);
    if (route === "/api/v1/player/search") return handlePlayerSearch_(req);
    if (route === "/api/v1/player/verify") return handlePlayerVerify_(req);
    if (route === "/api/v1/player/list-current") return handlePlayerListCurrent_(req);
    if (route === "/api/v1/clan/sync-live") return handleClanSyncLive_(req);
    if (route === "/api/v1/player/add-note") return handlePlayerAddNote_(req);
    if (route === "/api/v1/player/delete-note") return handlePlayerDeleteNote_(req);

    return jsonOut_({
      ok: false,
      error: "Unknown route: " + route,
      hint: ["/api/v1/health", "/api/v1/clan/members", "/api/v1/player/add-note", "/api/v1/player/delete-note"]
    });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* =========================
 * Handlers
 * ========================= */

function handleMemberEvents_(req) {
  const raw = readSheetObjects_("MemberEvents", req, { strategy: "append", defaultSortBy: "ts", defaultSortDir: "desc" });
  const rows = raw.rows.map(r => shapeMemberEvent_(r));
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "member-events", nextCursor: raw.nextCursor, totalAfterFilter: raw.totalAfterFilter, rows });
}

function handleWarHistory_(req) {
  const raw = readSheetObjects_("WarHistory", req, { strategy: "append", defaultSortBy: "endTime", defaultSortDir: "desc" });
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "war-history", nextCursor: raw.nextCursor, totalAfterFilter: raw.totalAfterFilter, rows: raw.rows });
}

function handleWarMembers_(req) {
  handleLatestWarKeyParam_(req);
  const raw = readSheetObjects_("WarMembers", req, { strategy: "append", defaultSortBy: "ts", defaultSortDir: "desc" });
  const rows = raw.rows.map(r => ({
    warKey: r.warKey, warType: r.warType, playerTag: r.playerTag, playerName: r.playerName,
    mapPosition: r.mapPosition, attacksDone: num_(r.attacksDone), attacksRequired: num_(r.attacksRequired),
    starsTotal: num_(r.starsTotal), bestDestruction: num_(r.bestDestruction), missingAttacks: num_(r.missingAttacks),
    participationRate: rate_(num_(r.attacksDone), num_(r.attacksRequired))
  }));
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "war-members", nextCursor: raw.nextCursor, totalAfterFilter: raw.totalAfterFilter, rows });
}

function handleWarAttacks_(req) {
  handleLatestWarKeyParam_(req);
  const raw = readSheetObjects_("WarAttacks", req, { strategy: "append", defaultSortBy: "warKey", defaultSortDir: "desc" });
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "war-attacks", nextCursor: raw.nextCursor, totalAfterFilter: raw.totalAfterFilter, rows: raw.rows });
}

function handleWarStatsCurrent_(req) {
  const members = readAllSheetObjects_("MembersCurrent");
  const stats = readAllSheetObjects_("WarStats");
  const memMap = new Map();
  members.forEach(m => { if (m.playerTag) memMap.set(String(m.playerTag).trim(), m); });

  let rows = stats
    .map(s => normalizeWarStatsRow_(s))
    .filter(s => memMap.has(s.playerTag))
    .map(s => {
      const m = memMap.get(s.playerTag);
      return {
        playerTag: s.playerTag, playerName: m.name || s.playerName || "", roleVi: roleVi_(m.role),
        cw_wars_joined: s.cw_wars_joined, cw_attacks_done: s.cw_attacks_done, cw_missed_attacks: s.cw_missed_attacks,
        cwl_seasons_joined: s.cwl_seasons_joined, cwl_rounds_present: s.cwl_rounds_present, cwl_attacks_done: s.cwl_attacks_done, cwl_missed_attacks: s.cwl_missed_attacks,
        overall_attacks_done: s.overall_attacks_done, overall_missed_attacks: s.overall_missed_attacks,
      };
    });

  const sortBy = String(req.params.sortBy || "overall_attacks_done").trim();
  const sortDir = (String(req.params.sortDir || "desc").toLowerCase() === "asc") ? "asc" : "desc";
  rows.sort((a, b) => compareSmart_(a[sortBy], b[sortBy], sortDir));

  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "war-stats-current", total: rows.length, rows });
}

function handleWarRecommend_(req) {
  const size = clampInt_(req.params.size, 15, 1, 50);
  const type = String(req.params.type || "cw").toLowerCase();
  const alpha = clampInt_(req.params.alpha, 2, 0, 100);
  const beta = clampInt_(req.params.beta, 2, 0, 100);
  const k = clampInt_(req.params.k, 10, 0, 1000);
  const kWars = clampInt_(req.params.kWars, 5, 0, 1000);
  const includeNoHistory = String(req.params.includeNoHistory || "false").toLowerCase() === "true";
  const excludeSet = new Set(parseCsvList_(req.params.exclude).map(x => String(x).trim()));
  const resetLock = String(req.params.resetLock || "false").toLowerCase() === "true";

  const members = readAllSheetObjects_("MembersCurrent");
  const stats = readAllSheetObjects_("WarStats").map(normalizeWarStatsRow_);
  const statMap = new Map();
  stats.forEach(s => { if (s.playerTag) statMap.set(s.playerTag, s); });

  const currentMemberTags = members.map(m => String(m.playerTag || "").trim()).filter(Boolean);
  let poolTags = currentMemberTags;

  if (type === "cwl") {
    const seasonKey = String(req.params.seasonKey || "").trim() || getActiveCwlSeasonKey_();
    const lockMeta = loadOrInitCwlRosterLock_(seasonKey || "CWL_UNKNOWN", currentMemberTags, resetLock);
    const currSet = new Set(currentMemberTags);
    poolTags = lockMeta.tags.filter(t => currSet.has(t));
  }

  const candidates = [];
  const noHistory = [];
  const memInfo = new Map();
  members.forEach(m => { if (m.playerTag) memInfo.set(String(m.playerTag).trim(), m); });

  poolTags.forEach(tag => {
    if (!tag || excludeSet.has(tag)) return;
    const mi = memInfo.get(tag) || { name: "", role: "" };
    const s = statMap.get(tag);
    if (!s) {
      const item = { playerTag: tag, playerName: mi.name, role: mi.role, roleVi: roleVi_(mi.role), score: 0, reason: "no_history" };
      (includeNoHistory ? candidates : noHistory).push(item);
      return;
    }

    const pack = pickStatPack_(s, type);
    const done = pack.done, reqd = pack.required, warsJoined = pack.warsJoined;
    const missed = Math.max(0, reqd - done);
    const smoothedRate = (reqd > 0) ? (done + alpha) / (reqd + alpha + beta) : (alpha + beta > 0 ? alpha / (alpha + beta) : 0);
    const confidenceAttacks = (reqd > 0) ? (reqd / (reqd + k)) : 0;
    const confidenceWars = (warsJoined > 0) ? (warsJoined / (warsJoined + kWars)) : 0;
    const missPenalty = 1 / (1 + missed);
    const confidence = (0.7 * confidenceAttacks + 0.3 * confidenceWars);
    const score = clamp01_(smoothedRate * confidence * missPenalty);

    candidates.push({
      playerTag: tag, playerName: mi.name || s.playerName || "", role: mi.role, roleVi: roleVi_(mi.role),
      type, attacksDone: done, attacksRequired: reqd, missedAttacks: missed, warsJoined,
      smoothedRate: round3_(smoothedRate), confidenceAttacks: round3_(confidenceAttacks), confidenceWars: round3_(confidenceWars),
      missPenalty: round3_(missPenalty), score: round3_(score), scorePct: Math.round(score * 1000) / 10, note: scoreNote_(score, reqd, warsJoined)
    });
  });

  candidates.sort((a, b) => compareSmart_(a.score, b.score, "desc"));
  return jsonOut_({
    ok: true, ts: new Date().toISOString(), resource: "war-recommend", type,
    picked: candidates.slice(0, size).map((x, i) => ({ rank: i + 1, ...x })),
    bench: candidates.slice(size).map((x, i) => ({ rank: size + i + 1, ...x })),
    noHistory: includeNoHistory ? [] : noHistory
  });
}

function handleCwlSeasonHistory_(req) {
  const raw = readSheetObjects_("CWLSeasonHistory", req, { strategy: "replace", defaultSortBy: "season", defaultSortDir: "desc" });
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "cwl-season-history", totalAfterFilter: raw.totalAfterFilter, rows: raw.rows });
}

function handleCwlRounds_(req) {
  const raw = readSheetObjects_("CWLRounds", req, { strategy: "append", defaultSortBy: "roundIndex", defaultSortDir: "asc" });
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "cwl-rounds", nextCursor: raw.nextCursor, totalAfterFilter: raw.totalAfterFilter, rows: raw.rows });
}

function handleCwlRoundMembers_(req) {
  const raw = readSheetObjects_("CWLRoundMembers", req, { strategy: "append", defaultSortBy: "ts", defaultSortDir: "desc" });
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "cwl-round-members", nextCursor: raw.nextCursor, totalAfterFilter: raw.totalAfterFilter, rows: raw.rows });
}

function handleCwlRoundAttacks_(req) {
  const raw = readSheetObjects_("CWLRoundAttacks", req, { strategy: "append", defaultSortBy: "roundIndex", defaultSortDir: "desc" });
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "cwl-round-attacks", nextCursor: raw.nextCursor, totalAfterFilter: raw.totalAfterFilter, rows: raw.rows });
}

function handleRaidSeasons_(req) {
  const raw = readSheetObjects_("RaidSeasons", req, { strategy: "append", defaultSortBy: "endTime", defaultSortDir: "desc" });
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "raid-seasons", nextCursor: raw.nextCursor, totalAfterFilter: raw.totalAfterFilter, rows: raw.rows });
}

function handleRaidMembers_(req) {
  const raw = readSheetObjects_("RaidMembers", req, { strategy: "append", defaultSortBy: "raidId", defaultSortDir: "desc" });
  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "raid-members", nextCursor: raw.nextCursor, totalAfterFilter: raw.totalAfterFilter, rows: raw.rows });
}

/* =========================
 * Management Handlers
 * ========================= */

function handleClanMembers_(req) {
  const authTag = String(req.params.authTag || "").trim();
  const raw = readSheetObjects_("MembersCurrent", req, { strategy: "replace", defaultSortBy: "townHallLevel", defaultSortDir: "desc" });

  const allMems = readAllSheetObjects_("MembersCurrent");
  const requester = allMems.find(m => String(m.playerTag) === authTag);
  const isManagement = requester && (requester.role === "coLeader" || requester.role === "leader");

  const rows = raw.rows.map(r => {
    const item = {
      playerTag: r.playerTag, name: r.name, role: r.role,
      townHallLevel: r.townHallLevel, warStars: r.warStars,
      memberNote: r.memberNote, lastUpdated: r.ts
    };
    // ONLY show adminNote if requester is management
    item.adminNote = isManagement ? r.adminNote : "";
    return item;
  });

  return jsonOut_({ ok: true, ts: new Date().toISOString(), resource: "clan-members", totalAfterFilter: raw.totalAfterFilter, rows });
}

function handlePlayerSearch_(req) {
  const q = String(req.params.q || "").toLowerCase().trim();
  if (!q) return jsonOut_({ ok: false, error: "Missing query" });
  const normalize = (str) => String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const normalizedQ = normalize(q);
  const members = readAllSheetObjects_("MembersCurrent");
  const filtered = members.filter(m => {
    const tag = String(m.playerTag || "").toLowerCase();
    if (tag === q || tag === "#" + q) return true;
    return normalize(m.name).includes(normalizedQ);
  }).map(m => ({ tag: m.playerTag, name: m.name, role: m.role, th: m.townHallLevel }));
  return jsonOut_({ ok: true, rows: filtered });
}

function handlePlayerVerify_(req) {
  const tag = String(req.params.tag || "").trim(), token = String(req.params.token || "").trim();
  if (!tag || !token) return jsonOut_({ ok: false, error: "Missing tag/token" });
  const cfg = getCfg_();
  const url = cfg.baseUrl.replace(/\/$/, "") + "/players/" + encodeURIComponent(tag.startsWith("#") ? tag : "#" + tag) + "/verifytoken";
  try {
    const resp = UrlFetchApp.fetch(url, { method: "post", headers: { "Authorization": "Bearer " + cfg.token, "Content-Type": "application/json" }, payload: JSON.stringify({ token }), muteHttpExceptions: true });
    return jsonOut_({ ok: true, status: JSON.parse(resp.getContentText()).status });
  } catch (e) { return jsonOut_({ ok: false, error: String(e) }); }
}

function handlePlayerListCurrent_(req) {
  const members = readAllSheetObjects_("MembersCurrent");
  const rows = members.map(m => ({ tag: m.playerTag, name: m.name, role: m.role, th: m.townHallLevel }));
  return jsonOut_({ ok: true, rows });
}

function handleClanSyncLive_(req) {
  try { syncClanAndMembers_(getCfg_()); return jsonOut_({ ok: true }); }
  catch (e) { return jsonOut_({ ok: false, error: String(e) }); }
}

function handlePlayerAddNote_(req) {
  const { targetTag, message, authTag, authName, type } = req.params;
  if (!targetTag || !message || !authTag) return jsonOut_({ ok: false, error: "Missing params" });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("MembersCurrent");
  const headers = SHEETS.MembersCurrent.headers;
  const data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), headers.length).getValues();
  
  const authUser = data.find(r => String(r[headers.indexOf("playerTag")]) === authTag);
  if (!authUser) return jsonOut_({ ok: false, error: "Auth failed" });
  const isManagement = (authUser[headers.indexOf("role")] === "coLeader" || authUser[headers.indexOf("role")] === "leader");

  const targetIdx = data.findIndex(r => String(r[headers.indexOf("playerTag")]) === targetTag);
  if (targetIdx === -1) return jsonOut_({ ok: false, error: "Not found" });

  const now = new Date().toISOString();
  if (type === "admin") {
    if (!isManagement) return jsonOut_({ ok: false, error: "Only management can add admin notes" });
    const colIdx = headers.indexOf("adminNote");
    let notes = []; try { notes = JSON.parse(data[targetIdx][colIdx] || "[]"); } catch(e) {}
    notes.push({ message, time: now, user: [authTag, authName] });
    sh.getRange(targetIdx + 2, colIdx + 1).setValue(JSON.stringify(notes));
  } else {
    if (authTag !== targetTag) return jsonOut_({ ok: false, error: "Only you can add your own member note" });
    const colIdx = headers.indexOf("memberNote");
    let notes = []; try { notes = JSON.parse(data[targetIdx][colIdx] || "[]"); } catch(e) {}
    notes.push({ message, time: now });
    sh.getRange(targetIdx + 2, colIdx + 1).setValue(JSON.stringify(notes));
  }
  return jsonOut_({ ok: true });
}

function handlePlayerDeleteNote_(req) {
  const { targetTag, time, authTag, type } = req.params;
  if (!targetTag || !time || !authTag) return jsonOut_({ ok: false, error: "Missing params" });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("MembersCurrent");
  const headers = SHEETS.MembersCurrent.headers;
  const data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), headers.length).getValues();
  
  const authUser = data.find(r => String(r[headers.indexOf("playerTag")]) === authTag);
  if (!authUser) return jsonOut_({ ok: false, error: "Auth failed" });
  const isManagement = (authUser[headers.indexOf("role")] === "coLeader" || authUser[headers.indexOf("role")] === "leader");

  const targetIdx = data.findIndex(r => String(r[headers.indexOf("playerTag")]) === targetTag);
  if (targetIdx === -1) return jsonOut_({ ok: false, error: "Not found" });

  const colIdx = headers.indexOf(type === "admin" ? "adminNote" : "memberNote");
  if (type === "admin" && !isManagement) return jsonOut_({ ok: false, error: "Denied" });
  if (type === "member" && authTag !== targetTag && !isManagement) return jsonOut_({ ok: false, error: "Denied" });

  let notes = []; try { notes = JSON.parse(data[targetIdx][colIdx] || "[]"); } catch(e) {}
  const filtered = notes.filter(n => String(n.time) !== time);
  sh.getRange(targetIdx + 2, colIdx + 1).setValue(JSON.stringify(filtered));
  return jsonOut_({ ok: true });
}

/* =========================
 * Core Helpers
 * ========================= */

function readSheetObjects_(sheetName, req, opt) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName);
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 1) return { rows: [], totalAfterFilter: 0, nextCursor: 0 };
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const strategy = (opt.strategy || "append").toLowerCase();
  const limit = clampInt_(req.params.limit, 500, 0, 20000), offset = clampInt_(req.params.offset, 0, 0, 10000000);
  const filters = req.params.filters ? safeJsonParse_(req.params.filters) : null;
  const sortBy = req.params.sortBy || opt.defaultSortBy, sortDir = (req.params.sortDir || opt.defaultSortDir || "asc").toLowerCase();

  let startRow = 2, numRows = Math.max(0, lastRow - 1);
  if (strategy === "append") {
    const cursor = clampInt_(req.params.cursor, 0, 0, 10000000);
    const tail = clampInt_(req.params.tail, 2000, 0, 20000);
    if (cursor >= 2) { startRow = cursor + 1; numRows = Math.max(0, lastRow - startRow + 1); }
    else if (tail > 0) { startRow = Math.max(2, lastRow - tail + 1); numRows = Math.max(0, lastRow - startRow + 1); }
  }

  if (numRows <= 0) return { rows: [], headers, totalAfterFilter: 0, nextCursor: lastRow };
  let rows = sh.getRange(startRow, 1, numRows, lastCol).getValues().map(r => {
    const o = {}; headers.forEach((h, i) => o[h] = r[i] ?? ""); return o;
  });

  if (filters) rows = rows.filter(row => Object.keys(filters).every(col => matchFilterExpr_(row[col], String(filters[col]))));
  if (req.params.q) { const qq = req.params.q.toLowerCase(); rows = rows.filter(row => JSON.stringify(row).toLowerCase().includes(qq)); }
  if (sortBy) rows.sort((a, b) => compareSmart_(a[sortBy], b[sortBy], sortDir));

  const total = rows.length;
  if (offset > 0) rows = rows.slice(offset);
  if (limit > 0) rows = rows.slice(0, limit);
  return { rows, headers, totalAfterFilter: total, nextCursor: lastRow };
}

function readAllSheetObjects_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  return sh.getRange(2, 1, lastRow - 1, lastCol).getValues().map(r => {
    const o = {}; headers.forEach((h, i) => o[h] = r[i] ?? ""); return o;
  });
}

function handleLatestWarKeyParam_(req) {
  if (!req.params.filters) return;
  try {
    const f = JSON.parse(req.params.filters);
    if (f.warKey === "latest") {
      const history = readSheetObjects_("WarHistory", { params: { limit: 1, sortBy: "endTime", sortDir: "desc" } }, { strategy: "replace" });
      f.warKey = history.rows.length ? history.rows[0].warKey : null;
      req.params.filters = JSON.stringify(f);
    }
  } catch(e) {}
}

function buildReq_(e) {
  const params = e && e.parameter ? e.parameter : {};
  const path = (e && e.pathInfo ? "/" + e.pathInfo : params.path || "/").replace(/\/+$/, "") || "/";
  return { path, params };
}

function jsonOut_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function num_(x) { const n = Number(String(x ?? "").trim()); return isFinite(n) ? n : 0; }
function rate_(a, b) { return b > 0 ? a / b : 0; }
function clampInt_(v, def, min, max) { const n = parseInt(v, 10); return isFinite(n) ? Math.max(min, Math.min(max, n)) : def; }
function safeJsonParse_(s) { try { return JSON.parse(s); } catch(e) { return null; } }
function clamp01_(x) { return Math.max(0, Math.min(1, isFinite(x) ? x : 0)); }
function round3_(x) { return Math.round(clamp01_(x) * 1000) / 1000; }
function parseCsvList_(s) { return String(s || "").split(",").map(x => x.trim()).filter(Boolean); }

function matchFilterExpr_(cell, expr) {
  const m = String(expr).trim().match(/^(>=|<=|!=|=|>|<)\s*(.+)$/);
  if (!m) return String(cell ?? "").toLowerCase().includes(expr.toLowerCase());
  const op = m[1], rhs = m[2];
  const vn = tryParseNumber_(cell), rn = tryParseNumber_(rhs);
  if (vn != null && rn != null) return applyCompare_(vn, rn, op);
  return applyCompare_(String(cell ?? "").toLowerCase(), rhs.toLowerCase(), op);
}

function applyCompare_(a, b, op) {
  if (op === "=") return a === b; if (op === "!=") return a !== b;
  if (op === ">") return a > b; if (op === "<") return a < b;
  if (op === ">=") return a >= b; if (op === "<=") return a <= b;
  return false;
}

function compareSmart_(va, vb, dir) {
  const s = dir === "desc" ? -1 : 1;
  const na = tryParseNumber_(va), nb = tryParseNumber_(vb);
  if (na != null && nb != null) return s * (na - nb);
  return s * String(va).localeCompare(String(vb));
}

function tryParseNumber_(x) {
  const s = String(x ?? "").trim().replace(/%$/, "");
  return s && isFinite(Number(s)) ? Number(s) : null;
}

function roleVi_(role) {
  return { member: "thành viên", admin: "huynh trưởng", coLeader: "đồng thủ lĩnh", leader: "thủ lĩnh" }[role] || role || "";
}