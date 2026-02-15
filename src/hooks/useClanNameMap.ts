import { useEffect, useMemo, useState } from "react";

export function useClanNameMap(baseUrl: string, rows: Record<string, any>[], headers: string[]) {
  const [map, setMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("clanNameMap") || "{}"); }
    catch { return {}; }
  });

  const tagsNeeded = useMemo(() => {
    // chỉ scan các cột có tên chứa "clanTag" hoặc "opponentTag"
    const cols = headers.filter(h => /clanTag|opponentTag/i.test(h));
    const set = new Set<string>();

    for (const r of rows) {
      for (const c of cols) {
        const v = String(r[c] ?? "").trim();
        if (v.startsWith("#") && v.length >= 4) set.add(v);
      }
    }

    // chỉ lấy những tag chưa có trong map
    return Array.from(set).filter(t => !map[t]);
  }, [rows, headers, map]);

  useEffect(() => {
    if (!tagsNeeded.length) return;

    // chia batch để URL không dài quá
    const chunks: string[][] = [];
    for (let i = 0; i < tagsNeeded.length; i += 20) chunks.push(tagsNeeded.slice(i, i + 20));

    let cancelled = false;

    (async () => {
      for (const chunk of chunks) {
        const url = new URL(baseUrl, window.location.origin);
        url.searchParams.set("action", "resolveClans");
        url.searchParams.set("tags", chunk.join(","));

        const res = await fetch(url.toString());
        const json = await res.json();
        if (!json?.ok) continue;

        if (cancelled) return;

        setMap(prev => {
          const next = { ...prev, ...(json.map || {}) };
          localStorage.setItem("clanNameMap", JSON.stringify(next));
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [baseUrl, tagsNeeded]);

  return map;
}
