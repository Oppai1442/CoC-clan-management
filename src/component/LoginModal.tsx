import { useState } from 'react';
import { Search, ShieldCheck, X, User, Key, RotateCw, ListFilter, RefreshCw, Save } from 'lucide-react';
import { searchPlayer, verifyPlayerToken, listCurrentMembers, forceSyncClan, addPlayerNote } from '../lib/sheetApi';
import { type UserProfile } from '../hooks/useAuth';
import clsx from 'clsx';

type Props = {
  baseUrl: string;
  onSuccess: (user: Omit<UserProfile, 'loginAt'> & { token: string }) => void;
  onClose: () => void;
};

export function LoginModal({ baseUrl, onSuccess, onClose }: Props) {
  const [step, setStep] = useState<'search' | 'verify'>('search');
  const [query, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [token, setToken] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const resp = await searchPlayer(baseUrl, query);
      setResults(resp.rows);
    } catch (e: any) {
      setError(e.message || 'Lỗi tìm kiếm');
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
      setError(e.message || 'Lỗi lấy danh sách');
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
      setError('Không thể cập nhật dữ liệu mới');
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
        setError('Token không chính xác. Hãy kiểm tra lại trong Cài đặt game.');
      }
    } catch (e: any) {
      setError(e.message || 'Lỗi xác thực');
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
        className="w-full max-w-md bg-[#2a1d12] border-4 border-[#4e3b2a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative text-orange-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
        
        <button 
          onClick={onClose} 
          className="absolute right-4 top-4 text-orange-200/50 hover:text-white z-[20] p-1 hover:bg-white/10 rounded-lg transition-all"
        >
          <X size={24} />
        </button>

        <div className="p-6 relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-orange-600 p-2 rounded-xl border-2 border-yellow-500 shadow-lg">
              <ShieldCheck className="text-white drop-shadow-md" size={24} />
            </div>
            <h2 className="text-xl font-black uppercase text-yellow-400 tracking-widest drop-shadow-md" style={{ textShadow: "2px 2px 0px #000" }}>
              {step === 'search' ? 'ĐĂNG NHẬP PLAYER' : 'XÁC THỰC TÀI KHOẢN'}
            </h2>
          </div>

          {step === 'search' ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-200/40" size={18} />
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Tên hoặc Tag (#...)"
                    className="w-full pl-10 pr-4 py-3 bg-[#1a110a] border-2 border-[#4e3b2a] text-orange-50 rounded-xl focus:border-yellow-500 outline-none transition-all shadow-inner placeholder-orange-200/20"
                  />
                </div>
                <button 
                  onClick={handlePickList}
                  title="Hiện toàn bộ danh sách"
                  className="px-4 bg-[#3d2e1e] hover:bg-[#4e3b2a] text-yellow-500 rounded-xl border-b-4 border-[#1a110a] active:border-b-0 active:translate-y-1 transition-all shadow-lg"
                >
                  <ListFilter size={20} />
                </button>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={handleSearch}
                  disabled={loading}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black rounded-xl border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg uppercase tracking-wider"
                >
                  {loading ? <RotateCw className="animate-spin" size={18} /> : <Search size={18} />}
                  TÌM KIẾM
                </button>
                <button 
                  onClick={handleSyncLive}
                  disabled={syncing}
                  title="Cập nhật mem mới gia nhập"
                  className="px-5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all shadow-lg"
                >
                  <RefreshCw size={18} className={clsx(syncing && "animate-spin")} />
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar pr-1 bg-[#f0e6d2] p-3 rounded-xl border-4 border-[#b89b72] shadow-inner relative">
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>
                {results.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedPlayer(p);
                      setStep('verify');
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
                {results.length === 0 && !loading && !syncing && query && <p className="text-center text-[#998877] text-xs font-bold py-4 uppercase">Không tìm thấy ai!</p>}
                {syncing && <p className="text-center text-green-700 text-[10px] font-black py-4 animate-pulse uppercase tracking-tighter">ĐANG ĐỒNG BỘ...</p>}
              </div>
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
                <label className="text-xs font-black text-orange-200/60 uppercase tracking-widest flex items-center gap-2">
                  <Key size={14} className="text-yellow-500" /> API TOKEN CỦA BẠN
                </label>
                <input
                  autoFocus
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  placeholder="Nhập mã token từ Cài đặt game"
                  className="w-full px-4 py-3 bg-[#1a110a] border-2 border-[#4e3b2a] text-orange-50 rounded-xl focus:border-yellow-500 outline-none transition-all shadow-inner"
                />
                <p className="text-[10px] text-orange-200/30 leading-tight italic">
                  * Vào Game → Cài đặt → Cài đặt khác → Mã API → Bấm "Hiển thị" để lấy mã.
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
                  QUAY LẠI
                </button>
                <button 
                  onClick={handleVerify}
                  disabled={loading || !token}
                  className="flex-[2] py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black rounded-xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg uppercase text-sm tracking-wider"
                >
                  {loading ? <RotateCw className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                  XÁC THỰC
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}