import { useState } from 'react';
import { X, Save, RotateCw, MessageSquare, ShieldAlert } from 'lucide-react';
import { addPlayerNote } from '../lib/sheetApi';
import { type UserProfile } from '../hooks/useAuth';

type Props = {
  baseUrl: string;
  user: UserProfile;
  target: { tag: string; name: string };
  onSuccess: () => void;
  onClose: () => void;
};

export function AddNoteModal({ baseUrl, user, target, onSuccess, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isManagement = user.role === 'coLeader' || user.role === 'leader';
  const isSelf = user.tag === target.tag;

  const handleSave = async (type: 'member' | 'admin') => {
    if (!message.trim()) return;
    setLoading(true);
    setError('');
    try {
      await addPlayerNote(baseUrl, {
        targetTag: target.tag,
        message: message.trim(),
        authTag: user.tag,
        authName: user.name,
        type
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Lỗi lưu ghi chú');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#2a1d12] border-4 border-[#4e3b2a] rounded-2xl shadow-2xl overflow-hidden relative text-orange-50"
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
            <div className="bg-orange-600 p-2 rounded-xl border-2 border-yellow-500 shadow-lg text-white">
              <MessageSquare size={24} />
            </div>
            <h2 className="text-xl font-black uppercase text-yellow-400 tracking-widest drop-shadow-md" style={{ textShadow: "2px 2px 0px #000" }}>
              THÊM GHI CHÚ
            </h2>
          </div>

          <div className="mb-6 p-4 bg-[#1a110a] rounded-xl border-2 border-[#4e3b2a] shadow-inner">
            <div className="text-[10px] text-orange-200/40 uppercase font-black tracking-widest mb-1">Đang viết cho</div>
            <div className="font-black text-white text-lg">{target.name}</div>
            <div className="text-xs text-orange-200/40 font-mono">{target.tag}</div>
          </div>

          <div className="space-y-4">
            <textarea
              autoFocus
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Nhập nội dung ghi chú..."
              className="w-full p-4 bg-[#1a110a] border-2 border-[#4e3b2a] text-orange-50 rounded-xl focus:border-yellow-500 outline-none transition-all shadow-inner placeholder-orange-200/20 resize-none"
            />

            {error && (
              <div className="p-3 bg-red-950/50 border-2 border-red-900 rounded-xl text-red-400 text-[10px] font-black uppercase text-center shadow-lg">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {(isSelf || isManagement) && (
                <button 
                  onClick={() => handleSave('member')}
                  disabled={loading || !message.trim()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-xl border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg uppercase"
                >
                  {loading ? <RotateCw className="animate-spin" size={18} /> : <Save size={18} />}
                  LƯU MEMBER NOTE
                </button>
              )}
              
              {isManagement && (
                <button 
                  onClick={() => handleSave('admin')}
                  disabled={loading || !message.trim()}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black rounded-xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg uppercase"
                >
                  <ShieldAlert size={18} />
                  LƯU ADMIN NOTE
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
