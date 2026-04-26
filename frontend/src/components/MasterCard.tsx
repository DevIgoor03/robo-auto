import { useState } from 'react';
import { Power, RefreshCw, Play, Pause, Loader2, Wallet, Link2, TrendingUp, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountsApi } from '../services/api.js';
import { AccountInfo } from '../types/index.js';

type OpMode = 'auto' | 'common';

interface MasterCardProps {
  account: AccountInfo | null;
  robotRunning: boolean;
  /** Mantido por compatibilidade com o painel; a sessão já não tem fim por tempo. */
  robotEndsAt?: string | null;
  onDisconnect: () => void;
  onRobotRunningChange: (running: boolean) => void;
  onBalanceRefresh: (bal: Partial<AccountInfo>) => void;
  onConnectRequest?: () => void;
}

export default function MasterCard({
  account,
  robotRunning,
  onDisconnect,
  onRobotRunningChange,
  onBalanceRefresh,
  onConnectRequest,
}: MasterCardProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [opMode, setOpMode] = useState<OpMode>('auto');
  const [stake, setStake] = useState(10);
  const [stopWin, setStopWin] = useState(50);
  const [stopLoss, setStopLoss] = useState(50);
  const [accountType, setAccountType] = useState<'real' | 'demo'>('demo');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await accountsApi.getStatus();
      if (data.master) onBalanceRefresh(data.master);
    } catch {
      toast.error('Erro ao atualizar saldo');
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (robotRunning) {
        await accountsApi.stopRobot();
        onRobotRunningChange(false);
        toast('Robô parado', { icon: '⏸' });
      } else {
        if (opMode === 'common') {
          toast.error('Selecione o modo Automático para o robô operar.');
          return;
        }
        await accountsApi.startRobot({
          mode: 'auto',
          stake,
          stopWin,
          stopLoss,
          accountType,
        });
        onRobotRunningChange(true);
        toast.success('Robô iniciado — turbo M1 até parar ou atingir stop');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao controlar o robô');
    } finally {
      setToggling(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await accountsApi.disconnectMaster();
      onDisconnect();
      toast('Desconectado', { icon: '👋' });
    } catch {
      toast.error('Erro ao desconectar');
    }
  };

  if (!account) {
    return (
      <div className="card overflow-hidden">
        <div className="relative p-5 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1.5px, transparent 1.5px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="relative z-10 text-center py-3">
            <div className="w-12 h-12 rounded-2xl bg-white/8 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-white font-semibold text-sm mb-0.5">Conta Bullex não conectada</p>
            <p className="text-gray-500 text-xs">Conecte a corretora para usar o robô automático</p>
          </div>
        </div>
        <div className="p-4">
          <button onClick={onConnectRequest} className="btn-brand w-full">
            <Link2 className="w-4 h-4" />
            Conectar conta Bullex
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-c shadow-card">
      <div className="relative p-5 overflow-hidden bg-sidebar">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 80% 20%, rgba(132,204,22,0.18) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center shadow-glow-brand">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight">{account.name}</p>
                <p className="text-gray-400 text-xs truncate max-w-[160px]">{account.email}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-all"
                title="Atualizar saldo"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleDisconnect}
                className="w-7 h-7 rounded-lg bg-red-500/12 hover:bg-red-500/25 text-red-400 flex items-center justify-center transition-all"
                title="Desconectar"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1">
            <Wallet className="w-3 h-3" /> Saldo Real
          </p>
          <p className="num text-2xl font-bold text-white tracking-tight">
            {account.currency} {account.balanceReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="num text-sm text-gray-500 mt-1">
            Demo: {account.currency} {account.balanceDemo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="bg-surface p-4 space-y-3">
        <p className="text-[11px] font-semibold text-c2 uppercase tracking-wide">Modo de operação</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={robotRunning}
            onClick={() => setOpMode('auto')}
            className={`rounded-xl py-2 text-xs font-semibold transition-all ${
              opMode === 'auto'
                ? 'bg-brand-500 text-white shadow-glow-brand'
                : 'bg-surface2 border border-c text-c2 hover:border-brand-400/40'
            }`}
          >
            Automático
          </button>
          <button
            type="button"
            disabled={robotRunning}
            onClick={() => setOpMode('common')}
            className={`rounded-xl py-2 text-xs font-semibold transition-all ${
              opMode === 'common'
                ? 'bg-brand-500 text-white shadow-glow-brand'
                : 'bg-surface2 border border-c text-c2 hover:border-brand-400/40'
            }`}
          >
            Comum
          </button>
        </div>
        {opMode === 'common' && (
          <p className="text-[11px] text-c3 leading-relaxed">
            Modo comum: sem ordens automáticas pela aplicação. Opere manualmente na corretora. Para o robô abrir operações
            sozinho, escolha <strong className="text-c2">Automático</strong>.
          </p>
        )}

        {opMode === 'auto' && (
          <div className="space-y-2 pt-1">
            <p className="text-[10px] text-c3 leading-relaxed rounded-lg bg-surface2/80 border border-c px-2 py-1.5">
              <strong className="text-c2">Turbo</strong>, vela <strong>M1</strong> (1 min). A sessão só termina se parar,
              ou ao bater stop win / stop loss. Análise: RSI + tendência SMA nas velas M1.
            </p>

            <label className="block text-[10px] text-c3 font-medium">Conta</label>
            <select
              className="field w-full text-sm py-2"
              value={accountType}
              disabled={robotRunning}
              onChange={(e) => setAccountType(e.target.value as 'real' | 'demo')}
            >
              <option value="demo">Demo (recomendado para testes)</option>
              <option value="real">Real</option>
            </select>

            <label className="block text-[10px] text-c3 font-medium">Valor por operação (entrada)</label>
            <input
              type="number"
              min={1}
              step={1}
              className="field w-full text-sm py-2"
              value={stake}
              disabled={robotRunning}
              onChange={(e) => setStake(Number(e.target.value))}
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-c3 font-medium mb-0.5">Stop win</label>
                <input
                  type="number"
                  min={0}
                  className="field w-full text-sm py-2"
                  value={stopWin}
                  disabled={robotRunning}
                  onChange={(e) => setStopWin(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-[10px] text-c3 font-medium mb-0.5">Stop loss</label>
                <input
                  type="number"
                  min={0}
                  className="field w-full text-sm py-2"
                  value={stopLoss}
                  disabled={robotRunning}
                  onChange={(e) => setStopLoss(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleToggle}
          disabled={toggling || opMode === 'common'}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            robotRunning ? 'bg-surface2 border border-c text-c2 hover:text-c1' : 'btn-brand'
          } ${opMode === 'common' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {toggling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : robotRunning ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {robotRunning ? 'Parar robô' : 'Iniciar'}
        </button>

        {robotRunning && (
          <div className="flex flex-col items-center justify-center gap-1 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-dot" />
              <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">Turbo M1 ativo</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
