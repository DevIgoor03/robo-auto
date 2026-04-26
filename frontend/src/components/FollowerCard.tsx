import { useState } from 'react';
import { Trash2, TrendingUp, TrendingDown, MoreVertical, Edit3, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountsApi } from '../services/api.js';
import { FollowerAccount } from '../types/index.js';
import EditFollowerModal from './EditFollowerModal.js';

interface Props {
  follower: FollowerAccount;
  onRemove: (id: string) => void;
  onUpdate: (f: FollowerAccount) => void;
}

const modeLabel: Record<string, string> = {
  fixed:           'Fixo',
  multiplier:   'Multiplicador',
  proportional: '% Saldo',
};

export default function FollowerCard({ follower, onRemove, onUpdate }: Props) {
  const [removing,  setRemoving]  = useState(false);
  const [refreshing,setRefreshing]= useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [showEdit,  setShowEdit]  = useState(false);

  const { sessionStats: s, copySettings: cs } = follower;
  const closed   = s.wins + s.losses;
  const winRate  = closed > 0 ? Math.round((s.wins / closed) * 100) : 0;
  const positive = s.profit >= 0;
  const balance  = cs.accountType === 'real' ? follower.balanceReal : follower.balanceDemo;

  const initials = follower.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { master, followers } = await accountsApi.getStatus();
      const updated = followers?.find((f: any) => f.id === follower.id);
      if (updated) { onUpdate(updated); toast.success('Saldo atualizado'); }
    } catch { toast.error('Erro ao atualizar saldo'); }
    finally { setRefreshing(false); }
  };

  const handleRemove = async () => {
    setMenuOpen(false);
    if (!confirm(`Remover ${follower.name}?`)) return;
    setRemoving(true);
    try {
      await accountsApi.removeFollower(follower.id);
      onRemove(follower.id);
    } catch { toast.error('Erro ao remover'); }
    finally { setRemoving(false); }
  };

  return (
    <>
      <div className={`card transition-all duration-200 ${!cs.isActive ? 'opacity-60' : ''} ${removing ? 'scale-95 opacity-0' : ''}`}>

        {/* ── Header ── */}
        <div className="p-4 pb-0">
          <div className="flex items-start justify-between gap-2">
            {/* Avatar + info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${
                  cs.isActive ? 'bg-brand-gradient text-white' : 'bg-surface2 border border-c text-c2'
                }`}>
                  {initials}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${
                  cs.isActive ? 'bg-brand-500' : 'bg-gray-400 dark:bg-gray-600'
                }`} />
              </div>
              <div className="min-w-0">
                <p className="text-c1 font-bold text-sm truncate leading-tight">{follower.name}</p>
                <p className="text-c3 text-[11px] truncate">{follower.email}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={handleRefresh} disabled={refreshing}
                className="btn-icon w-8 h-8 rounded-xl" title="Atualizar saldo">
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="btn-icon w-8 h-8 rounded-xl">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-9 z-20 bg-surface border border-c rounded-xl shadow-modal py-1 min-w-[160px] animate-scale-in">
                      <button onClick={() => { setMenuOpen(false); setShowEdit(true); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-c1 hover:bg-surface2 transition-colors">
                        <Edit3 className="w-3.5 h-3.5 text-brand-500" />
                        Editar configurações
                      </button>
                      <div className="divider my-1" />
                      <button onClick={handleRemove} disabled={removing}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover conta
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Balance hero */}
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] text-c3 uppercase tracking-wider mb-0.5">
                {cs.accountType === 'real' ? '💰 Saldo Real' : '🎯 Saldo Demo'}
              </p>
              <p className="num text-xl font-bold text-c1 tracking-tight">
                {follower.currency} {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            {s.totalTrades > 0 && (
              <div className={`flex items-center gap-1 text-sm font-bold num ${positive ? 'text-brand-600 dark:text-brand-400' : 'text-red-500 dark:text-red-400'}`}>
                {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {s.profit >= 0 ? '+' : ''}{s.profit.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="mx-4 my-3.5 divider" />

        {/* ── Stats row ── */}
        <div className="px-4 grid grid-cols-3 gap-2">
          <Stat label="Trades" value={String(s.totalTrades)} />
          <Stat label="Win Rate" value={`${winRate}%`}
            cls={closed > 0 ? (winRate >= 50 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500 dark:text-red-400') : 'text-c2'} />
          <Stat label="W / L" value={`${s.wins} / ${s.losses}`} />
        </div>

        {/* ── Config chips ── */}
        <div className="px-4 pb-4 pt-3 flex flex-wrap gap-1.5">
          <Chip label={`${modeLabel[cs.mode]}: ${cs.mode === 'fixed' ? `R$${cs.amount}` : `${cs.amount}%`}`} />
          {cs.stopWin  != null && <Chip label={`↑ SW R$${cs.stopWin}`}  cls="badge-green" />}
          {cs.stopLoss != null && <Chip label={`↓ SL R$${cs.stopLoss}`} cls="badge-red"   />}

          {/* Edit shortcut */}
          <button onClick={() => setShowEdit(true)}
            className="ml-auto flex items-center gap-1 text-[11px] text-c3 hover:text-brand-600 dark:hover:text-brand-400 transition-colors font-medium">
            <Edit3 className="w-3 h-3" /> Editar
          </button>
        </div>
      </div>

      {showEdit && (
        <EditFollowerModal
          follower={follower}
          onClose={() => setShowEdit(false)}
          onSaved={(f) => { onUpdate(f); setShowEdit(false); }}
        />
      )}
    </>
  );
}

function Stat({ label, value, cls = 'text-c1' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-surface2 border border-c rounded-xl py-2.5 px-2 text-center">
      <p className="text-[10px] text-c3 mb-0.5">{label}</p>
      <p className={`num text-sm font-bold ${cls}`}>{value}</p>
    </div>
  );
}

function Chip({ label, cls = 'badge-gray' }: { label: string; cls?: string }) {
  return <span className={`badge text-[10px] ${cls}`}>{label}</span>;
}
