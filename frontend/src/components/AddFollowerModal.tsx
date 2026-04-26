import { useState } from 'react';
import { X, UserPlus, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountsApi } from '../services/api.js';
import { CopySettings, FollowerAccount } from '../types/index.js';

interface Props {
  onClose: () => void;
  onAdded: (follower: FollowerAccount) => void;
}

export default function AddFollowerModal({ onClose, onAdded }: Props) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [cfg, setCfg] = useState<Partial<CopySettings>>({
    mode: 'fixed', amount: 5, accountType: 'real', isActive: false, stopWin: null, stopLoss: null,
  });
  /** String para o input de valor — evita 0 “preso” ao apagar (controlled number). */
  const [amountInput, setAmountInput] = useState('5');

  const set = (k: keyof CopySettings, v: any) => setCfg((p) => ({ ...p, [k]: v }));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Preencha email e senha'); return; }
    const raw = amountInput.trim().replace(',', '.');
    if (raw === '') {
      toast.error('Informe o valor / multiplicador / percentual');
      return;
    }
    const amt = parseFloat(raw);
    if (Number.isNaN(amt) || amt < 0) {
      toast.error('Valor inválido');
      return;
    }
    setLoading(true);
    try {
      const data = await accountsApi.addFollower(email, password, { ...cfg, amount: amt });
      toast.success(`${data.name} adicionado!`); onAdded(data); onClose();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Erro ao adicionar'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-surface rounded-2xl w-full max-w-[440px] shadow-modal border border-c animate-slide-up overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-c">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-500/15 flex items-center justify-center">
              <UserPlus className="w-4.5 h-4.5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <p className="text-c1 font-semibold">Adicionar Seguidor</p>
              <p className="text-c3 text-xs">Credenciais da conta Bullex</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="px-6 py-5 space-y-5">
          {/* Credentials */}
          <div className="space-y-3">
            <p className="section-title">Credenciais</p>
            <div>
              <label className="label">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="email@exemplo.com" className="field" disabled={loading} />
            </div>
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       placeholder="Senha da conta" className="field pr-10" disabled={loading} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-c3 hover:text-c2 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="divider" />

          {/* Settings */}
          <div className="space-y-3.5">
            <p className="section-title">Configurações de Cópia</p>

            <div>
              <label className="label">Modo de cópia</label>
              <select value={cfg.mode} onChange={(e) => set('mode', e.target.value)}
                      className="field" disabled={loading} style={{ colorScheme: 'inherit' }}>
                <option value="fixed">Valor fixo (R$)</option>
                <option value="multiplier">Multiplicador do master</option>
                <option value="proportional">% do saldo</option>
              </select>
            </div>

            <div>
              <label className="label">
                {cfg.mode === 'fixed' ? 'Valor (R$)' : cfg.mode === 'multiplier' ? 'Multiplicador (ex: 2 = 2x)' : '% do saldo'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="field" disabled={loading}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" style={{ color: '#65a30d' }}>↑ Stop Win (R$)</label>
                <input type="number" placeholder="Sem limite" min={0} step="any"
                       onChange={(e) => set('stopWin', e.target.value ? parseFloat(e.target.value) : null)}
                       className="field" disabled={loading} />
              </div>
              <div>
                <label className="label" style={{ color: '#ef4444' }}>↓ Stop Loss (R$)</label>
                <input type="number" placeholder="Sem limite" min={0} step="any"
                       onChange={(e) => set('stopLoss', e.target.value ? parseFloat(e.target.value) : null)}
                       className="field" disabled={loading} />
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose} disabled={loading} className="btn-white flex-1 py-3">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-brand flex-1 py-3">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</>
                : <><UserPlus className="w-4 h-4" /> Adicionar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
