import { Clock, RefreshCw, ChevronUp, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { TradeRecord } from '../types/index.js';

interface Props {
  trades: TradeRecord[];
  /** Sincroniza com o servidor (re-fetch). Não apaga registos. */
  onRefresh?: () => void;
  compact?: boolean;
  /** Mostrar botão "Atualizar" (default: false — evita ações destrutivas por engano) */
  showRefresh?: boolean;
}

export default function TradeHistory({ trades, onRefresh, compact = false, showRefresh = false }: Props) {
  const handleRefresh = () => {
    if (!onRefresh) return;
    onRefresh();
    toast.success('Lista atualizada', { icon: '🔄' });
  };

  const wins   = trades.filter((t) => t.status === 'WIN').length;
  const losses = trades.filter((t) => t.status === 'LOSS').length;
  const closed = wins + losses;
  const wr     = closed > 0 ? Math.round((wins / closed) * 100) : 0;
  const profit = trades.reduce((s, t) => s + (t.status !== 'OPEN' ? t.profit : 0), 0);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-c px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div>
            <h3 className="text-c1 font-semibold text-sm">Operações</h3>
            <p className="text-c3 text-xs mt-0.5">{trades.length} registros</p>
          </div>
          {closed > 0 && (
            <div className="flex items-center gap-3 pl-4 border-l border-c">
              <div>
                <p className="text-[10px] text-c3 mb-0.5">Win Rate</p>
                <p className={`num text-sm font-bold ${wr >= 50 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500 dark:text-red-400'}`}>{wr}%</p>
              </div>
              <div>
                <p className="text-[10px] text-c3 mb-0.5">Lucro</p>
                <p className={`num text-sm font-bold ${profit >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-500 dark:text-red-400'}`}>
                  {`${profit >= 0 ? '+' : ''}R$${profit.toFixed(2)}`}
                </p>
              </div>
              <div className="flex gap-1">
                <span className="badge badge-green text-[10px]">{wins}W</span>
                <span className="badge badge-red   text-[10px]">{losses}L</span>
              </div>
            </div>
          )}
        </div>
        {!compact && showRefresh && onRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            className="btn-ghost text-xs hover:text-brand-600 dark:hover:text-brand-400 px-2 py-1.5 flex-shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        )}
      </div>

      {trades.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-surface2 border border-c flex items-center justify-center">
            <Clock className="w-6 h-6 text-c3" />
          </div>
          <div className="text-center">
            <p className="text-c2 text-sm font-medium">Nenhuma operação ainda</p>
            <p className="text-c3 text-xs mt-0.5">As operações aparecerão aqui em tempo real</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="bg-surface2 border-b border-c">
                {!compact && (
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-c3 uppercase tracking-wider whitespace-nowrap">
                    Conta
                  </th>
                )}
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-c3 uppercase tracking-wider whitespace-nowrap">Ativo</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-c3 uppercase tracking-wider">Dir.</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-c3 uppercase tracking-wider whitespace-nowrap">Valor</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-c3 uppercase tracking-wider whitespace-nowrap">Resultado</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-c3 uppercase tracking-wider whitespace-nowrap">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-c/50">
              {trades.map((t) => <TradeRow key={t.id} trade={t} compact={compact} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade: t, compact }: { trade: TradeRecord; compact: boolean }) {
  const isCall = t.direction === 'call';
  const isWin  = t.status === 'WIN';
  const isPend = t.status === 'OPEN';
  const time   = new Date(t.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <tr className="hover:bg-surface2 transition-colors animate-fade-in">
      {!compact && (
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">
              {(t.followerName ?? '?').charAt(0)}
            </div>
            <span className="text-xs text-c2 font-medium">
              {t.followerName ?? (t.followerId ? 'Conta' : 'Robô')}
            </span>
          </div>
        </td>
      )}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-c1 font-semibold">{t.instrumentName || `#${t.positionId}`}</span>
      </td>
      <td className="px-4 py-3">
        <div className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-full whitespace-nowrap ${
          isCall ? 'bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-400'
                 : 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400'
        }`}>
          {isCall ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {isCall ? 'CALL' : 'PUT'}
        </div>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className="num text-sm text-c1 font-semibold">{`R$${t.amount.toFixed(2)}`}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {isPend ? (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse-dot" />
            Aberta
          </div>
        ) : isWin ? (
          <div className="inline-flex items-center gap-1.5">
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 dark:text-brand-400 bg-brand-100 dark:bg-brand-500/15 px-2.5 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" /> WIN
            </div>
            <span className="num text-xs text-brand-600 dark:text-brand-400 font-semibold">{`+R$${t.profit.toFixed(2)}`}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5">
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15 px-2.5 py-1 rounded-full">
              <TrendingDown className="w-3 h-3" /> LOSS
            </div>
            <span className="num text-xs text-red-500 dark:text-red-400 font-semibold">{`-R$${Math.abs(t.profit).toFixed(2)}`}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <span className="num text-xs text-c3">{time}</span>
      </td>
    </tr>
  );
}
