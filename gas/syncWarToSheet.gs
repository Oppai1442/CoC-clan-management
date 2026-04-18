/***************
 * Oppai CoC Collector (NO WEB API)
 * - Poll every 30 minutes
 * - MemberEvents: JOIN/LEAVE/NAME_CHANGE/PROMOTE/DEMOTE (diff each poll)
 * - War system:
 *    - CW (normal war): attacksRequired = attacksPerMember (usually 2)
 *    - CWL: attacksRequired = 1
 *    - "git commit": only write when war digest changes
 * - History:
 *    - WarHistory (1 row/war at warEnded)
 *    - WarMembers (upsert per war per member)
 *    - WarAttacks (append unique attacks)
 *    - MemberWarHistory (append status per member per warEnded)
 * - Stats like python:
 *    - wars_joined/participated/completed/dropped/incomplete + rates
 *    - split by CW vs CWL
 * - Capital raids: seasons + members
 ***************/

/* =========================
 * SHEETS
 * ========================= */
const SHEETS = {
  data: {
    headers: [
      "access_time",
      "link"
    ]
  },
  ClanCurrent: {
    headers: [
      "ts",
      "clanTag",
      "clanName",
      "clanLevel", "clanPoints", "clanVersusPoints", "members",
      "type", "warFrequency",
      "warWinStreak", "warWins", "warTies", "warLosses"
    ]
  },
  MembersCurrent: {
    headers: [
      "ts",
      "clanTag", "clanName",
      "playerTag", "name", "role",
      "expLevel",
      "trophies", "versusTrophies",
      "donations", "donationsReceived",
      "builderBaseTrophies",
      "clanRank", "previousClanRank",
      "league",
      "warPreference",
      "townHallLevel", "builderHallLevel",
      "warStars",
      "clanCapitalContributions",
      "adminNote",
      "memberNote",
      "status" // Cột mới để biết còn trong clan không
    ]
  },

  MemberEvents: {
    headers: [
      "eventId", "ts",
      "clanTag", "clanName",
      "type",           // JOIN | LEAVE | NAME_CHANGE | PROMOTE | DEMOTE
      "playerTag",
      "playerName",
      "oldValue",
      "newValue"
    ]
  },

  // Unified war system
  WarCurrent: {
    headers: [
      "ts",
      "warType",         // CW | CWL
      "sourceId",        // CW: "CW"; CWL: warTag
      "warKey",
      "state",
      "prepStart", "startTime", "endTime",
      "teamSize",
      "attacksPerMember",
      "clanTag", "clanName",
      "clanStars", "oppStars",
      "clanDestruction", "oppDestruction",
      "opponentTag", "opponentName"
    ]
  },

  WarHistory: {
    headers: [
      "warKey",
      "warType",         // CW | CWL
      "sourceId",
      "firstSeenTs",
      "finalTs",
      "result",          // win|lose|draw
      "prepStart", "startTime", "endTime",
      "teamSize",
      "attacksPerMember",
      "clanTag", "clanName",
      "clanStars", "oppStars",
      "clanDestruction", "oppDestruction",
      "opponentTag", "opponentName"
    ]
  },

  WarMembers: {
    headers: [
      "warMemberId",
      "ts",
      "warKey",
      "warType",
      "sourceId",
      "clanTag", "clanName",
      "playerTag",
      "playerName",
      "mapPosition",
      "attacksDone",
      "attacksRequired", // CW=2 usually, CWL=1
      "starsTotal",
      "bestDestruction",
      "missingAttacks"
    ]
  },

  WarAttacks: {
    headers: [
      "attackId",
      "warKey",
      "warType",
      "sourceId",
      "side",            // clan
      "attackerTag",
      "attackerName",
      "defenderTag",
      "stars",
      "destructionPct",
      "order"
    ]
  },

  // Per-member per-war outcome (like python "history label")
  MemberWarHistory: {
    headers: [
      "rowId",
      "ts",
      "warKey",
      "warType",
      "clanTag", "clanName",
      "playerTag",
      "playerName",
      "status"            // Joined | Participated | Finished | Incomplete | Dropped
    ]
  },

  // Stats like python + split CW/CWL
  WarStats: {
    headers: [
      "ts",
      "clanTag", "clanName",
      "playerTag",
      "lastName",

      // overall like python
      "wars_joined",
      "wars_participated",
      "wars_completed",
      "wars_dropped",
      "wars_incomplete",
      "participation_rate_pct",
      "completion_rate_pct",
      "drop_rate_pct",
      "incomplete_rate_pct",

      // totals
      "total_attacks_done",
      "total_attacks_required",

      // CW only
      "cw_wars_joined",
      "cw_attacks_done",
      "cw_attacks_required",
      "cw_completion_rate_pct",

      // CWL only
      "cwl_wars_joined",
      "cwl_attacks_done",
      "cwl_attacks_required",
      "cwl_completion_rate_pct"
    ]
  },

  RaidSeasons: {
    headers: [
      "raidId", "ts",
      "clanTag", "clanName",
      "startTime", "endTime",
      "capitalTotalLoot",
      "raidsCompleted",
      "totalAttacks",
      "enemyDistrictsDestroyed",
      "offensiveReward",
      "defensiveReward"
    ]
  },
  RaidMembers: {
    headers: [
      "raidMemberId",
      "raidId",
      "playerTag",
      "name",
      "attacks",
      "attackLimit",
      "capitalResourcesLooted"
    ]
  },

  CWLSeasonHistory: {
    headers: [
      "seasonKey",
      "tsFirstSeen",
      "tsFinal",
      "clanTag", "clanName",
      "season",
      "roundsTotal",
      "roundsEnded",
      "roundsWon",
      "roundsLost",
      "roundsDraw"
    ]
  },
  CWLRounds: {
    headers: [
      "roundKey",
      "seasonKey",
      "season",
      "roundIndex",
      "warTag",
      "ts",
      "state",
      "startTime",
      "endTime",
      "teamSize",
      "clanTag", "clanName",
      "clanStars", "oppStars",
      "clanDestruction", "oppDestruction",
      "opponentTag", "opponentName",
      "result" // win|lose|draw
    ]
  },
  CWLRoundMembers: {
    headers: [
      "roundMemberId",
      "roundKey",
      "seasonKey",
      "season",
      "roundIndex",
      "ts",
      "playerTag",
      "playerName",
      "mapPosition",
      "attacksDone",        // 0|1
      "attacksRequired",    // always 1
      "starsTotal",
      "bestDestruction",
      "missingAttacks"
    ]
  },
  CWLRoundAttacks: {
    headers: [
      "attackId",
      "roundKey",
      "seasonKey",
      "season",
      "roundIndex",
      "warTag",
      "attackerTag",
      "attackerName",
      "defenderTag",
      "stars",
      "destructionPct",
      "order"
    ]
  },

};

/* =========================
 * SETUP + RUN
 * ========================= */
function setupCollector() {
  ensureSheets_();
  removeCollectorTriggers_();

  ScriptApp.newTrigger("runCollector")
    .timeBased()
    .everyMinutes(30)
    .create();

  Logger.log("✅ Setup xong: sheets + trigger 30 phút.");
}

function runCollector() {
  const cfg = getCfg_();
  ensureSheets_();

  // 1) Clan + members current + MemberEvents (diff)
  syncClanAndMembers_(cfg);

  // 2) Wars (CW + CWL)
  syncWarCW_(cfg);
  syncWarCWLSeason_(cfg);

  // 3) Capital raid
  syncRaidSeasons_(cfg);

  Logger.log("✅ runCollector done.");
}

/* =========================
 * CONFIG + HTTP
 * ========================= */
function getCfg_() {
  const props = PropertiesService.getScriptProperties();

  const token = props.getProperty("COC_API_TOKEN");
  const clanTagRaw = props.getProperty("CLAN_TAG");
  const baseUrl = props.getProperty("BASE_URL") || "https://cocproxy.royaleapi.dev/v1";
  const batchSize = parseInt(props.getProperty("PLAYER_PROFILE_BATCH_SIZE") || "10", 10);
  const ttlSec = parseInt(props.getProperty("PLAYER_PROFILE_TTL_SEC") || "86400", 10);

  if (!token) throw new Error("Missing Script Property: COC_API_TOKEN");
  if (!clanTagRaw) throw new Error("Missing Script Property: CLAN_TAG (ví dụ: #2LQGPYVRV)");

  const clanTag = clanTagRaw.trim().startsWith("#") ? clanTagRaw.trim() : ("#" + clanTagRaw.trim());

  return {
    token,
    clanTag,
    clanTagEnc: encodeURIComponent(clanTag),
    baseUrl,
    playerProfileBatchSize: isNaN(batchSize) ? 10 : batchSize,
    playerProfileTtlSec: isNaN(ttlSec) ? 86400 : ttlSec
  };
}

function cocGet_(cfg, path, queryObj) {
  const qs = queryObj ? "?" + toQuery_(queryObj) : "";
  const url = cfg.baseUrl.replace(/\/$/, "") + path + qs;

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "Authorization": "Bearer " + cfg.token,
      "Accept": "application/json"
    },
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  const text = resp.getContentText();

  if (code >= 200 && code < 300) return JSON.parse(text);

  Logger.log("HTTP " + code + " url=" + url + " body=" + text);
  throw new Error("HTTP " + code + " from " + url);
}

function toQuery_(obj) {
  return Object.keys(obj)
    .filter(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== "")
    .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(String(obj[k])))
    .join("&");
}

function md5Hex_(s) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return raw.map(b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

function roleRank_(role) {
  const r = String(role || "");
  const map = { member: 1, admin: 2, coLeader: 3, leader: 4 };
  return map[r] || 0;
}

/* =========================
 * SHEET HELPERS
 * ========================= */
function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    ensureHeaders_(sh, SHEETS[name].headers);
  });
}

function ensureHeaders_(sh, desiredHeaders) {
  const lastRow = sh.getLastRow();

  if (lastRow === 0) {
    sh.getRange(1, 1, 1, desiredHeaders.length).setValues([desiredHeaders]);
    sh.setFrozenRows(1);
    return;
  }

  const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const exact = (existing.length === desiredHeaders.length) && desiredHeaders.every((h, i) => h === existing[i]);
  if (exact) return;

  const isPrefix = desiredHeaders.slice(0, existing.length).every((h, i) => h === existing[i]);
  if (isPrefix) {
    const missing = desiredHeaders.slice(existing.length);
    if (missing.length) sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    sh.setFrozenRows(1);
    return;
  }

  Logger.log(`⚠️ Header mismatch in "${sh.getName()}". Auto-fix skipped.`);
}

function overwriteSingleRow_(sheetName, row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Missing sheet: " + sheetName);

  const headers = SHEETS[sheetName].headers;
  ensureHeaders_(sh, headers);

  sh.getRange(2, 1, 1, headers.length).setValues([row]);

  const last = sh.getLastRow();
  if (last > 2) sh.getRange(3, 1, last - 2, headers.length).clearContent();
}

function overwriteTable_(sheetName, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Missing sheet: " + sheetName);

  const headers = SHEETS[sheetName].headers;
  ensureHeaders_(sh, headers);

  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, headers.length).clearContent();

  if (!rows || !rows.length) return;
  try {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  } catch (e) {
    console.log(sheetName)
  }
}

function appendUniqueRows_(sheetName, idColIndex1Based, rows) {
  if (!rows || rows.length === 0) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Missing sheet: " + sheetName);

  const lastRow = sh.getLastRow();
  const startRow = 2;

  const existing = new Set();
  if (lastRow >= startRow) {
    const ids = sh.getRange(startRow, idColIndex1Based, lastRow - startRow + 1, 1).getValues().flat();
    ids.forEach(v => { if (v) existing.add(String(v)); });
  }

  const filtered = rows.filter(r => {
    const id = String(r[idColIndex1Based - 1] || "");
    if (!id) return false;
    if (existing.has(id)) return false;
    existing.add(id);
    return true;
  });

  if (!filtered.length) return;

  sh.getRange(sh.getLastRow() + 1, 1, filtered.length, filtered[0].length).setValues(filtered);
}

function upsertRowsById_(sheetName, idColIndex1Based, rows) {
  if (!rows || rows.length === 0) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("Missing sheet: " + sheetName);

  const lastRow = sh.getLastRow();
  const startRow = 2;

  const idToRow = new Map();
  if (lastRow >= startRow) {
    const ids = sh.getRange(startRow, idColIndex1Based, lastRow - startRow + 1, 1).getValues();
    ids.forEach((v, i) => {
      const id = String(v[0] || "");
      if (id) idToRow.set(id, startRow + i);
    });
  }

  const toAppend = [];
  rows.forEach(r => {
    const id = String(r[idColIndex1Based - 1] || "");
    if (!id) return;
    const rowIndex = idToRow.get(id);
    if (rowIndex) sh.getRange(rowIndex, 1, 1, r.length).setValues([r]);
    else toAppend.push(r);
  });

  if (toAppend.length) {
    sh.getRange(sh.getLastRow() + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
  }
}



/* =========================
 * 1) CLAN + MEMBERS + MEMBER EVENTS
 * ========================= */
function getPlayerProfilesSlim_(cfg, tags, maxFetch, ttlSec) {
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();

  const uniq = Array.from(new Set((tags || []).map(t => String(t || "").trim()).filter(Boolean)));
  if (!uniq.length) return {};

  // read cache in bulk
  const keys = uniq.map(t => "P:" + t);
  const cached = cache.getAll(keys);

  const out = {};
  const miss = new Set();

  uniq.forEach(t => {
    const k = "P:" + t;
    if (cached && cached[k]) {
      try { out[t] = JSON.parse(cached[k]); }
      catch (_) { miss.add(t); }
    } else {
      miss.add(t);
    }
  });

  const cap = Math.max(0, Number(maxFetch || 0));
  if (!cap) return out;

  // round-robin pointer so missing tags will be filled gradually
  let ptr = parseInt(props.getProperty("PLAYER_PROFILE_PTR") || "0", 10);
  if (!Number.isFinite(ptr)) ptr = 0;

  const n = uniq.length;
  let fetched = 0;
  let scanned = 0;

  for (let step = 0; step < n && fetched < cap; step++) {
    const idx = (ptr + step) % n;
    const tag = uniq[idx];
    scanned++;

    if (!miss.has(tag)) continue;

    try {
      const encodedTag = tag.startsWith('#') ? tag.replace('#', '%23') : `%23${tag}`;
      const p = cocGet_(cfg, `/players/${encodedTag}`);
      
      // store only what we need -> cache nhỏ, nhanh
      const slim = {
        townHallLevel: p && p.townHallLevel != null ? p.townHallLevel : "",
        builderHallLevel: p && p.builderHallLevel != null ? p.builderHallLevel : "",
        warStars: p && p.warStars != null ? p.warStars : "",
        clanCapitalContributions: p && p.clanCapitalContributions != null ? p.clanCapitalContributions : "",
        builderBaseTrophies: p && p.builderBaseTrophies != null ? p.builderBaseTrophies : "",
        warPreference: p && p.warPreference != null ? p.warPreference : "",
        attackWins: p && p.attackWins != null ? p.attackWins : "",
        defenseWins: p && p.defenseWins != null ? p.defenseWins : ""
      };
      console.log(slim)
      out[tag] = slim;
      cache.put("P:" + tag, JSON.stringify(slim), Math.max(60, Number(ttlSec || 86400))); // default 24h
      fetched++;

      Utilities.sleep(120); // chống 429 nhẹ
    } catch (e) {
      // ignore từng người
      console.log(`Ignore: ${tag} | reason: ${e}`)
    }
  }

  // move pointer forward
  props.setProperty("PLAYER_PROFILE_PTR", String((ptr + scanned) % n));
  return out;
}


function syncClanAndMembers_(cfg) {
  const nowIso = new Date().toISOString();

  // 1. Lấy dữ liệu Clan từ API
  const clan = cocGet_(cfg, `/clans/${cfg.clanTagEnc}`);
  const clanName = String(clan.name || "");

  overwriteSingleRow_("ClanCurrent", [
    nowIso, cfg.clanTag, clanName,
    clan.clanLevel || "", clan.clanPoints || "", clan.clanVersusPoints || "",
    clan.members || "", clan.type || "", clan.warFrequency || "",
    clan.warWinStreak || "", clan.warWins || "", clan.warTies || "", clan.warLosses || ""
  ].map(String));

  // 2. Lấy danh sách thành viên hiện tại từ API
  const membersApi = cocGet_(cfg, `/clans/${cfg.clanTagEnc}/members`, { limit: 50 });
  const items = membersApi.items || [];
  const tags = items.map(m => m.tag).filter(Boolean);

  // 3. Fetch thông tin chi tiết (theo batch và cache)
  const profileBatch = Number(cfg.playerProfileBatchSize || 10);
  const profileTtlSec = Number(cfg.playerProfileTtlSec || 86400);
  const profMap = getPlayerProfilesSlim_(cfg, tags, profileBatch, profileTtlSec);

  // 4. ĐỌC DỮ LIỆU CŨ TỪ SHEET ĐỂ BẢO TOÀN (Note và các profile cũ)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("MembersCurrent");
  const existingMap = new Map();
  const headers = SHEETS.MembersCurrent.headers;
  const idxMap = {};
  headers.forEach((h, i) => idxMap[h] = i);
  
  if (sh && sh.getLastRow() >= 2) {
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
    const tagIdx = idxMap["playerTag"];
    data.forEach(row => {
      const tag = String(row[tagIdx] || "");
      if (tag) existingMap.set(tag, row);
    });
  }

            // 5. MERGE DỮ LIỆU CŨ VÀ MỚI
          const currentTagsSet = new Set(tags);
          const snapRows = items.map(m => {
            const tag = m.tag;
            const p = profMap[tag];           // Dữ liệu từ API vừa fetch (hoặc cache)
            const oldRow = existingMap.get(tag); // Dữ liệu cũ đang nằm trên sheet
        
            // Helper: Ưu tiên API > Nếu không có thì dùng Sheet cũ > Cuối cùng mới để trống
            const getVal = (fieldName, apiVal) => {
              if (apiVal !== undefined && apiVal !== null && apiVal !== "") return apiVal;
              const i = idxMap[fieldName];
              if (oldRow && i !== undefined) return oldRow[i];
              return "";
            };
        
            return cleanRow_([
              nowIso,
              cfg.clanTag,
              clanName,
              tag || "",
              m.name || "",
              m.role || "",
              m.expLevel || "",
              m.trophies || "",
              m.versusTrophies || "",
              m.donations || "",
              m.donationsReceived || "",
              // builderBaseTrophies: ưu tiên profile (p) > member list (m) > sheet cũ
              getVal("builderBaseTrophies", p ? p.builderBaseTrophies : (m.builderBaseTrophies || "")),   
              m.clanRank || "",
              m.previousClanRank || "",
              (m.league && m.league.name) ? m.league.name : "",
              getVal("warPreference", p ? p.warPreference : ""),
              getVal("townHallLevel", p ? p.townHallLevel : ""),
              getVal("builderHallLevel", p ? p.builderHallLevel : ""),
              getVal("warStars", p ? p.warStars : ""),
              getVal("clanCapitalContributions", p ? p.clanCapitalContributions : ""),
              // Bảo toàn ghi chú (API không có nên sẽ luôn lấy từ sheet cũ)
              getVal("adminNote", ""),
              getVal("memberNote", ""),
              "IN" // Đang ở trong Clan
            ]);
          });
      
          // 5.1 Xác định những người đã RỜI CLAN (Có trong sheet cũ nhưng không có trong API mới)
          const outRows = [];
          existingMap.forEach((oldRow, tag) => {
            if (!currentTagsSet.has(tag)) {
              // Người này đã out. Cập nhật status = OUT, giữ nguyên Note
              const updatedRow = [...oldRow];
              // Đảm bảo hàng có đủ độ dài cho cột status mới
              while (updatedRow.length < SHEETS.MembersCurrent.headers.length) updatedRow.push("");
              updatedRow[idxMap["status"]] = "OUT";
              updatedRow[idxMap["ts"]] = nowIso;
              outRows.push(cleanRow_(updatedRow));
            }
          });
      
          const allRowsToSync = [...snapRows, ...outRows];
      
        // 6. CẬP NHẬT DỮ LIỆU
        // playerTag nằm ở cột thứ 4 (index 1-based)
        upsertRowsById_("MembersCurrent", 4, allRowsToSync);
  // 7. Xử lý MemberEvents (giữ nguyên logic cũ)
  const props = PropertiesService.getScriptProperties();
  const prevJson = props.getProperty("MEMBER_STATE_JSON");
  const prev = prevJson ? JSON.parse(prevJson) : null;
  const curr = {};
  items.forEach(m => curr[m.tag] = { name: m.name || "", role: m.role || "" });

  if (!prev) {
    props.setProperty("MEMBER_STATE_JSON", JSON.stringify(curr));
    props.setProperty("MEMBER_STATE_INIT_AT", nowIso);
    return;
  }

  const eventRows = [];
  const makeEventId = (type, tag, ts, oldV, newV) => md5Hex_(`${type}|${tag}|${ts}|${oldV}|${newV}`);

  Object.keys(curr).forEach(tag => {
    const name = curr[tag].name;
    const role = curr[tag].role;

    if (!prev[tag]) {
      // JOIN: Để trống old/new value cho sạch
      eventRows.push([makeEventId("JOIN", tag, nowIso, "", ""), nowIso, cfg.clanTag, clanName, "JOIN", tag, name, "", ""]);
    } else {
      if (prev[tag].name !== curr[tag].name) {
        // NAME_CHANGE: Lưu tên cũ và tên mới
        eventRows.push(
          [makeEventId("NAME_CHANGE", tag, nowIso, prev[tag].name, curr[tag].name),
           nowIso, cfg.clanTag, clanName, "NAME_CHANGE", tag, name, prev[tag].name, curr[tag].name]);
      }
      if (prev[tag].role !== curr[tag].role) {
        // ROLE_CHANGE: Lưu chức vụ cũ và mới
        const oldR = prev[tag].role, newR = curr[tag].role;
        const type = roleRank_(newR) > roleRank_(oldR) ? "PROMOTE" : roleRank_(newR) < roleRank_(oldR) ? "DEMOTE" : "ROLE_CHANGE";
        eventRows.push(
          [makeEventId(type, tag, nowIso, oldR, newR), 
           nowIso, cfg.clanTag, clanName, type, tag, name, oldR, newR]);
      }
    }
  });

  Object.keys(prev).forEach(tag => {
    if (!curr[tag]) {
      // LEAVE: Để trống old/new value cho sạch
      const name = prev[tag].name;
      const role = prev[tag].role;
      eventRows.push(
        [makeEventId("LEAVE", tag, nowIso, "", ""),
          nowIso, cfg.clanTag, clanName, "LEAVE", tag, name, "", ""]);
    }
  });

  appendUniqueRows_("MemberEvents", 1, eventRows);
  props.setProperty("MEMBER_STATE_JSON", JSON.stringify(curr));
}



/* =========================
 * 2) WARS (CW + CWL) — unified commit system
 * ========================= */
function warKeyCW_(cfg, war) {
  return md5Hex_(`${cfg.clanTag}|${war.preparationStartTime || ""}|${war.startTime || ""}|${war.endTime || ""}`);
}
function warKeyCWL_(warTag) {
  return `CWL:${warTag}`;
}
function warResult_(clanStars, oppStars, clanDes, oppDes) {
  const cs = Number(clanStars || 0);
  const os = Number(oppStars || 0);
  const cd = Number(clanDes || 0);
  const od = Number(oppDes || 0);

  if (cs > os) return "win";
  if (cs < os) return "lose";
  if (cd > od) return "win";
  if (cd < od) return "lose";
  return "draw";
}
function warDigest_(war) {
  const pick = {
    state: war.state || "",
    prep: war.preparationStartTime || "",
    start: war.startTime || "",
    end: war.endTime || "",
    teamSize: war.teamSize || "",
    apm: war.attacksPerMember || "",
    clanStars: war.clan?.stars ?? "",
    oppStars: war.opponent?.stars ?? "",
    clanDes: war.clan?.destructionPercentage ?? "",
    oppDes: war.opponent?.destructionPercentage ?? "",
    roster: (war.clan?.members || [])
      .map(m => [m.tag || "", (m.attacks || []).length])
      .sort((a, b) => a[0].localeCompare(b[0]))
  };
  return md5Hex_(JSON.stringify(pick));
}
function propKeyForWar_(prefix, warKey) {
  return prefix + md5Hex_(warKey); // keep property key short
}
function getWarDigestPrev_(warKey) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(propKeyForWar_("WAR_DIGEST_", warKey)) || "";
}
function setWarDigest_(warKey, digest) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(propKeyForWar_("WAR_DIGEST_", warKey), digest);
}
function getFirstSeen_(warKey, nowIso) {
  const props = PropertiesService.getScriptProperties();
  const k = propKeyForWar_("WAR_FIRST_SEEN_", warKey);
  const v = props.getProperty(k);
  if (v) return v;
  props.setProperty(k, nowIso);
  return nowIso;
}

function statusLabel_(attacksDone, attacksReq, warEnded) {
  const done = Number(attacksDone || 0);
  const req = Number(attacksReq || 0);

  if (!warEnded) {
    if (done >= req && req > 0) return "Finished";
    if (done > 0) return "Participated";
    return "Joined";
  }

  // warEnded:
  if (done >= req && req > 0) return "Finished";
  if (done === 0) return "Dropped";
  return "Incomplete";
}

function commitWarObject_(cfg, war, warType, sourceId, attacksRequiredOverride) {
  const nowIso = new Date().toISOString();

  const clanTag = cfg.clanTag;
  const clanName = String(war.clan?.name || ""); // usually same as cfg but keep safe
  const oppTag = String(war.opponent?.tag || "");
  const oppName = String(war.opponent?.name || "");

  const warKey = (warType === "CWL")
    ? warKeyCWL_(sourceId)            // sourceId = warTag
    : warKeyCW_(cfg, war);

  const apm = Number(war.attacksPerMember || 0) || 0;
  const attacksRequired = (typeof attacksRequiredOverride === "number")
    ? attacksRequiredOverride
    : apm;

  // git-diff: only write when digest changes
  const digest = warDigest_(war);
  const prevDigest = getWarDigestPrev_(warKey);
  if (prevDigest && prevDigest === digest) return;

  setWarDigest_(warKey, digest);
  const firstSeen = getFirstSeen_(warKey, nowIso);

  // WarCurrent (overwrite single row) — but only runs when digest changed
  overwriteSingleRow_("WarCurrent", cleanRow_([
    nowIso,
    warType,
    sourceId,
    warKey,
    war.state || "",
    war.preparationStartTime || "",
    war.startTime || "",
    war.endTime || "",
    war.teamSize || "",
    apm || attacksRequired,
    clanTag,
    clanName,
    war.clan?.stars ?? "",
    war.opponent?.stars ?? "",
    war.clan?.destructionPercentage ?? "",
    war.opponent?.destructionPercentage ?? "",
    oppTag,
    oppName
  ]));

  // WarMembers (upsert per war per member)
  const memberRows = (war.clan?.members || []).map(m => {
    const attacks = m.attacks || [];
    const attacksDone = attacks.length;

    const starsTotal = attacks.reduce((s, a) => s + (Number(a.stars || 0) || 0), 0);
    const bestDes = attacks.reduce((mx, a) => Math.max(mx, Number(a.destructionPercentage || 0) || 0), 0);
    const missing = Math.max(0, attacksRequired - attacksDone);

    const warMemberId = md5Hex_(`${warKey}|${m.tag || ""}`);
    return cleanRow_([
      warMemberId,
      nowIso,
      warKey,
      warType,
      sourceId,
      clanTag,
      clanName,
      m.tag || "",
      m.name || "",
      m.mapPosition || "",
      attacksDone,
      attacksRequired,
      starsTotal,
      bestDes,
      missing
    ]);
  });
  upsertRowsById_("WarMembers", 1, memberRows);

  // WarAttacks (append unique)
  const attackRows = [];
  (war.clan?.members || []).forEach(m => {
    (m.attacks || []).forEach(a => {
      const attackId = md5Hex_(`${warKey}|clan|${m.tag || ""}|${a.order}`);
      attackRows.push(cleanRow_([
        attackId,
        warKey,
        warType,
        sourceId,
        "clan",
        m.tag || "",
        m.name || "",
        a.defenderTag || "",
        a.stars ?? "",
        a.destructionPercentage ?? "",
        a.order ?? ""
      ]));
    });
  });
  appendUniqueRows_("WarAttacks", 1, attackRows);

  // War ended => commit WarHistory + MemberWarHistory + recompute stats
  const warEnded = String(war.state || "") === "warEnded";
  if (!warEnded) return;

  const result = warResult_(
    war.clan?.stars ?? 0,
    war.opponent?.stars ?? 0,
    war.clan?.destructionPercentage ?? 0,
    war.opponent?.destructionPercentage ?? 0
  );

  appendUniqueRows_("WarHistory", 1, [cleanRow_([
    warKey,
    warType,
    sourceId,
    firstSeen,
    nowIso,
    result,
    war.preparationStartTime || "",
    war.startTime || "",
    war.endTime || "",
    war.teamSize || "",
    apm || attacksRequired,
    clanTag,
    clanName,
    war.clan?.stars ?? "",
    war.opponent?.stars ?? "",
    war.clan?.destructionPercentage ?? "",
    war.opponent?.destructionPercentage ?? "",
    oppTag,
    oppName
  ])]);

  // Per-member per-war status like python history labels
  const histRows = (war.clan?.members || []).map(m => {
    const done = (m.attacks || []).length;
    const label = statusLabel_(done, attacksRequired, true);
    const rowId = md5Hex_(`${warKey}|${m.tag || ""}|${label}`);
    return cleanRow_([
      rowId,
      nowIso,
      warKey,
      warType,
      clanTag,
      clanName,
      m.tag || "",
      m.name || "",
      label
    ]);
  });
  appendUniqueRows_("MemberWarHistory", 1, histRows);

  computeWarStats_(clanTag, clanName);
}

function syncWarCW_(cfg) {
  let war;
  try {
    war = cocGet_(cfg, `/clans/${cfg.clanTagEnc}/currentwar`);
  } catch (e) {
    Logger.log("CW skipped: " + e.message);
    return;
  }

  const required = Number(war.attacksPerMember || 2) || 2;
  commitWarObject_(cfg, war, "CW", "CW", required);
}

function syncWarCWLSeason_(cfg) {
  const nowIso = new Date().toISOString();

  let group;
  try {
    group = cocGet_(cfg, `/clans/${cfg.clanTagEnc}/currentwar/leaguegroup`);
  } catch (e) {
    Logger.log("CWL group not available: " + e.message);
    return;
  }

  const season = String(group.season || "");
  if (!season) {
    Logger.log("CWL group has no season field.");
    return;
  }

  // seasonKey: 1 season == 1 war
  const seasonKey = `CWLSEASON:${md5Hex_(cfg.clanTag + "|" + season)}`;

  // firstSeen / finalSeen tracking
  const props = PropertiesService.getScriptProperties();
  const firstKey = "CWL_SEASON_FIRST_" + md5Hex_(seasonKey);
  const finalKey = "CWL_SEASON_FINAL_" + md5Hex_(seasonKey);

  const firstSeen = props.getProperty(firstKey) || nowIso;
  if (!props.getProperty(firstKey)) props.setProperty(firstKey, firstSeen);

  // clanName lấy từ ClanCurrent cho chắc
  const clanName = readClanNameFromSheet_() || "";

  // collect all warTags
  const rounds = group.rounds || [];
  const warTags = [];
  rounds.forEach((r, idx) => {
    (r.warTags || []).forEach(wt => {
      if (wt && wt !== "#0") warTags.push({ warTag: wt, roundIndex: idx });
    });
  });

  if (warTags.length === 0) {
    Logger.log("CWL group has no warTags.");
    return;
  }

  // fetch each round war, commit round-level sheets
  const roundSummaries = [];
  warTags.slice(0, 15).forEach(x => {
    const warTag = x.warTag;
    const roundIndex = x.roundIndex;

    const warTagEnc = encodeURIComponent(warTag.trim().startsWith("#") ? warTag.trim() : ("#" + warTag.trim()));

    let w;
    try {
      w = cocGet_(cfg, `/clanwarleagues/wars/${warTagEnc}`);
    } catch (e) {
      Logger.log("CWL war fetch failed " + warTag + ": " + e.message);
      return;
    }

    const roundInfo = commitCwlRound_(cfg, seasonKey, season, roundIndex, warTag, w, clanName);
    if (roundInfo) roundSummaries.push(roundInfo);
  });

  // aggregate season stats per member (based on CWLRoundMembers)
  commitCwlSeasonAggregate_(cfg, seasonKey, season, clanName);

  // season end detection: all fetched rounds are warEnded AND count matches (best-effort)
  const roundsTotal = warTags.length;
  const roundsEnded = roundSummaries.filter(r => r.state === "warEnded").length;

  let roundsWon = 0, roundsLost = 0, roundsDraw = 0;
  roundSummaries.forEach(r => {
    if (r.result === "win") roundsWon++;
    else if (r.result === "lose") roundsLost++;
    else if (r.result === "draw") roundsDraw++;
  });

  const seasonEnded = (roundSummaries.length > 0) && (roundsEnded === roundSummaries.length) && (roundSummaries.length >= Math.min(7, roundsTotal));

  if (seasonEnded) {
    const finalSeen = nowIso;
    props.setProperty(finalKey, finalSeen);

    // CWLSeasonHistory: 1 row/seasonKey
    upsertRowsById_("CWLSeasonHistory", 1, [[
      seasonKey,
      firstSeen,
      finalSeen,
      cfg.clanTag,
      clanName,
      season,
      String(roundsTotal),
      String(roundsEnded),
      String(roundsWon),
      String(roundsLost),
      String(roundsDraw)
    ]]);

    // Recompute WarStats after season ends (and during season too, nếu cậu thích)
    computeWarStats_(cfg.clanTag, clanName);
  } else {
    // During season: still update stats for “đang chạy”
    computeWarStats_(cfg.clanTag, clanName);
  }
}

function commitCwlRound_(cfg, seasonKey, season, roundIndex, warTag, w, clanName) {
  const nowIso = new Date().toISOString();

  const roundKey = `CWLROUND:${md5Hex_(seasonKey + "|" + warTag)}`;

  const opp = w.opponent || {};
  const clan = w.clan || {};

  const clanStars = clan.stars ?? "";
  const oppStars = opp.stars ?? "";
  const clanDes = clan.destructionPercentage ?? "";
  const oppDes = opp.destructionPercentage ?? "";

  const result = warResult_(clanStars, oppStars, clanDes, oppDes);

  // Round row (upsert by roundKey)
  upsertRowsById_("CWLRounds", 1, [[
    roundKey,
    seasonKey,
    season,
    String(roundIndex),
    warTag,
    nowIso,
    w.state || "",
    w.startTime || "",
    w.endTime || "",
    w.teamSize || "",
    cfg.clanTag,
    clanName,
    String(clanStars),
    String(oppStars),
    String(clanDes),
    String(oppDes),
    String(opp.tag || ""),
    String(opp.name || ""),
    result
  ].map(String)]);

  // Members (upsert per round per member)
  const memberRows = (clan.members || []).map(m => {
    const attacks = m.attacks || [];
    const done = attacks.length; // CWL round: 0|1
    const req = 1;

    const starsTotal = attacks.reduce((s, a) => s + (Number(a.stars || 0) || 0), 0);
    const bestDes = attacks.reduce((mx, a) => Math.max(mx, Number(a.destructionPercentage || 0) || 0), 0);
    const missing = Math.max(0, req - done);

    const roundMemberId = md5Hex_(`${roundKey}|${m.tag || ""}`);
    return [
      roundMemberId,
      roundKey,
      seasonKey,
      season,
      String(roundIndex),
      nowIso,
      m.tag || "",
      m.name || "",
      m.mapPosition || "",
      String(done),
      String(req),
      String(starsTotal),
      String(bestDes),
      String(missing)
    ].map(String);
  });
  upsertRowsById_("CWLRoundMembers", 1, memberRows);

  // Attacks (append unique)
  const attackRows = [];
  (clan.members || []).forEach(m => {
    (m.attacks || []).forEach(a => {
      const attackId = md5Hex_(`${roundKey}|${m.tag || ""}|${a.order}`);
      attackRows.push([
        attackId,
        roundKey,
        seasonKey,
        season,
        String(roundIndex),
        warTag,
        m.tag || "",
        m.name || "",
        a.defenderTag || "",
        a.stars ?? "",
        a.destructionPercentage ?? "",
        a.order ?? ""
      ].map(String));
    });
  });
  appendUniqueRows_("CWLRoundAttacks", 1, attackRows);

  return { state: String(w.state || ""), result };
}

function commitCwlSeasonAggregate_(cfg, seasonKey, season, clanName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("CWLRoundMembers");
  if (!sh) return;

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return;

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const vals = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const idx = (h) => headers.indexOf(h);

  const iSeasonKey = idx("seasonKey");
  const iPlayerTag = idx("playerTag");
  const iPlayerName = idx("playerName");
  const iDone = idx("attacksDone");
  const iReq = idx("attacksRequired");
  const iStars = idx("starsTotal");
  const iBestDes = idx("bestDestruction");

  const per = new Map();

  vals.forEach(r => {
    if (String(r[iSeasonKey] || "") !== seasonKey) return;

    const tag = String(r[iPlayerTag] || "");
    if (!tag) return;

    const name = String(r[iPlayerName] || "");
    const done = Number(r[iDone] || 0) || 0;
    const req = Number(r[iReq] || 0) || 0;
    const stars = Number(r[iStars] || 0) || 0;
    const best = Number(r[iBestDes] || 0) || 0;

    let a = per.get(tag);
    if (!a) {
      a = { tag, name, roundsJoined: 0, done: 0, req: 0, stars: 0, best: 0 };
      per.set(tag, a);
    }

    a.name = name || a.name;
    a.roundsJoined += 1;
    a.done += done;
    a.req += req;
    a.stars += stars;
    a.best = Math.max(a.best, best);
  });

  // Now write to WarMembers as CWL_SEASON (1 row per member per season)
  const nowIso = new Date().toISOString();
  const warMemberRows = Array.from(per.values()).map(a => {
    const missing = Math.max(0, a.req - a.done);
    const warMemberId = md5Hex_(`${seasonKey}|${a.tag}`);

    return [
      warMemberId,
      nowIso,
      seasonKey,          // warKey
      "CWL_SEASON",       // warType
      season,             // sourceId
      cfg.clanTag,
      clanName,
      a.tag,
      a.name,
      "",                 // mapPosition (season aggregate => bỏ trống)
      String(a.done),
      String(a.req),
      String(a.stars),
      String(a.best),
      String(missing)
    ].map(String);
  });

  upsertRowsById_("WarMembers", 1, warMemberRows);

  // MemberWarHistory (season-level) — only when season ended (handled elsewhere if cậu muốn)
  // => tui để computeWarStats_ dựa WarMembers là đủ.
}



/* =========================
 * 3) STATS (python-like)
 * ========================= */
function computeWarStats_(clanTag, clanName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("WarMembers");
  if (!sh) return;

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return;

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const vals = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const idx = (h) => headers.indexOf(h);

  const iWarKey = idx("warKey");
  const iType = idx("warType");
  const iTag = idx("playerTag");
  const iName = idx("playerName");
  const iDone = idx("attacksDone");
  const iReq = idx("attacksRequired");

  // Determine which wars ended (so we can classify dropped vs incomplete)
  const endedSet = getWarEndedSet_();

  const per = new Map();

  vals.forEach(r => {
    const warKey = String(r[iWarKey] || "");
    const type = String(r[iType] || "");
    const tag = String(r[iTag] || "");
    if (!warKey || !tag) return;

    const name = String(r[iName] || "");
    const done = Number(r[iDone] || 0) || 0;
    const req = Number(r[iReq] || 0) || 0;

    const warEnded = endedSet.has(warKey);

    let a = per.get(tag);
    if (!a) {
      a = {
        tag,
        lastName: name,

        // python-like
        joined: 0,
        participated: 0,
        completed: 0,
        dropped: 0,
        incomplete: 0,

        totalDone: 0,
        totalReq: 0,

        cw_joined: 0,
        cw_done: 0,
        cw_req: 0,

        cwl_joined: 0,
        cwl_done: 0,
        cwl_req: 0
      };
      per.set(tag, a);
    }

    a.lastName = name || a.lastName;

    // wars_joined: roster presence == 1 record in WarMembers
    a.joined += 1;

    if (done > 0) a.participated += 1;
    if (req > 0 && done >= req) a.completed += 1;

    // Only classify dropped/incomplete when war ended
    if (warEnded && req > 0 && done < req) {
      if (done === 0) a.dropped += 1;
      else a.incomplete += 1;
    }

    a.totalDone += done;
    a.totalReq += req;

    // split by type
    if (type === "CWL" || type === "CWL_SEASON") {
      a.cwl_joined += 1;
      a.cwl_done += done;
      a.cwl_req += req;
    } else {
      a.cw_joined += 1;
      a.cw_done += done;
      a.cw_req += req;
    }
  });

  const nowIso = new Date().toISOString();
  const rows = Array.from(per.values())
    .sort((a, b) => (b.joined - a.joined) || a.lastName.localeCompare(b.lastName))
    .map(a => {
      const participationRate = a.joined ? (a.participated / a.joined * 100) : 0;
      const completionRate = a.joined ? (a.completed / a.joined * 100) : 0;
      const dropRate = a.joined ? (a.dropped / a.joined * 100) : 0;
      const incompleteRate = a.joined ? (a.incomplete / a.joined * 100) : 0;

      const cwCompletion = a.cw_req ? (a.cw_done / a.cw_req * 100) : 0;
      const cwlCompletion = a.cwl_req ? (a.cwl_done / a.cwl_req * 100) : 0;

      return [
        nowIso,
        clanTag,
        clanName,
        a.tag,
        a.lastName,

        a.joined,
        a.participated,
        a.completed,
        a.dropped,
        a.incomplete,
        participationRate.toFixed(1),
        completionRate.toFixed(1),
        dropRate.toFixed(1),
        incompleteRate.toFixed(1),

        a.totalDone,
        a.totalReq,

        a.cw_joined,
        a.cw_done,
        a.cw_req,
        cwCompletion.toFixed(1),

        a.cwl_joined,
        a.cwl_done,
        a.cwl_req,
        cwlCompletion.toFixed(1)
      ].map(String);
    });

  // playerTag nằm ở cột thứ 4
  upsertRowsById_("WarStats", 4, rows);
}

function getWarEndedSet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("WarHistory");
  const set = new Set();
  if (!sh) return set;

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return set;

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const iWarKey = headers.indexOf("warKey");
  if (iWarKey < 0) return set;

  const vals = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  vals.forEach(r => {
    const k = String(r[iWarKey] || "");
    if (k) set.add(k);
  });
  return set;
}

/* =========================
 * 4) CAPITAL RAID
 * ========================= */
function syncRaidSeasons_(cfg) {
  const nowIso = new Date().toISOString();

  let res;
  try {
    res = cocGet_(cfg, `/clans/${cfg.clanTagEnc}/capitalraidseasons`, { limit: 20 });
  } catch (e) {
    Logger.log("Raid seasons skipped: " + e.message);
    return;
  }

  const items = res.items || [];
  const raidRows = [];
  const memberRows = [];

  // Need clan name (from ClanCurrent row2 if exists)
  const clanName = readClanNameFromSheet_() || "";

  items.forEach(season => {
    const raidId = md5Hex_(`${cfg.clanTag}|${season.startTime || ""}|${season.endTime || ""}`);

    raidRows.push([
      raidId,
      nowIso,
      cfg.clanTag,
      clanName,
      season.startTime || "",
      season.endTime || "",
      season.capitalTotalLoot || "",
      season.raidsCompleted || "",
      season.totalAttacks || "",
      season.enemyDistrictsDestroyed || "",
      season.offensiveReward || "",
      season.defensiveReward || ""
    ].map(String));

    (season.members || []).forEach(m => {
      const raidMemberId = md5Hex_(`${raidId}|${m.tag}`);
      memberRows.push([
        raidMemberId,
        raidId,
        m.tag || "",
        m.name || "",
        m.attacks || "",
        m.attackLimit || "",
        m.capitalResourcesLooted || ""
      ].map(String));
    });
  });

  appendUniqueRows_("RaidSeasons", 1, raidRows);
  appendUniqueRows_("RaidMembers", 1, memberRows);
}

function readClanNameFromSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("ClanCurrent");
  if (!sh) return "";
  if (sh.getLastRow() < 2) return "";
  // headers: ts, clanTag, clanName, ...
  const clanName = sh.getRange(2, 3).getValue();
  return String(clanName || "");
}

/* =========================
 * TRIGGER UTILS
 * ========================= */
function removeCollectorTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "runCollector") ScriptApp.deleteTrigger(t);
  });
}

/* =========================
 * DEBUG
 * ========================= */
function debug403() {
  const cfg = getCfg_();

  try {
    const clan = cocGet_(cfg, `/clans/${cfg.clanTagEnc}`);
    Logger.log("OK clan: " + clan.name + " " + clan.tag);
  } catch (e) {
    Logger.log("Clan failed: " + e.message);
  }

  try {
    const war = cocGet_(cfg, `/clans/${cfg.clanTagEnc}/currentwar`);
    Logger.log("OK currentwar state: " + war.state);
  } catch (e) {
    Logger.log("currentwar failed: " + e.message);
  }

  try {
    const group = cocGet_(cfg, `/clans/${cfg.clanTagEnc}/currentwar/leaguegroup`);
    Logger.log("OK CWL season: " + (group.season || "n/a"));
  } catch (e) {
    Logger.log("leaguegroup failed: " + e.message);
  }
}


function cleanRow_(arr) {
  return arr.map(v => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") {
      if (!isFinite(v)) return "";
      if (v % 1 !== 0) return Math.round(v * 100) / 100;
      return v;
    }
    return v;
  });
}
