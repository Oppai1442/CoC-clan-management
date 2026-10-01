// src/lib/sheetApi.ts

// --- Types ---
export type ApiListResp = {
  ok: true;
  sheets: Array<{
    name: string;
    lastRow: number;
    lastCol: number;
    headers: string[];
    strategy: "append" | "replace";
  }>;
};

export type ApiCommonResp<T> = {
  ok: true;
  ts: string;
  resource: string;
  nextCursor?: number;
  totalAfterFilter?: number;
  rows: T[];
};

export type ErrResp = { ok: false; error: string; hint?: string[] };

// Helper to build URL
function buildUrl(baseUrl: string, qp: Record<string, string | number | undefined | null>) {
  const url = new URL(baseUrl);
  Object.entries(qp).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  const contentType = res.headers.get("content-type") || "";

  if (!trimmed) {
    throw new Error(`Empty response (HTTP ${res.status})`);
  }

  const looksHtml =
    contentType.includes("text/html") ||
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed);

  if (looksHtml) {
    throw new Error(
      `Backend returned HTML instead of JSON (HTTP ${res.status}). This is usually a temporary Apps Script deployment/redirect response; retry the request.`
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`Invalid JSON response (HTTP ${res.status}): ${preview}`);
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const requestUrl = attempt === 0
        ? url
        : `${url}${url.includes("?") ? "&" : "?"}_retry=${Date.now()}`;
      const res = await fetch(requestUrl, {
        method: "GET",
        signal,
        redirect: "follow",
        cache: "no-store",
        headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.1" },
      });
      const data = await parseJsonResponse<T>(res);
      if (!data || (data as any).ok !== true) {
        const err = (data as ErrResp)?.error || `HTTP ${res.status}`;
        throw new Error(err);
      }
      return data as T;
    } catch (error: any) {
      lastError = error;
      if (error?.name === "AbortError") throw error;
      const message = String(error?.message || error);
      const transientFormatError =
        message.includes("returned HTML instead of JSON") ||
        message.includes("Invalid JSON response") ||
        message.includes("Empty response");
      if (!transientFormatError || attempt === 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// --- API Methods ---

export const AVAILABLE_ENDPOINTS = [
  { name: "Announcements", i18nKey: "endpoint.announcements", path: "/api/v1/announcements", strategy: "replace", group: "overview", pollMs: 60000 },
  { name: "Analytics", i18nKey: "endpoint.analytics", path: "/api/v1/analytics", strategy: "replace", group: "overview", pollMs: 120000 },
  { name: "Clan Members", i18nKey: "endpoint.clan-members", path: "/api/v1/clan/members", strategy: "replace", group: "clan", pollMs: 30000 },
  { name: "Member Events", i18nKey: "endpoint.member-events", path: "/api/v1/member-events", strategy: "replace", group: "clan", pollMs: 120000 },
  { name: "War History", i18nKey: "endpoint.war-history", path: "/api/v1/war/history", strategy: "replace", group: "war", pollMs: 120000 },
  { name: "War Members", i18nKey: "endpoint.war-members", path: "/api/v1/war/members", strategy: "append", group: "war", pollMs: 30000 },
  { name: "War Attacks", i18nKey: "endpoint.war-attacks", path: "/api/v1/war/attacks", strategy: "append", group: "war", pollMs: 30000 },
  { name: "War Stats (Current)", i18nKey: "endpoint.war-stats-current", path: "/api/v1/war/stats-current", strategy: "replace", group: "war", pollMs: 60000 },
  { name: "War Recommend", i18nKey: "endpoint.war-recommend", path: "/api/v1/war/recommend", strategy: "replace", group: "war", pollMs: 60000 },
  { name: "CWL Season History", i18nKey: "endpoint.cwl-season-history", path: "/api/v1/cwl/season-history", strategy: "replace", group: "cwl", pollMs: 300000 },
  { name: "CWL Rounds", i18nKey: "endpoint.cwl-rounds", path: "/api/v1/cwl/rounds", strategy: "replace", group: "cwl", pollMs: 120000 },
  { name: "CWL Round Members", i18nKey: "endpoint.cwl-round-members", path: "/api/v1/cwl/round-members", strategy: "replace", group: "cwl", pollMs: 120000 },
  { name: "CWL Round Attacks", i18nKey: "endpoint.cwl-round-attacks", path: "/api/v1/cwl/round-attacks", strategy: "replace", group: "cwl", pollMs: 120000 },
  { name: "Raid Seasons", i18nKey: "endpoint.raid-seasons", path: "/api/v1/raid/seasons", strategy: "append", group: "raid", pollMs: 120000 },
  { name: "Raid Members", i18nKey: "endpoint.raid-members", path: "/api/v1/raid/members", strategy: "replace", group: "raid", pollMs: 120000 },
] as const;

export async function fetchEndpoint<T = any>(
  baseUrl: string,
  path: string,
  opts: {
    tail?: number;
    cursor?: number;
    limit?: number;
    offset?: number;
    q?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    filters?: Record<string, string>;
    authTag?: string;
  } = {},
  signal?: AbortSignal
) {
  const url = buildUrl(baseUrl, {
    path,
    tail: opts.tail,
    cursor: opts.cursor,
    limit: opts.limit,
    offset: opts.offset,
    q: opts.q,
    sortBy: opts.sortBy,
    sortDir: opts.sortDir,
    filters: opts.filters ? JSON.stringify(opts.filters) : undefined,
    authTag: opts.authTag,
  });

  return fetchJson<ApiCommonResp<T>>(url, signal);
}

export type ResolveClansResp = {
  ok: true;
  map: Record<string, string>;
};

export async function resolveClans(baseUrl: string, tags: string[], signal?: AbortSignal) {
  const url = buildUrl(baseUrl, { action: "resolveclans", tags: tags.join(",") });
  try {
    return await fetchJson<ResolveClansResp>(url, signal);
  } catch (e) {
    return { ok: true, map: {} } as ResolveClansResp;
  }
}

export async function searchPlayer(baseUrl: string, q: string) {
  const url = buildUrl(baseUrl, { path: "/api/v1/player/search", q });
  return fetchJson<{ ok: true, rows: any[] }>(url);
}

export async function verifyPlayerToken(baseUrl: string, tag: string, token: string) {
  const url = buildUrl(baseUrl, { path: "/api/v1/player/verify", tag, token });
  return fetchJson<{ ok: true, status: "ok" | "invalid", token?: string }>(url);
}


export async function listCurrentMembers(baseUrl: string) {
  const url = buildUrl(baseUrl, { path: "/api/v1/player/list-current" });
  return fetchJson<{ ok: true, rows: any[] }>(url);
}

export async function forceSyncClan(baseUrl: string) {
  const url = buildUrl(baseUrl, { path: "/api/v1/clan/sync-live" });
  return fetchJson<{ ok: true }>(url);
}

export async function addPlayerNote(baseUrl: string, opts: {
  targetTag: string;
  message: string;
  authTag: string;
  authName: string;
  type: "member" | "admin";
}) {
  const url = buildUrl(baseUrl, { path: "/api/v1/player/add-note", ...opts });
  return fetchJson<{ ok: true }>(url);
}


export async function deletePlayerNote(baseUrl: string, opts: {
  targetTag: string;
  time: string;
  authTag: string;
  type: "member" | "admin";
}) {
  const url = buildUrl(baseUrl, { path: "/api/v1/player/delete-note", ...opts });
  return fetchJson<{ ok: true }>(url);
}

export async function fetchAccessStats(baseUrl: string, update: boolean = false) {
  const url = buildUrl(baseUrl, { path: "/api/v1/access-stats", update: String(update) });
  return fetchJson<{ ok: true, total: number }>(url);
}

export async function createAnnouncement(
  baseUrl: string,
  payload: {
    authTag: string;
    token: string;
    title: string;
    content: string;
    imageUrls?: string;
    youtubeUrl?: string;
  }
) {
  const url = baseUrl.replace(/\/$/, "") + "?path=/api/v1/announcements/create";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain"
    },
    body: JSON.stringify(payload)
  });
  const data = await parseJsonResponse<any>(response);
  if (!data.ok) {
    throw new Error(data.error || "Failed to create announcement");
  }
  return data as { ok: true, message: string, id: string };
}

export async function deleteAnnouncement(
  baseUrl: string,
  payload: {
    authTag: string;
    token: string;
    id: string;
  }
) {
  const url = baseUrl.replace(/\/$/, "") + "?path=/api/v1/announcements/delete";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain"
    },
    body: JSON.stringify(payload)
  });
  const data = await parseJsonResponse<any>(response);
  if (!data.ok) {
    throw new Error(data.error || "Failed to delete announcement");
  }
  return data as { ok: true, message: string };
}

export async function setWarRecommendManualExclude(
  baseUrl: string,
  opts: {
    authTag: string;
    token: string;
    targetTag: string;
    type?: "cw" | "cwl" | "overall";
    excluded: boolean;
  }
) {
  const url = buildUrl(baseUrl, {
    path: "/api/v1/war/recommend/manual-exclude",
    authTag: opts.authTag,
    token: opts.token,
    targetTag: opts.targetTag,
    type: opts.type || "cw",
    excluded: String(opts.excluded),
  });
  return fetchJson<{
    ok: true;
    targetTag: string;
    excluded: boolean;
    excludedTags: string[];
  }>(url);
}
