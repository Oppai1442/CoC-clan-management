import { useMemo, useState, useEffect } from "react";
import { useSheetExplorer } from "../hooks/useSheetExplorer";
import { useAuth } from "../hooks/useAuth";
import { LoginModal } from "./LoginModal";
import { fetchEndpoint } from "../lib/sheetApi";
import { 
  Search, 
  RotateCw, 
  Database, 
  AlertCircle, 
  Layers, 
  ArrowDownToLine,
  LayoutList,
  Languages,
  Swords,
  Scroll,
  Shield,
  ArrowUp,
  ArrowDown,
  X,
  User,
  LogOut,
  LogIn,
  History
} from "lucide-react";
import clsx from "clsx";
import { useTranslation } from 'react-i18next';
import { format, parseISO, isValid } from 'date-fns';

type Props = {
  baseUrl: string;
  pollMs?: number;
};

export function SheetExplorer({ baseUrl, pollMs = 15000 }: Props) {
  const { t, i18n } = useTranslation();
  const { user, login, logout, isAuthenticated } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  
  const [q, setQ] = useState("");
  const [maxShow, setMaxShow] = useState(500);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const [selectedWarKey, setSelectedWarKey] = useState("latest");
  const [warHistory, setWarHistory] = useState<any[]>([]);
  const [activeSheetName, setActiveSheetName] = useState("");

  const {
    sheets, selected, selectedI18nKey, setSelected: hookSetSelected,
    strategy, headers, rows, lastRow,
    loading, isInitialLoading, sheetsLoading, error, clanNames, resetCursor
  } = useSheetExplorer(baseUrl, pollMs, {
    q,
    sortBy: sortConfig?.key,
    sortDir: sortConfig?.direction,
    filters: useMemo(() => {
      const f = { ...filters };
      if (activeSheetName === "War Members" || activeSheetName === "War Attacks") {
        f.warKey = selectedWarKey;
      }
      return f;
    }, [filters, activeSheetName, selectedWarKey])
  });

  // Sync selection to local state to avoid TDZ crash
  useEffect(() => {
    if (selected) setActiveSheetName(selected);
  }, [selected]);

  const setSelected = (name: string) => {
    setActiveSheetName(name);
    hookSetSelected(name);
  };

  // Fetch War History for the dropdown
  useEffect(() => {
    if (activeSheetName === "War Members" || activeSheetName === "War Attacks") {
      fetchEndpoint(baseUrl, "/api/v1/war/history", { limit: 50, sortBy: "endTime", sortDir: "desc" })
        .then(resp => setWarHistory(resp.rows || []))
        .catch(() => {});
    }
  }, [baseUrl, activeSheetName]);

  // Helper to format values (especially dates and clan tags)
  const formatValue = (val: any, columnKey: string) => {
    if (val === null || val === undefined || val === "") return "";
    
    const strVal = String(val);

    // 1. Clan Tag Resolution (cho mọi cột có chứa chữ 'tag')
    if (columnKey.toLowerCase().includes('tag') && strVal.startsWith('#')) {
      const name = clanNames[strVal];
      return name ? `${name} (${strVal})` : strVal;
    }

    // 2. Tự động nhận diện ISO 8601 UTC (kết thúc bằng Z) và chuyển sang giờ địa phương
    if (typeof val === 'string' && val.endsWith('Z')) {
      // Nhận diện định dạng cơ bản: 20260213T144521.000Z (thiếu - và :)
      const basicFormat = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/;
      // Nhận diện định dạng mở rộng: 2026-02-13T14:45:21.000Z
      const extendedFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

      let dateStr = val;
      let isMatch = false;

      if (extendedFormat.test(val)) {
        isMatch = true;
      } else if (basicFormat.test(val)) {
        // Tự động thêm dấu - và : để Date() hiểu được trên mọi trình duyệt
        dateStr = val.replace(basicFormat, "$1-$2-$3T$4:$5:$6$7Z");
        isMatch = true;
      }

      if (isMatch) {
        try {
          const date = new Date(dateStr);
          if (isValid(date)) {
            return format(date, "dd/MM/yyyy HH:mm:ss");
          }
        } catch (e) {
          // ignore
        }
      }
    }

    return strVal;
  };

  const toggleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null; 
      }
      return { key, direction: 'asc' };
    });
  };

  const updateFilter = (key: string, val: string) => {
    setFilters(prev => {
      const next = { ...prev };
      if (!val) delete next[key];
      else next[key] = val;
      return next;
    });
  };

  // Local slice for performance, but filters/sorting are already done by server
  const shown = useMemo(() => {
    if (rows.length > maxShow) return rows.slice(rows.length - maxShow);
    return rows;
  }, [rows, maxShow]);

  return (
    <div className="flex h-screen w-full bg-[#2a2a2a] text-[#f0f0f0] font-sans overflow-hidden font-bold select-none relative">
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>

      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 bg-[#1e1e1e] border-r-4 border-[#3a3a3a] flex flex-col shadow-2xl z-10 relative">
        <div className="p-4 bg-[#252525] border-b-4 border-[#111] shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 p-2 rounded-xl border-2 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]">
              <Swords size={24} className="text-white drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-xl text-yellow-400 tracking-wider uppercase drop-shadow-md font-black" style={{ textShadow: "2px 2px 0px #000" }}>
                {t('app.title')}
              </h1>
              <div className="h-1 w-full bg-gradient-to-r from-yellow-600 to-transparent rounded mt-1"></div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          <div className="px-2 py-2 text-xs font-bold text-[#aaa] uppercase tracking-widest flex items-center justify-between border-b-2 border-[#333] mb-2">
            <span>{t('sidebar.availableSheets')}</span>
            <div className="flex items-center">
              {sheetsLoading ? (
                <div className="flex items-center gap-1 px-2 py-1 bg-[#111] rounded border border-[#444] shadow-inner">
                  <RotateCw size={10} className="animate-spin text-orange-500" />
                  <span className="text-[10px] text-orange-400 animate-pulse">LOADING</span>
                </div>
              ) : (
                <span className="bg-[#333] text-yellow-500 px-2 py-1 rounded border border-[#555] shadow-inner text-xs min-w-[24px] text-center">
                  {sheets.length}
                </span>
              )}
            </div>
          </div>
          
          {sheetsLoading ? (
            <div className="space-y-3 px-1">
               {[1, 2, 3].map(i => (
                 <div key={i} className="h-16 w-full bg-[#2a2a2a] rounded-xl animate-pulse border border-[#333]"></div>
               ))}
            </div>
          ) : (
            sheets.map(s => {
              const isSelected = s.name === selected;
              return (
                <button
                  key={s.name}
                  onClick={() => {
                    setSelected(s.name);
                    setFilters({});
                    setSortConfig(null);
                    setQ("");
                  }}
                  className={clsx(
                    "w-full text-left p-3 rounded-xl transition-all duration-100 flex items-center gap-3 group border-2 relative overflow-hidden",
                    isSelected 
                      ? "bg-[#3a2a1a] border-yellow-500 shadow-[0_4px_0_0_rgba(0,0,0,0.3)] translate-y-[-1px]" 
                      : "bg-[#2a2a2a] border-[#444] hover:bg-[#333] hover:border-[#666] hover:-translate-y-0.5"
                  )}
                >
                  <div className={clsx(
                    "p-2 rounded-lg border-2 shadow-inner",
                    isSelected 
                      ? "bg-yellow-500 border-yellow-300 text-yellow-900" 
                      : "bg-[#1a1a1a] border-[#333] text-[#555]"
                  )}>
                    <Scroll size={20} />
                  </div>
                  <div className="flex-1 min-w-0 z-10">
                    <div className={clsx(
                      "font-bold truncate text-base", 
                      isSelected ? "text-white" : "text-[#ccc]"
                    )} style={isSelected ? { textShadow: "1px 1px 0 #000" } : {}}>
                      {t(s.i18nKey, s.name)}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[#888] font-mono">
                      <span className={clsx("flex items-center gap-1 uppercase", s.strategy === 'append' ? "text-green-400" : "text-blue-400")}>
                        {s.strategy === 'append' ? <ArrowDownToLine size={10} /> : <RotateCw size={10} />}
                        {s.strategy}
                      </span>
                    </div>
                  </div>
                  {isSelected && <div className="absolute inset-0 bg-yellow-500/10 mix-blend-overlay"></div>}
                </button>
              );
            })
          )}
        </div>
        
        <div className="p-3 border-t-4 border-[#111] bg-[#1a1a1a] text-[10px] text-[#666] font-mono">
          {isAuthenticated ? (
            <div className="mb-3 p-3 bg-[#2a2a2a] rounded-xl border-2 border-[#3a3a3a] flex items-center justify-between group shadow-inner">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-600 p-1.5 rounded-lg border-2 border-yellow-400">
                  <User size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-yellow-400 truncate tracking-wide">{user?.name}</div>
                  <div className="text-[10px] text-[#888] font-mono">{user?.tag}</div>
                </div>
              </div>
              <button 
                onClick={logout}
                className="p-2 bg-[#333] hover:bg-red-900/30 hover:text-red-500 rounded-lg border border-[#444] transition-all"
                title="Đăng xuất"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsLoginOpen(true)}
              className="w-full mb-3 p-3 bg-[#2a2a2a] hover:bg-[#333] border-2 border-[#444] hover:border-yellow-600 rounded-xl flex items-center gap-3 transition-all group shadow-lg"
            >
              <div className="bg-[#1a1a1a] group-hover:bg-yellow-600 p-2 rounded-lg border-2 border-[#333] group-hover:border-yellow-400 transition-all">
                <LogIn size={18} className="text-[#666] group-hover:text-white" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-[#888] group-hover:text-white uppercase tracking-wider">Đăng nhập</div>
                <div className="text-[10px] text-[#555] font-mono">Để xem stats cá nhân</div>
              </div>
            </button>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutList size={12} />
              <span>{t('sidebar.lastUpdate')}: {new Date().toLocaleTimeString()}</span>
            </div>
            <div className="relative group">
               <button className="p-1.5 bg-[#333] hover:bg-[#444] rounded border border-[#555] text-[#ccc]">
                 <Languages size={14} />
               </button>
               <select 
                value={i18n.language} 
                onChange={e => i18n.changeLanguage(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute inset-0 bg-[#222] z-0">
          <div className="w-full h-full opacity-5 bg-[radial-gradient(#444_1px,transparent_1px)] [background-size:16px_16px]"></div>
        </div>

        <header className="bg-[#2a2a2a] border-b-4 border-[#151515] px-6 py-4 flex items-center justify-between shadow-2xl z-10 relative">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black text-white flex items-center gap-3" style={{ textShadow: "2px 2px 0 #000" }}>
              <Shield className="text-gray-500" size={24} />
              {selectedI18nKey ? t(selectedI18nKey, selected) : t('sheet.noSheetSelected')}
            </h2>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
              <span className="bg-[#111] text-[#888] px-2 py-1 rounded border border-[#333]">
                {t('sheet.strategy')}: <span className="text-blue-400">{strategy}</span>
              </span>
              <span className="bg-[#111] text-[#888] px-2 py-1 rounded border border-[#333]">
                {t('sheet.cursor')}: <span className="text-orange-400">{(lastRow-1>0?lastRow-1:0).toLocaleString()}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {strategy === "append" && (
              <button 
                onClick={resetCursor}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 shadow-lg text-sm uppercase tracking-wide"
              >
                <RotateCw size={16} />
                {t('action.resetCursor')}
              </button>
            )}
            
            <div className="flex items-center gap-2 bg-[#1a1a1a] p-1.5 rounded-lg border border-[#444] shadow-inner">
              <span className="text-[10px] text-[#888] px-2 uppercase font-bold">{t('action.showLast')}</span>
              <select 
                value={maxShow} 
                onChange={e => setMaxShow(parseInt(e.target.value, 10))}
                className="bg-[#333] text-white text-xs font-bold border border-[#555] rounded py-1 pl-2 pr-4 focus:outline-none focus:border-yellow-500 cursor-pointer"
              >
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={5000}>5000</option>
              </select>
            </div>
          </div>
        </header>

        <div className="px-6 py-4 bg-[#3d2e1e] border-b border-[#2a2015] flex items-center gap-4 shadow-inner relative z-10">
          {(selected === "War Members" || selected === "War Attacks") && (
            <div className="flex items-center gap-2 bg-[#2a1d12] p-1.5 rounded-xl border-2 border-[#4e3b2a] shadow-inner min-w-[280px]">
              <History size={18} className="ml-2 text-orange-200/40" />
              <select 
                value={selectedWarKey}
                onChange={e => setSelectedWarKey(e.target.value)}
                className="bg-transparent text-orange-50 text-sm font-bold focus:outline-none cursor-pointer flex-1 py-1"
              >
                <option value="latest" className="bg-[#2a1d12]">🏆 Trận mới nhất</option>
                {warHistory.map(w => (
                  <option key={w.warKey} value={w.warKey} className="bg-[#2a1d12]">
                    ⚔️ {w.opponentName} ({formatValue(w.endTime, 'endTime')})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-200 opacity-60" size={18} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t('search.placeholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-[#2a1d12] text-orange-50 placeholder-orange-200/30 border-2 border-[#4e3b2a] rounded-xl focus:outline-none focus:border-yellow-500 focus:bg-[#1a110a] transition-all shadow-inner font-medium"
            />
          </div>
          <div className="text-xs font-bold text-orange-200/60 uppercase">
            {t('status.showing')} <span className="text-yellow-400 text-sm">{shown.length}</span> {t('status.rows')}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-900/50 border-2 border-red-500 rounded-xl flex items-start gap-3 text-red-100 shadow-lg backdrop-blur-sm z-10">
            <AlertCircle className="mt-0.5 flex-shrink-0 text-red-400" size={20} />
            <div>
              <h3 className="font-bold text-red-200">{t('status.error')}</h3>
              <p className="text-sm opacity-80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto p-6 z-0">
          <div className="bg-[#f0e6d2] border-4 border-[#b89b72] rounded-xl shadow-2xl overflow-hidden h-full flex flex-col relative text-[#2a2a2a]">
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
            
            <div className="overflow-auto flex-1 scrollbar-parchment relative z-10">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#e6d5b8] sticky top-0 z-10 shadow-md border-b-2 border-[#cbbda2]">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-4 py-3 text-xs font-black text-[#5c4a35] uppercase tracking-wider min-w-[150px] align-top">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-[#3a2e20] select-none" onClick={() => toggleSort(h)}>
                            <span>{t(`field.${h}`, h)}</span>
                            {sortConfig?.key === h && (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-orange-600" /> : <ArrowDown size={12} className="text-orange-600" />
                            )}
                          </div>
                          <div className="relative">
                            <input 
                              className="w-full bg-[#fcf5e5] border border-[#cbbda2] rounded px-2 py-1 text-[11px] font-normal focus:outline-none focus:border-orange-400 placeholder-[#b89b72]"
                              placeholder={`Filter ${h}...`}
                              value={filters[h] || ""}
                              onChange={e => updateFilter(h, e.target.value)}
                            />
                            {filters[h] && <button onClick={() => updateFilter(h, "")} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#b89b72] hover:text-red-500"><X size={10} /></button>}
                          </div>
                        </div>
                      </th>
                    ))}
                    {headers.length === 0 && <th className="p-4"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dccfb9]">
                  {shown.map((r, idx) => (
                    <tr key={(r.eventId || r.attackId || r.warLogId || r.warKey || r.raidId || idx) as any} className="hover:bg-[#fff9ea] transition-colors group odd:bg-[#f0e6d2] even:bg-[#ebe0ca]">
                      {headers.map((h, i) => (
                        <td key={i} className="px-4 py-2.5 text-sm font-semibold text-[#4a3b2a] whitespace-nowrap border-r border-[#dccfb9]/50 last:border-0">
                          {formatValue((r as any)[h], h)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(1, headers.length)} className="px-6 py-20 text-center text-[#998877]">
                        {(loading || isInitialLoading) ? (
                          <div className="flex flex-col items-center gap-4">
                            <RotateCw className="animate-spin text-green-600/50" size={64} />
                            <p className="font-bold text-lg uppercase tracking-widest animate-pulse text-green-800/40">
                              {t('status.loading', 'Loading...')}
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-4 opacity-60">
                            <Layers size={64} />
                            <p className="font-bold text-lg uppercase tracking-widest">{t('status.noData')}</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="border-t-2 border-[#cbbda2] bg-[#e6d5b8] px-4 py-2 text-[10px] text-[#776655] flex justify-between items-center font-bold uppercase relative z-10">
               <span className="flex items-center gap-1"><Database size={10} /> {t('status.source')}</span>
               {strategy === "append" && (
                 <span className="text-[#998877] italic normal-case">{t('status.appendNote')}</span>
               )}
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {isLoginOpen && (
        <LoginModal 
          baseUrl={baseUrl} 
          onClose={() => setIsLoginOpen(false)}
          onSuccess={(userData) => {
            login(userData);
            setIsLoginOpen(false);
          }}
        />
      )}
    </div>
  );
}
