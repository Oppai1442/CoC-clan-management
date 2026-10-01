import { useMemo, useState, useEffect } from "react";
import { useSheetExplorer } from "../hooks/useSheetExplorer";
import { useAuth } from "../hooks/useAuth";
import { LoginModal } from "./LoginModal";
import { AddNoteModal } from "./AddNoteModal";
import { fetchEndpoint, fetchAccessStats, AVAILABLE_ENDPOINTS, verifyPlayerToken, createAnnouncement, deleteAnnouncement, setWarRecommendManualExclude } from "../lib/sheetApi";
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
  History,
  StickyNote,
  Menu,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  ArrowBigDownDash,
  Eye,
  Download,
  SlidersHorizontal,
  FilterX,
  Info,
  Copy,
  Check,
  BarChart3,
  TrendingUp,
  Plus,
  Trash2,
  UserMinus,
  UserPlus
} from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { format, isValid } from "date-fns";

type Props = {
  baseUrl: string;
  pollMs?: number;
};

type TourStep = {
  content: string;
  step: number;
};

type SummaryCard = {
  label: string;
  value: string;
  hint?: string;
};

const TECHNICAL_COLUMNS = new Set([
  "warKey",
  "warMemberId",
  "attackId",
  "eventId",
  "rowId",
  "seasonKey",
  "roundKey",
  "roundMemberId",
  "raidId",
  "raidMemberId",
  "warTag",
  "clanTag",
  "opponentTag",
  "playerTag",
  "attackerTag",
  "defenderTag",
  "sourceId",
  "isInClan",
  "firstSeen",
  "daysInClan",
  "confidenceWars",
  "smoothedRate",
  "confidenceAttacks",
  "confidenceFactor",
  "missFactor",
  "missPenalty",
  "score",
  "type",
  "rosterStatus",
  "reason",
  "cw_wars_joined",
  "cw_attacks_done",
  "cw_attacks_required",
  "cw_missed_attacks",
  "cwl_wars_joined",
  "cwl_seasons_joined",
  "cwl_rounds_present",
  "cwl_attacks_done",
  "cwl_attacks_required",
  "cwl_missed_attacks",
  "overall_attacks_done",
  "overall_attacks_required",
  "overall_missed_attacks",
  "lifetimeScorePct",
  "recentWarsJoined",
  "recentEligibleWars",
  "recentAttacksDone",
  "recentAttacksRequired",
  "trendDeltaPct",
  "confidencePct",
  "manualExcluded",
  "warPreference"
]);

const DATE_FIELDS = new Set([
  "ts",
  "firstSeenTs",
  "finalTs",
  "preparationStartTime",
  "prepStart",
  "startTime",
  "endTime",
  "tsFirstSeen",
  "tsFinal",
  "lastSeenTs",
  "lastUpdated"
]);

function parseSheetDate(val: unknown) {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  const basicFormat = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/;
  const extendedFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  let dateStr = trimmed;

  if (basicFormat.test(trimmed)) {
    dateStr = trimmed.replace(basicFormat, "$1-$2-$3T$4:$5:$6$7Z");
  } else if (!extendedFormat.test(trimmed)) {
    return null;
  }

  const date = new Date(dateStr);
  return isValid(date) ? date : null;
}

function numberFrom(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function rawString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatAnalyticsPeriod(period: string, granularity: "week" | "month") {
  if (granularity === "month" && /^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-");
    return `${month}/${year}`;
  }
  const date = new Date(`${period}T00:00:00`);
  if (!Number.isNaN(date.getTime())) return format(date, "dd/MM/yyyy");
  return period;
}

function AnalyticsLineChart({ rows, valueKey, label, suffix = "" }: { rows: Record<string, any>[]; valueKey: string; label: string; suffix?: string }) {
  const data = rows.slice(-18);
  const values = data.map(r => numberFrom(r[valueKey]));
  const max = Math.max(1, ...values);
  const width = 900;
  const height = 240;
  const padX = 42;
  const padY = 28;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const points = values.map((v, i) => {
    const x = padX + (data.length <= 1 ? usableW / 2 : (i / (data.length - 1)) * usableW);
    const y = padY + usableH - (v / max) * usableH;
    return { x, y, v, period: rawString(data[i]?.period) };
  });
  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <div className="bg-[#fcfaf2] border-2 border-[#dccfb9] rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs font-black uppercase tracking-wider text-[#6f4b2f]">{label}</div>
        <div className="text-[10px] text-[#806f5c]">{data.length} periods</div>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[620px] h-[220px]" role="img" aria-label={label}>
          {[0, 0.25, 0.5, 0.75, 1].map(level => {
            const y = padY + usableH - level * usableH;
            return <line key={level} x1={padX} x2={width - padX} y1={y} y2={y} stroke="currentColor" opacity="0.12" />;
          })}
          {points.length > 1 && <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" className="text-[#8b5e34]" />}
          {points.map((p, i) => (
            <g key={`${p.period}-${i}`}>
              <circle cx={p.x} cy={p.y} r="5" fill="currentColor" className="text-[#b7791f]" />
              {(i === 0 || i === points.length - 1 || i % Math.max(1, Math.ceil(points.length / 6)) === 0) && <text x={p.x} y={height - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">{p.period.slice(5)}</text>}
            </g>
          ))}
          <text x={padX} y={14} fontSize="11" fill="currentColor" opacity="0.65">{formatCompact(max)}{suffix}</text>
          <text x={padX} y={height - padY + 4} fontSize="11" fill="currentColor" opacity="0.65">0{suffix}</text>
        </svg>
      </div>
    </div>
  );
}

function formatCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(value % 1 ? 1 : 0);
}

export function SheetExplorer({ baseUrl, pollMs = 15000 }: Props) {
  const { t, i18n } = useTranslation();
  const { user, login, logout, isAuthenticated } = useAuth();
  const normalizedUserRole = String(user?.role || "").trim().toLowerCase();
  const canManageRecommend = isAuthenticated && (normalizedUserRole === "leader" || normalizedUserRole === "coleader");
  const [hasVerifiedAuth, setHasVerifiedAuth] = useState(false);

  // Auto-login verification on mount
  useEffect(() => {
    if (!baseUrl || hasVerifiedAuth) return;
    if (user?.tag && user?.token) {
      verifyPlayerToken(baseUrl, user.tag, user.token)
        .then(resp => {
          if (resp.status !== 'ok') {
            logout();
          }
          setHasVerifiedAuth(true);
        })
        .catch(err => {
          console.error("Auto login verification failed:", err);
          if (err.message && (err.message.includes("not found") || err.message.includes("invalid") || err.message.includes("40"))) {
            logout();
          }
          setHasVerifiedAuth(true);
        });
    } else {
      setHasVerifiedAuth(true);
    }
  }, [baseUrl, user, hasVerifiedAuth, logout]);

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  
  // Announcements tab state
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceContent, setAnnounceContent] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [announceLoading, setAnnounceLoading] = useState(false);
  const [announceError, setAnnounceError] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedRowData, setSelectedRowData] = useState<Record<string, any> | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [recommendExclusionBusy, setRecommendExclusionBusy] = useState<string | null>(null);
  const [recommendExclusionError, setRecommendExclusionError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [q]);

  const [maxShow, setMaxShow] = useState(500);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [tempFilters, setTempFilters] = useState<Record<string, string>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters(tempFilters);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [tempFilters]);

  const updateFilter = (key: string, val: string) => {
    setTempFilters(prev => {
      const next = { ...prev };
      if (!val) delete next[key];
      else next[key] = val;
      return next;
    });
  };

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setFilters(tempFilters);
    }
  };

  const [selectedWarKey, setSelectedWarKey] = useState("latest");
  const [selectedCwlSeasonKey, setSelectedCwlSeasonKey] = useState("");
  const [selectedCwlDay, setSelectedCwlDay] = useState("all");
  const [analyticsGranularity, setAnalyticsGranularity] = useState<"week" | "month">("week");
  const [warHistory, setWarHistory] = useState<any[]>([]);
  const [cwlSeasons, setCwlSeasons] = useState<any[]>([]);
  const [activeSheetName, setActiveSheetName] = useState("");
  const [totalVisits, setTotalVisits] = useState(0);
  const [noteTarget, setNoteTarget] = useState<{ tag: string; name: string; memberNote?: string; adminNote?: string } | null>(null);

  const [activeTourType, setActiveTourType] = useState<"main" | "members" | null>(null);
  const [activeTourIndex, setActiveTourIndex] = useState(0);

  useEffect(() => {
    const hasSeenMain = localStorage.getItem("hasSeenMainTour");
    if (!hasSeenMain) setActiveTourType("main");
  }, []);

  useEffect(() => {
    if (activeSheetName === "Clan Members") {
      const hasSeenMembers = localStorage.getItem("hasSeenMembersTour");
      if (!hasSeenMembers && activeTourType === null) {
        setActiveTourType("members");
        setActiveTourIndex(0);
      }
    }
  }, [activeSheetName, activeTourType]);

  const closeTour = () => {
    if (activeTourType === "main") localStorage.setItem("hasSeenMainTour", "true");
    if (activeTourType === "members") localStorage.setItem("hasSeenMembersTour", "true");
    setActiveTourType(null);
    setActiveTourIndex(0);
  };

  const mainTourSteps: TourStep[] = [
    { content: t("tour.main.1"), step: 1 },
    { content: t("tour.main.2"), step: 2 },
    { content: t("tour.main.3"), step: 3 },
    { content: t("tour.main.4"), step: 4 },
    { content: t("tour.main.5"), step: 5 },
    { content: t("tour.main.6"), step: 6 }
  ];

  const membersTourSteps: TourStep[] = [
    { content: t("tour.members.1"), step: 1 },
    { content: t("tour.members.2"), step: 2 },
    { content: t("tour.members.3"), step: 3 }
  ];

  const currentTourSteps = activeTourType === "members" ? membersTourSteps : mainTourSteps;

  useEffect(() => {
    if (activeTourType === "main") {
      if ([0, 4, 5].includes(activeTourIndex)) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    }
  }, [activeTourIndex, activeTourType]);

  const sheetFilters = useMemo(() => {
    const f = { ...filters };
    if (activeSheetName === "War Members" || activeSheetName === "War Attacks") {
      f.warKey = selectedWarKey;
    }
    if (["CWL Rounds", "CWL Round Members", "CWL Round Attacks"].includes(activeSheetName) && selectedCwlSeasonKey) {
      f.seasonKey = selectedCwlSeasonKey;
    }
    if (["CWL Round Members", "CWL Round Attacks"].includes(activeSheetName) && selectedCwlDay !== "all") {
      f.day = selectedCwlDay;
    }
    return f;
  }, [filters, activeSheetName, selectedWarKey, selectedCwlSeasonKey, selectedCwlDay]);

  const isReplaceStrategy = useMemo(() => {
    const activeEndpoint = AVAILABLE_ENDPOINTS.find(e => e.name === activeSheetName);
    return activeEndpoint?.strategy === "replace";
  }, [activeSheetName]);

  const {
    sheets,
    selected,
    selectedI18nKey,
    setSelected: hookSetSelected,
    strategy,
    headers,
    rows,
    totalAfterFilter,
    lastRow,
    loading,
    isInitialLoading,
    sheetsLoading,
    error,
    clanNames,
    resetCursor,
    refresh,
    mutateRow
  } = useSheetExplorer(baseUrl, pollMs, {
    q: debouncedQ,
    sortBy: sortConfig?.key,
    sortDir: sortConfig?.direction,
    authTag: user?.tag,
    filters: sheetFilters,
    limit: isReplaceStrategy ? pageSize : undefined,
    offset: isReplaceStrategy ? (page - 1) * pageSize : undefined
  });

  useEffect(() => {
    if (selected) setActiveSheetName(selected);
  }, [selected]);

  useEffect(() => {
    setSelectedRowId(null);
    setSelectedRowData(null);
    setIsColumnsOpen(false);
    setPage(1);
  }, [activeSheetName]);

  useEffect(() => {
    if (!activeSheetName) return;
    try {
      const stored = localStorage.getItem(`coc:hiddenColumns:${activeSheetName}`);
      setHiddenColumns(stored ? JSON.parse(stored) : {});
    } catch {
      setHiddenColumns({});
    }
  }, [activeSheetName]);

  useEffect(() => {
    if (!activeSheetName) return;
    localStorage.setItem(`coc:hiddenColumns:${activeSheetName}`, JSON.stringify(hiddenColumns));
  }, [activeSheetName, hiddenColumns]);

  const setSelected = (name: string) => {
    setActiveSheetName(name);
    hookSetSelected(name);
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    if (activeSheetName === "War Members" || activeSheetName === "War Attacks") {
      fetchEndpoint(baseUrl, "/api/v1/war/history", { limit: 50, sortBy: "endTime", sortDir: "desc" })
        .then(resp => setWarHistory(resp.rows || []))
        .catch(() => {});
    }
  }, [baseUrl, activeSheetName]);

  useEffect(() => {
    if (!["CWL Rounds", "CWL Round Members", "CWL Round Attacks"].includes(activeSheetName)) return;
    fetchEndpoint(baseUrl, "/api/v1/cwl/season-history", { limit: 50, sortBy: "season", sortDir: "desc" })
      .then(resp => {
        const list = resp.rows || [];
        setCwlSeasons(list);
        setSelectedCwlSeasonKey(prev => prev || list[0]?.seasonKey || "");
      })
      .catch(() => {});
  }, [baseUrl, activeSheetName]);

  useEffect(() => {
    fetchAccessStats(baseUrl, true)
      .then(resp => setTotalVisits(resp.total))
      .catch(() => {});
  }, [baseUrl]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 }),
    [i18n.language]
  );

  const formatNum = (value: number) => numberFormatter.format(value);

  const translateValue = (value: unknown) => {
    const text = rawString(value);
    if (!text) return text;
    const directKey = `value.${text}`;
    const lowerKey = `value.${text.toLowerCase()}`;
    const direct = t(directKey);
    if (direct !== directKey) return direct;
    const lower = t(lowerKey);
    if (lower !== lowerKey) return lower;
    return text;
  };

  const formatRawForDisplay = (val: any, columnKey: string) => {
    if (val === null || val === undefined || val === "") return "";
    const date = parseSheetDate(val);
    if (date && (DATE_FIELDS.has(columnKey) || String(val).endsWith("Z"))) {
      return format(date, "dd/MM/yyyy HH:mm:ss");
    }

    if (typeof val === "number") return formatNum(val);
    if (typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val.trim())) {
      const n = Number(val);
      if (Number.isFinite(n) && Math.abs(n) >= 1000) return formatNum(n);
    }
    return translateValue(val);
  };

  const isPercentColumn = (columnKey: string) => {
    const key = columnKey.toLowerCase();
    return key.includes("pct") || key.includes("rate") || key.includes("destruction");
  };

  const isChipColumn = (columnKey: string) => {
    return ["result", "state", "status", "rosterStatus", "note", "reason", "type", "warType"].includes(columnKey);
  };

  const formatValue = (val: any, columnKey: string) => {
    if (val === null || val === undefined || val === "") return "";
    const strVal = String(val);

    if (columnKey.toLowerCase().includes("tag") && strVal.startsWith("#")) {
      const name = clanNames[strVal];
      return name ? `${name} (${strVal})` : strVal;
    }

    if ((columnKey === "adminNote" || columnKey === "memberNote") && strVal.startsWith("[")) {
      try {
        const notes = JSON.parse(strVal);
        if (Array.isArray(notes)) {
          if (notes.length === 0) return "";
          const latest = notes[notes.length - 1];
          return (
            <div className="flex flex-col gap-0.5 min-w-[140px] max-w-[260px]">
              <div className="text-[10px] bg-black/5 p-1.5 rounded border border-black/5 leading-tight">
                <span className="font-bold text-orange-800 break-words line-clamp-2">{latest.message}</span>
                <span className="text-[8px] opacity-50 block mt-0.5">{format(new Date(latest.time), "dd/MM HH:mm")}</span>
              </div>
            </div>
          );
        }
      } catch {
        // fallback below
      }
    }

    if (isPercentColumn(columnKey)) {
      if (typeof val === "string" && val.includes("%")) {
        return val;
      }
      let n = numberFrom(val);
      const fractionFields = new Set([
        "smoothedRate", "confidenceAttacks", "confidenceWars", "confidenceFactor",
        "missFactor", "missPenalty", "score", "observedRate"
      ]);
      if (fractionFields.has(columnKey)) n *= 100;
      while (Math.abs(n) > 100) n /= 10;
      return `${formatNum(n)}%`;
    }

    const display = formatRawForDisplay(val, columnKey);

    if (isChipColumn(columnKey)) {
      const raw = String(val).toLowerCase();
      const tone = raw.includes("win") || raw.includes("picked") || raw === "in" || raw === "cw" || raw === "cwl" || raw === "join" || raw === "promote" || raw === "false"
        ? "bg-green-700/10 text-green-800 border-green-700/20"
        : raw.includes("lose") || raw.includes("loss") || raw.includes("miss") || raw.includes("no_history") || raw === "out" || raw === "leave" || raw === "demote" || raw === "true"
          ? "bg-red-700/10 text-red-800 border-red-700/20"
          : raw.includes("draw") || raw === "bench" || raw === "name_change" || raw === "role_change"
            ? "bg-yellow-700/10 text-yellow-800 border-yellow-700/20"
            : "bg-[#4a3b2a]/10 text-[#4a3b2a] border-[#4a3b2a]/20";
      return <span className={clsx("inline-flex px-2 py-0.5 rounded-full border text-[10px] font-black uppercase", tone)}>{display}</span>;
    }

    return display;
  };

  const toggleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === "asc") return { key, direction: "desc" };
        return null;
      }
      return { key, direction: "asc" };
    });
  };

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    const { key, direction } = sortConfig;
    return [...rows].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];
      
      const clean = (v: any) => {
        if (v === null || v === undefined) return "";
        return String(v).trim().toLowerCase();
      };
      
      const strA = clean(valA);
      const strB = clean(valB);
      
      const numA = Number(strA.replace(/%/g, ""));
      const numB = Number(strB.replace(/%/g, ""));
      if (strA && strB && Number.isFinite(numA) && Number.isFinite(numB)) {
        return direction === "asc" ? numA - numB : numB - numA;
      }
      
      return direction === "asc" 
        ? strA.localeCompare(strB, undefined, { numeric: true }) 
        : strB.localeCompare(strA, undefined, { numeric: true });
    });
  }, [rows, sortConfig]);

  const shown = useMemo(() => {
    if (isReplaceStrategy) return sortedRows;
    if (sortedRows.length > maxShow) return sortedRows.slice(sortedRows.length - maxShow);
    return sortedRows;
  }, [sortedRows, maxShow, isReplaceStrategy]);

  const getRowSelectionKey = (row: Record<string, any>, idx: number) => {
    const base =
      row.attackId ||
      row.warMemberId ||
      row.roundMemberId ||
      row.raidMemberId ||
      row.rowId ||
      row.eventId ||
      row.playerTag ||
      row.tag ||
      row.attackerTag ||
      row.defenderTag ||
      row.warKey ||
      row.roundKey ||
      row.raidId ||
      activeSheetName;
    return `${String(base)}-${idx}`;
  };

  const baseVisibleHeaders = useMemo(() => {
    return headers.filter(h => {
      if (h === "type" && activeSheetName === "Member Events") return true;
      if (["CWL Rounds", "CWL Round Members", "CWL Round Attacks"].includes(activeSheetName) && h === "season") return false;
      return !TECHNICAL_COLUMNS.has(h);
    });
  }, [headers, activeSheetName]);
  const visibleHeaders = useMemo(
    () => baseVisibleHeaders.filter(h => !hiddenColumns[h]),
    [baseVisibleHeaders, hiddenColumns]
  );

  const activeFiltersCount = (q.trim() ? 1 : 0) + Object.keys(filters).length + (sortConfig ? 1 : 0);

  const analyticsRows = useMemo(() => {
    if (activeSheetName !== "Analytics") return [];
    return rows
      .filter(r => r.granularity === analyticsGranularity)
      .sort((a, b) => rawString(a.period).localeCompare(rawString(b.period)));
  }, [rows, activeSheetName, analyticsGranularity]);

  const analyticsTotals = useMemo(() => {
    const data = analyticsRows;
    const wars = data.reduce((a, r) => a + numberFrom(r.wars), 0);
    const wins = data.reduce((a, r) => a + numberFrom(r.wins), 0);
    const losses = data.reduce((a, r) => a + numberFrom(r.losses), 0);
    const draws = data.reduce((a, r) => a + numberFrom(r.draws), 0);
    const decided = wins + losses + draws;
    return {
      wars,
      wins,
      losses,
      draws,
      winRate: decided ? (wins / decided) * 100 : 0,
      raidLoot: data.reduce((a, r) => a + numberFrom(r.raidLoot), 0),
      raidAttacks: data.reduce((a, r) => a + numberFrom(r.raidAttacks), 0)
    };
  }, [analyticsRows]);

  const summaryCards = useMemo<SummaryCard[]>(() => {
    const count = shown.length;
    const sum = (field: string) => shown.reduce((acc, r) => acc + numberFrom(r[field]), 0);
    const avg = (field: string) => count ? sum(field) / count : 0;
    const avgPresent = (field: string) => {
      const values = shown.filter(r => r[field] !== null && r[field] !== undefined && r[field] !== "").map(r => numberFrom(r[field]));
      return values.length ? values.reduce((a, n) => a + n, 0) / values.length : 0;
    };
    const avgPct = (field: string) => {
      if (!count) return 0;
      const values = shown.map(r => {
        let n = numberFrom(r[field]);
        while (Math.abs(n) > 100) n /= 10;
        return n;
      });
      return values.reduce((a, n) => a + n, 0) / values.length;
    };
    const unique = (field: string) => new Set(shown.map(r => rawString(r[field])).filter(Boolean)).size;
    const resultCount = (value: string) => shown.filter(r => rawString(r.result).toLowerCase() === value).length;

    const generic: SummaryCard[] = [
      { label: t("summary.totalRows"), value: formatNum(isReplaceStrategy ? totalAfterFilter : count) },
      { label: t("summary.visibleColumns"), value: `${visibleHeaders.length}/${baseVisibleHeaders.length}` },
      { label: t("summary.activeFilters"), value: formatNum(activeFiltersCount) }
    ];

    if (activeSheetName === "Analytics") {
      return [
        { label: t("summary.wars"), value: formatNum(analyticsTotals.wars) },
        { label: t("summary.winRate"), value: `${formatNum(analyticsTotals.winRate)}%` },
        { label: t("summary.totalLoot"), value: formatNum(analyticsTotals.raidLoot) },
        { label: t("summary.raidAttacks"), value: formatNum(analyticsTotals.raidAttacks) }
      ];
    }

    if (activeSheetName === "Clan Members") {
      const management = shown.filter(r => /leader|co|thủ lĩnh|đồng/i.test(`${r.role} ${r.roleVi}`)).length;
      const noteCount = shown.filter(r => rawString(r.memberNote).length > 2 || rawString(r.adminNote).length > 2).length;
      return [
        { label: t("summary.members"), value: formatNum(count) },
        { label: t("summary.avgTownHall"), value: count ? formatNum(avg("townHallLevel")) : "0" },
        { label: t("summary.management"), value: formatNum(management) },
        { label: t("summary.notes"), value: formatNum(noteCount) }
      ];
    }

    if (activeSheetName === "War History" || activeSheetName === "CWL Rounds") {
      const win = resultCount("win");
      const lose = resultCount("lose") + resultCount("loss");
      const draw = resultCount("draw");
      return [
        { label: t("summary.wars"), value: formatNum(count) },
        { label: t("summary.record"), value: `${win}/${lose}/${draw}` },
        { label: t("summary.avgDestruction"), value: `${formatNum(avgPct("clanDestruction") || avgPct("oppDestruction"))}%` }
      ];
    }

    if (activeSheetName === "War Members" || activeSheetName === "CWL Round Members") {
      const done = sum("attacksDone");
      const required = sum("attacksRequired");
      return [
        { label: t("summary.participants"), value: formatNum(unique("playerTag")) },
        { label: t("summary.missingAttacks"), value: formatNum(sum("missingAttacks")) },
        { label: t("summary.attackProgress"), value: `${formatNum(done)}/${formatNum(required)}` },
        { label: t("summary.avgStars"), value: formatNum(avg("starsTotal")) }
      ];
    }

    if (activeSheetName === "War Attacks" || activeSheetName === "CWL Round Attacks") {
      return [
        { label: t("summary.attacks"), value: formatNum(count) },
        { label: t("summary.totalStars"), value: formatNum(sum("stars")) },
        { label: t("summary.avgDestruction"), value: `${formatNum(avgPct("destructionPct"))}%` },
        { label: t("summary.uniqueAttackers"), value: formatNum(unique("attackerTag")) }
      ];
    }

    if (activeSheetName === "War Stats (Current)") {
      const topScore = Math.max(0, ...shown.map(r => numberFrom(r.overall_completion_rate_pct)));
      return [
        { label: t("summary.members"), value: formatNum(count) },
        { label: t("summary.avgCompletion"), value: `${formatNum(avgPresent("overall_completion_rate_pct"))}%` },
        { label: t("summary.missingAttacks"), value: formatNum(sum("overall_missed_attacks")) },
        { label: t("summary.topCompletion"), value: `${formatNum(topScore)}%` }
      ];
    }

    if (activeSheetName === "War Recommend") {
      const picked = shown.filter(r => r.rosterStatus === "picked").length;
      const bench = shown.filter(r => r.rosterStatus === "bench").length;
      return [
        { label: t("summary.picked"), value: formatNum(picked) },
        { label: t("summary.bench"), value: formatNum(bench) },
        { label: t("summary.avgCompletion"), value: `${formatNum(avgPresent("observedRatePct"))}%` },
        { label: t("summary.topScore"), value: `${formatNum(Math.max(0, ...shown.map(r => numberFrom(r.scorePct))))}%` }
      ];
    }

    if (activeSheetName === "Raid Seasons") {
      return [
        { label: t("summary.totalLoot"), value: formatNum(sum("capitalTotalLoot")) },
        { label: t("summary.raidsCompleted"), value: formatNum(sum("raidsCompleted")) },
        { label: t("summary.attacks"), value: formatNum(sum("totalAttacks")) },
        { label: t("summary.rewards"), value: formatNum(sum("offensiveReward") + sum("defensiveReward")) }
      ];
    }

    if (activeSheetName === "Raid Members") {
      return [
        { label: t("summary.members"), value: formatNum(unique("playerTag")) },
        { label: t("summary.totalLoot"), value: formatNum(sum("capitalResourcesLooted")) },
        { label: t("summary.attacks"), value: formatNum(sum("attacks")) }
      ];
    }

    return generic;
  }, [shown, visibleHeaders.length, baseVisibleHeaders.length, activeFiltersCount, activeSheetName, analyticsTotals, isReplaceStrategy, totalAfterFilter, t, formatNum]);

  const handleRecommendExclusion = async (row: Record<string, any>, excluded: boolean) => {
    if (!user?.tag || !user?.token || !canManageRecommend) return;
    const targetTag = String(row.playerTag || row.tag || "").trim();
    if (!targetTag) return;

    setRecommendExclusionBusy(targetTag);
    setRecommendExclusionError("");
    try {
      await setWarRecommendManualExclude(baseUrl, {
        authTag: user.tag,
        token: user.token,
        targetTag,
        type: "cw",
        excluded,
      });
      refresh();
    } catch (e: any) {
      setRecommendExclusionError(e?.message || String(e));
    } finally {
      setRecommendExclusionBusy(null);
    }
  };

  const clearFilters = () => {
    setQ("");
    setFilters({});
    setTempFilters({});
    setSortConfig(null);
  };

  const toggleColumn = (key: string) => {
    setHiddenColumns(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const exportCsv = () => {
    const csvHeaders = visibleHeaders;
    const csvRows = shown.map(row => csvHeaders.map(h => {
      const cell = rawString(row[h]).replace(/"/g, '""');
      return `"${cell}"`;
    }).join(","));
    const csv = [`\ufeff${csvHeaders.join(",")}`, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = selected.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sheet";
    a.href = url;
    a.download = `${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyField = async (field: string, value: unknown) => {
    try {
      await navigator.clipboard.writeText(rawString(value));
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1200);
    } catch {
      // Clipboard can be blocked on insecure origins; no hard fail needed.
    }
  };

  const openNotesForRow = (row: Record<string, any>) => {
    const tag = row.playerTag || row.tag || row.attackerTag;
    const name = row.playerName || row.name || row.attackerName;
    if (!tag || !name) return;
    setNoteTarget({ tag, name, memberNote: row.memberNote, adminNote: row.adminNote });
  };

  const handleAnnounceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announceTitle.trim() || !announceContent.trim()) {
      setAnnounceError(i18n.language === "vi" ? "Vui lòng nhập đầy đủ tiêu đề và nội dung" : "Please fill in title and content");
      return;
    }
    if (!user || user.tag !== "#VCVQQCUJ") {
      setAnnounceError(i18n.language === "vi" ? "Bạn không có quyền đăng thông báo" : "Unauthorized");
      return;
    }

    setAnnounceLoading(true);
    setAnnounceError("");

    try {
      await createAnnouncement(baseUrl, {
        authTag: user.tag,
        token: user.token,
        title: announceTitle.trim(),
        content: announceContent.trim(),
        imageUrls: imageUrls.trim() || undefined,
        youtubeUrl: youtubeUrl.trim() || undefined
      });

      // Clear state and close
      setAnnounceTitle("");
      setAnnounceContent("");
      setImageUrls("");
      setYoutubeUrl("");
      setIsAnnounceModalOpen(false);
      
      // Refresh feed
      refresh();
    } catch (err: any) {
      console.error(err);
      setAnnounceError(err.message || "Failed to post announcement");
    } finally {
      setAnnounceLoading(false);
    }
  };

  const handleAnnounceDelete = async (id: string) => {
    if (!window.confirm(i18n.language === "vi" ? "Bạn có chắc chắn muốn xóa thông báo này?" : "Are you sure you want to delete this announcement?")) {
      return;
    }
    if (!user || user.tag !== "#VCVQQCUJ") return;

    try {
      await deleteAnnouncement(baseUrl, {
        authTag: user.tag,
        token: user.token,
        id
      });
      refresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to delete announcement");
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#2a2a2a] text-[#f0f0f0] font-sans overflow-hidden font-bold select-none relative">
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />

      {activeTourType && <div className="fixed inset-0 bg-black/70 z-[80] pointer-events-none transition-opacity duration-500" />}

      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={clsx(
        "w-80 flex-shrink-0 bg-[#1e1e1e] border-r-4 border-[#3a3a3a] flex flex-col shadow-2xl fixed lg:static inset-y-0 left-0 transition-transform duration-300 ease-in-out lg:translate-x-0",
        !isSidebarOpen && "-translate-x-full",
        activeTourType === "main" && (activeTourIndex === 0 || activeTourIndex === 4 || activeTourIndex === 5) ? "z-[90]" : "z-50",
        activeTourType === "main" && activeTourIndex === 0 && "ring-4 ring-yellow-500 ring-inset"
      )}>
        <div className="p-4 bg-[#252525] border-b-4 border-[#111] shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 p-2 rounded-xl border-2 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]">
              <Swords size={24} className="text-white drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-xl text-yellow-400 tracking-wider uppercase drop-shadow-md font-black" style={{ textShadow: "2px 2px 0px #000" }}>
                {t("app.title")}
              </h1>
              <div className="h-1 w-full bg-gradient-to-r from-yellow-600 to-transparent rounded mt-1" />
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-[#666] hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          <div className="px-2 py-2 text-xs font-bold text-[#aaa] uppercase tracking-widest flex items-center justify-between border-b-2 border-[#333] mb-2">
            <span>{t("sidebar.availableSheets")}</span>
            <div className="flex items-center">
              {sheetsLoading ? (
                <div className="flex items-center gap-1 px-2 py-1 bg-[#111] rounded border border-[#444] shadow-inner">
                  <RotateCw size={10} className="animate-spin text-orange-50" />
                  <span className="text-[10px] text-orange-400 animate-pulse uppercase">{t("sheet.loading")}</span>
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
                <div key={i} className="h-16 w-full bg-[#2a2a2a] rounded-xl animate-pulse border border-[#333]" />
              ))}
            </div>
          ) : (
            ([
              ["overview", t("nav.overview")],
              ["clan", t("nav.clan")],
              ["war", t("nav.war")],
              ["cwl", t("nav.cwl")],
              ["raid", t("nav.raid")]
            ] as const).map(([groupKey, groupLabel]) => {
              const groupSheets = sheets.filter(s => s.group === groupKey);
              if (!groupSheets.length) return null;
              return (
                <div key={groupKey} className="space-y-1.5 pt-1">
                  <div className="px-2 pt-2 text-[9px] uppercase tracking-[0.2em] text-[#666] font-black">{groupLabel}</div>
                  {groupSheets.map(s => {
                    const isSelected = s.name === selected;
                    return (
                      <button
                        key={s.name}
                        onClick={() => setSelected(s.name)}
                        className={clsx(
                          "w-full text-left px-3 py-2.5 rounded-xl transition-all duration-100 flex items-center gap-3 group border-2 relative overflow-hidden",
                          isSelected
                            ? "bg-[#3a2a1a] border-yellow-500 shadow-[0_4px_0_0_rgba(0,0,0,0.3)] translate-y-[-1px]"
                            : "bg-[#2a2a2a] border-[#444] hover:bg-[#333] hover:border-[#666]",
                          activeTourType === "main" && activeTourIndex === 5 && s.name === "Clan Members" && "ring-4 ring-yellow-500"
                        )}
                      >
                        <div className={clsx(
                          "p-1.5 rounded-lg border shadow-inner",
                          isSelected ? "bg-yellow-500 border-yellow-300 text-yellow-900" : "bg-[#1a1a1a] border-[#333] text-[#555]"
                        )}>
                          {s.name === "Analytics" ? <BarChart3 size={17} /> : <Scroll size={17} />}
                        </div>
                        <div className="flex-1 min-w-0 z-10">
                          <div className={clsx("font-bold truncate text-sm", isSelected ? "text-white" : "text-[#ccc]")}>{t(s.i18nKey, s.name)}</div>
                        </div>
                        {isSelected && <div className="absolute inset-0 bg-yellow-500/10 mix-blend-overlay" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className={clsx("p-3 border-t-4 border-[#111] bg-[#1a1a1a] text-[10px] text-[#666] font-mono transition-all", activeTourType === "main" && activeTourIndex === 4 && "ring-4 ring-yellow-500 ring-inset rounded-b-xl bg-[#2a2a2a]")}> 
          {isAuthenticated ? (
            <div className="mb-3 p-3 bg-[#2a2a2a] rounded-xl border-2 border-[#3a3a3a] flex items-center justify-between group shadow-inner">
              <div className="flex items-center gap-3 min-w-0">
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
                title={t("auth.logout")}
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
                <div className="text-xs font-black text-[#888] group-hover:text-white uppercase tracking-wider">{t("auth.login")}</div>
                <div className="text-[10px] text-[#555] font-mono">{t("auth.statsHint")}</div>
              </div>
            </button>
          )}

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <LayoutList size={12} />
                <span>{t("sidebar.lastUpdate")}: {new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-2 opacity-60">
                <Eye size={12} />
                <span>{t("sidebar.totalVisits")}: {totalVisits.toLocaleString()}</span>
              </div>
            </div>
            <div className="relative group">
              <button className="p-1.5 bg-[#333] hover:bg-[#444] rounded border border-[#555] text-[#ccc]" title={t("language.select")}>
                <Languages size={14} />
              </button>
              <select
                value={i18n.language}
                onChange={e => i18n.changeLanguage(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title={t("language.select")}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className={clsx(
        "flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-300",
        selectedRowData && "lg:pr-[420px]"
      )}>
        <div className="absolute inset-0 bg-[#222] z-0">
          <div className="w-full h-full opacity-5 bg-[radial-gradient(#444_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>

        <header className={clsx(
          "bg-[#2a2a2a] border-b-4 border-[#151515] px-4 lg:px-6 py-4 flex items-center justify-between shadow-2xl relative transition-all gap-3",
          activeTourType === "main" && activeTourIndex === 2 ? "z-[90]" : "z-10"
        )}>
          <div className="flex items-center gap-3 lg:gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 bg-[#333] rounded-lg border-2 border-[#444] text-yellow-500 hover:bg-[#444] active:scale-95 transition-all"
            >
              <Menu size={20} />
            </button>
            <div className={clsx("flex flex-col gap-0.5 lg:gap-1 transition-all min-w-0", activeTourType === "main" && activeTourIndex === 2 && "ring-4 ring-yellow-500 ring-offset-4 ring-offset-[#2a2a2a] rounded-lg bg-[#2a2a2a] p-1")}> 
              <h2 className="text-lg lg:text-2xl font-black text-white flex items-center gap-2 lg:gap-3 truncate" style={{ textShadow: "2px 2px 0 #000" }}>
                <Shield className="text-gray-500 hidden sm:block shrink-0" size={24} />
                <span className="truncate">{selectedI18nKey ? t(selectedI18nKey, selected) : t("sheet.noSheetSelected")}</span>
              </h2>
              <div className="flex items-center gap-2 text-[10px] lg:text-xs font-bold uppercase tracking-wide">
                <span className="bg-[#111] text-[#888] px-1.5 lg:px-2 py-0.5 lg:py-1 rounded border border-[#333]">
                  <span className="hidden sm:inline">{t("sheet.strategy")}: </span><span className="text-blue-400">{strategy}</span>
                </span>
                <span className="bg-[#111] text-[#888] px-1.5 lg:px-2 py-0.5 lg:py-1 rounded border border-[#333]">
                  <span className="hidden sm:inline">{t("sheet.cursor")}: </span><span className="text-orange-400">{(lastRow - 1 > 0 ? lastRow - 1 : 0).toLocaleString()}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3 shrink-0">
            <button
              onClick={() => { setActiveTourType("main"); setActiveTourIndex(0); }}
              className="p-2 text-[#666] hover:text-yellow-500 transition-colors"
              title={t("tour.main.title")}
            >
              <HelpCircle size={22} />
            </button>

            <button
              onClick={refresh}
              className="p-2 bg-[#333] hover:bg-[#444] text-white rounded-lg border-b-4 border-[#111] active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 shadow-lg text-xs uppercase tracking-wide"
              title={t("action.refresh")}
            >
              <RotateCw size={16} className={clsx(loading && "animate-spin")} />
              <span className="hidden lg:inline">{t("action.refresh")}</span>
            </button>

            {strategy === "append" && (
              <button
                onClick={resetCursor}
                className="p-2 lg:px-4 lg:py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 shadow-lg text-xs lg:text-sm uppercase tracking-wide"
              >
                <RotateCw size={16} />
                <span className="hidden lg:inline">{t("action.resetCursor")}</span>
              </button>
            )}

            {!isReplaceStrategy && (
              <div className="flex items-center gap-2 bg-[#1a1a1a] p-1 lg:p-1.5 rounded-lg border border-[#444] shadow-inner">
                <span className="hidden lg:inline text-[10px] text-[#888] px-2 uppercase font-bold">{t("action.showLast")}</span>
                <select
                  value={maxShow}
                  onChange={e => setMaxShow(parseInt(e.target.value, 10))}
                  className="bg-[#333] text-white text-[10px] lg:text-xs font-bold border border-[#555] rounded py-0.5 lg:py-1 pl-1 lg:pl-2 pr-2 lg:pr-4 focus:outline-none focus:border-yellow-500 cursor-pointer"
                >
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                  <option value={5000}>5000</option>
                </select>
              </div>
            )}
          </div>
        </header>

        <div className={clsx(
          "px-4 lg:px-6 py-3 lg:py-4 bg-[#3d2e1e] border-b border-[#2a2015] flex flex-col gap-3 shadow-inner relative transition-all",
          activeTourType === "main" && activeTourIndex === 1 ? "z-[90]" : "z-20"
        )}>
          {activeSheetName !== "Analytics" && (
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 lg:gap-4">
            {(activeSheetName === "War Members" || activeSheetName === "War Attacks") && (
              <div className="flex items-center gap-2 bg-[#2a1d12] p-1 lg:p-1.5 rounded-xl border-2 border-[#4e3b2a] shadow-inner min-w-0 xl:min-w-[280px]">
                <History size={18} className="ml-2 text-orange-200/40 shrink-0" />
                <select
                  value={selectedWarKey}
                  onChange={e => setSelectedWarKey(e.target.value)}
                  className="bg-transparent text-orange-50 text-xs lg:text-sm font-bold focus:outline-none cursor-pointer flex-1 py-1 min-w-0"
                >
                  <option value="latest" className="bg-[#2a1d12]">🏆 {t("war.latest")}</option>
                  {warHistory.map(w => (
                    <option key={w.warKey} value={w.warKey} className="bg-[#2a1d12]">
                      ⚔️ {w.opponentName} ({formatRawForDisplay(w.endTime, "endTime")})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {["CWL Rounds", "CWL Round Members", "CWL Round Attacks"].includes(activeSheetName) && (
              <div className="flex items-center gap-2 bg-[#2a1d12] p-1 lg:p-1.5 rounded-xl border-2 border-[#4e3b2a] shadow-inner min-w-0 xl:min-w-[230px]">
                <History size={18} className="ml-2 text-orange-200/40 shrink-0" />
                <span className="hidden 2xl:inline text-[10px] uppercase font-black text-orange-200/60">{t("cwl.season")}</span>
                <select
                  value={selectedCwlSeasonKey}
                  onChange={e => { setSelectedCwlSeasonKey(e.target.value); setSelectedCwlDay("all"); setPage(1); }}
                  className="bg-transparent text-orange-50 text-xs lg:text-sm font-bold focus:outline-none cursor-pointer flex-1 py-1 min-w-0"
                >
                  {cwlSeasons.map(s => (
                    <option key={s.seasonKey} value={s.seasonKey} className="bg-[#2a1d12]">
                      {s.season || s.seasonKey}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {["CWL Round Members", "CWL Round Attacks"].includes(activeSheetName) && (
              <div className="flex items-center gap-2 bg-[#2a1d12] p-1 lg:p-1.5 rounded-xl border-2 border-[#4e3b2a] shadow-inner min-w-0 xl:min-w-[150px]">
                <select
                  value={selectedCwlDay}
                  onChange={e => { setSelectedCwlDay(e.target.value); setPage(1); }}
                  className="bg-transparent text-orange-50 text-xs lg:text-sm font-bold focus:outline-none cursor-pointer flex-1 py-1 px-2 min-w-0"
                >
                  <option value="all" className="bg-[#2a1d12]">{t("cwl.allDays")}</option>
                  {[1, 2, 3, 4, 5, 6, 7].map(day => (
                    <option key={day} value={String(day)} className="bg-[#2a1d12]">
                      {t("field.day")} {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={clsx(
              "relative flex-1 transition-all",
              activeTourType === "main" && activeTourIndex === 1 && "ring-4 ring-yellow-500 rounded-xl bg-[#2a1d12]"
            )}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-200 opacity-60" size={18} />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder={t("search.placeholder")}
                className="w-full pl-10 pr-4 py-2 lg:py-2.5 bg-[#2a1d12] text-orange-50 placeholder-orange-200/30 border-2 border-[#4e3b2a] rounded-xl focus:outline-none focus:border-yellow-500 focus:bg-[#1a110a] transition-all shadow-inner font-medium text-sm"
              />
            </div>

            <div className="flex items-center gap-2 justify-end flex-wrap">
              <button
                onClick={clearFilters}
                disabled={activeFiltersCount === 0}
                className="px-3 py-2 bg-[#2a1d12] hover:bg-[#1a110a] disabled:opacity-40 text-orange-100 border-2 border-[#4e3b2a] rounded-xl flex items-center gap-2 text-[10px] uppercase font-black shadow-inner"
                title={t("action.clearFilters")}
              >
                <FilterX size={14} />
                <span className="hidden sm:inline">{t("action.clearFilters")}</span>
              </button>

              <button
                onClick={exportCsv}
                disabled={shown.length === 0 || visibleHeaders.length === 0}
                className="px-3 py-2 bg-[#2a1d12] hover:bg-[#1a110a] disabled:opacity-40 text-orange-100 border-2 border-[#4e3b2a] rounded-xl flex items-center gap-2 text-[10px] uppercase font-black shadow-inner"
                title={t("action.exportCsv")}
              >
                <Download size={14} />
                <span className="hidden sm:inline">{t("action.exportCsv")}</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setIsColumnsOpen(prev => !prev)}
                  className="px-3 py-2 bg-[#2a1d12] hover:bg-[#1a110a] text-orange-100 border-2 border-[#4e3b2a] rounded-xl flex items-center gap-2 text-[10px] uppercase font-black shadow-inner"
                  title={t("action.columns")}
                >
                  <SlidersHorizontal size={14} />
                  <span className="hidden sm:inline">{t("action.columns")}</span>
                </button>

                {isColumnsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto bg-[#1a110a] border-2 border-[#4e3b2a] rounded-xl shadow-2xl p-3 z-[80] custom-scrollbar">
                    <div className="flex items-center justify-between mb-2 border-b border-orange-200/10 pb-2">
                      <div className="text-[10px] uppercase font-black text-yellow-500 tracking-widest">{t("columns.title")}</div>
                      <button onClick={() => setHiddenColumns({})} className="text-[10px] text-orange-200/50 hover:text-white uppercase font-black">
                        {t("action.showAllColumns")}
                      </button>
                    </div>
                    {baseVisibleHeaders.length === 0 ? (
                      <div className="text-[10px] text-orange-200/40 py-4 text-center">{t("columns.empty")}</div>
                    ) : (
                      baseVisibleHeaders.map(h => (
                        <label key={h} className="flex items-center gap-2 text-xs text-orange-50/80 py-1.5 hover:bg-white/5 rounded px-1 cursor-pointer">
                          <input type="checkbox" checked={!hiddenColumns[h]} onChange={() => toggleColumn(h)} />
                          <span className="truncate">{t(`field.${h}`, h)}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="text-[10px] lg:text-xs font-bold text-orange-200/60 uppercase whitespace-nowrap self-center">
                {t("status.showing")} <span className="text-yellow-400 text-xs lg:text-sm">{shown.length}</span> {t("status.rows")}
              </div>
            </div>
          </div>
          )}

          {summaryCards.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {summaryCards.map(card => (
                <div key={card.label} className="bg-[#2a1d12] border border-[#4e3b2a] rounded-xl p-3 shadow-inner min-w-0">
                  <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-orange-200/40 font-black truncate">
                    <BarChart3 size={11} />
                    <span className="truncate">{card.label}</span>
                  </div>
                  <div className="text-lg lg:text-xl text-yellow-400 font-black mt-1 truncate" style={{ textShadow: "1px 1px 0 #000" }}>{card.value}</div>
                  {card.hint && <div className="text-[9px] text-orange-200/30 truncate">{card.hint}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 lg:mx-6 mt-4 p-3 lg:p-4 bg-red-900/50 border-2 border-red-500 rounded-xl flex items-start gap-3 text-red-100 shadow-lg backdrop-blur-sm z-10 text-xs lg:text-sm">
            <AlertCircle className="mt-0.5 flex-shrink-0 text-red-400" size={20} />
            <div>
              <h3 className="font-bold text-red-200">{t("status.error")}</h3>
              <p className="opacity-80 mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className={clsx(
          "flex-1 overflow-auto p-3 lg:p-6 z-0 text-[10px] lg:text-sm transition-all",
          (activeTourType === "main" && activeTourIndex === 3) || activeTourType === "members" ? "z-[90]" : "z-0"
        )}>
          <div className="bg-[#f0e6d2] border-2 lg:border-4 border-[#b89b72] rounded-xl shadow-2xl overflow-hidden h-full flex flex-col relative text-[#2a2a2a]">
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />

            {activeSheetName === "War Recommend" && recommendExclusionError && (
              <div className="mx-4 mt-4 relative z-20 px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-800 text-xs font-bold">
                {recommendExclusionError}
              </div>
            )}

            {activeSheetName === "Analytics" ? (
              <div className="overflow-auto flex-1 p-4 lg:p-6 relative z-10 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl lg:text-2xl font-black text-orange-950 uppercase tracking-wide flex items-center gap-2"><TrendingUp size={24} /> {t("analytics.title")}</h2>
                    <p className="text-xs text-[#806f5c] mt-1">{t("analytics.subtitle")}</p>
                  </div>
                  <div className="inline-flex bg-[#e4d6bf] border border-[#b89b72] rounded-xl p-1 self-start">
                    {(["week", "month"] as const).map(g => (
                      <button key={g} onClick={() => setAnalyticsGranularity(g)} className={clsx("px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all", analyticsGranularity === g ? "bg-[#6f4b2f] text-white shadow" : "text-[#6f4b2f] hover:bg-white/40")}>{t(`analytics.${g}`)}</button>
                    ))}
                  </div>
                </div>

                {analyticsRows.length === 0 ? (
                  <div className="py-20 text-center text-[#998877] font-bold uppercase tracking-wider">{loading ? t("status.loading") : t("status.noData")}</div>
                ) : (
                  <>
                    <AnalyticsLineChart rows={analyticsRows} valueKey="winRate" label={t("analytics.winRateTrend")} suffix="%" />
                    <AnalyticsLineChart rows={analyticsRows} valueKey="raidLoot" label={t("analytics.raidLootTrend")} />
                    <div className="bg-[#fcfaf2] border-2 border-[#dccfb9] rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-[#e4d6bf] text-[#5c4631] uppercase text-[10px]"><tr><th className="p-3 text-left">{t("analytics.period")}</th><th className="p-3 text-right">{t("summary.wars")}</th><th className="p-3 text-right">{t("summary.record")}</th><th className="p-3 text-right">{t("summary.winRate")}</th><th className="p-3 text-right">{t("summary.avgDestruction")}</th><th className="p-3 text-right">{t("summary.totalLoot")}</th></tr></thead>
                          <tbody>{[...analyticsRows].reverse().slice(0, 24).map(r => <tr key={`${r.granularity}-${r.period}`} className="border-t border-[#dccfb9]/70"><td className="p-3 font-black">{formatAnalyticsPeriod(rawString(r.period), analyticsGranularity)}</td><td className="p-3 text-right">{formatNum(numberFrom(r.wars))}</td><td className="p-3 text-right">{formatNum(numberFrom(r.wins))}/{formatNum(numberFrom(r.losses))}/{formatNum(numberFrom(r.draws))}</td><td className="p-3 text-right font-black">{formatNum(numberFrom(r.winRate))}%</td><td className="p-3 text-right">{formatNum(numberFrom(r.avgDestruction))}%</td><td className="p-3 text-right">{formatNum(numberFrom(r.raidLoot))}</td></tr>)}</tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : activeSheetName === "Announcements" ? (
              <div className="overflow-auto flex-1 p-4 lg:p-6 space-y-6 scrollbar-parchment relative z-10 max-w-4xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b-2 border-[#b89b72]/40 pb-4">
                  <div>
                    <h2 className="text-xl lg:text-2xl font-black text-orange-950 uppercase tracking-wide">📢 {t("endpoint.announcements")}</h2>
                    <p className="text-xs text-[#806f5c] mt-1">Thông báo và cập nhật mới nhất từ ban quản trị clan</p>
                  </div>
                  {user?.tag === "#VCVQQCUJ" && (
                    <button
                      onClick={() => setIsAnnounceModalOpen(true)}
                      className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-bold text-xs lg:text-sm uppercase tracking-wider rounded-lg shadow-lg hover:shadow-green-700/20 active:translate-y-0.5 transition-all flex items-center gap-2 border-b-4 border-green-900 active:border-b-0"
                    >
                      <Plus size={16} />
                      <span>{i18n.language === "vi" ? "Đăng thông báo" : "New Post"}</span>
                    </button>
                  )}
                </div>

                {rows.length === 0 ? (
                  <div className="py-20 text-center text-[#998877] font-bold uppercase tracking-wider">
                    {loading ? (
                      <div className="flex flex-col items-center gap-4">
                        <RotateCw className="animate-spin text-green-600/50" size={32} />
                        <span className="text-xs animate-pulse">{t("status.loading")}</span>
                      </div>
                    ) : (
                      "Chưa có thông báo nào"
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {rows.map((r: any) => {
                      const imageUrlList = [
                        ...(r.imageUrl ? [r.imageUrl] : []),
                        ...String(r.imageUrls || "").split(",").map(x => x.trim()).filter(Boolean)
                      ];

                      const getYouTubeId = (url: string) => {
                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                        const match = String(url).match(regExp);
                        return (match && match[2].length === 11) ? match[2] : null;
                      };
                      const ytId = r.youtubeUrl ? getYouTubeId(r.youtubeUrl) : null;

                      return (
                        <article key={r.id} className="bg-[#fcfaf2] border-2 border-[#dccfb9] rounded-xl p-5 lg:p-6 shadow-md hover:shadow-lg transition-all relative overflow-hidden group text-left text-xs lg:text-sm">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#b89b72]" />
                          
                          {user?.tag === "#VCVQQCUJ" && (
                            <button
                              onClick={() => handleAnnounceDelete(r.id)}
                              className="absolute top-4 right-4 p-2 text-red-700 hover:text-red-500 hover:bg-red-100/50 rounded-lg transition-colors animate-in fade-in"
                              title={i18n.language === "vi" ? "Xóa thông báo" : "Delete Announcement"}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

                          <header className="flex flex-col gap-1 border-b border-[#dccfb9]/60 pb-3 mb-4 pr-8">
                            <h3 className="text-base lg:text-lg font-black text-orange-950 break-words leading-tight">{r.title}</h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] lg:text-xs text-[#806f5c] font-medium mt-1">
                              <span className="font-bold text-orange-800">👑 {r.authorName} ({r.authorTag})</span>
                              <span className="opacity-50">•</span>
                              <span>📅 {formatRawForDisplay(r.ts, "ts")}</span>
                            </div>
                          </header>
                          
                          <div className="text-xs lg:text-sm text-[#3a2e20] leading-relaxed whitespace-pre-wrap font-medium break-words select-text">
                            {r.content}
                          </div>

                          {imageUrlList.length > 0 && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl select-none">
                              {imageUrlList.map((url, idx) => (
                                <div key={idx} className="overflow-hidden rounded-lg border border-[#dccfb9]/60 bg-black/5 aspect-video w-full">
                                  <img
                                    src={url}
                                    alt={`${r.title} - ${idx + 1}`}
                                    className="w-full h-full object-cover cursor-zoom-in hover:scale-[1.01] transition-transform duration-200"
                                    onClick={() => setZoomImageUrl(url)}
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {ytId && (
                            <div className="mt-4 overflow-hidden rounded-xl border border-[#dccfb9]/60 aspect-video w-full max-w-2xl bg-black shadow-lg">
                              <iframe
                                src={`https://www.youtube.com/embed/${ytId}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className="w-full h-full"
                              />
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-auto flex-1 scrollbar-parchment relative z-10">
                <table className="w-full text-left border-collapse">
                  <thead className={clsx("bg-[#e6d5b8] sticky top-0 z-10 shadow-md border-b-2 border-[#cbbda2] transition-all", activeTourType === "main" && activeTourIndex === 3 && "ring-4 ring-yellow-500")}> 
                    <tr>
                      {visibleHeaders.map((h, i) => (
                        <th key={i} className={clsx(
                          "px-3 lg:px-4 py-2 lg:py-3 text-[10px] lg:text-xs font-black text-[#5c4a35] uppercase tracking-wider min-w-[120px] lg:min-w-[150px] align-top transition-all",
                          activeTourType === "members" && activeTourIndex === 2 && (h === "memberNote" || h === "adminNote") && "bg-yellow-500/20 ring-4 ring-yellow-500 ring-inset"
                        )}>
                          <div className="flex flex-col gap-1 lg:gap-2">
                            <div className="flex items-center gap-1 cursor-pointer hover:text-[#3a2e20] select-none" onClick={() => toggleSort(h)}>
                              <span>{t(`field.${h}`, h)}</span>
                              {sortConfig?.key === h && (
                                sortConfig.direction === "asc" ? <ArrowUp size={12} className="text-orange-600" /> : <ArrowDown size={12} className="text-orange-600" />
                              )}
                            </div>
                            <div className="relative">
                              <input
                                className="w-full bg-[#fcf5e5] border border-[#cbbda2] rounded px-1.5 lg:px-2 py-0.5 lg:py-1 text-[10px] lg:text-[11px] font-normal focus:outline-none focus:border-orange-400 placeholder-[#b89b72]"
                                placeholder={t("filter.placeholder")}
                                value={tempFilters[h] || ""}
                                onChange={e => updateFilter(h, e.target.value)}
                                onKeyDown={handleFilterKeyDown}
                              />
                              {tempFilters[h] && <button onClick={() => updateFilter(h, "")} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#b89b72] hover:text-red-500"><X size={10} /></button>}
                            </div>
                          </div>
                        </th>
                      ))}
                      {activeSheetName === "War Recommend" && canManageRecommend && (
                        <th className="px-3 lg:px-4 py-2 lg:py-3 text-[10px] lg:text-xs font-black text-[#5c4a35] uppercase tracking-wider min-w-[150px] align-top">
                          {i18n.language === "vi" ? "Quản lý đề xuất" : "Recommendation control"}
                        </th>
                      )}
                      {visibleHeaders.length === 0 && <th className="p-4" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dccfb9]">
                    {shown.map((r, idx) => {
                      const tag = r.playerTag || r.tag || r.attackerTag;
                      const name = r.playerName || r.name || r.attackerName;
                      const canNote = isAuthenticated && tag && name && activeSheetName === "Clan Members";
                      const isFirstRow = idx === 0;
                      const rowKey = getRowSelectionKey(r, idx);
                      const isSelected = selectedRowId === rowKey;

                      return (
                        <tr
                          key={rowKey}
                          onClick={() => {
                            setSelectedRowId(rowKey);
                            setSelectedRowData(r);
                          }}
                          className={clsx(
                            "transition-colors group odd:bg-[#f0e6d2] even:bg-[#ebe0ca] cursor-pointer",
                            isSelected ? "bg-[#f8e7b8]" : "hover:bg-[#fff9ea]",
                            activeTourType === "members" && activeTourIndex === 0 && isFirstRow && "ring-4 ring-yellow-500 ring-inset z-50 bg-yellow-100"
                          )}
                        >
                          {visibleHeaders.map((h, i) => (
                            <td
                              key={i}
                              className={clsx(
                                "px-3 lg:px-4 py-2 lg:py-2.5 font-semibold text-[#4a3b2a] whitespace-nowrap border-r border-[#dccfb9]/50 last:border-0 relative transition-colors",
                                isSelected && "bg-[#f6de9f]"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <span className={clsx(
                                  (h === "playerName" || h === "name" || h === "attackerName") && r.isInClan === false && "text-orange-950/50 italic font-medium"
                                )}>
                                  {(h === "playerName" || h === "name" || h === "attackerName") && r.isInClan === false
                                    ? `(*) ${formatValue((r as any)[h], h)}`
                                    : formatValue((r as any)[h], h)}
                                </span>
                                {canNote && (h === "playerName" || h === "name" || h === "attackerName") && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      openNotesForRow(r);
                                    }}
                                    className="p-1 rounded bg-orange-100 hover:bg-orange-200 text-orange-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title={t("action.openNotes")}
                                  >
                                    <StickyNote size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          ))}
                          {activeSheetName === "War Recommend" && canManageRecommend && (
                            <td className="px-3 lg:px-4 py-2 lg:py-2.5 border-r border-[#dccfb9]/50 last:border-0 whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRecommendExclusion(r, !Boolean(r.manualExcluded));
                                }}
                                disabled={recommendExclusionBusy === String(tag || "")}
                                className={clsx(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all disabled:opacity-50",
                                  r.manualExcluded
                                    ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
                                    : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                                )}
                                title={r.manualExcluded
                                  ? (i18n.language === "vi" ? "Khôi phục member vào xếp hạng đề xuất" : "Restore member to recommendation ranking")
                                  : (i18n.language === "vi" ? "Đẩy member xuống cuối bảng đề xuất" : "Demote member to the bottom of recommendations")}
                              >
                                {r.manualExcluded ? <UserPlus size={12} /> : <UserMinus size={12} />}
                                {r.manualExcluded
                                  ? (i18n.language === "vi" ? "Khôi phục" : "Restore")
                                  : (i18n.language === "vi" ? "Loại" : "Exclude")}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={Math.max(1, visibleHeaders.length + (activeSheetName === "War Recommend" && canManageRecommend ? 1 : 0))} className="px-6 py-20 text-center text-[#998877]">
                          {(loading || isInitialLoading) ? (
                            <div className="flex flex-col items-center gap-4">
                              <RotateCw className="animate-spin text-green-600/50" size={48} />
                              <p className="font-bold text-base lg:text-lg uppercase tracking-widest animate-pulse text-green-800/40">
                                {t("status.loading")}
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-4 opacity-60">
                              <Layers size={48} />
                              <p className="font-bold text-base lg:text-lg uppercase tracking-widest">{t("status.noData")}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {isReplaceStrategy && totalAfterFilter > 0 && (
              <div className="border-t-2 border-[#cbbda2] bg-[#fdfaf2] px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#5c4a37] font-semibold relative z-10">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-[#f5ebd6] border border-[#cbbda2] rounded px-1 py-0.5 font-bold focus:outline-none"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span>rows per page</span>
                </div>
                
                <div className="text-[#806f5c]">
                  Showing {Math.min(totalAfterFilter, (page - 1) * pageSize + 1)}-{Math.min(totalAfterFilter, page * pageSize)} of {totalAfterFilter} rows
                </div>

                <div className="flex items-center gap-1 select-none">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    className="p-1 px-2 rounded bg-[#f5ebd6] hover:bg-[#ebdcc0] border border-[#cbbda2] disabled:opacity-40 disabled:pointer-events-none font-bold text-[10px]"
                  >
                    &lt;&lt;
                  </button>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    className="p-1 px-2 rounded bg-[#f5ebd6] hover:bg-[#ebdcc0] border border-[#cbbda2] disabled:opacity-40 disabled:pointer-events-none font-bold text-[10px]"
                  >
                    &lt;
                  </button>
                  <span className="px-3 font-bold">
                    Page {page} of {Math.max(1, Math.ceil(totalAfterFilter / pageSize))}
                  </span>
                  <button
                    disabled={page * pageSize >= totalAfterFilter}
                    onClick={() => setPage(prev => prev + 1)}
                    className="p-1 px-2 rounded bg-[#f5ebd6] hover:bg-[#ebdcc0] border border-[#cbbda2] disabled:opacity-40 disabled:pointer-events-none font-bold text-[10px]"
                  >
                    &gt;
                  </button>
                  <button
                    disabled={page * pageSize >= totalAfterFilter}
                    onClick={() => setPage(Math.max(1, Math.ceil(totalAfterFilter / pageSize)))}
                    className="p-1 px-2 rounded bg-[#f5ebd6] hover:bg-[#ebdcc0] border border-[#cbbda2] disabled:opacity-40 disabled:pointer-events-none font-bold text-[10px]"
                  >
                    &gt;&gt;
                  </button>
                </div>
              </div>
            )}

            <div className="border-t-2 border-[#cbbda2] bg-[#e6d5b8] px-4 py-2 text-[8px] lg:text-[10px] text-[#776655] flex justify-between items-center font-bold uppercase relative z-10">
              <span className="flex items-center gap-1"><Database size={10} /> {t("status.source")}</span>
              {strategy === "append" && (
                <span className="text-[#998877] italic normal-case hidden sm:inline">{t("status.appendNote")}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedRowData && (
        <aside className="fixed right-0 top-0 bottom-0 z-[75] w-full sm:w-[420px] bg-[#21160d] border-l-4 border-[#4e3b2a] shadow-2xl text-orange-50 flex flex-col">
          <div className="p-4 bg-[#2a1d12] border-b-4 border-[#1a110a] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-yellow-500 text-[10px] uppercase tracking-widest font-black">
                <Info size={14} /> {t("details.title")}
              </div>
              <div className="text-xs text-orange-200/40 mt-1">{t("details.subtitle")}</div>
            </div>
            <button onClick={() => { setSelectedRowData(null); setSelectedRowId(null); }} className="p-2 text-orange-200/50 hover:text-white hover:bg-white/10 rounded-lg">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {Object.entries(selectedRowData).map(([field, value]) => (
              <button
                key={field}
                onClick={() => copyField(field, value)}
                className="w-full text-left bg-[#1a110a] hover:bg-[#2a1d12] border border-[#4e3b2a] rounded-xl p-3 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-[10px] uppercase tracking-wider text-yellow-500/80 font-black truncate">{t(`field.${field}`, field)}</div>
                  {copiedField === field ? <Check size={13} className="text-green-400" /> : <Copy size={13} className="text-orange-200/25 group-hover:text-orange-200/70" />}
                </div>
                <div className="text-sm font-bold text-orange-50/90 break-words whitespace-pre-wrap">{rawString(value) || "—"}</div>
              </button>
            ))}
          </div>

          {activeSheetName === "Clan Members" && isAuthenticated && selectedRowData && (
            <div className="p-4 border-t-2 border-[#4e3b2a] bg-[#2a1d12]">
              <button
                onClick={() => openNotesForRow(selectedRowData)}
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-xl border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase text-xs shadow-lg"
              >
                <StickyNote size={16} />
                {t("action.openNotes")}
              </button>
            </div>
          )}
        </aside>
      )}

      {activeTourType && (
        <div className="fixed inset-0 z-[120] pointer-events-none">
          <div className={clsx(
            "fixed z-[130] text-yellow-500 animate-bounce transition-all duration-500 flex flex-col items-center",
            activeTourType === "main" ? (
              activeTourIndex === 0 && "left-40 top-1/2 -translate-y-1/2" ||
              activeTourIndex === 1 && "left-1/2 top-44 -translate-x-1/2" ||
              activeTourIndex === 2 && "left-[200px] lg:left-[450px] top-10" ||
              activeTourIndex === 3 && "left-1/2 top-[35%] -translate-x-1/2" ||
              activeTourIndex === 4 && "left-40 bottom-24" ||
              activeTourIndex === 5 && "left-40 top-[25%]"
            ) : (
              activeTourIndex === 0 && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" ||
              activeTourIndex === 1 && "left-1/2 top-[40%] -translate-x-1/2" ||
              activeTourIndex === 2 && "right-40 top-40"
            )
          )}>
            <div className="bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full mb-1 shadow-lg uppercase whitespace-nowrap">{t("tour.lookHere")}</div>
            <ArrowBigDownDash size={48} fill="currentColor" className="drop-shadow-[0_0_15px_rgba(234,179,8,1)]" />
          </div>

          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[140] flex justify-center w-full max-w-sm px-4 pointer-events-auto">
            <div className="w-full bg-[#3d2e1e] text-orange-50 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-4 border-[#b89b72] relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="flex-1">
                  <div className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-1.5 drop-shadow-md">
                    {activeTourType === "members" ? t("tour.members.title") : t("tour.main.title")} • {t("tour.step")} {currentTourSteps[activeTourIndex].step}/{currentTourSteps.length}
                  </div>
                  <div className="font-bold text-sm lg:text-base leading-snug text-white" style={{ textShadow: "1px 1px 2px #000" }}>
                    {currentTourSteps[activeTourIndex].content}
                  </div>
                </div>
                <button onClick={closeTour} className="text-orange-200/40 hover:text-white p-1 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-5 relative z-10">
                <div className="flex gap-1.5">
                  {currentTourSteps.map((_, i) => (
                    <div key={i} className={clsx("w-2 h-2 rounded-full transition-all border border-black/20", i === activeTourIndex ? "bg-yellow-500 w-5 shadow-[0_0_5px_rgba(234,179,8,0.5)]" : "bg-white/10")} />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    disabled={activeTourIndex === 0}
                    onClick={() => setActiveTourIndex(prev => prev - 1)}
                    className="p-1.5 bg-[#2a1d12] hover:bg-[#4e3b2a] text-yellow-500 rounded-xl border-b-2 border-[#1a110a] active:border-b-0 active:translate-y-0.5 transition-all disabled:opacity-20"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  {activeTourIndex < currentTourSteps.length - 1 ? (
                    <button
                      onClick={() => setActiveTourIndex(prev => prev + 1)}
                      className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-2 rounded-xl text-xs font-black uppercase border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg tracking-wide"
                    >
                      {t("tour.next")}
                    </button>
                  ) : (
                    <button
                      onClick={closeTour}
                      className="bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-xl text-xs font-black uppercase border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg tracking-wide"
                    >
                      {activeTourType === "members" ? t("tour.gotIt") : t("tour.explore")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {noteTarget && user && (
        <AddNoteModal
          baseUrl={baseUrl}
          user={user}
          target={noteTarget}
          onClose={() => setNoteTarget(null)}
          onSuccess={(newJson, type) => {
            const field = type === "admin" ? "adminNote" : "memberNote";
            mutateRow(noteTarget.tag, field, newJson);
            setSelectedRowData(prev => prev && (prev.playerTag === noteTarget.tag || prev.tag === noteTarget.tag) ? { ...prev, [field]: newJson } : prev);
            setNoteTarget(prev => prev ? { ...prev, [field]: newJson } : null);
          }}
        />
      )}

      {/* Create Announcement Modal */}
      {isAnnounceModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsAnnounceModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[#2a1d12] border-4 border-[#4e3b2a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative text-orange-50 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none rounded-[14px] overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
            </div>

            <div className="p-4 bg-[#2a1d12] border-b-4 border-[#1a110a] flex items-center justify-between gap-3 relative z-10">
              <h3 className="text-sm lg:text-base font-black text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                📢 {i18n.language === "vi" ? "Đăng thông báo mới" : "New Announcement"}
              </h3>
              <button
                onClick={() => setIsAnnounceModalOpen(false)}
                className="p-1 text-orange-200/40 hover:text-white rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAnnounceSubmit} className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 relative z-10 scrollbar-parchment">
              {announceError && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-red-200 text-xs font-semibold">
                  {announceError}
                </div>
              )}

              <div className="space-y-1 flex flex-col text-left">
                <label className="text-[10px] uppercase tracking-wider text-orange-200/50 font-black">
                  {i18n.language === "vi" ? "Tiêu đề" : "Title"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={i18n.language === "vi" ? "Nhập tiêu đề thông báo..." : "Enter title..."}
                  value={announceTitle}
                  onChange={(e) => setAnnounceTitle(e.target.value)}
                  className="w-full bg-[#1a110a] border-2 border-[#4e3b2a] rounded-lg px-3 py-2 text-orange-50 placeholder-orange-200/20 focus:outline-none focus:border-yellow-500 text-xs lg:text-sm font-semibold transition-colors"
                />
              </div>

              <div className="space-y-1 flex flex-col text-left">
                <label className="text-[10px] uppercase tracking-wider text-orange-200/50 font-black">
                  {i18n.language === "vi" ? "Nội dung" : "Content"}
                </label>
                <textarea
                  required
                  rows={8}
                  placeholder={i18n.language === "vi" ? "Nhập nội dung thông báo (hỗ trợ xuống dòng)..." : "Enter announcement content..."}
                  value={announceContent}
                  onChange={(e) => setAnnounceContent(e.target.value)}
                  className="w-full bg-[#1a110a] border-2 border-[#4e3b2a] rounded-lg px-3 py-2 text-orange-50 placeholder-orange-200/20 focus:outline-none focus:border-yellow-500 text-xs lg:text-sm font-semibold transition-colors resize-none custom-scrollbar"
                />
              </div>

              <div className="space-y-1 flex flex-col text-left">
                <label className="text-[10px] uppercase tracking-wider text-orange-200/50 font-black">
                  {i18n.language === "vi" ? "Link hình ảnh (Phân cách bằng dấu phẩy nếu có nhiều ảnh)" : "Image URLs (Comma separated if multiple)"}
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/image1.jpg, https://example.com/image2.png"
                  value={imageUrls}
                  onChange={(e) => setImageUrls(e.target.value)}
                  className="w-full bg-[#1a110a] border-2 border-[#4e3b2a] rounded-lg px-3 py-2 text-orange-50 placeholder-orange-200/20 focus:outline-none focus:border-yellow-500 text-xs lg:text-sm font-semibold transition-colors"
                />
              </div>

              <div className="space-y-1 flex flex-col text-left">
                <label className="text-[10px] uppercase tracking-wider text-orange-200/50 font-black">
                  {i18n.language === "vi" ? "Link video Youtube (Tùy chọn)" : "YouTube Video Link (Optional)"}
                </label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full bg-[#1a110a] border-2 border-[#4e3b2a] rounded-lg px-3 py-2 text-orange-50 placeholder-orange-200/20 focus:outline-none focus:border-yellow-500 text-xs lg:text-sm font-semibold transition-colors"
                />
              </div>

              <div className="border-t border-[#4e3b2a] pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnnounceModalOpen(false)}
                  className="px-4 py-2 bg-transparent hover:bg-white/5 border border-[#4e3b2a] text-orange-200 hover:text-white rounded-lg font-bold text-xs lg:text-sm uppercase tracking-wider transition-colors"
                >
                  {i18n.language === "vi" ? "Hủy" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={announceLoading}
                  className="px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold text-xs lg:text-sm uppercase tracking-wider rounded-lg shadow-lg hover:shadow-green-700/20 active:translate-y-0.5 transition-all border-b-4 border-green-900 active:border-b-0 flex items-center gap-2"
                >
                  {announceLoading ? (
                    <>
                      <RotateCw size={14} className="animate-spin" />
                      <span>{i18n.language === "vi" ? "Đang đăng..." : "Posting..."}</span>
                    </>
                  ) : (
                    <span>{i18n.language === "vi" ? "Đăng" : "Post"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox Zoom Overlay */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 animate-in fade-in duration-200 cursor-zoom-out select-none"
          onClick={() => setZoomImageUrl(null)}
        >
          <button
            onClick={() => setZoomImageUrl(null)}
            className="absolute top-6 right-6 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X size={24} />
          </button>
          <img
            src={zoomImageUrl}
            alt="Zoomed Announcement Asset"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
