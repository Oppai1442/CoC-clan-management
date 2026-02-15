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

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: "GET", signal });
  const data = await res.json();
  if (!data || data.ok !== true) {
    const err = (data as ErrResp)?.error || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data as T;
}

// --- API Methods ---

export const AVAILABLE_ENDPOINTS = [
  { name: "Member Events", i18nKey: "endpoint.member-events", path: "/api/v1/member-events", strategy: "append" },
  { name: "War History", i18nKey: "endpoint.war-history", path: "/api/v1/war/history", strategy: "append" },
  { name: "War Members", i18nKey: "endpoint.war-members", path: "/api/v1/war/members", strategy: "append" },
  { name: "War Attacks", i18nKey: "endpoint.war-attacks", path: "/api/v1/war/attacks", strategy: "append" },
  { name: "War Stats (Current)", i18nKey: "endpoint.war-stats-current", path: "/api/v1/war/stats-current", strategy: "replace" },
  { name: "War Recommend", i18nKey: "endpoint.war-recommend", path: "/api/v1/war/recommend", strategy: "replace" },
  { name: "CWL Season History", i18nKey: "endpoint.cwl-season-history", path: "/api/v1/cwl/season-history", strategy: "replace" },
  { name: "CWL Rounds", i18nKey: "endpoint.cwl-rounds", path: "/api/v1/cwl/rounds", strategy: "append" },
  { name: "CWL Round Members", i18nKey: "endpoint.cwl-round-members", path: "/api/v1/cwl/round-members", strategy: "append" },
  { name: "CWL Round Attacks", i18nKey: "endpoint.cwl-round-attacks", path: "/api/v1/cwl/round-attacks", strategy: "append" },
  { name: "Raid Seasons", i18nKey: "endpoint.raid-seasons", path: "/api/v1/raid/seasons", strategy: "append" },
  { name: "Raid Members", i18nKey: "endpoint.raid-members", path: "/api/v1/raid/members", strategy: "append" },
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
  return fetchJson<{ ok: true, status: "ok" | "invalid" }>(url);
}


export async function listCurrentMembers(baseUrl: string) {
  const url = buildUrl(baseUrl, { path: "/api/v1/player/list-current" });
  return fetchJson<{ ok: true, rows: any[] }>(url);
}

export async function forceSyncClan(baseUrl: string) {
  const url = buildUrl(baseUrl, { path: "/api/v1/clan/sync-live" });
  return fetchJson<{ ok: true }>(url);
}
