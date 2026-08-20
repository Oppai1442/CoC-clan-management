/****************
 * Author: Oppai1442
 * Oppai REST-ish Web API for Google Shee
 
 *
 * Routes (GET):
 *  - /api/v1/health
 *  - /api/v1/member-events
 *  - /api/v1/war/history
 *  - /api/v1/war/members
 *  - /api/v1/war/attacks
 *  - /api/v1/cwl/season-history
 *  - /api/v1/cwl/rounds
 *  - /api/v1/cwl/round-members
 *  - /api/v1/cwl/round-attacks
 *  - /api/v1/raid/seasons
 *  - /api/v1/raid/members
 *
 * Common query params:
 *  - tail=2000         (append-like endpoints: lấy last N rows khi không có cursor)
 *  - cursor=123        (append-like endpoints: chỉ lấy rows sau row index này)
 *  - limit=500         (cap sau filter/sort)
 *  - offset=0
 *  - q=...             (global contains)
 *  - filters={...}     (JSON string; supports: ">=...","<=...","=...","!=...","<..."," >...")
 *  - sortBy=colName
 *  - sortDir=asc|desc
 *
 * Script Properties:
 *  - API_SHEET_DENYLIST = Sheet1;Sheet2   (case-insensitive)
 ****************/

function doGet(e) {
  try {
    const req = buildReq_(e);
    return dispatchRequest_(req);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const postData = e.postData ? e.postData.contents : "";
    let params = {};
    try {
      params = postData ? JSON.parse(postData) : {};
    } catch(err) {
      params = e.parameter || {};
    }
    
    const pathInfo = (e && typeof e.pathInfo === "string") ? e.pathInfo : "";
    const path = normalizePath_(params.path || pathInfo || String(e.parameter.path || "") || "/");
    
    const req = {
      path: path,
      params: {
        ...e.parameter,
        ...params
      }
    };
    
    return dispatchRequest_(req);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function dispatchRequest_(req) {
  try {
    const route = req.path;

    // Basic routing
    if (route === "/api/v1/health") return jsonOut_({ ok: true, ts: new Date().toISOString() });

    // Announcements
    if (route === "/api/v1/announcements") return handleAnnouncements_(req);
    if (route === "/api/v1/announcements/create") return handleAnnouncementsCreate_(req);
    if (route === "/api/v1/announcements/delete") return handleAnnouncementsDelete_(req);

    // Member events (JOIN/LEAVE/ROLE_CHANGE/NAME_CHANGE)
    if (route === "/api/v1/member-events") return handleMemberEvents_(req);

    // Normal war (CW) history + members + attacks
    if (route === "/api/v1/war/history") return handleWarHistory_(req);
    if (route === "/api/v1/war/members") return handleWarMembers_(req);
    if (route === "/api/v1/war/attacks") return handleWarAttacks_(req);
    if (route === "/api/v1/war/stats-current") return handleWarStatsCurrent_(req);
    if (route === "/api/v1/war/recommend") return handleWarRecommend_(req);


    // CWL (season = 1 đợt, rounds = 7 trận)
    if (route === "/api/v1/cwl/season-history") return handleCwlSeasonHistory_(req);
    if (route === "/api/v1/cwl/rounds") return handleCwlRounds_(req);
    if (route === "/api/v1/cwl/round-members") return handleCwlRoundMembers_(req);
    if (route === "/api/v1/cwl/round-attacks") return handleCwlRoundAttacks_(req);

    // Raid
    if (route === "/api/v1/raid/seasons") return handleRaidSeasons_(req);
    if (route === "/api/v1/raid/members") return handleRaidMembers_(req);

    // Clan Members Management
    if (route === "/api/v1/clan/members") return handleClanMembers_(req);

    // Player Auth
    if (route === "/api/v1/player/search") return handlePlayerSearch_(req);
    if (route === "/api/v1/player/verify") return handlePlayerVerify_(req);
    if (route === "/api/v1/player/list-current") return handlePlayerListCurrent_(req);
    if (route === "/api/v1/clan/sync-live") return handleClanSyncLive_(req);
    if (route === "/api/v1/player/add-note") return handlePlayerAddNote_(req);
    if (route === "/api/v1/player/delete-note") return handlePlayerDeleteNote_(req);
    if (route === "/api/v1/access-stats") return handleAccessStats_(req);

    // Unknown
    return jsonOut_({
      ok: false,
      error: "Unknown route",
      hint: [
        "/api/v1/health",
        "/api/v1/member-events",
        "/api/v1/war/history",
        "/api/v1/war/members",
        "/api/v1/war/attacks",
        "/api/v1/clan/members",
        "/api/v1/player/search",
        "/api/v1/player/verify",
        "/api/v1/player/list-current",
        "/api/v1/clan/sync-live",
        "/api/v1/player/add-note",
        "/api/v1/player/delete-note",
        "/api/v1/access-stats"
      ]
    });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* =========================
 * Handlers: per "bảng" / per endpoint
 * ========================= */

function handleMemberEvents_(req) {
  // Sheet: MemberEvents
  // Default sort: ts desc
  const raw = readSheetObjects_("MemberEvents", req, {
    strategy: "replace",
    defaultSortBy: "ts",
    defaultSortDir: "desc"
  });

  // Shape output: parse old/new value => {name, role, roleVi}
  const rows = raw.rows.map(r => shapeMemberEvent_(r));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "member-events",
    nextCursor: raw.nextCursor,
    totalAfterFilter: raw.totalAfterFilter,
    rows
  });
}

function handleWarHistory_(req) {
  // Sheet: WarHistory (append, history)
  const raw = readSheetObjects_("WarHistory", req, {
    strategy: "replace",
    defaultSortBy: "endTime",
    defaultSortDir: "desc"
  });

  const rows = raw.rows.map(r => ({
    warKey: r.warKey,
    opponentTag: r.opponentTag,
    opponentName: r.opponentName,
    state: r.state,
    preparationStartTime: r.preparationStartTime,
    startTime: r.startTime,
    endTime: r.endTime,
    teamSize: r.teamSize,
    attacksPerMember: r.attacksPerMember,
    clanStars: num_(r.clanStars),
    opponentStars: num_(r.oppStars),
    clanDestruction: num_(r.clanDestruction),
    opponentDestruction: num_(r.oppDestruction),
    result: r.result
  }));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "war-history",
    nextCursor: raw.nextCursor,
    totalAfterFilter: raw.totalAfterFilter,
    rows: rows
  });
}

function handleWarMembers_(req) {
  // NEW: Resolve "latest" warKey if requested
  handleLatestWarKeyParam_(req);

  // Sheet: WarMembers (upsert-ish nhưng API đọc như replace cũng được; ở đây vẫn treat as append để cursor/tail chạy)
  const raw = readSheetObjects_("WarMembers", req, {
    strategy: "append",
    defaultSortBy: "ts",
    defaultSortDir: "desc"
  });

  const rows = raw.rows.map(r => ({
    playerTag: r.playerTag,
    playerName: r.playerName,
    mapPosition: r.mapPosition,
    attacksDone: num_(r.attacksDone),
    attacksRequired: num_(r.attacksRequired),
    starsTotal: num_(r.starsTotal),
    bestDestruction: num_(r.bestDestruction),
    missingAttacks: num_(r.missingAttacks),
  }));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "war-members",
    nextCursor: raw.nextCursor,
    totalAfterFilter: raw.totalAfterFilter,
    rows: rows
  });
}

function handleWarAttacks_(req) {
  // NEW: Resolve "latest" warKey if requested
  handleLatestWarKeyParam_(req);

  // Sheet: WarAttacks
  const raw = readSheetObjects_("WarAttacks", req, {
    strategy: "append",
    defaultSortBy: "warKey",
    defaultSortDir: "desc"
  });

  const rows = raw.rows.map(r => ({
    ts: r.ts,
    attackerTag: r.attackerTag,
    attackerName: r.attackerName,
    defenderTag: r.defenderTag,
    stars: num_(r.stars),
    destructionPct: num_(r.destructionPct),
    order: num_(r.order)
  }));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "war-attacks",
    nextCursor: raw.nextCursor,
    totalAfterFilter: raw.totalAfterFilter,
    rows: rows
  });
}

/* =========================
 * War filtering helpers
 * ========================= */

function handleLatestWarKeyParam_(req) {
  if (!req.params.filters) return;
  try {
    const filters = JSON.parse(req.params.filters);
    if (filters.warKey === "latest") {
      filters.warKey = getLatestWarKey_();
      req.params.filters = JSON.stringify(filters);
    }
  } catch (e) { /* ignore */ }
}

function getLatestWarKey_() {
  const raw = readSheetObjects_("WarHistory", {
    params: { limit: 1, sortBy: "endTime", sortDir: "desc" }
  }, {
    strategy: "replace"
  });
  return (raw.rows && raw.rows.length > 0) ? raw.rows[0].warKey : null;
}

/* =========================
 * WarStats (current members only)
 * ========================= */

function handleWarStatsCurrent_(req) {
  const members = readAllSheetObjects_("MembersCurrent");
  const stats = getFreshWarStatsRows_(members);

  const statsMap = new Map();
  stats.forEach(s => {
    const norm = normalizeWarStatsRow_(s);
    if (norm.playerTag) {
      statsMap.set(norm.playerTag.trim().toUpperCase(), norm);
    }
  });

  // Loop through current members to include all of them (Left Join)
  let rows = [];
  members.forEach(m => {
    const tag = String(m.playerTag || "").trim().toUpperCase();
    const status = String(getValCI_(m, "status") || "IN").toUpperCase();
    if (!tag) return;
    if (status !== "IN") return;

    const s = statsMap.get(tag) || {};

    rows.push({
      playerTag: tag,
      playerName: String(m.name || "").trim() || String(s.playerName || "").trim() || "",
      roleVi: roleVi_(String(m.role || "").trim()),

      // CW
      cw_wars_joined: toNum0_(s.cw_wars_joined),
      cw_attacks_done: toNum0_(s.cw_attacks_done),
      cw_attacks_required: toNum0_(s.cw_attacks_required),
      cw_missed_attacks: toNum0_(s.cw_missed_attacks),
      cw_completion_rate_pct: s.cw_completion_rate_pct !== undefined ? s.cw_completion_rate_pct : "",

      // CWL
      cwl_wars_joined: toNum0_(s.cwl_seasons_joined),
      cwl_seasons_joined: toNum0_(s.cwl_seasons_joined),
      cwl_rounds_present: toNum0_(s.cwl_rounds_present),
      cwl_attacks_done: toNum0_(s.cwl_attacks_done),
      cwl_attacks_required: toNum0_(s.cwl_attacks_required),
      cwl_missed_attacks: toNum0_(s.cwl_missed_attacks),
      cwl_completion_rate_pct: s.cwl_completion_rate_pct !== undefined ? s.cwl_completion_rate_pct : "",

      // Overall
      overall_attacks_done: toNum0_(s.overall_attacks_done),
      overall_attacks_required: toNum0_(s.overall_attacks_required),
      overall_missed_attacks: toNum0_(s.overall_missed_attacks),
      overall_completion_rate_pct: s.overall_completion_rate_pct !== undefined ? s.overall_completion_rate_pct : ""
    });
  });

  // Sorting (server side)
  const sortBy = String(req.params.sortBy || "overall_completion_rate_pct").trim();
  const sortDir = (String(req.params.sortDir || "desc").toLowerCase() === "asc") ? "asc" : "desc";
  rows.sort((a, b) => compareSmart_(a[sortBy], b[sortBy], sortDir));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "war-stats-current",
    total: rows.length,
    rows
  });
}
/* =========================
 * Recommend roster for war
 * ========================= */

function handleWarRecommend_(req) {
  const size = clampInt_(req.params.size, 15, 1, 50);
  const type = String(req.params.type || "cw").toLowerCase(); // cw|cwl|overall

  const alpha = clampInt_(req.params.alpha, 2, 0, 100);
  const beta = clampInt_(req.params.beta, 2, 0, 100);
  const k = clampInt_(req.params.k, 10, 0, 1000);
  const kWars = clampInt_(req.params.kWars, 5, 0, 1000);

  const includeNoHistory = String(req.params.includeNoHistory || "true").toLowerCase() === "true";

  // NEW: exclude list
  const excludeSet = new Set(parseCsvList_(req.params.exclude).map(x => String(x).trim()));

  // NEW: CWL lock
  const resetLock = String(req.params.resetLock || "false").toLowerCase() === "true";

  const members = readAllSheetObjects_("MembersCurrent");
  const stats = getFreshWarStatsRows_(members).map(normalizeWarStatsRow_);

  const statMap = new Map();
  stats.forEach(s => { if (s.playerTag) statMap.set(s.playerTag, s); });

  // Build current member tags (Only those who are currently IN the clan)
  const currentMemberTags = members
    .filter(m => {
      const s = String(getValCI_(m, "status") || "IN").toUpperCase();
      return s === "IN";
    })
    .map(m => String(m.playerTag || "").trim())
    .filter(Boolean);

  // Decide candidate pool
  let poolTags = currentMemberTags;
  let lockMeta = null;

  if (type === "cwl") {
    const seasonKey = String(req.params.seasonKey || "").trim() || getActiveCwlSeasonKey_();
    if (!seasonKey) {
      // fallback: still allow, but lock on "unknown"
      // (cậu có thể set seasonKey param cho chắc)
      lockMeta = loadOrInitCwlRosterLock_("CWL_UNKNOWN", currentMemberTags, resetLock);
    } else {
      lockMeta = loadOrInitCwlRosterLock_(seasonKey, currentMemberTags, resetLock);
    }

    // lock pool = locked roster
    // but still intersect with current members to avoid recommending people already left clan
    const currSet = new Set(currentMemberTags);
    poolTags = lockMeta.tags.filter(t => currSet.has(t));
  }

  const candidates = [];
  const noHistory = [];

  // Build a fast lookup for members info
  const memInfo = new Map();
  members.forEach(m => {
    const tag = String(m.playerTag || "").trim();
    if (!tag) return;
    memInfo.set(tag, {
      playerTag: tag,
      playerName: String(m.name || "").trim(),
      role: String(m.role || "").trim()
    });
  });

  poolTags.forEach(tag => {
    if (!tag) return;
    if (excludeSet.has(tag)) return; // NEW exclude

    const mi = memInfo.get(tag) || { playerTag: tag, playerName: "", role: "" };
    const name = mi.playerName;
    const role = mi.role;

    const s = statMap.get(tag);
    if (!s) {
      const item = {
        playerTag: tag,
        playerName: name,
        role,
        roleVi: roleVi_(role),
        type,
        attacksDone: 0,
        attacksRequired: 0,
        missedAttacks: 0,
        warsJoined: 0,
        smoothedRate: 0,
        confidenceAttacks: 0,
        confidenceWars: 0,
        missPenalty: 0,
        score: 0,
        scorePct: 0,
        note: "no_history",
        reason: "no_history"
      };
      (includeNoHistory ? candidates : noHistory).push(item);
      return;
    }

    const pack = pickStatPack_(s, type);
    const done = pack.done;
    const reqd = pack.required;
    const warsJoined = pack.warsJoined;
    const missed = Math.max(0, reqd - done);
    const missRate = (reqd > 0) ? (missed / reqd) : 0;

    // Bayesian smoothing: avoid "1 war full hits => 100%"
    const smoothedRate = (reqd > 0)
      ? (done + alpha) / (reqd + alpha + beta)
      : (alpha + beta > 0 ? alpha / (alpha + beta) : 0);

    const confidenceAttacks = (reqd > 0) ? (reqd / (reqd + k)) : 0;
    const confidenceWars = (warsJoined > 0) ? (warsJoined / (warsJoined + kWars)) : 0;

    // Penalize by miss rate, not absolute misses, so large sample sizes are not crushed unfairly.
    const missPenalty = 1 / (1 + 2 * missRate);

    const confidence = (0.7 * confidenceAttacks + 0.3 * confidenceWars);
    const confidenceFactor = 0.35 + 0.65 * confidence;
    const missFactor = 0.7 + 0.3 * missPenalty;
    const score = clamp01_(smoothedRate * confidenceFactor * missFactor);

    candidates.push({
      playerTag: tag,
      playerName: name || s.playerName || "",
      roleVi: roleVi_(role),

      type,
      attacksDone: done,
      attacksRequired: reqd,
      missedAttacks: missed,
      warsJoined,

      smoothedRate: round3_(smoothedRate),
      confidenceAttacks: round3_(confidenceAttacks),
      confidenceWars: round3_(confidenceWars),
      missPenalty: round3_(missPenalty),
      confidenceFactor: round3_(confidenceFactor),
      missFactor: round3_(missFactor),

      score: round3_(score),
      scorePct: Math.round(score * 1000) / 10,
      note: scoreNote_(score, reqd, warsJoined)
    });
  });

  candidates.sort((a, b) => {
    const aNoHist = (a.note === "no_history") ? 1 : 0;
    const bNoHist = (b.note === "no_history") ? 1 : 0;
    if (aNoHist !== bNoHist) return aNoHist - bNoHist;

    return (
      compareSmart_(a.score, b.score, "desc") ||
      compareSmart_(a.missedAttacks, b.missedAttacks, "asc") ||
      compareSmart_(a.attacksRequired, b.attacksRequired, "desc") ||
      compareSmart_(a.warsJoined, b.warsJoined, "desc") ||
      compareSmart_(a.playerName, b.playerName, "asc")
    );
  });

  const picked = candidates.slice(0, size).map((x, i) => ({ rank: i + 1, ...x }));
  const bench = candidates.slice(size).map((x, i) => ({ rank: size + i + 1, ...x }));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "war-recommend",
    type,
    sizeRequested: size,
    params: { alpha, beta, k, kWars, includeNoHistory },

    pool: (type === "cwl")
      ? {
        mode: "locked",
        seasonKey: String(req.params.seasonKey || "").trim() || (lockMeta ? "AUTO" : ""),
        lockedAt: lockMeta ? lockMeta.lockedAt : "",
        poolSize: poolTags.length
      }
      : {
        mode: "current",
        poolSize: poolTags.length
      },

    excluded: Array.from(excludeSet),
    meta: {
      currentMembers: currentMemberTags.length,
      poolCandidates: poolTags.length,
      considered: candidates.length,
      noHistoryExcluded: includeNoHistory ? 0 : noHistory.length
    },

    picked,
    bench,
    noHistory: includeNoHistory ? [] : noHistory
  });
}


/* =========================
 * Helpers (sheet read + normalize + scoring)
 * ========================= */

function readAllSheetObjects_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values.map(r => {
    const o = {};
    for (let i = 0; i < headers.length; i++) o[headers[i]] = (r[i] ?? "");
    return o;
  });
}

function normalizeWarStatsRow_(r) {
  // tolerate missing columns; treat as 0
  const s = {};
  s.playerTag = String(r.playerTag || "").trim();
  s.playerName = String(r.playerName || r.lastName || r.name || "").trim();
  s.lastSeenTs = String(r.lastSeenTs || r.ts || "").trim();

  // CW
  s.cw_wars_joined = toNum0_(pickFirst_(r, ["cw_wars_joined", "cwWarsJoined"], 0));
  s.cw_attacks_done = toNum0_(pickFirst_(r, ["cw_attacks_done", "cwAttacksDone"], 0));
  s.cw_attacks_required = toNum0_(pickFirst_(r, ["cw_attacks_required", "cwAttacksRequired"], 0));
  s.cw_missed_attacks = Math.max(0, s.cw_attacks_required - s.cw_attacks_done);
  s.cw_completion_rate_pct = toNum0_(pickFirst_(r, ["cw_completion_rate_pct", "cwCompletionRatePct"], 0));
  s.cw_score = toNum0_(pickFirst_(r, ["cw_score", "cwScore"], 0));

  // CWL (season=7 rounds) -> required = rounds present (1 attack each round)
  s.cwl_seasons_joined = toNum0_(pickFirst_(r, ["cwl_seasons_joined", "cwlSeasonsJoined", "cwl_wars_joined", "cwlWarsJoined"], 0));
  s.cwl_rounds_present = toNum0_(pickFirst_(r, ["cwl_rounds_present", "cwlRoundsPresent", "cwl_attacks_required", "cwlAttacksRequired"], 0));
  s.cwl_attacks_done = toNum0_(pickFirst_(r, ["cwl_attacks_done", "cwlAttacksDone"], 0));
  s.cwl_attacks_required = toNum0_(pickFirst_(r, ["cwl_attacks_required", "cwlAttacksRequired"], 0));
  s.cwl_missed_attacks = Math.max(0, s.cwl_attacks_required - s.cwl_attacks_done);
  s.cwl_completion_rate_pct = toNum0_(pickFirst_(r, ["cwl_completion_rate_pct", "cwlCompletionRatePct"], 0));
  s.cwl_score = toNum0_(pickFirst_(r, ["cwl_score", "cwlScore"], 0));

  // Overall
  s.overall_attacks_done = toNum0_(pickFirst_(r, ["overall_attacks_done", "overallAttacksDone", "total_attacks_done", "totalAttacksDone"], 0));
  s.overall_attacks_required = toNum0_(pickFirst_(r, ["overall_attacks_required", "overallAttacksRequired", "total_attacks_required", "totalAttacksRequired"], 0));
  s.overall_missed_attacks = Math.max(0, s.overall_attacks_required - s.overall_attacks_done);
  s.overall_completion_rate_pct = toNum0_(pickFirst_(r, ["completion_rate_pct", "completionRatePct"], 0));
  s.overall_score = toNum0_(pickFirst_(r, ["overall_score", "overallScore", "completion_rate_pct", "completionRatePct"], 0));

  return s;
}

function getFreshWarStatsRows_(members) {
  let stats = dedupeWarStatsRowsByTag_(readAllSheetObjects_("WarStats"));

  const hasCwlStats = stats.some(r => {
    return (
      toNum0_(pickFirst_(r, ["cwl_wars_joined", "cwlWarsJoined"], 0)) > 0 ||
      toNum0_(pickFirst_(r, ["cwl_attacks_done", "cwlAttacksDone"], 0)) > 0 ||
      toNum0_(pickFirst_(r, ["cwl_attacks_required", "cwlAttacksRequired"], 0)) > 0
    );
  });
  if (hasCwlStats) return stats;

  const warMembers = readAllSheetObjects_("WarMembers");
  const hasCwlSource = warMembers.some(r => {
    const type = String(r.warType || "").toUpperCase();
    return (type === "CWL" || type === "CWL_SEASON");
  });
  if (!hasCwlSource) return stats;

  const firstMember = (members || []).find(m => String(m.playerTag || "").trim());
  const clanTag = String((firstMember && firstMember.clanTag) || "").trim();
  const clanName = (
    (typeof readClanNameFromSheet_ === "function" ? String(readClanNameFromSheet_() || "") : "") ||
    String((firstMember && firstMember.clanName) || "").trim()
  );

  if (!clanTag || typeof computeWarStats_ !== "function") return stats;

  try {
    computeWarStats_(clanTag, clanName);
    stats = dedupeWarStatsRowsByTag_(readAllSheetObjects_("WarStats"));
  } catch (e) {
    // Keep serving the last available stats if recompute fails.
  }

  return stats;
}

function dedupeWarStatsRowsByTag_(rows) {
  const bestByTag = new Map();

  (rows || []).forEach(r => {
    const tag = String(r.playerTag || "").trim();
    if (!tag) return;

    const prev = bestByTag.get(tag);
    if (!prev) {
      bestByTag.set(tag, r);
      return;
    }

    const prevTs = tryParseDate_(prev.ts);
    const currTs = tryParseDate_(r.ts);
    const prevTime = prevTs ? prevTs.getTime() : -1;
    const currTime = currTs ? currTs.getTime() : -1;

    if (currTime > prevTime) {
      bestByTag.set(tag, r);
      return;
    }
    if (currTime < prevTime) return;

    const prevFilled = countFilledValues_(prev);
    const currFilled = countFilledValues_(r);
    if (currFilled > prevFilled) {
      bestByTag.set(tag, r);
    }
  });

  return Array.from(bestByTag.values());
}

function countFilledValues_(obj) {
  if (!obj) return 0;
  let count = 0;
  Object.keys(obj).forEach(k => {
    if (k == null || k === "None") return;
    const v = obj[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") count += 1;
  });
  return count;
}

function pickStatPack_(s, type) {
  if (type === "cwl") {
    return {
      done: toNum0_(s.cwl_attacks_done),
      required: toNum0_(s.cwl_attacks_required),
      warsJoined: toNum0_(s.cwl_seasons_joined) + toNum0_(s.cwl_rounds_present) * 0.0001 // tiny tie-break
    };
  }
  if (type === "overall") {
    // approximate warsJoined from required attacks: CW=2 per war, CWL=1 per round; war count is fuzzy -> ok for confidence
    return {
      done: toNum0_(s.overall_attacks_done),
      required: toNum0_(s.overall_attacks_required),
      warsJoined: approxWarsJoinedFromRequired_(toNum0_(s.overall_attacks_required))
    };
  }
  // default cw
  return {
    done: toNum0_(s.cw_attacks_done),
    required: toNum0_(s.cw_attacks_required),
    warsJoined: toNum0_(s.cw_wars_joined) || Math.floor(toNum0_(s.cw_attacks_required) / 2)
  };
}

function approxWarsJoinedFromRequired_(required) {
  // heuristic: assume half are CW (2 attacks), half are CWL rounds (1 attack)
  // we only use this for confidenceWars, not for a "truth" stat.
  if (!required || required <= 0) return 0;
  return Math.max(1, Math.round(required / 1.5));
}

function pickFirst_(obj, keys, def) {
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
  }
  return def;
}

function toNum0_(x) {
  const n = Number(String(x ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function clamp01_(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function round3_(x) {
  return Math.round(clamp01_(x) * 1000) / 1000;
}

function scoreNote_(score, required, warsJoined) {
  if (!required) return "no_sample";
  if (required < 4) return "sample_too_small";
  if (score >= 0.75) return "very_reliable";
  if (score >= 0.55) return "ok";
  if (score >= 0.35) return "risky";
  return "avoid";
}

/* ---- CWL ---- */

function handleCwlSeasonHistory_(req) {
  // Sheet: CWLSeasonHistory (replace-ish; 1 row/seasonKey)
  const raw = readSheetObjects_("CWLSeasonHistory", req, {
    strategy: "replace",
    defaultSortBy: "season",
    defaultSortDir: "desc"
  });

  const rows = raw.rows.map(r => ({
    seasonKey: r.seasonKey,
    tsFirstSeen: r.tsFirstSeen,
    tsFinal: r.tsFinal,
    clanTag: r.clanTag,
    clanName: r.clanName,
    season: r.season,
    roundsTotal: num_(r.roundsTotal),
    roundsEnded: num_(r.roundsEnded),
    roundsWon: num_(r.roundsWon),
    roundsLost: num_(r.roundsLost),
    roundsDraw: num_(r.roundsDraw)
  }));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "cwl-season-history",
    totalAfterFilter: raw.totalAfterFilter,
    rows
  });
}

function handleCwlRounds_(req) {
  // Sheet: CWLRounds (append or replace tuỳ cậu; thường append/upsert)
  const raw = readSheetObjects_("CWLRounds", req, {
    strategy: "append",
    defaultSortBy: "roundIndex",
    defaultSortDir: "asc"
  });

  // Optional: filter by season=...
  const season = String(req.params.season || "").trim();
  let rows = raw.rows;
  if (season) rows = rows.filter(r => String(r.season || "") === season);

  rows = rows.map(r => ({
    roundKey: r.roundKey,
    seasonKey: r.seasonKey,
    season: r.season,
    roundIndex: num_(r.roundIndex),
    warTag: r.warTag,
    ts: r.ts,
    state: r.state,
    startTime: r.startTime,
    endTime: r.endTime,
    teamSize: num_(r.teamSize),
    clanTag: r.clanTag,
    clanName: r.clanName,
    opponentTag: r.opponentTag,
    opponentName: r.opponentName,
    clanStars: num_(r.clanStars),
    oppStars: num_(r.oppStars),
    clanDestruction: num_(r.clanDestruction),
    oppDestruction: num_(r.oppDestruction),
    result: r.result
  }));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "cwl-rounds",
    nextCursor: raw.nextCursor,
    totalAfterFilter: raw.totalAfterFilter,
    rows
  });
}

function handleCwlRoundMembers_(req) {
  const raw = readSheetObjects_("CWLRoundMembers", req, {
    strategy: "append",
    defaultSortBy: "ts",
    defaultSortDir: "desc"
  });

  const rows = raw.rows.map(r => ({
    roundMemberId: r.roundMemberId,
    roundKey: r.roundKey,
    seasonKey: r.seasonKey,
    season: r.season,
    roundIndex: num_(r.roundIndex),
    ts: r.ts,
    playerTag: r.playerTag,
    playerName: r.playerName,
    mapPosition: num_(r.mapPosition),
    attacksDone: num_(r.attacksDone),          // 0|1
    attacksRequired: num_(r.attacksRequired),  // 1
    starsTotal: num_(r.starsTotal),
    bestDestruction: num_(r.bestDestruction),
    missingAttacks: num_(r.missingAttacks)
  }));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "cwl-round-members",
    nextCursor: raw.nextCursor,
    totalAfterFilter: raw.totalAfterFilter,
    rows
  });
}

function handleCwlRoundAttacks_(req) {
  const raw = readSheetObjects_("CWLRoundAttacks", req, {
    strategy: "replace",
    defaultSortBy: "roundIndex",
    defaultSortDir: "desc"
  });

  const rows = raw.rows.map(r => ({
    attackId: r.attackId,
    roundKey: r.roundKey,
    seasonKey: r.seasonKey,
    season: r.season,
    roundIndex: num_(r.roundIndex),
    warTag: r.warTag,
    attackerTag: r.attackerTag,
    attackerName: r.attackerName,
    defenderTag: r.defenderTag,
    stars: num_(r.stars),
    destructionPct: num_(r.destructionPct),
    order: num_(r.order)
  }));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "cwl-round-attacks",
    nextCursor: raw.nextCursor,
    totalAfterFilter: raw.totalAfterFilter,
    rows
  });
}

/* ---- Raid ---- */

function handleRaidSeasons_(req) {
  const raw = readSheetObjects_("RaidSeasons", req, {
    strategy: "append",
    defaultSortBy: "endTime",
    defaultSortDir: "desc"
  });

  const rows = raw.rows.map(r => ({
    raidId: r.raidId,
    startTime: r.startTime,
    endTime: r.endTime,
    capitalTotalLoot: num_(r.capitalTotalLoot),
    raidsCompleted: num_(r.raidsCompleted),
    totalAttacks: num_(r.totalAttacks),
    enemyDistrictsDestroyed: num_(r.enemyDistrictsDestroyed),
    offensiveReward: num_(r.offensiveReward),
    defensiveReward: num_(r.defensiveReward)
  }));

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "raid-seasons",
    nextCursor: raw.nextCursor,
    totalAfterFilter: raw.totalAfterFilter,
    rows
  });
}

function handleRaidMembers_(req) {
  const members = readAllSheetObjects_("MembersCurrent");
  const currentTags = new Set();
  members.forEach(m => {
    const tag = String(m.playerTag || "").trim();
    const status = String(getValCI_(m, "status") || "IN").toUpperCase();
    if (tag && status === "IN") {
      currentTags.add(tag);
    }
  });

  const allRaid = readAllSheetObjects_("RaidMembers");
  let rows = allRaid.filter(r => {
    const tag = String(r.playerTag || "").trim();
    return currentTags.has(tag);
  });

  rows = rows.map(r => ({
    raidMemberId: r.raidMemberId,
    raidId: r.raidId,
    playerTag: r.playerTag,
    name: r.name,
    attacks: num_(r.attacks),
    capitalResourcesLooted: num_(r.capitalResourcesLooted)
  }));

  const q = String(req.params.q || "").trim();
  const filters = parseFilters_(req);
  const sortBy = String(req.params.sortBy || "raidId").trim();
  const sortDir = (String(req.params.sortDir || "desc").toLowerCase() === "asc") ? "asc" : "desc";
  const limit = clampInt_(req.params.limit, 500, 0, 20000);
  const offset = clampInt_(req.params.offset, 0, 0, 10000000);

  if (filters && typeof filters === "object") {
    rows = rows.filter(row => {
      return Object.keys(filters).every(col => matchFilterExpr_(getValCI_(row, col), String(filters[col])));
    });
  }

  if (q) {
    const qq = normalizeSearchStr_(q).trim();
    if (qq) {
      rows = rows.filter(row => {
        return Object.values(row).some(val => {
          if (val === null || val === undefined) return false;
          return normalizeSearchStr_(val).includes(qq);
        });
      });
    }
  }

  if (sortBy) {
    rows.sort((a, b) => compareSmart_(getValCI_(a, sortBy), getValCI_(b, sortBy), sortDir));
  }

  const totalAfterFilter = rows.length;

  if (offset > 0) rows = rows.slice(offset);
  if (limit > 0) rows = rows.slice(0, limit);

  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "raid-members",
    totalAfterFilter,
    rows
  });
}

/* =========================
 * Core sheet reader (server-side filter/sort/paging)
 * ========================= */

function readSheetObjects_(sheetName, req, opt) {
  const deny = getDenySet_();
  if (isDeniedSheet_(deny, sheetName)) {
    throw new Error("Forbidden sheet: " + sheetName);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Sheet not found: " + sheetName);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return { rows: [], totalAfterFilter: 0, nextCursor: 0 };
  }

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  // LOGIC MỚI: Nếu có filter hoặc search, ép buộc dùng chiến lược "replace" (quét toàn bộ)
  const q = String(req.params.q || "").trim();
  const filters = parseFilters_(req);
  
  let strategy = String(opt && opt.strategy ? opt.strategy : inferStrategy_(sheetName)).toLowerCase();
  if (q || (filters && Object.keys(filters).length > 0)) {
    strategy = "replace";
  }

  const tail = clampInt_(req.params.tail, 2000, 0, 20000);
  const cursor = clampInt_(req.params.cursor, 0, 0, 10000000);
  const limit = clampInt_(req.params.limit, 500, 0, 20000);
  const offset = clampInt_(req.params.offset, 0, 0, 10000000);

  const sortBy = String(req.params.sortBy || (opt && opt.defaultSortBy ? opt.defaultSortBy : "")).trim();
  const sortDir = (String(req.params.sortDir || (opt && opt.defaultSortDir ? opt.defaultSortDir : "asc")).toLowerCase() === "desc") ? "desc" : "asc";

  // Base range selection
  let startRow = 2;
  let numRows = 0;

  if (strategy === "replace") {
    startRow = 2;
    numRows = Math.max(0, lastRow - 1);
  } else {
    // append-like: cursor => delta, else tail
    if (cursor >= 2) {
      startRow = Math.max(2, cursor + 1);
      numRows = Math.max(0, lastRow - startRow + 1);
    } else {
      if (tail > 0) {
        startRow = Math.max(2, lastRow - tail + 1);
        numRows = Math.max(0, lastRow - startRow + 1);
      } else {
        startRow = 2;
        numRows = 0;
      }
    }
  }

  let values = [];
  if (numRows > 0) values = sh.getRange(startRow, 1, numRows, lastCol).getValues();

  let rows = values.map(r => {
    const o = {};
    for (let i = 0; i < headers.length; i++) o[headers[i]] = (r[i] ?? "");
    return o;
  });

  // 1) Column filters (Xử lý lọc ở Server)
  if (filters && typeof filters === "object") {
    rows = rows.filter(row => {
      return Object.keys(filters).every(col => matchFilterExpr_(getValCI_(row, col), String(filters[col])));
    });
  }

  // 2) Global search (Xử lý tìm kiếm ở Server)
  if (q) {
    const qq = normalizeSearchStr_(q).trim();
    if (qq) {
      rows = rows.filter(row => {
        return Object.keys(row).some(k => {
          const val = row[k];
          if (val === null || val === undefined) return false;
          return normalizeSearchStr_(val).includes(qq);
        });
      });
    }
  }

  // 3) Sorting
  if (sortBy) {
    rows.sort((a, b) => compareSmart_(getValCI_(a, sortBy), getValCI_(b, sortBy), sortDir));
  }

  const totalAfterFilter = rows.length;

  // 4) offset/limit
  if (offset > 0) rows = rows.slice(offset);
  if (limit > 0) rows = rows.slice(0, limit);

  return {
    rows,
    headers,
    totalAfterFilter,
    nextCursor: lastRow
  };
}

/* =========================
 * Per-row shaping helpers
 * ========================= */

function shapeMemberEvent_(r) {
  const type = String(getValCI_(r, "type") || "").toUpperCase();
  const playerName = String(getValCI_(r, "playerName") || "").trim();
  let oldValue = String(getValCI_(r, "oldValue") || "").trim();
  let newValue = String(getValCI_(r, "newValue") || "").trim();
  
  if (type === "PROMOTE" || type === "DEMOTE" || type === "ROLE_CHANGE") {
    oldValue = roleVi_(oldValue);
    newValue = roleVi_(newValue);
  }

  return {
    ts: getValCI_(r, "ts"),
    type: type,
    playerTag: getValCI_(r, "playerTag"),
    playerName: playerName,
    oldValue,
    newValue,
  };
}

function splitNameRole_(s) {
  const t = String(s || "").trim();
  if (!t) return { name: "", role: "" };
  const parts = t.split("|");
  if (parts.length === 1) return { name: t, role: "" };
  return { name: String(parts[0] || "").trim(), role: String(parts[1] || "").trim() };
}

function roleVi_(roleRaw) {
  const r = String(roleRaw || "").trim();
  const map = {
    member: "thành viên",
    admin: "huynh trưởng",
    coLeader: "đồng thủ lĩnh",
    leader: "thủ lĩnh"
  };
  return map[r] || r;
}

function clanDisplay_(name, tag) {
  const n = String(name || "").trim();
  const t = String(tag || "").trim();
  if (!n && !t) return "";
  return `${n}|${t}`;
}

/* =========================
 * Filter / sort helpers
 * ========================= */

function safeJsonParse_(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

function parseFilters_(req) {
  if (!req || !req.params || !req.params.filters) return null;
  if (typeof req.params.filters === "object") return req.params.filters;
  const raw = String(req.params.filters).trim();
  if (raw === "" || raw === "[object Object]") return null;
  return safeJsonParse_(raw);
}

function matchFilterExpr_(cell, exprRaw) {
  const expr = String(exprRaw || "").trim();
  const v = cell;

  const m = expr.match(/^(>=|<=|!=|=|>|<)\s*(.+)$/);
  if (!m) {
    return String(v ?? "").toLowerCase().includes(expr.toLowerCase());
  }

  const op = m[1];
  const rhs = m[2];

  const vd = tryParseDate_(v);
  const rd = tryParseDate_(rhs);
  if (vd && rd) return applyCompare_(vd.getTime(), rd.getTime(), op);

  const vn = tryParseNumber_(v);
  const rn = tryParseNumber_(rhs);
  if (vn != null && rn != null) return applyCompare_(vn, rn, op);

  const vs = String(v ?? "").toLowerCase();
  const rs = String(rhs ?? "").toLowerCase();
  if (op === "=") return vs === rs;
  if (op === "!=") return vs !== rs;
  if (op === ">") return vs > rs;
  if (op === "<") return vs < rs;
  if (op === ">=") return vs >= rs;
  if (op === "<=") return vs <= rs;
  return false;
}

function tryParseNumber_(x) {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  if (!s) return null;
  const cleaned = s.endsWith("%") ? s.slice(0, -1) : s;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function tryParseDate_(x) {
  if (x instanceof Date || (x && Object.prototype.toString.call(x) === '[object Date]')) return x;
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function applyCompare_(a, b, op) {
  if (op === "=") return a === b;
  if (op === "!=") return a !== b;
  if (op === ">") return a > b;
  if (op === "<") return a < b;
  if (op === ">=") return a >= b;
  if (op === "<=") return a <= b;
  return false;
}

function compareSmart_(va, vb, dir) {
  const sign = (dir === "desc") ? -1 : 1;

  const da = tryParseDate_(va);
  const db = tryParseDate_(vb);
  if (da && db) return sign * (da.getTime() - db.getTime());

  const na = tryParseNumber_(va);
  const nb = tryParseNumber_(vb);
  if (na != null && nb != null) return sign * (na - nb);

  const sa = String(va ?? "").toLowerCase();
  const sb = String(vb ?? "").toLowerCase();
  if (sa < sb) return -1 * sign;
  if (sa > sb) return 1 * sign;
  return 0;
}

/* =========================
 * Request + denylist + utils
 * ========================= */

function buildReq_(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  // pathInfo in GAS often starts with "/"
  const pathInfo = (e && typeof e.pathInfo === "string") ? e.pathInfo : "";
  const path = normalizePath_(pathInfo || String(params.path || "") || "/");

  return { path, params };
}

function normalizePath_(p) {
  let s = String(p || "").trim();
  if (!s) return "/";
  if (!s.startsWith("/")) s = "/" + s;
  // remove trailing slash (except root)
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function inferStrategy_(sheetName) {
  return (/Current$/i.test(sheetName) || /Stats$/i.test(sheetName)) ? "replace" : "append";
}

function getDenySet_() {
  const props = PropertiesService.getScriptProperties();
  const raw = String(props.getProperty("API_SHEET_DENYLIST") || "").trim();
  if (!raw) return new Set();

  const items = raw
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.toLowerCase());

  return new Set(items);
}

function isDeniedSheet_(denySet, sheetName) {
  if (!sheetName) return false;
  return denySet.has(String(sheetName).toLowerCase());
}

function clampInt_(v, def, min, max) {
  const n = parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function num_(x) {
  const n = Number(String(x ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function rate_(a, b) {
  if (!b || b <= 0) return 0;
  return a / b;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================
 * General Helper
 * ========================= */

function parseCsvList_(s) {
  const raw = String(s || "").trim();
  if (!raw) return [];
  return raw.split(",").map(x => x.trim()).filter(Boolean);
}

function md5Hex_(s) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return raw.map(b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

// Find active CWL seasonKey from CWLSeasonHistory:
// active = tsFinal empty OR roundsEnded < roundsTotal (usually 7)
function getActiveCwlSeasonKey_() {
  const rows = readAllSheetObjects_("CWLSeasonHistory"); // you already have this helper in your API
  if (!rows.length) return "";

  const norm = rows.map(r => ({
    seasonKey: String(r.seasonKey || "").trim(),
    season: String(r.season || "").trim(),
    tsFinal: String(r.tsFinal || "").trim(),
    roundsTotal: toNum0_(r.roundsTotal),
    roundsEnded: toNum0_(r.roundsEnded)
  })).filter(x => x.seasonKey);

  // active first
  const active = norm.find(x => (!x.tsFinal) || (x.roundsTotal > 0 && x.roundsEnded < x.roundsTotal));
  if (active) return active.seasonKey;

  // fallback latest by season (string compare ok if season like "2026-02")
  norm.sort((a, b) => (a.season < b.season ? 1 : (a.season > b.season ? -1 : 0)));
  return norm[0].seasonKey;
}

// Load or init CWL roster lock for a seasonKey.
// Returns: { tags:[], lockedAt:"" }
function loadOrInitCwlRosterLock_(seasonKey, currentMemberTags, reset) {
  const props = PropertiesService.getScriptProperties();
  const pKey = "CWL_ROSTER_LOCK_" + md5Hex_(seasonKey);

  if (!reset) {
    const existing = String(props.getProperty(pKey) || "").trim();
    if (existing) {
      // format: lockedAt|tag1,tag2,tag3
      const pipe = existing.indexOf("|");
      if (pipe > 0) {
        const lockedAt = existing.slice(0, pipe);
        const tags = existing.slice(pipe + 1).split(",").map(x => x.trim()).filter(Boolean);
        return { tags, lockedAt };
      }
      // backward compat: only csv
      return { tags: existing.split(",").map(x => x.trim()).filter(Boolean), lockedAt: "" };
    }
  }

  // init new lock from current members (max 50)
  const lockedAt = new Date().toISOString();
  const tags = (currentMemberTags || []).slice(0, 50);
  props.setProperty(pKey, lockedAt + "|" + tags.join(","));
  return { tags, lockedAt };
}


/* =========================
 * Player Auth Handlers
 * ========================= */

function handlePlayerSearch_(req) {
  const q = String(req.params.q || "").toLowerCase().trim();
  if (!q) return jsonOut_({ ok: false, error: "Missing query" });

  const normalize = (str) => {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]/g, "");
  };

  const normalizedQ = normalize(q);
  const members = readAllSheetObjects_("MembersCurrent");

  const filtered = members.filter(m => {
    const status = String(getValCI_(m, "status") || "IN").toUpperCase();
    if (status !== "IN") return false;
    const name = String(m.name || "");
    const tag = String(m.playerTag || "").toLowerCase();
    if (tag === q || tag === "#" + q) return true;
    if (!normalizedQ && q) return name.toLowerCase().includes(q.toLowerCase());
    return normalize(name).includes(normalizedQ);
  }).map(m => ({
    tag: String(m.playerTag || ""),
    name: String(m.name || ""),
    role: String(m.role || ""),
    th: String(m.townHallLevel || "")
  }));

  return jsonOut_({ ok: true, rows: filtered });
}

function handlePlayerVerify_(req) {
  const tag = String(req.params.tag || "").trim();
  const token = String(req.params.token || "").trim();
  if (!tag || !token) return jsonOut_({ ok: false, error: "Missing tag or token" });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("MembersCurrent");
  if (!sh) return jsonOut_({ ok: false, error: "Sheet MembersCurrent not found" });

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const idxMap = {};
  headers.forEach((h, i) => idxMap[h] = i);

  const tagIdx = idxMap["playerTag"];
  const tokenIdx = idxMap["token"];
  const statusIdx = idxMap["status"];

  if (tagIdx === undefined || tokenIdx === undefined) {
    return jsonOut_({ ok: false, error: "Missing playerTag or token columns in sheet" });
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return jsonOut_({ ok: false, error: "No players in members list" });

  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  let playerRowIdx = -1;
  let playerRowData = null;

  for (let i = 0; i < values.length; i++) {
    const pTag = String(values[i][tagIdx] || "").trim();
    if (pTag.toLowerCase() === tag.toLowerCase()) {
      playerRowIdx = i + 2;
      playerRowData = values[i];
      break;
    }
  }

  if (playerRowIdx === -1 || !playerRowData) {
    return jsonOut_({ ok: false, error: "Player not found in clan members list" });
  }

  const status = String(playerRowData[statusIdx] || "IN").toUpperCase();
  if (status !== "IN") {
    return jsonOut_({ ok: false, error: "Player has left the clan" });
  }

  const existingSessionToken = String(playerRowData[tokenIdx] || "").trim();

  // 1. If the token matches the session token in the sheet, it's a valid session token (auto login)
  if (existingSessionToken && existingSessionToken === token) {
    return jsonOut_({ ok: true, status: "ok", token: token });
  }

  // 2. Otherwise, treat it as a CoC API token (one-time token) and verify against CoC API
  const cfg = getCfg_();
  const tagEnc = encodeURIComponent(tag.startsWith("#") ? tag : "#" + tag);
  const url = cfg.baseUrl.replace(/\/$/, "") + "/players/" + tagEnc + "/verifytoken";

  try {
    const resp = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + cfg.token,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      payload: JSON.stringify({ token: token }),
      muteHttpExceptions: true
    });

    const code = resp.getResponseCode();
    const result = JSON.parse(resp.getContentText());

    if (code >= 200 && code < 300) {
      if (result.status === "ok") {
        // CoC API token verified! Generate a new session token, save to sheet, and return it.
        const newSessionToken = md5Hex_(`${tag}|${Date.now()}|${Math.random()}`);
        sh.getRange(playerRowIdx, tokenIdx + 1).setValue(newSessionToken);
        return jsonOut_({ ok: true, status: "ok", token: newSessionToken });
      } else {
        return jsonOut_({ ok: true, status: "invalid" });
      }
    } else {
      return jsonOut_({ ok: false, error: result.reason || result.message || "Verify failed", code: code });
    }
  } catch (e) {
    return jsonOut_({ ok: false, error: String(e) });
  }
}

function handlePlayerListCurrent_(req) {
  const members = readAllSheetObjects_("MembersCurrent");
  const rows = members
    .filter(m => {
      const status = String(getValCI_(m, "status") || "IN").toUpperCase();
      return status === "IN";
    })
    .map(m => ({
      tag: String(m.playerTag || ""),
      name: String(m.name || ""),
      role: String(m.role || ""),
      th: String(m.townHallLevel || "")
    }));
  return jsonOut_({ ok: true, rows: rows });
}

function handleClanSyncLive_(req) {
  try {
    const cfg = getCfg_();
    syncClanAndMembers_(cfg);
    return jsonOut_({ ok: true, message: "Sync complete" });
  } catch (e) {
    return jsonOut_({ ok: false, error: String(e) });
  }
}

function handlePlayerAddNote_(req) {
  const targetTag = String(req.params.targetTag || "").trim();
  const message = String(req.params.message || "").trim();
  const authTag = String(req.params.authTag || "").trim();
  const authName = String(req.params.authName || "").trim();
  const noteType = String(req.params.type || "member");

  if (!targetTag || !message || !authTag) return jsonOut_({ ok: false, error: "Missing params" });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("MembersCurrent");
  const headers = SHEETS.MembersCurrent.headers;
  const data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), headers.length).getValues();
  
  const tagIdx = headers.indexOf("playerTag");
  const roleIdx = headers.indexOf("role");
  const adminIdx = headers.indexOf("adminNote");
  const memberIdx = headers.indexOf("memberNote");

  const authUser = data.find(r => String(r[tagIdx]) === authTag);
  if (!authUser) return jsonOut_({ ok: false, error: "Auth failed" });
  const isManagement = (String(authUser[roleIdx]) === "coLeader" || String(authUser[roleIdx]) === "leader");

  const targetRowIdx = data.findIndex(r => String(r[tagIdx]) === targetTag);
  if (targetRowIdx === -1) return jsonOut_({ ok: false, error: "Not found" });

  const now = new Date().toISOString();

  if (noteType === "admin") {
    if (!isManagement) return jsonOut_({ ok: false, error: "Only Co-Leader/Leader can add admin notes" });
    let notes = [];
    try { notes = JSON.parse(data[targetRowIdx][adminIdx] || "[]"); } catch(e) { notes = []; }
    notes.push({ message, time: now, user: [authTag, authName] });
    sh.getRange(targetRowIdx + 2, adminIdx + 1).setValue(JSON.stringify(notes));
  } else {
    if (authTag !== targetTag) return jsonOut_({ ok: false, error: "Only the player can add their own member note" });
    let notes = [];
    try { notes = JSON.parse(data[targetRowIdx][memberIdx] || "[]"); } catch(e) { notes = []; }
    notes.push({ message, time: now });
    sh.getRange(targetRowIdx + 2, memberIdx + 1).setValue(JSON.stringify(notes));
  }
  return jsonOut_({ ok: true });
}

function handlePlayerDeleteNote_(req) {
  const targetTag = String(req.params.targetTag || "").trim();
  const timeId = String(req.params.time || "").trim();
  const authTag = String(req.params.authTag || "").trim();
  const noteType = String(req.params.type || "member");

  if (!targetTag || !timeId || !authTag) return jsonOut_({ ok: false, error: "Missing params" });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("MembersCurrent");
  const headers = SHEETS.MembersCurrent.headers;
  const data = sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), headers.length).getValues();
  
  const tagIdx = headers.indexOf("playerTag");
  const roleIdx = headers.indexOf("role");
  const adminIdx = headers.indexOf("adminNote");
  const memberIdx = headers.indexOf("memberNote");

  const authUser = data.find(r => String(r[tagIdx]) === authTag);
  if (!authUser) return jsonOut_({ ok: false, error: "Auth failed" });
  const isManagement = (String(authUser[roleIdx]) === "coLeader" || String(authUser[roleIdx]) === "leader");

  const targetRowIdx = data.findIndex(r => String(r[tagIdx]) === targetTag);
  if (targetRowIdx === -1) return jsonOut_({ ok: false, error: "Not found" });

  if (noteType === "admin" && !isManagement) return jsonOut_({ ok: false, error: "Denied" });
  if (noteType === "member" && authTag !== targetTag && !isManagement) return jsonOut_({ ok: false, error: "Denied" });

  const colIdx = (noteType === "admin") ? adminIdx : memberIdx;
  let notes = [];
  try { notes = JSON.parse(data[targetRowIdx][colIdx] || "[]"); } catch(e) { notes = []; }
  const filtered = notes.filter(n => String(n.time) !== timeId);
  sh.getRange(targetRowIdx + 2, colIdx + 1).setValue(JSON.stringify(filtered));

  return jsonOut_({ ok: true });
}

function handleClanMembers_(req) {
  const authTag = String(req.params.authTag || "").trim();

  // Enforce status = "IN" on the request filter so readSheetObjects_ filters it before slicing/paginating!
  if (!req.params) req.params = {};
  if (!req.params.filters || typeof req.params.filters !== "object") {
    req.params.filters = {};
  }
  req.params.filters.status = "IN";

  const raw = readSheetObjects_("MembersCurrent", req, { strategy: "replace", defaultSortBy: "townHallLevel", defaultSortDir: "desc" });

  const allMems = readAllSheetObjects_("MembersCurrent");
  const requester = allMems.find(m => m.playerTag === authTag);
  const isManagement = requester && (requester.role === "coLeader" || requester.role === "leader");

  const rows = raw.rows.map(r => {
    const item = {
      playerTag: r.playerTag,
      name: r.name,
      role: roleVi_(String(r.role || "").trim()),
      townHallLevel: r.townHallLevel,
      warStars: r.warStars,
      memberNote: r.memberNote,
      adminNote: isManagement ? r.adminNote : ""
    };
    return item;
  });

  return jsonOut_({ 
    ok: true, 
    ts: new Date().toISOString(), 
    resource: "clan-members", 
    totalAfterFilter: raw.totalAfterFilter, 
    rows: rows 
  });
}


function getValCI_(obj, key) {
  if (!obj || !key) return "";
  const target = key.toLowerCase();
  const found = Object.keys(obj).find(k => k.toLowerCase() === target);
  return found ? obj[found] : "";
}


function handleAccessStats_(req) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("data");
  if (!sh) {
    sh = ss.insertSheet("data");
    sh.getRange(1, 1).setValue("access_time");
    sh.getRange(2, 1).setValue(0);
  }
  
  let count = Number(sh.getRange(2, 1).getValue() || 0);
  const update = String(req.params.update || "").toLowerCase() === "true";
  
  if (update) {
    count++;
    sh.getRange(2, 1).setValue(count);
  }
  
  return jsonOut_({ ok: true, total: count });
}

function normalizeSearchStr_(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function handleAnnouncements_(req) {
  const raw = readSheetObjects_("Announcements", req, { strategy: "replace", defaultSortBy: "ts", defaultSortDir: "desc" });
  return jsonOut_({
    ok: true,
    ts: new Date().toISOString(),
    resource: "announcements",
    totalAfterFilter: raw.totalAfterFilter,
    rows: raw.rows
  });
}

function handleAnnouncementsCreate_(req) {
  const authTag = String(req.params.authTag || "").trim().toUpperCase();
  const token = String(req.params.token || "").trim();
  const title = String(req.params.title || "").trim();
  const content = String(req.params.content || "").trim();
  const imageUrls = String(req.params.imageUrls || "").trim();
  const youtubeUrl = String(req.params.youtubeUrl || "").trim();
  
  if (!authTag || !token || !title || !content) {
    return jsonOut_({ ok: false, error: "Missing required parameters (authTag, token, title, content)" });
  }
  
  if (authTag !== "#VCVQQCUJ") {
    return jsonOut_({ ok: false, error: "Only player #VCVQQCUJ is authorized to create announcements" });
  }

  // Verify auth token in MembersCurrent
  const members = readAllSheetObjects_("MembersCurrent");
  const player = members.find(m => String(m.playerTag || "").trim().toUpperCase() === authTag);
  if (!player) {
    return jsonOut_({ ok: false, error: "Author not found in current members list" });
  }
  
  const status = String(getValCI_(player, "status") || "IN").toUpperCase();
  if (status !== "IN") {
    return jsonOut_({ ok: false, error: "Author is no longer in the clan" });
  }

  const existingToken = String(getValCI_(player, "token") || "").trim();
  if (!existingToken || existingToken !== token) {
    return jsonOut_({ ok: false, error: "Authentication failed. Session expired or invalid token." });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Announcements");
  if (!sh) {
    return jsonOut_({ ok: false, error: "Announcements sheet not found" });
  }

  const nowIso = new Date().toISOString();
  const id = md5Hex_(`${authTag}|${nowIso}|${Math.random()}`);

  const row = cleanRow_([
    id,
    nowIso,
    authTag,
    player.name || "",
    title,
    content,
    "", // imageUrl (legacy column, leave empty)
    imageUrls,
    youtubeUrl
  ]);

  sh.appendRow(row);

  return jsonOut_({ ok: true, message: "Announcement created successfully", id: id });
}

function handleAnnouncementsDelete_(req) {
  const authTag = String(req.params.authTag || "").trim().toUpperCase();
  const token = String(req.params.token || "").trim();
  const id = String(req.params.id || "").trim();
  
  if (!authTag || !token || !id) {
    return jsonOut_({ ok: false, error: "Missing required parameters (authTag, token, id)" });
  }
  
  if (authTag !== "#VCVQQCUJ") {
    return jsonOut_({ ok: false, error: "Only player #VCVQQCUJ is authorized to delete announcements" });
  }

  // Verify auth token in MembersCurrent
  const members = readAllSheetObjects_("MembersCurrent");
  const player = members.find(m => String(m.playerTag || "").trim().toUpperCase() === authTag);
  if (!player) {
    return jsonOut_({ ok: false, error: "Author not found in current members list" });
  }
  
  const existingToken = String(getValCI_(player, "token") || "").trim();
  if (!existingToken || existingToken !== token) {
    return jsonOut_({ ok: false, error: "Authentication failed. Session expired or invalid token." });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("Announcements");
  if (!sh) {
    return jsonOut_({ ok: false, error: "Announcements sheet not found" });
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return jsonOut_({ ok: false, error: "No announcements found" });
  }

  const data = sh.getRange(2, 1, lastRow - 1, 1).getValues(); // Read ID column
  let rowToDelete = -1;
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === id) {
      rowToDelete = i + 2; // 1-based index including header
      break;
    }
  }

  if (rowToDelete === -1) {
    return jsonOut_({ ok: false, error: "Announcement not found" });
  }

  sh.deleteRow(rowToDelete);

  return jsonOut_({ ok: true, message: "Announcement deleted successfully" });
}
