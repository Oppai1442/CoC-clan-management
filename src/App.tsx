import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SheetExplorer } from "./component/SheetExplorer";

const STORAGE_KEY = "oClanManager.backendUrl";
const DEFAULT_BOOTSTRAP_URL = String(import.meta.env.VITE_COC_BOOTSTRAP_URL || "").trim();

function normalizeUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

async function resolveBackend(url: string) {
  const base = normalizeUrl(url);
  const res = await fetch(`${base}?path=/api/v1/get-url`);
  const data = await res.json();
  if (data?.ok && data?.url) return normalizeUrl(String(data.url));
  if (data?.ok) return base;
  throw new Error(data?.error || `HTTP ${res.status}`);
}

export default function App() {
  const { t } = useTranslation();
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [candidate, setCandidate] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_BOOTSTRAP_URL);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const connect = async (raw: string) => {
    if (!raw.trim()) return;
    setChecking(true);
    setError("");
    try {
      const configured = normalizeUrl(raw);
      const resolved = await resolveBackend(configured);
      localStorage.setItem(STORAGE_KEY, configured);
      setCandidate(configured);
      setApiUrl(resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (candidate) void connect(candidate);
    // First boot only. Users can reconnect from this screen after clearing the saved URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (apiUrl) return <SheetExplorer baseUrl={apiUrl} pollMs={15000} />;

  return (
    <main className="min-h-screen bg-[#17130f] text-[#f7ead0] flex items-center justify-center p-5">
      <section className="w-full max-w-xl rounded-2xl border-4 border-[#5b3a20] bg-[#2b2118] shadow-2xl overflow-hidden">
        <header className="px-6 py-5 bg-[#3a291b] border-b-4 border-[#17100b]">
          <div className="text-xs font-black uppercase tracking-[0.25em] text-[#d5a54a]">O-Project · Game Tools</div>
          <h1 className="mt-2 text-3xl font-black text-[#ffd66b]" style={{ textShadow: "2px 2px #000" }}>O-Clan Manager</h1>
          <p className="mt-2 text-sm text-[#d9c7aa]">Connect this dashboard to your own Google Apps Script deployment.</p>
        </header>

        <div className="p-6 space-y-5">
          <div className="rounded-xl border-2 border-[#6b5137] bg-[#1e1813] p-4 text-sm leading-6">
            <strong className="text-[#ffd66b]">First setup:</strong> copy the project spreadsheet, run its O-Clan Manager setup, deploy the Apps Script as a Web App, then paste the deployment URL below.
          </div>

          <label className="block">
            <span className="block mb-2 text-xs font-black uppercase tracking-wider text-[#caa66a]">Apps Script Web App URL</span>
            <input
              value={candidate}
              onChange={e => setCandidate(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void connect(candidate)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full rounded-xl border-2 border-[#6b5137] bg-[#110e0b] px-4 py-3 text-sm text-white outline-none focus:border-[#e2ad45]"
            />
          </label>

          {error && <div className="rounded-lg border border-red-700 bg-red-950/40 px-4 py-3 text-sm text-red-200">Could not connect: {error}</div>}

          <button
            disabled={checking || !candidate.trim()}
            onClick={() => void connect(candidate)}
            className="w-full rounded-xl border-b-4 border-[#75500f] bg-[#e1a72e] px-5 py-3 font-black uppercase tracking-wider text-[#2b1b08] disabled:opacity-50 active:translate-y-1 active:border-b-0"
          >
            {checking ? t("app.connecting") : "Test & connect"}
          </button>

          <p className="text-xs text-[#907d67]">The URL is stored only in this browser. No O-Project hosted backend is required.</p>
        </div>
      </section>
    </main>
  );
}
