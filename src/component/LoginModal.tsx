import { useState, useEffect } from 'react';
import { Search, ShieldCheck, X, User, Key, RotateCw, ListFilter, RefreshCw, Save, HelpCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { searchPlayer, verifyPlayerToken, listCurrentMembers, forceSyncClan, addPlayerNote } from '../lib/sheetApi';
import { type UserProfile } from '../hooks/useAuth';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

type Props = {
  baseUrl: string;
  onSuccess: (user: Omit<UserProfile, 'loginAt'> & { token: string }) => void;
  onClose: () => void;
};

type TourStep = {
  target: string;
  content: string;
  step: number;
};

export function LoginModal({ baseUrl, onSuccess, onClose }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'search' | 'verify'>('search');
  const [query, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [token, setToken] = useState('');

  // Tour state
  const [showTour, setShowTour] = useState(false);
  const [activeTourIndex, setActiveTourIndex] = useState(0);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenLoginTour');
    if (!hasSeenTour) {
      setShowTour(true);
    }
  }, []);

  const closeTour = () => {
    setShowTour(false);
    localStorage.setItem('hasSeenLoginTour', 'true');
  };

  const tourSteps: TourStep[] = step === 'search' ? [
    { target: 'search-input', content: t('tour.login.search.1'), step: 1 },
    { target: 'list-btn', content: t('tour.login.search.2'), step: 2 },
    { target: 'sync-btn', content: t('tour.login.search.3'), step: 3 },
    { target: 'search-btn', content: t('tour.login.search.4'), step: 4 },
  ] : [
    { target: 'token-input', content: t('tour.login.verify.1'), step: 1 },
    { target: 'yt-btn', content: t('tour.login.verify.2'), step: 2 },
    { target: 'verify-btn', content: t('tour.login.verify.3'), step: 3 },
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const resp = await searchPlayer(baseUrl, query);
      setResults(resp.rows);
    } catch (e: any) {
      setError(e.message || t('auth.error.search'));
    } finally {
      setLoading(false);
    }
  };

  const handlePickList = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await listCurrentMembers(baseUrl);
      setResults(resp.rows);
    } catch (e: any) {
      setError(e.message || t('auth.error.list'));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncLive = async () => {
    setSyncing(true);
    setError('');
    try {
      await forceSyncClan(baseUrl);
      await handlePickList(); 
    } catch (e: any) {
      setError(t('auth.error.sync'));
    } finally {
      setSyncing(false);
    }
  };

  const handleVerify = async () => {
    if (!token.trim() || !selectedPlayer) return;
    setLoading(true);
    setError('');
    try {
      const resp = await verifyPlayerToken(baseUrl, selectedPlayer.tag, token);
      if (resp.status === 'ok') {
        onSuccess({
          tag: selectedPlayer.tag,
          name: selectedPlayer.name,
          role: selectedPlayer.role || 'N/A',
          th: selectedPlayer.th || 'N/A',
          token: token
        });
      } else {
        setError(t('auth.error.invalidToken'));
      }
    } catch (e: any) {
      setError(e.message || t('auth.error.verify'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#2a1d12] border-4 border-[#4e3b2a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative text-orange-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none rounded-[14px] overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
        </div>
        
        <div className="absolute right-4 top-4 flex items-center gap-2 z-[20]">
          <button 
            onClick={() => { setShowTour(true); setActiveTourIndex(0); }} 
            className="text-orange-200/30 hover:text-yellow-500 p-1 transition-colors"
            title={t('tour.main.title')}
          >
            <HelpCircle size={20} />
          </button>
          <button 
            onClick={onClose} 
            className="text-orange-200/50 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-600 p-2 rounded-xl border-2 border-yellow-500 shadow-lg">
              <ShieldCheck className="text-white drop-shadow-md" size={24} />
            </div>
            <h2 className="text-xl font-black uppercase text-yellow-400 tracking-widest drop-shadow-md" style={{ textShadow: "2px 2px 0px #000" }}>
              {step === 'search' ? t('auth.playerLogin') : t('auth.verifyAccount')}
            </h2>
          </div>

          {step === 'search' ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className={clsx("relative flex-1 transition-all duration-300", showTour && activeTourIndex === 0 && "ring-4 ring-yellow-500 ring-offset-4 ring-offset-[#2a1d12] rounded-xl z-50")}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-200/40" size={18} />
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder={t('auth.searchPlaceholder')}
                    className="w-full pl-10 pr-4 py-3 bg-[#1a110a] border-2 border-[#4e3b2a] text-orange-50 rounded-xl focus:border-yellow-500 outline-none transition-all shadow-inner placeholder-orange-200/20"
                  />
                </div>
                <button 
                  onClick={handlePickList}
                  title={t('auth.listAll')}
                  className={clsx(
                    "px-4 bg-[#3d2e1e] hover:bg-[#4e3b2a] text-yellow-500 rounded-xl border-b-4 border-[#1a110a] active:border-b-0 active:translate-y-1 transition-all shadow-lg",
                    showTour && activeTourIndex === 1 && "ring-4 ring-yellow-500 ring-offset-4 ring-offset-[#2a1d12] z-50"
                  )}
                >
                  <ListFilter size={20} />
                </button>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={handleSearch}
                  disabled={loading}
                  className={clsx(
                    "flex-1 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black rounded-xl border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg uppercase tracking-wider",
                    showTour && activeTourIndex === 3 && "ring-4 ring-yellow-500 ring-offset-4 ring-offset-[#2a1d12] z-50"
                  )}
                >
                  {loading ? <RotateCw className="animate-spin" size={18} /> : <Search size={18} />}
                  {t('auth.search')}
                </button>
                <button 
                  onClick={handleSyncLive}
                  disabled={syncing}
                  title={t('auth.syncTitle')}
                  className={clsx(
                    "px-5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg",
                    showTour && activeTourIndex === 2 && "ring-4 ring-yellow-500 ring-offset-4 ring-offset-[#2a1d12] z-50"
                  )}
                >
                  <RefreshCw size={18} className={clsx(syncing && "animate-spin")} />
                </button>
              </div>

              {(results.length > 0 || syncing || (query && !loading && results.length === 0)) && (
                <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar pr-1 bg-[#f0e6d2] p-3 rounded-xl border-4 border-[#b89b72] shadow-inner relative">
                  <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
                  {results.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedPlayer(p);
                        setStep('verify');
                        setActiveTourIndex(0); // Reset tour for next step
                      }}
                      className="w-full p-3 bg-[#e6d5b8] hover:bg-[#dfc9a3] border-2 border-[#cbbda2] rounded-xl flex items-center justify-between group transition-all relative z-10 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#fcf5e5] rounded-lg border border-[#cbbda2] group-hover:bg-orange-600/10 transition-colors">
                          <User size={18} className="text-[#5c4a35] group-hover:text-orange-700" />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-[#4a3b2a] leading-tight">{p.name}</div>
                          <div className="text-[10px] text-[#998877] font-mono">{p.tag}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         {p.role && <span className="text-[9px] text-[#998877] uppercase font-black">{p.role}</span>}
                         {p.th && <span className="bg-[#4a3b2a] text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded border border-[#333]">TH{p.th}</span>}
                      </div>
                    </button>
                  ))}
                  {results.length === 0 && !loading && !syncing && query && <p className="text-center text-[#998877] text-xs font-bold py-4 uppercase">{t('auth.noResults')}</p>}
                  {syncing && <p className="text-center text-green-700 text-[10px] font-black py-4 animate-pulse uppercase tracking-tighter">{t('auth.syncing')}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-[#1a110a] rounded-xl border-2 border-[#4e3b2a] flex items-center gap-4 shadow-inner">
                <div className="bg-yellow-600/20 p-2 rounded-lg text-yellow-500 border border-yellow-500/30">
                  <User size={24} />
                </div>
                <div>
                  <div className="font-black text-white text-lg leading-none">{selectedPlayer?.name}</div>
                  <div className="text-xs text-orange-200/40 font-mono mt-1">{selectedPlayer?.tag}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-orange-200/60 uppercase tracking-widest flex items-center gap-2">
                    <Key size={14} className="text-yellow-500" /> {t('auth.tokenLabel')}
                  </label>
                  <a 
                    href="https://www.youtube.com/watch?v=b-ygM4Remwc" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={clsx(
                      "flex items-center gap-1.5 px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black rounded-lg border-b-2 border-red-800 active:border-b-0 active:translate-y-0.5 transition-all shadow-sm uppercase",
                      showTour && activeTourIndex === 1 && "ring-4 ring-yellow-500 ring-offset-4 ring-offset-[#2a1d12] z-50"
                    )}
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.016 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    {t('auth.tokenHelp')}
                  </a>
                </div>
                <div className={clsx("transition-all duration-300", showTour && activeTourIndex === 0 && "ring-4 ring-yellow-500 ring-offset-4 ring-offset-[#2a1d12] rounded-xl z-50")}>
                  <input
                    autoFocus
                    type="password"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    placeholder={t('auth.tokenPlaceholder')}
                    className="w-full px-4 py-3 bg-[#1a110a] border-2 border-[#4e3b2a] text-orange-50 rounded-xl focus:border-yellow-500 outline-none transition-all shadow-inner"
                  />
                </div>
                <p className="text-[10px] text-orange-200/30 leading-tight italic">
                  * {t('auth.tokenInstruction')}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-950/50 border-2 border-red-900 rounded-xl text-red-400 text-[10px] font-black uppercase text-center shadow-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setStep('search')}
                  className="flex-1 py-3 bg-[#3d2e1e] hover:bg-[#4e3b2a] text-orange-200/70 font-black rounded-xl border-b-4 border-[#1a110a] active:border-b-0 active:translate-y-1 transition-all uppercase text-sm shadow-lg"
                >
                  {t('auth.back')}
                </button>
                <button 
                  onClick={handleVerify}
                  disabled={loading || !token}
                  className={clsx(
                    "flex-[2] py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black rounded-xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg uppercase text-sm tracking-wider",
                    showTour && activeTourIndex === 2 && "ring-4 ring-yellow-500 ring-offset-4 ring-offset-[#2a1d12] z-50"
                  )}
                >
                  {loading ? <RotateCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                  {t('auth.verify')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tour Overlay UI */}
        {showTour && (
          <div className="absolute -bottom-20 left-4 right-4 lg:left-0 lg:right-0 z-50 flex justify-center pointer-events-none animate-in slide-in-from-top-2 duration-300">
            <div className="max-w-xs w-full bg-yellow-500 text-black p-3 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] pointer-events-auto border-2 border-yellow-600 relative">
              {/* Arrow pointing up */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rotate-45 border-l-2 border-t-2 border-yellow-600"></div>
              
              <div className="flex items-start justify-between gap-2 relative z-10">
                <div className="flex-1">
                  <div className="text-[9px] font-black uppercase opacity-60 mb-0.5">{t('tour.step')} {tourSteps[activeTourIndex].step}/{tourSteps.length}</div>
                  <div className="font-bold text-xs leading-tight">{tourSteps[activeTourIndex].content}</div>
                </div>
                <button onClick={closeTour} className="p-0.5 hover:bg-black/10 rounded transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center justify-between mt-3 relative z-10">
                <div className="flex gap-1">
                  {tourSteps.map((_, i) => (
                    <div key={i} className={clsx("w-1 h-1 rounded-full transition-all", i === activeTourIndex ? "bg-black w-3" : "bg-black/20")} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    disabled={activeTourIndex === 0}
                    onClick={() => setActiveTourIndex(prev => prev - 1)}
                    className="p-1 hover:bg-black/10 rounded-lg disabled:opacity-20 transition-all"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  
                  {activeTourIndex < tourSteps.length - 1 ? (
                    <button 
                      onClick={() => setActiveTourIndex(prev => prev + 1)}
                      className="bg-black text-yellow-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-md"
                    >
                      {t('tour.next')}
                    </button>
                  ) : (
                    <button 
                      onClick={closeTour}
                      className="bg-green-700 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-md"
                    >
                      {t('tour.explore')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
