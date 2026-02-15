import { useState } from 'react';
import { X, Save, RotateCw, MessageSquare, ShieldAlert, Trash2, Clock, User as UserIcon } from 'lucide-react';
import { addPlayerNote, deletePlayerNote } from '../lib/sheetApi';
import { type UserProfile } from '../hooks/useAuth';
import { format } from 'date-fns';
import clsx from 'clsx';

type Note = {
  message: string;
  time: string;
  user?: [string, string]; // [tag, name] for admin notes
};

type Props = {
  baseUrl: string;
  user: UserProfile;
  target: { tag: string; name: string; memberNote?: string; adminNote?: string };
  onSuccess: (newNoteJson: string, type: 'member' | 'admin') => void;
  onClose: () => void;
};

export function AddNoteModal({ baseUrl, user, target, onSuccess, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isManagement = user.role === 'coLeader' || user.role === 'leader';
  const isSelf = user.tag === target.tag;

  const parseNotes = (raw?: string): Note[] => {
    if (!raw || !raw.startsWith('[')) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  };

  const memberNotes = parseNotes(target.memberNote);
  const adminNotes = parseNotes(target.adminNote);

  const handleSave = async (type: 'member' | 'admin') => {
    if (!message.trim()) return;
    setLoading(true);
    setError('');
    const now = new Date().toISOString();
    try {
      await addPlayerNote(baseUrl, {
        targetTag: target.tag,
        message: message.trim(),
        authTag: user.tag,
        authName: user.name,
        type
      });
      
      // Update locally
      const currentNotes = type === 'admin' ? [...adminNotes] : [...memberNotes];
      const newNote: Note = { message: message.trim(), time: now };
      if (type === 'admin') newNote.user = [user.tag, user.name];
      
      currentNotes.push(newNote);
      onSuccess(JSON.stringify(currentNotes), type);
      setMessage('');
    } catch (e: any) {
      setError(e.message || 'Lỗi lưu ghi chú');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (time: string, type: 'member' | 'admin') => {
    if (!window.confirm('Bạn có chắc muốn xóa ghi chú này?')) return;
    setLoading(true);
    setError('');
    try {
      await deletePlayerNote(baseUrl, {
        targetTag: target.tag,
        time,
        authTag: user.tag,
        type
      });
      
      // Update locally
      const currentNotes = type === 'admin' ? [...adminNotes] : [...memberNotes];
      const filtered = currentNotes.filter(n => n.time !== time);
      onSuccess(JSON.stringify(filtered), type);
    } catch (e: any) {
      setError(e.message || 'Lỗi xóa ghi chú');
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
        className="w-full max-w-lg bg-[#2a1d12] border-4 border-[#4e3b2a] rounded-2xl shadow-2xl overflow-hidden relative text-orange-50 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
        
        <button 
          onClick={onClose} 
          className="absolute right-4 top-4 text-orange-200/50 hover:text-white z-[20] p-1 hover:bg-white/10 rounded-lg transition-all"
        >
          <X size={24} />
        </button>

        <div className="p-6 relative z-10 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 mb-6 shrink-0">
            <div className="bg-orange-600 p-2 rounded-xl border-2 border-yellow-500 shadow-lg text-white">
              <MessageSquare size={24} />
            </div>
            <h2 className="text-xl font-black uppercase text-yellow-400 tracking-widest drop-shadow-md" style={{ textShadow: "2px 2px 0px #000" }}>
              QUẢN LÝ GHI CHÚ
            </h2>
          </div>

          <div className="mb-6 p-4 bg-[#1a110a] rounded-xl border-2 border-[#4e3b2a] shadow-inner shrink-0">
            <div className="text-[10px] text-orange-200/40 uppercase font-black tracking-widest mb-1">Người chơi</div>
            <div className="font-black text-white text-lg leading-tight">{target.name}</div>
            <div className="text-xs text-orange-200/40 font-mono">{target.tag}</div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar mb-6">
            {/* Member Notes Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-orange-200/10 pb-1">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Ghi chú thành viên</h3>
                <span className="text-[10px] bg-blue-900/30 px-2 rounded-full border border-blue-500/30">{memberNotes.length}</span>
              </div>
              <div className="space-y-2">
                {memberNotes.map((n, i) => (
                  <div key={i} className="bg-[#f0e6d2] p-3 rounded-xl border-2 border-[#b89b72] relative group">
                    <div className="text-[#4a3b2a] font-bold text-sm leading-snug pr-6">{n.message}</div>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-[#998877] font-bold uppercase">
                      <span className="flex items-center gap-1"><Clock size={10} /> {format(new Date(n.time), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    {(isSelf || isManagement) && (
                      <button 
                        onClick={() => handleDelete(n.time, 'member')}
                        className="absolute top-2 right-2 text-red-800/30 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {memberNotes.length === 0 && <p className="text-center text-orange-200/20 text-[10px] uppercase py-2">Trống</p>}
              </div>
            </section>

            {/* Admin Notes Section */}
            {isManagement && (
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-orange-200/10 pb-1">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-red-400">Ghi chú quản trị</h3>
                  <span className="text-[10px] bg-red-900/30 px-2 rounded-full border border-red-500/30">{adminNotes.length}</span>
                </div>
                <div className="space-y-2">
                  {adminNotes.map((n, i) => (
                    <div key={i} className="bg-[#1a110a] p-3 rounded-xl border-2 border-[#4e3b2a] relative group">
                      <div className="text-orange-50 font-bold text-sm leading-snug pr-6">{n.message}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-orange-200/40 font-bold uppercase">
                        <span className="flex items-center gap-1"><Clock size={10} /> {format(new Date(n.time), "dd/MM/yyyy HH:mm")}</span>
                        {n.user && <span className="flex items-center gap-1 text-yellow-600/60"><UserIcon size={10} /> {n.user[1]}</span>}
                      </div>
                      <button 
                        onClick={() => handleDelete(n.time, 'admin')}
                        className="absolute top-2 right-2 text-red-500/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {adminNotes.length === 0 && <p className="text-center text-orange-200/20 text-[10px] uppercase py-2">Trống</p>}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-4 shrink-0 border-t-2 border-orange-200/10 pt-4">
            <textarea
              rows={2}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Viết ghi chú mới..."
              className="w-full p-3 bg-[#1a110a] border-2 border-[#4e3b2a] text-orange-50 rounded-xl focus:border-yellow-500 outline-none transition-all shadow-inner placeholder-orange-200/20 resize-none text-sm"
            />

            {error && (
              <div className="p-3 bg-red-950/50 border-2 border-red-900 rounded-xl text-red-400 text-[10px] font-black uppercase text-center shadow-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleSave('member')}
                disabled={loading || !message.trim() || !isSelf}
                title={!isSelf ? "Chỉ chính người chơi mới có thể tự viết ghi chú member" : ""}
                className={clsx(
                  "py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white font-black rounded-xl border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg uppercase text-[10px]",
                  !isSelf && "grayscale"
                )}
              >
                {loading ? <RotateCw className="animate-spin" size={14} /> : <Save size={14} />}
                Lưu Member Note
              </button>
              
              <button 
                onClick={() => handleSave('admin')}
                disabled={loading || !message.trim() || !isManagement}
                className={clsx(
                  "py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-30 text-white font-black rounded-xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 shadow-lg uppercase text-[10px]",
                  !isManagement && "grayscale"
                )}
              >
                <ShieldAlert size={14} />
                Lưu Admin Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
