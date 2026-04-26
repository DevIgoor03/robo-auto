import { useState } from 'react';
import { X, TrendingUp, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { accountsApi, tokenStore } from '../services/api';
import { AccountInfo } from '../types/index';
import toast from 'react-hot-toast';

interface Props {
  onClose:       () => void;
  onConnected:   (info: AccountInfo) => void;
  prefillEmail?: string;
  isReconnect?:  boolean;
}

export default function ConnectMasterModal({ onClose, onConnected, prefillEmail, isReconnect }: Props) {
  const [email,    setEmail]    = useState(prefillEmail ?? '');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await accountsApi.connectMaster(email, password);
      // Backend returns fresh JWT with masterId populated
      if (data.accessToken && data.refreshToken) {
        tokenStore.setTokens(data.accessToken, data.refreshToken);
      }
      toast.success(`Conta ${data.name} conectada!`);
      onConnected(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message ?? 'Erro ao conectar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isReconnect ? 'bg-amber-500' : 'bg-brand-600'}`}>
              {isReconnect ? <RefreshCw className="w-4 h-4 text-white" /> : <TrendingUp className="w-4 h-4 text-white" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-1)]">
                {isReconnect ? 'Reconectar conta Bullex' : 'Conectar conta Bullex'}
              </h3>
              <p className="text-[10px] text-[var(--text-3)]">Credenciais da sua conta na corretora</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon w-8 h-8 rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className={`rounded-xl p-3 text-xs ${isReconnect
            ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300'
            : 'bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/20 text-brand-700 dark:text-brand-400'}`}>
            {isReconnect
              ? '⚠️ A sessão com a corretora expirou ou a ligação foi interrompida. Insira a sua senha para reconectar.'
              : 'Conecte a conta Bullex que será usada como master para replicar as operações.'}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Email Bullex</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="master@email.com" required className="field w-full" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-2)] mb-1.5">Senha Bullex</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="field w-full pr-10" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 btn-white py-2.5 text-sm">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-all disabled:opacity-60">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Conectar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
