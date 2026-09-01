import { useEffect, useMemo, useRef, useState } from "react";
import { AVAILABLE_ENDPOINTS, fetchEndpoint, resolveClans } from "../lib/sheetApi";

type SheetMeta = {
  name: string;
  i18nKey: string;
  path: string;
  strategy: "append" | "replace";
  group?: string;
  pollMs?: number;
};

export function useSheetExplorer(baseUrl: string, pollMs: number, options: {
  q?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  filters?: Record<string, string>;
  authTag?: string;
  offset?: number;
  limit?: number;
} = {}) {
  // Helper to convert path to slug and vice versa
  const getSlug = (p: string) => p.replace('/api/v1/', '').replace(/\//g, '-');
  const getPathFromSlug = (s: string) => {
    const found = AVAILABLE_ENDPOINTS.find(e => getSlug(e.path) === s);
    return found ? found.path : "";
  };

  // Static list
  const [sheets] = useState<SheetMeta[]>(AVAILABLE_ENDPOINTS.map(e => ({ ...e })));
  
  // Initialize from URL param
  const [selectedPath, setSelectedPath] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const sheetParam = params.get('sheet');
    if (sheetParam) {
      const p = getPathFromSlug(sheetParam);
      if (p) return p;
    }
    return "";
  });
  const [strategy, setStrategy] = useState<"append" | "replace">("append");
  
  // Data state
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [totalAfterFilter, setTotalAfterFilter] = useState<number>(0);
  
  // Current active cursor
  const [cursor, setCursor] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [sheetsLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null);
  const [clanNames, setClanNames] = useState<Record<string, string>>({});
  const triedTagsRef = useRef<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const cursorRef = useRef(cursor);
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);

  const refresh = () => {
    setCursor(0);
    setRows([]);
    setHeaders([]);
    setIsInitialLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  // Sync selection to URL
  useEffect(() => {
    if (!selectedPath) return;
    const params = new URLSearchParams(window.location.search);
    const currentSlug = getSlug(selectedPath);
    
    if (params.get('sheet') !== currentSlug) {
      params.set('sheet', currentSlug);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [selectedPath]);

  // Resolve clans effect
  useEffect(() => {
    if (rows.length === 0) return;
    
    // Tìm các tag mới xuất hiện trong rows mà chưa được resolve và chưa từng thử resolve thất bại
    const tagsInRows = new Set<string>();
    rows.forEach(r => {
      ['clanTag', 'playerTag', 'opponentTag', 'attackerTag', 'defenderTag'].forEach(field => {
        const val = r[field];
        if (typeof val === 'string' && val.startsWith('#') && !clanNames[val] && !triedTagsRef.current.has(val)) {
          tagsInRows.add(val);
        }
      });
    });

    if (tagsInRows.size === 0) return;

    // Đánh dấu là đã thử các tag này để không gọi lại trong vòng lặp hiện tại
    tagsInRows.forEach(t => triedTagsRef.current.add(t));

    const controller = new AbortController();
    (async () => {
      try {
        const resp = await resolveClans(baseUrl, Array.from(tagsInRows), controller.signal);
        if (resp && resp.map) {
            setClanNames(prev => ({ ...prev, ...resp.map }));
        }
      } catch (e) { 
        // Nếu lỗi, có thể cho phép thử lại vào lần sau bằng cách xóa khỏi Set (tùy chọn)
        // tagsInRows.forEach(t => triedTagsRef.current.delete(t));
      }
    })();
    return () => controller.abort();
    // QUAN TRỌNG: Không bỏ clanNames vào đây để tránh loop
  }, [rows, baseUrl]);

  const selectedMeta = useMemo(
    () => sheets.find(s => s.path === selectedPath),
    [sheets, selectedPath]
  );

  const effectivePollMs = selectedMeta?.pollMs ?? pollMs;

  // Auto-select first
  useEffect(() => {
    if (!selectedPath && sheets.length > 0) {
      setSelectedPath(sheets[0].path);
    }
  }, [sheets, selectedPath]);

  // Handle selection change
  useEffect(() => {
    if (!selectedPath) return;

    const meta = selectedMeta;
    const currentStrategy = meta?.strategy || "append";
    
    setStrategy(currentStrategy);
    setCursor(0);
    setRows([]);
    setHeaders([]);
    setIsInitialLoading(true);

    let timer: number | null = null;
    const ctrl = new AbortController();
    let isFirstFetch = true;
    let isActive = true; // Biến cờ để kiểm soát effect hiện tại

    const tick = async () => {
      try {
        if (!isActive) return;
        setLoading(true);
        setError(null);

        const currentCursor = isFirstFetch ? 0 : cursorRef.current;
        
        const hasFilters = options.q || options.sortBy || (options.filters && Object.keys(options.filters).length > 0) || options.offset !== undefined;
        const effectiveStrategy = hasFilters ? "replace" : currentStrategy;

        const resp = await fetchEndpoint(
          baseUrl,
          selectedPath,
          {
            cursor: (effectiveStrategy === "append" && !isFirstFetch) ? currentCursor : undefined,
            tail: (effectiveStrategy === "append" && isFirstFetch) ? 300 : undefined,
            q: options.q,
            sortBy: options.sortBy,
            sortDir: options.sortDir,
            filters: options.filters,
            authTag: options.authTag,
            limit: options.limit !== undefined ? options.limit : 500,
            offset: options.offset
          },
          ctrl.signal
        );

        // Normalize response: war-recommend returns 'picked' and 'bench' instead of 'rows'
        let dataRows = resp.rows || [];
        if (!resp.rows && (resp as any).picked) {
            const picked = ((resp as any).picked || []).map((row: any) => ({ ...row, rosterStatus: 'picked' }));
            const bench = ((resp as any).bench || []).map((row: any) => ({ ...row, rosterStatus: 'bench' }));
            dataRows = [...picked, ...bench];
        }

        if (dataRows.length > 0) {
            const first = dataRows[0] as Record<string, any>;
            setHeaders(Object.keys(first));
        }

        if (effectiveStrategy === "replace") {
          if (!isActive) return;
          setRows(dataRows);
          setTotalAfterFilter(resp.totalAfterFilter !== undefined ? resp.totalAfterFilter : dataRows.length);
          if (resp.nextCursor) {
             setCursor(resp.nextCursor);
          }
        } else {
          // APPEND
          if (!isActive) return;
          if (dataRows.length > 0) {
             setRows(prev => {
               const keyOf = (row: Record<string, any>) =>
                 row.attackId || row.warMemberId || row.roundMemberId || row.raidMemberId || row.rowId ||
                 row.eventId || row.warKey || row.roundKey || row.raidId ||
                 [row.playerTag, row.ts, row.roundIndex, row.season].filter(Boolean).join("|") || JSON.stringify(row);
               const seen = new Set(prev.map(keyOf));
               const fresh = dataRows.filter(row => {
                 const key = keyOf(row);
                 if (seen.has(key)) return false;
                 seen.add(key);
                 return true;
               });
               if (!fresh.length) return prev;
               const merged = [...prev, ...fresh];
               return merged.length > 5000 ? merged.slice(-5000) : merged;
             });
             setTotalAfterFilter(prev => prev + dataRows.length);
             if (resp.nextCursor && resp.nextCursor > cursorRef.current) {
                 setCursor(resp.nextCursor);
             }
          }
        }

      } catch (e: any) {
        if (isActive && e?.name !== "AbortError") setError(e?.message || String(e));
      } finally {
        if (isActive) {
          setLoading(false);
          if (isFirstFetch) setIsInitialLoading(false);
          isFirstFetch = false;
          timer = window.setTimeout(tick, effectivePollMs);
        }
      }
    };

    tick();

    return () => {
      isActive = false; // Vô hiệu hóa các lệnh callback của effect cũ
      ctrl.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [baseUrl, selectedPath, effectivePollMs, selectedMeta, options.q, options.sortBy, options.sortDir, options.filters, options.authTag, options.offset, options.limit, refreshKey]);

  const resetCursor = () => {
    if (!selectedPath) return;
    setCursor(0);
    setRows([]);
    setHeaders([]);
    setIsInitialLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  const mutateRow = (idValue: string, field: string, newValue: any) => {
    setRows(prev => prev.map(row => {
      const rowId = row.playerTag || row.tag || row.attackerTag;
      if (rowId === idValue) {
        return { ...row, [field]: newValue };
      }
      return row;
    }));
  };

  return {
    sheets: sheets.map(s => ({
        name: s.name,
        i18nKey: s.i18nKey,
        strategy: s.strategy,
        group: s.group,
        pollMs: s.pollMs,
        lastRow: 0
    })),
    selected: sheets.find(s => s.path === selectedPath)?.name || "",
    selectedI18nKey: sheets.find(s => s.path === selectedPath)?.i18nKey || "",
    setSelected: (name: string) => {
        const s = sheets.find(sh => sh.name === name);
        if (s) setSelectedPath(s.path);
    },
    strategy,
    headers,
    rows,
    totalAfterFilter,
    lastRow: cursor,
    loading,
    isInitialLoading,
    sheetsLoading,
    error,
    clanNames,
    resetCursor,
    refresh,
    mutateRow
  };
}
