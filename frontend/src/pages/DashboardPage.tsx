import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, DollarSign,
  BarChart2, Bell, Settings, ExternalLink, Moon, Sun, Link2, LogOut, AlertTriangle,
  LayoutDashboard, History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSocket }    from '../hooks/useSocket.js';
import { useTheme }     from '../hooks/useTheme.js';
import { accountsApi, tokenStore, tradesApi } from '../services/api.js';
import { DashboardInviteBackdrop } from '../components/layout/DashboardInviteBackdrop.js';
import Sidebar          from '../components/Sidebar.js';
import StatCard         from '../components/StatCard.js';
import MasterCard       from '../components/MasterCard.js';
import TradeHistory     from '../components/TradeHistory.js';
import ConnectMasterModal from '../components/ConnectMasterModal.js';
import { MobileDockNav, type DockNavItem } from '../components/layout/MobileDockNav.js';
import { AccountInfo, TradeRecord } from '../types/index.js';

const MASTER_DOCK_ITEMS: DockNavItem[] = [
  { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export default function DashboardPage() {
  const navigate          = useNavigate();
  const { isDark, toggle } = useTheme();

  const [activePage,    setActivePage]    = useState('dashboard');
  const [showConnect,   setShowConnect]   = useState(false);
  const [master,        setMaster]        = useState<AccountInfo | null>(null);
  const [bullexConnected,  setBullexConnected]  = useState(false);
  const [trades,        setTrades]        = useState<TradeRecord[]>([]);
  const [robotRunning,  setRobotRunning]  = useState(false);
  const [robotEndsAt,   setRobotEndsAt]   = useState<string | null>(null);
  const [robotSessionProfit, setRobotSessionProfit] = useState(0);
  const [connected,     setConnected]     = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [nowTick,       setNowTick]       = useState(Date.now());
  // ─── Load initial state ───────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    try {
      const data = await accountsApi.getStatus();
      setMaster(data.master ?? null);
      setBullexConnected(data.sdkConnected ?? false);
      setTrades(data.trades ?? []);
      setRobotRunning(data.robotRunning ?? false);
      setRobotEndsAt(data.robotEndsAt ?? null);
      // Always force the connect modal whenever the master is not connected.
      // User explicitly requested this behavior.
      if (!data.master || !data.sdkConnected) setShowConnect(true);
    } catch (err: any) {
      if (err.response?.status === 401) {
        tokenStore.clearTokens();
        navigate('/login', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ─── Socket.IO real-time ──────────────────────────────────────────────────────

  const handleSocketEvent = useCallback((event: string, data: any) => {
    switch (event) {
      case 'connect':    setConnected(true);  break;
      case 'disconnect': setConnected(false); break;
      case 'master:balance':
        setMaster((m) => m ? { ...m, ...data } : m);
        break;
      case 'trade:new':
        setTrades((prev) => [data, ...prev].slice(0, 200));
        break;
      case 'trade:updated':
        setTrades((prev) => prev.map((t) => t.id === data.id ? { ...t, ...data } : t));
        break;
      case 'copy:started': break;
      case 'copy:stopped': break;
      case 'copy:error':
        toast.error(`Erro: ${data.error}`);
        break;
      case 'robot:started':
        setRobotRunning(true);
        setRobotEndsAt(null);
        setRobotSessionProfit(0);
        break;
      case 'robot:stopped':
        setRobotRunning(false);
        setRobotEndsAt(null);
        if (typeof data.sessionProfit === 'number') setRobotSessionProfit(data.sessionProfit);
        break;
      case 'robot:profit':
        if (typeof data.sessionProfit === 'number') setRobotSessionProfit(data.sessionProfit);
        break;
    }
  }, []);

  useSocket(handleSocketEvent);

  // ─── Derived metrics ──────────────────────────────────────────────────────────

  const todayStart = new Date(nowTick);
  todayStart.setHours(0, 0, 0, 0);
  const todayClosed = trades.filter(
    (t) => new Date(t.openedAt).getTime() >= todayStart.getTime() && t.status !== 'OPEN'
  );
  const todayProfitFromTrades = parseFloat(todayClosed.reduce((s, t) => s + t.profit, 0).toFixed(2));
  const totalProfit = robotRunning ? robotSessionProfit : todayProfitFromTrades;
  const totalTrades = trades.filter((t) => new Date(t.openedAt).getTime() >= todayStart.getTime()).length;
  const totalWins = todayClosed.filter((t) => t.status === 'WIN').length;
  const closed = todayClosed.length;
  const winRate = closed > 0 ? Math.round((totalWins / closed) * 100) : 0;
  const todayTrades = trades.filter((t) => new Date(t.openedAt).getTime() >= todayStart.getTime());

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    tokenStore.clearTokens();
    navigate('/login', { replace: true });
  };

  const handleMasterConnected  = (info: AccountInfo) => { setMaster(info); setBullexConnected(true); setShowConnect(false); };
  const handleBalanceRefresh   = (bal: Partial<AccountInfo>) => setMaster((m) => m ? { ...m, ...bal } : m);
  const handleRobotRunningChange = (running: boolean) => {
    setRobotRunning(running);
    if (!running) setRobotEndsAt(null);
    void loadStatus();
  };

  const pageLabels: Record<string, string> = {
    dashboard: 'Visão Geral',
    history:   'Histórico',
    settings:  'Configurações',
  };

  const handleNavigate = (page: string) => {
    if (page === '__connect__') { setShowConnect(true); return; }
    setActivePage(page);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'history':
        return <HistoryPage onSyncDashboard={loadStatus} />;
      case 'settings':
        return <SettingsPage isDark={isDark} onToggleTheme={toggle} user={tokenStore.getUser()} onLogout={handleLogout} />;
      default:
        return (
          <OverviewPage
            master={master}
            robotRunning={robotRunning}
            robotEndsAt={robotEndsAt}
            totalProfit={totalProfit}
            totalTrades={totalTrades}
            winRate={winRate}
            closedTrades={closed}
            recentTrades={todayTrades}
            onMasterDisconnect={handleLogout}
            onBalanceRefresh={handleBalanceRefresh}
            onRobotRunningChange={handleRobotRunningChange}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden">
        <DashboardInviteBackdrop variant={isDark ? 'dark' : 'light'} />
        <div
          className={`relative z-10 h-6 w-6 animate-spin rounded-full border-2 ${
            isDark
              ? 'border-[oklch(0.62_0.20_152/0.25)] border-t-[oklch(0.62_0.20_152)]'
              : 'border-gray-200 border-t-brand-600'
          }`}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen overflow-hidden">
      <DashboardInviteBackdrop variant={isDark ? 'dark' : 'light'} />
      <Sidebar activePage={activePage} onPageChange={setActivePage} robotRunning={robotRunning} onLogout={handleLogout} />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={`flex min-h-14 flex-shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 px-3 py-2 backdrop-blur-xl sm:flex-nowrap sm:px-6 sm:py-0 ${
            isDark
              ? 'border-b border-white/[0.1] bg-[#212B36]/92 backdrop-blur-md'
              : 'border-b border-gray-200/90 bg-white/80'
          }`}
        >
          <div className="min-w-0 flex-1 sm:flex-none">
            <h1 className="text-[var(--text-1)] text-sm font-bold leading-tight sm:text-base">{pageLabels[activePage]}</h1>
            {master && (
              <p className="truncate text-[var(--text-3)] text-[11px] sm:text-xs">
                {master.name} ·{' '}
                <span className={connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {connected ? 'Conectado' : 'Reconectando...'}
                </span>
              </p>
            )}
          </div>

          <div className="-mr-1 flex max-w-full flex-shrink-0 flex-wrap items-center justify-end gap-1 sm:flex-nowrap sm:gap-1.5">
            {(!master || !bullexConnected) && (
              <button
                onClick={() => setShowConnect(true)}
                className="flex items-center gap-1 rounded-xl bg-amber-500 px-2 py-1.5 text-[10px] font-bold text-white shadow-sm transition-all hover:bg-amber-600 sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-xs"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[9rem] truncate sm:max-w-none">
                  {master && !bullexConnected ? (
                    <>
                      <span className="sm:hidden">Bullex</span>
                      <span className="hidden sm:inline">Reconectar Bullex</span>
                    </>
                  ) : (
                    <>
                      <span className="sm:hidden">Conectar</span>
                      <span className="hidden sm:inline">Conectar conta Bullex</span>
                    </>
                  )}
                </span>
              </button>
            )}
            <button onClick={toggle} className="btn-icon" title="Alternar tema">
              {isDark ? <Sun className="h-4 w-4 text-yellow-400" /> : <Moon className="h-4 w-4" />}
            </button>
            <button type="button" className="btn-icon hidden sm:flex" title="Notificações">
              <Bell className="h-4 w-4" />
            </button>
            <button type="button" className="btn-icon hidden sm:flex" onClick={() => setActivePage('settings')}>
              <Settings className="h-4 w-4" />
            </button>
            {master && (
              <div className="ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">
                {master.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          {(!master || !bullexConnected) && (
            <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-500/20 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-300 sm:text-sm">
                {master && !bullexConnected ? (
                  <>
                    <strong>Sessão com a corretora expirada.</strong> Reconecte para continuar.
                  </>
                ) : (
                  <>
                    <strong>Conta da corretora não conectada.</strong> Conecte a Bullex para iniciar.
                  </>
                )}
              </p>
              <button
                onClick={() => setShowConnect(true)}
                className="shrink-0 self-start text-xs font-bold text-amber-700 underline underline-offset-2 transition-colors hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 sm:self-center"
              >
                {master && !bullexConnected ? 'Reconectar →' : 'Conectar agora →'}
              </button>
            </div>
          )}
          <div className="mx-auto max-w-[1440px] animate-fade-in p-3 sm:p-5">
            {renderPage()}
          </div>
        </main>
      </div>

      <MobileDockNav
        items={MASTER_DOCK_ITEMS}
        activeId={activePage}
        onSelect={setActivePage}
        showLiveOnFirst={robotRunning}
        onLogout={handleLogout}
      />
      {showConnect && (
        <ConnectMasterModal
          onClose={() => setShowConnect(false)}
          onConnected={handleMasterConnected}
          prefillEmail={master?.email}
          isReconnect={!!master}
        />
      )}
    </div>
  );
}

/* ─── Overview ─────────────────────────────────────────────────────────────── */
function OverviewPage({
  master,
  robotRunning,
  robotEndsAt,
  totalProfit,
  totalTrades,
  winRate,
  closedTrades,
  recentTrades,
  onMasterDisconnect,
  onBalanceRefresh,
  onRobotRunningChange,
  onNavigate,
}: {
  master: AccountInfo | null;
  robotRunning: boolean;
  robotEndsAt: string | null;
  totalProfit: number;
  totalTrades: number;
  winRate: number;
  closedTrades: number;
  recentTrades: TradeRecord[];
  onMasterDisconnect: () => void;
  onBalanceRefresh: (bal: Partial<AccountInfo>) => void;
  onRobotRunningChange: (running: boolean) => void;
  onNavigate: (page: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-[var(--text-1)] sm:text-2xl">
          Bom dia, {master?.name?.split(' ')[0] ?? 'Trader'} 👋
        </h2>
        <p className="mt-0.5 text-sm text-[var(--text-2)]">
          Configure o robô (entrada, stop win, stop loss) e acompanhe as operações na sua conta Bullex
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Lucro (hoje / sessão)" value={`${totalProfit >= 0 ? '+' : ''}R$${totalProfit.toFixed(2)}`} icon={DollarSign} color={totalProfit >= 0 ? 'green' : 'red'} trend={totalProfit > 0 ? 'up' : totalProfit < 0 ? 'down' : 'neutral'} />
        <StatCard title="Robô" value={robotRunning ? 'Ativo' : 'Parado'} subValue={robotRunning ? 'Operando' : 'Aguardando'} icon={Activity} color={robotRunning ? 'green' : 'blue'} />
        <StatCard title="Operações hoje" value={totalTrades} subValue="registos do dia" icon={Activity} color="purple" />
        <StatCard title="Win Rate" value={`${winRate}%`} subValue={`${closedTrades} fechadas`} icon={BarChart2} color={winRate >= 60 ? 'green' : winRate >= 40 ? 'yellow' : 'red'} trend={winRate >= 60 ? 'up' : winRate >= 40 ? 'neutral' : 'down'} />
      </div>

      <div className="grid grid-cols-12 gap-4 min-w-0">
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-4 min-w-0">
          <MasterCard
            account={master}
            robotRunning={robotRunning}
            robotEndsAt={robotEndsAt}
            onDisconnect={onMasterDisconnect}
            onRobotRunningChange={onRobotRunningChange}
            onBalanceRefresh={onBalanceRefresh}
            onConnectRequest={() => onNavigate('__connect__')}
          />
        </div>

        <div className="col-span-12 lg:col-span-8 xl:col-span-9 min-w-0 overflow-hidden">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-[var(--text-1)]">Últimas Operações</h3>
              <p className="text-xs text-[var(--text-3)]">Operações de hoje — dias anteriores no histórico completo</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400"
            >
              Histórico completo <ExternalLink className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-[min(28rem,55vh)] overflow-y-auto overscroll-contain rounded-xl">
            <TradeHistory trades={recentTrades} compact={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── History page (persistido + filtros) ───────────────────────────────────── */
function HistoryPage({
  onSyncDashboard,
}: {
  onSyncDashboard: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [status, setStatus] = useState<'all' | 'OPEN' | 'WIN' | 'LOSS'>('all');
  const [followerId, setFollowerId] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tradesApi.list({
        page: 1,
        limit: 300,
        status,
        followerId: followerId ? followerId : undefined,
        search: search || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      });
      setTrades(data.trades ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [status, followerId, search, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="card p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">Todos</option>
          <option value="OPEN">Abertas</option>
          <option value="WIN">Wins</option>
          <option value="LOSS">Losses</option>
        </select>
        <select className="field" value={followerId} onChange={(e) => setFollowerId(e.target.value)}>
          <option value="">Todas as contas</option>
          <option value="__robot__">Apenas robô (conta própria)</option>
        </select>
        <input className="field" placeholder="Buscar ativo/direção/seguidor" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="field" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="field" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-8 text-center text-c3 text-sm">Carregando histórico...</div>
      ) : (
        <TradeHistory
          trades={trades}
          showRefresh
          onRefresh={() => {
            void onSyncDashboard();
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ─── Settings page ─────────────────────────────────────────────────────────── */
function SettingsPage({ isDark, onToggleTheme, user, onLogout }: { isDark: boolean; onToggleTheme: () => void; user: any; onLogout: () => void }) {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-[var(--text-1)]">Configurações</h2>
        <p className="text-[var(--text-2)] text-sm mt-0.5">Preferências e informações do sistema</p>
      </div>

      {user && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg">
              {(user.name?.charAt(0) ?? '?').toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-[var(--text-1)]">{user.name}</p>
              <p className="text-xs text-[var(--text-3)]">{user.email}</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-2 rounded-xl transition-colors">
            <LogOut className="w-4 h-4" /> Sair da conta
          </button>
        </div>
      )}

      <div className="card">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[var(--text-1)] font-semibold">Aparência</h3>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center">
              {isDark ? <Moon className="w-5 h-5 text-[var(--text-2)]" /> : <Sun className="w-5 h-5 text-yellow-500" />}
            </div>
            <div>
              <p className="text-[var(--text-1)] font-medium text-sm">{isDark ? 'Modo Escuro' : 'Modo Claro'}</p>
              <p className="text-[var(--text-3)] text-xs">Alterna entre tema claro e escuro</p>
            </div>
          </div>
          <button onClick={onToggleTheme} className={`w-12 h-6 rounded-full transition-all relative ${isDark ? 'bg-brand-500' : 'bg-gray-200 dark:bg-white/15'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isDark ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[var(--text-1)] font-semibold">Sobre o Robô Auto</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          {[
            { k: 'Corretora', v: 'Bullex' },
            { k: 'Ligação', v: 'Tempo real com a corretora' },
            { k: 'Painel', v: 'Robô Auto' },
            { k: 'Versão', v: '2.0' },
          ].map(({ k, v }) => (
            <div key={k} className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3.5">
              <p className="text-xs text-[var(--text-3)] mb-1">{k}</p>
              <p className="text-[var(--text-1)] font-semibold text-sm">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
