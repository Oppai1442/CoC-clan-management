import { useState } from 'react';
import { Search, ShieldCheck, X, User, Key, RotateCw, ListFilter, RefreshCw } from 'lucide-react';
import { searchPlayer, verifyPlayerToken, listCurrentMembers, forceSyncClan } from '../lib/sheetApi';
import { type UserProfile } from '../hooks/useAuth';
import clsx from 'clsx';

type Props = {
  baseUrl: string;
  onSuccess: (user: Omit<UserProfile, 'loginAt'>) => void;
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
      await handlePickList(); // Refresh list after sync
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
          th: selectedPlayer.th || 'N/A'
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#2a2a2a] border-4 border-[#3a3a3a] rounded-2xl shadow-2xl overflow-hidden relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-[#888] hover:text-white transition-colors">
          <X size={24} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-yellow-600 p-2 rounded-lg border-2 border-yellow-400">
              <ShieldCheck className="text-white" size={24} />
            </div>
            <h2 className="text-xl font-black uppercase text-yellow-400 tracking-wider">
              {step === 'search' ? 'Đăng nhập Player' : 'Xác thực tài khoản'}
            </h2>
          </div>

          {step === 'search' ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" size={18} />
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Tên hoặc Tag (#...)"
                    className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border-2 border-[#444] rounded-xl focus:border-yellow-500 outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={handlePickList}
                  title="Hiện toàn bộ danh sách"
                  className="px-4 bg-[#333] hover:bg-[#444] text-yellow-500 rounded-xl border-2 border-[#444] transition-all"
                >
                  <ListFilter size={20} />
                </button>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={handleSearch}
                  disabled={loading}
                  className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white font-bold rounded-xl border-b-4 border-yellow-800 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <RotateCw className="animate-spin" size={18} /> : <Search size={18} />}
                  TÌM KIẾM
                </button>
                <button 
                  onClick={handleSyncLive}
                  disabled={syncing}
                  title="Cập nhật member mới gia nhập"
                  className="px-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl border-b-4 border-green-800 transition-all"
                >
                  <RefreshCw size={18} className={clsx(syncing && "animate-spin")} />
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                {results.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedPlayer(p);
                      setStep('verify');
                    }}
                    className="w-full p-3 bg-[#333] hover:bg-[#3d3d3d] border-2 border-[#444] rounded-xl flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#1a1a1a] rounded-lg group-hover:bg-yellow-600/20 transition-colors">
                        <User size={18} className="text-[#888] group-hover:text-yellow-500" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-white leading-tight">{p.name}</div>
                        <div className="text-[10px] text-[#888] font-mono">{p.tag}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       {p.role && <span className="text-[9px] text-[#666] uppercase font-black">{p.role}</span>}
                       {p.th && <span className="bg-[#1a1a1a] text-orange-400 text-[10px] font-bold px-2 py-1 rounded border border-[#444]">TH{p.th}</span>}
                    </div>
                  </button>
                ))}
                {results.length === 0 && !loading && !syncing && query && <p className="text-center text-[#666] text-sm py-4">Không tìm thấy kết quả nào</p>}
                {syncing && <p className="text-center text-blue-400 text-xs py-4 animate-pulse">Đang đồng bộ dữ liệu từ Supercell...</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-[#1a1a1a] rounded-xl border-2 border-[#333] flex items-center gap-4">
                <div className="bg-yellow-600/20 p-2 rounded-lg text-yellow-500">
                  <User size={24} />
                </div>
                <div>
                  <div className="font-black text-white">{selectedPlayer?.name}</div>
                  <div className="text-xs text-[#888] font-mono">{selectedPlayer?.tag}</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#888] uppercase tracking-widest flex items-center gap-2">
                  <Key size={14} /> API Token của bạn
                </label>
                <input
                  autoFocus
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  placeholder="Nhập mã token từ Cài đặt game"
                  className="w-full px-4 py-3 bg-[#1a1a1a] border-2 border-[#444] rounded-xl focus:border-yellow-500 outline-none transition-all"
                />
                <p className="text-[10px] text-[#666] leading-relaxed">
                  * Vào Game → Cài đặt → Cài đặt khác → Mã API → Bấm "Hiển thị" để lấy mã này. Chúng tôi sẽ lưu mã này để tự động login lần sau.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-400 text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setStep('search')}
                  className="flex-1 py-3 bg-[#333] hover:bg-[#444] text-[#ccc] font-bold rounded-xl border-b-4 border-[#111] transition-all"
                >
                  QUAY LẠI
                </button>
                <button 
                  onClick={handleVerify}
                  disabled={loading || !token}
                  className="flex-[2] py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl border-b-4 border-green-800 transition-all flex items-center justify-center gap-2"
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
