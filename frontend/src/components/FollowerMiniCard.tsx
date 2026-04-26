import { useState } from 'react';
import { Edit3, TrendingUp, TrendingDown } from 'lucide-react';
import { FollowerAccount } from '../types/index.js';
import EditFollowerModal from './EditFollowerModal.js';

interface Props {
  follower: FollowerAccount;
  onUpdate: (f: FollowerAccount) => void;
}

export default function FollowerMiniCard({ follower, onUpdate }: Props) {
  const [showEdit, setShowEdit] = useState(false);

  const { copySettings: cs, sessionStats: s } = follower;
  const positive = s.profit >= 0;
  const balance  = cs.accountType === 'real' ? follower.balanceReal : follower.balanceDemo;

  const initials = follower.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <div className={`flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors
                       hover:bg-black/[0.04] dark:hover:bg-white/[0.04] group
                       ${!cs.isActive ? 'opacity-50' : ''}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          cs.isActive ? 'bg-brand-gradient text-white' : 'bg-surface2 border border-c text-c3'
        }`}>
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-c1 truncate leading-tight">{follower.name}</p>
            <span className={`badge text-[9px] py-0 leading-none ${cs.isActive ? 'badge-green' : 'badge-gray'}`}>
              {cs.isActive ? 'On' : 'Off'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="num text-[11px] text-c3">
              {follower.currency} {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            {s.totalTrades > 0 && (
              <span className={`num text-[11px] font-semibold flex items-center gap-0.5 ${
                positive ? 'text-brand-600 dark:text-brand-400' : 'text-red-500 dark:text-red-400'
              }`}>
                {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {s.profit >= 0 ? '+' : ''}{s.profit.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Actions (visible on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => setShowEdit(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface2 border border-c text-c3 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-300 dark:hover:border-brand-500/40 transition-all"
            title="Editar">
            <Edit3 className="w-3 h-3" />
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
