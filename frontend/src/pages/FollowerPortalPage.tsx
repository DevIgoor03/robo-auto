import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, LogOut, Settings, BarChart2, Eye, EyeOff,
  Moon, Sun, CheckCircle, XCircle, Clock, Power, Search,
  Wallet, Target, ShieldAlert, Copy, Activity, DollarSign,
  LayoutDashboard, History, RotateCcw, Filter, Users, HelpCircle, ChevronLeft, ArrowRight,
} from 'lucide-react';
import { portalApi, portalTokenStore } from '../services/portalApi';
import { useTheme } from '../hooks/useTheme';
import { MARKETPLACE_TRADERS_ENABLED } from '../config/features';
import { InviteBullAuthShell } from '../components/login/InviteBullAuthShell';
import { CopyFyMark } from '../components/brand/CopyFyLogo';
import { MobileDockNav, type DockNavItem } from '../components/layout/MobileDockNav';
import toast from 'react-hot-toast';
import { usePortalSocket } from '../hooks/usePortalSocket.js';

type Page = 'overview' | 'history' | 'settings';

const PORTAL_DOCK_ITEMS: DockNavItem[] = [
  { id: 'overview', label: 'Início', icon: LayoutDashboard },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

interface FollowerData {
  id: string; name: string; email: string;
  balanceReal: number; balanceDemo: number; currency: string;
  isConnected: boolean; masterId: string;
  copySettings: {
    mode: string; amount: number; accountType: string;
    isActive: boolean; stopWin: number | null; stopLoss: number | null;
  };
  sessionStats: { wins: number; losses: number; totalTrades: number; profit: number; startedAt?: string };
}

interface Trade {
  id: string; direction: string; amount: number; instrumentName: string;
  positionId: string; status: 'OPEN' | 'WIN' | 'LOSS' | 'DRAW'; profit: number;
  openedAt: string; closedAt?: string;
}

function normalizeSocketTrade(raw: any): Trade {
  const opened =
    typeof raw.openedAt === 'string' ? raw.openedAt : new Date(raw.openedAt).toISOString();
  const closed =
    raw.closedAt == null
      ? undefined
      : typeof raw.closedAt === 'string'
        ? raw.closedAt
        : new Date(raw.closedAt).toISOString();
  return {
    id: String(raw.id),
    direction: String(raw.direction ?? ''),
    amount: Number(raw.amount ?? 0),
    instrumentName: String(raw.instrumentName ?? ''),
    positionId: String(raw.positionId ?? ''),
    status: (raw.status as Trade['status']) ?? 'OPEN',
    profit: Number(raw.profit ?? 0),
    openedAt: opened,
    closedAt: closed,
  };
}

interface TodaySummary {
  wins: number; losses: number; open: number; totalTrades: number; profit: number;
}

function normalizeFollower(raw: any): FollowerData | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.id || !raw.name || !raw.email) return null;

  const copySettings = raw.copySettings ?? {};
  const sessionStats = raw.sessionStats ?? {};

  return {
    id: String(raw.id),
    name: String(raw.name),
    email: String(raw.email),
    balanceReal: Number(raw.balanceReal ?? 0),
    balanceDemo: Number(raw.balanceDemo ?? 0),
    currency: String(raw.currency ?? 'USD'),
    isConnected: Boolean(raw.isConnected),
    masterId: String(raw.masterId ?? ''),
    copySettings: {
      mode: String(copySettings.mode ?? 'fixed'),
      amount: Number(copySettings.amount ?? 0),
      accountType: String(copySettings.accountType ?? 'real'),
      isActive: Boolean(copySettings.isActive),
      stopWin: copySettings.stopWin == null ? null : Number(copySettings.stopWin),
      stopLoss: copySettings.stopLoss == null ? null : Number(copySettings.stopLoss),
    },
    sessionStats: {
      wins: Number(sessionStats.wins ?? 0),
      losses: Number(sessionStats.losses ?? 0),
      totalTrades: Number(sessionStats.totalTrades ?? 0),
      profit: Number(sessionStats.profit ?? 0),
      startedAt: sessionStats.startedAt ? String(sessionStats.startedAt) : undefined,
    },
  };
}

const MODES = [
  { value: 'fixed',        label: 'Valor Fixo',    desc: 'Mesmo valor em cada operação',      icon: '💵' },
  { value: 'multiplier',   label: 'Multiplicador', desc: 'Múltiplo do valor do master',        icon: '✖️' },
  { value: 'proportional', label: '% do Saldo',    desc: 'Percentual do seu saldo disponível', icon: '📊' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Trades cujo `openedAt` cai no mesmo dia civil (fuso local) que `refMs`. Ao mudar o dia, deixam de entrar aqui. */
function tradesOpenedOnLocalCalendarDay<T extends { openedAt: string }>(list: T[], refMs: number): T[] {
  const ref = new Date(refMs);
  const y = ref.getFullYear();
  const mo = ref.getMonth();
  const d = ref.getDate();
  return list.filter((t) => {
    const o = new Date(t.openedAt);
    return o.getFullYear() === y && o.getMonth() === mo && o.getDate() === d;
  });
}

const PORTAL_LOGIN_TICKER = [
  'Copy trading em tempo real',
  'Replicação automática para seguidores',
  'Stop win e stop loss',
  'Portal dedicado aos seguidores',
  'Integração com a Bullex',
  'Credenciais encriptadas',
];

const portalLoginInputClass =
  'login-auth-shell w-full h-12 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 ' +
  'placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.62_0.20_152)]/35 focus:border-[oklch(0.62_0.20_152)] transition-colors';

export default function FollowerPortalPage() {
  const { masterId } = useParams<{ masterId?: string }>();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();

  const [isLoggedIn,       setIsLoggedIn]       = useState(false);
  const [activePage,       setActivePage]       = useState<Page>('overview');
  const [follower,         setFollower]         = useState<FollowerData | null>(null);
  const [trades,           setTrades]           = useState<Trade[]>([]);
  const [todaySummary,     setTodaySummary]     = useState<TodaySummary>({ wins: 0, losses: 0, open: 0, totalTrades: 0, profit: 0 });
  const [tradesLoading,    setTradesLoading]    = useState(false);
  const [email,            setEmail]            = useState('');
  const [password,         setPassword]         = useState('');
  const [showPw,           setShowPw]           = useState(false);
  const [logging,          setLogging]          = useState(false);
  const [togglingCopy,     setTogglingCopy]     = useState(false);
  const [showActivateCopyConfirm, setShowActivateCopyConfirm] = useState(false);
  const [resolvedMasterId, setResolvedMasterId] = useState(masterId ?? '');

  // Filter state
  const [filterStatus,  setFilterStatus]  = useState<'ALL' | 'OPEN' | 'WIN' | 'LOSS' | 'DRAW'>('ALL');
  const [filterFrom,    setFilterFrom]    = useState('');
  const [filterTo,      setFilterTo]      = useState('');
  const [filterSearch,  setFilterSearch]  = useState('');
  const [showFilters,   setShowFilters]   = useState(false);

  const [masterInfo, setMasterInfo] = useState<{ masterName: string } | null>(null);
  const [masterInfoLoading, setMasterInfoLoading] = useState(false);
  const [masterInfoError, setMasterInfoError] = useState(false);

  // Settings form
  const [sMode,    setSMode]    = useState('fixed');
  /** Texto livre no input de valor (evita 0 ao apagar). */
  const [sAmountStr, setSAmountStr] = useState('5');
  const [sStopWin, setSStopWin] = useState('');
  const [sStopLoss,setSStopLoss]= useState('');
  const [saving,   setSaving]   = useState(false);
  /** Atualiza após a meia-noite local para esvaziar “Últimas operações” do dia anterior. */
  const [calendarTick, setCalendarTick] = useState(() => Date.now());

  const syncSettings = (f: FollowerData) => {
    setSMode(f.copySettings.mode);
    setSAmountStr(String(f.copySettings.amount));
    setSStopWin(f.copySettings.stopWin ? String(f.copySettings.stopWin) : '');
    setSStopLoss(f.copySettings.stopLoss ? String(f.copySettings.stopLoss) : '');
  };

  const fetchTrades = useCallback(async () => {
    setTradesLoading(true);
    try {
      const data = await portalApi.trades({
        limit: 200,
        status: filterStatus,
        from: filterFrom ? new Date(filterFrom).toISOString() : undefined,
        to: filterTo ? new Date(`${filterTo}T23:59:59`).toISOString() : undefined,
        search: filterSearch || undefined,
      });
      setTrades(data.trades ?? []);
      if (data.today) setTodaySummary(data.today);
    } catch {} finally {
      setTradesLoading(false);
    }
  }, [filterStatus, filterFrom, filterTo, filterSearch]);

  const realtimeSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRealtimeSync = useCallback(() => {
    if (realtimeSyncTimer.current) clearTimeout(realtimeSyncTimer.current);
    realtimeSyncTimer.current = setTimeout(async () => {
      realtimeSyncTimer.current = null;
      await fetchTrades();
      try {
        const raw = await portalApi.me();
        const f = normalizeFollower(raw);
        if (f) setFollower(f);
      } catch {
        /* ignore */
      }
    }, 400);
  }, [fetchTrades]);

  const onSocketTradeNew = useCallback(
    (raw: unknown) => {
      const t = normalizeSocketTrade(raw);
      setTrades((prev) => {
        if (prev.some((x) => x.id === t.id)) return prev;
        return [t, ...prev].slice(0, 200);
      });
      scheduleRealtimeSync();
    },
    [scheduleRealtimeSync],
  );

  const onSocketTradeUpdated = useCallback(
    (raw: unknown) => {
      const t = normalizeSocketTrade(raw);
      setTrades((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...t } : x)));
      scheduleRealtimeSync();
    },
    [scheduleRealtimeSync],
  );

  usePortalSocket(Boolean(isLoggedIn && follower), onSocketTradeNew, onSocketTradeUpdated);

  useEffect(() => () => {
    if (realtimeSyncTimer.current) clearTimeout(realtimeSyncTimer.current);
  }, []);

  useEffect(() => {
    if (masterId) setResolvedMasterId(masterId);
  }, [masterId]);

  useEffect(() => {
    const id = window.setInterval(() => setCalendarTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const routeKeyForPublic = (masterId ?? resolvedMasterId).trim();

  useEffect(() => {
    if (!routeKeyForPublic || routeKeyForPublic.length < 3) {
      setMasterInfo(null);
      setMasterInfoError(false);
      setMasterInfoLoading(false);
      return;
    }
    const delay = masterId ? 0 : 500;
    const t = window.setTimeout(() => {
      setMasterInfoLoading(true);
      setMasterInfoError(false);
      portalApi
        .masterPublic(routeKeyForPublic)
        .then((d: { masterName?: string }) => {
          setMasterInfo({ masterName: String(d.masterName ?? 'Operador') });
        })
        .catch(() => {
          setMasterInfo(null);
          setMasterInfoError(true);
        })
        .finally(() => setMasterInfoLoading(false));
    }, delay);
    return () => window.clearTimeout(t);
  }, [masterId, resolvedMasterId]);

  useEffect(() => {
    const token = portalTokenStore.get();
    if (!token) return;
    portalApi.me()
      .then((raw: any) => {
        const f = normalizeFollower(raw);
        if (!f) {
          portalTokenStore.clear();
          setFollower(null);
          setIsLoggedIn(false);
          return;
        }
        // Se houver slug/id na URL, força compatibilidade com o trader selecionado.
        const looksLikeInternalId = /^cm[a-z0-9]{20,}$/i.test(resolvedMasterId);
        if (looksLikeInternalId && resolvedMasterId && f.masterId && f.masterId !== resolvedMasterId) {
          portalTokenStore.clear();
          setFollower(null);
          setIsLoggedIn(false);
          return;
        }
        setFollower(f);
        if (!resolvedMasterId && f.masterId) setResolvedMasterId(f.masterId);
        syncSettings(f);
        setIsLoggedIn(true);
      })
      .catch(() => portalTokenStore.clear());
  }, [resolvedMasterId]);

  useEffect(() => {
    if (isLoggedIn) fetchTrades();
  }, [isLoggedIn, fetchTrades]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedMasterId) { toast.error('ID do portal não encontrado na URL'); return; }
    setLogging(true);
    try {
      const data = await portalApi.login(resolvedMasterId, email, password);
      const normalizedFollower = normalizeFollower(data?.follower);
      if (!normalizedFollower) {
        toast.error('Dados do seguidor inválidos. Tente novamente.');
        setIsLoggedIn(false);
        setFollower(null);
        return;
      }
      portalTokenStore.set(data.token);
      setFollower(normalizedFollower);
      syncSettings(normalizedFollower);
      setIsLoggedIn(true);
      setActivePage('settings');
      toast.success(`Bem-vindo, ${normalizedFollower.name}! Configure seu copy abaixo.`);
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 429) toast.error('Muitas tentativas. Aguarde 1 minuto.');
      else if (s === 404) toast.error('Portal não encontrado. Verifique o link.');
      else if (s === 403) {
        toast.error(
          err?.response?.data?.error
          ?? 'Acesso não autorizado. Envie seu email Bullex ao suporte após a compra.',
        );
      } else toast.error(err?.response?.data?.error ?? 'Falha ao autenticar');
    } finally {
      setLogging(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmt = sAmountStr.trim().replace(',', '.');
    if (rawAmt === '') {
      toast.error('Informe o valor / multiplicador / percentual');
      return;
    }
    const amount = parseFloat(rawAmt);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Valor inválido');
      return;
    }
    setSaving(true);
    try {
      const updated = await portalApi.updateSettings({
        mode: sMode, amount, accountType: 'real',
        stopWin:  sStopWin  ? Number(sStopWin)  : null,
        stopLoss: sStopLoss ? Number(sStopLoss) : null,
      });
      setFollower((f) => f ? { ...f, copySettings: { ...f.copySettings, ...updated?.copySettings } } : f);
      toast.success('Configurações salvas!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await portalApi.logout().catch(() => {});
    portalTokenStore.clear();
    setFollower(null);
    setTrades([]);
    setIsLoggedIn(false);
  };

  const applyToggleCopy = async (next: boolean) => {
    if (!follower) return;
    setTogglingCopy(true);
    try {
      const updated = await portalApi.toggleCopy(next);
      const ns = updated?.copySettings ?? follower.copySettings;
      setFollower((p) => p ? { ...p, copySettings: { ...p.copySettings, ...ns } } : p);
      if (!next) {
        setTodaySummary({ wins: 0, losses: 0, open: 0, totalTrades: 0, profit: 0 });
      } else {
        fetchTrades();
      }
      toast.success(next ? '✅ Copy ativado para hoje!' : 'Copy pausado');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Erro ao alterar status');
    } finally {
      setTogglingCopy(false);
    }
  };

  /** Pausar: imediato. Ativar: abre modal de confirmação (servidor valida/reconecta Bullex). */
  const handleCopyPowerClick = () => {
    if (!follower) return;
    if (follower.copySettings.isActive) {
      void applyToggleCopy(false);
    } else {
      setShowActivateCopyConfirm(true);
    }
  };

  const confirmActivateCopy = () => {
    setShowActivateCopyConfirm(false);
    void applyToggleCopy(true);
  };

  // ─── Derived values (must be computed before any conditional return) ──────────

  const overviewTrades = useMemo(() => {
    const day = tradesOpenedOnLocalCalendarDay(trades, calendarTick);
    return [...day].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
  }, [trades, calendarTick]);

  // ─── Login Screen (mesmo shell visual do login do operador master) ────────────

  if (!isLoggedIn || !follower) {
    const loginGrid = (
      <div className="w-full max-w-7xl mx-auto grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-20 items-center">
        <div className="animate-invite-float-up" style={{ animationDelay: '0.1s' }}>
          {MARKETPLACE_TRADERS_ENABLED ? (
            <button
              type="button"
              onClick={() => navigate('/traders')}
              className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-[oklch(0.52_0.018_152)] hover:text-[oklch(0.94_0.006_155)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Escolher outro trader
            </button>
          ) : null}

          <div className="inline-flex items-center gap-2 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.62_0.20_152)] animate-pulse" />
            <span className="text-xs font-semibold text-[oklch(0.52_0.018_152)] tracking-[0.15em] uppercase">
              Robô Auto · Portal do seguidor
            </span>
          </div>

          <h1 className="font-display font-bold leading-[0.92] tracking-[-0.04em] mb-8">
            <span className="block text-[clamp(2.5rem,8vw,7rem)] text-[oklch(0.94_0.006_155)]">Copie.</span>
            <span
              className="block text-[clamp(2.5rem,8vw,7rem)]"
              style={{
                background: 'linear-gradient(135deg, oklch(0.72 0.22 152), oklch(0.65 0.20 175))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Sincroniza.
            </span>
            <span className="block text-[clamp(2.5rem,8vw,7rem)] text-[oklch(0.94_0.006_155)]/30">Lucre.</span>
          </h1>

          <div className="flex items-start gap-6">
            <div
              className="w-px h-16 shrink-0 mt-1"
              style={{
                background: 'linear-gradient(to bottom, oklch(0.62 0.20 152 / 0.6), transparent)',
              }}
            />
            <div className="text-base text-[oklch(0.52_0.018_152)] leading-relaxed max-w-sm space-y-2">
              <p>
                As operações do operador são replicadas na sua conta Bullex em tempo real, com stop win, stop loss e
                definições que ajusta neste portal.
              </p>
              {masterInfoLoading && <p className="text-sm text-[oklch(0.52_0.018_152)]">A identificar operador…</p>}
              {!masterInfoLoading && masterInfo && (
                <p className="text-[oklch(0.94_0.006_155)] font-semibold">
                  Operador:{' '}
                  <span className="text-[oklch(0.62_0.20_152)]">{masterInfo.masterName}</span>
                </p>
              )}
              {!masterInfoLoading && masterInfoError && routeKeyForPublic.length >= 3 && (
                <p className="text-sm text-red-400">Link inválido ou operador não encontrado.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-8 sm:gap-10 mt-10">
            {[
              { value: '24/7', label: 'Sincronização' },
              { value: '100%', label: 'Replicação' },
              { value: 'Bullex', label: 'Corretora' },
            ].map(({ value, label }, i) => (
              <div key={label} className="animate-invite-float-up" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
                <p className="font-display text-2xl font-bold tracking-tight text-[oklch(0.94_0.006_155)]">{value}</p>
                <p className="text-xs text-[oklch(0.52_0.018_152)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-invite-float-up" style={{ animationDelay: '0.25s' }}>
          <div className="relative">
            <div
              className="absolute inset-0 rounded-3xl blur-2xl -z-10 scale-95"
              style={{ background: 'oklch(0.38 0.18 152 / 0.12)' }}
            />
            <div className="relative bg-[#212B36]/88 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-8 overflow-hidden">
              <div
                className="absolute inset-x-8 top-0 h-px rounded-full pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent, oklch(0.62 0.20 152 / 0.6), transparent)',
                }}
              />

              <div className="mb-7 relative">
                <p className="text-xs text-[oklch(0.52_0.018_152)] tracking-[0.1em] uppercase font-semibold mb-2">
                  Acesse o seu portal
                </p>
                <h2 className="font-display text-xl font-bold tracking-tight text-[oklch(0.94_0.006_155)]">
                  Bem-vindo de volta
                </h2>
                <p className="text-xs text-[oklch(0.52_0.018_152)] mt-2 leading-relaxed">
                  {masterInfo && !masterInfoLoading
                    ? `Entre com a conta Bullex associada ao copy do operador ${masterInfo.masterName}.`
                    : 'Entre com o email e a senha da sua conta Bullex de seguidor.'}
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4 relative">
                {!masterId && (
                  <div>
                    <label className="block text-xs font-semibold text-[oklch(0.52_0.018_152)] mb-2 tracking-wide">
                      Identificador do portal
                    </label>
                    <input
                      className={portalLoginInputClass}
                      placeholder="Slug ou ID do operador"
                      value={resolvedMasterId}
                      onChange={(e) => setResolvedMasterId(e.target.value)}
                      disabled={logging}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-[oklch(0.52_0.018_152)] mb-2 tracking-wide">
                    E-mail Bullex
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    disabled={logging}
                    className={portalLoginInputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[oklch(0.52_0.018_152)] mb-2 tracking-wide">
                    Senha Bullex
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={logging}
                      className={`${portalLoginInputClass} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors"
                      aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={logging}
                  className="w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white
                             bg-[oklch(0.62_0.20_152)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ boxShadow: '0 8px 32px oklch(0.62 0.20 152 / 0.35)' }}
                >
                  {logging ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      Entrar no portal
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-white/[0.06] relative">
                <p className="text-xs text-[oklch(0.52_0.018_152)] text-center leading-relaxed">
                  Credenciais encriptadas e usadas apenas para autenticar na Bullex.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <InviteBullAuthShell tickerItems={PORTAL_LOGIN_TICKER}>
        {loginGrid}
      </InviteBullAuthShell>
    );
  }

  // ─── Dashboard Layout ─────────────────────────────────────────────────────────

  const f = follower!;
  const { sessionStats, copySettings } = f;
  const balance = f.balanceReal;
  const totalClosed = sessionStats.wins + sessionStats.losses;
  const winRate = totalClosed > 0 ? Math.round((sessionStats.wins / totalClosed) * 100) : 0;
  const overviewSummary = copySettings.isActive
    ? todaySummary
    : { wins: 0, losses: 0, open: 0, totalTrades: 0, profit: 0 };

  const navItems = [
    { id: 'overview' as Page,  label: 'Dashboard',   icon: LayoutDashboard },
    { id: 'history'  as Page,  label: 'Histórico',   icon: History },
    { id: 'settings' as Page,  label: 'Configurações', icon: Settings },
  ];

  const pageTitle: Record<Page, string> = {
    overview: 'Dashboard',
    history:  'Histórico de Operações',
    settings: 'Configurações',
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <nav className="hidden h-full w-[60px] flex-shrink-0 flex-col items-center gap-1 bg-sidebar py-4 md:flex">
        <div className="mb-4 flex h-10 w-10 flex-shrink-0 items-center justify-center" title="Robô Auto">
          <CopyFyMark className="h-9 w-auto" />
        </div>

        <div className="flex flex-col gap-0.5 flex-1 w-full px-2.5">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = activePage === id;
            return (
              <button key={id} onClick={() => setActivePage(id)} title={label}
                className={`relative w-full h-10 flex items-center justify-center rounded-lg transition-all duration-150 group ${
                  active ? 'bg-sidebar-active text-white' : 'text-gray-500 hover:bg-sidebar-hover hover:text-gray-200'
                }`}>
                <Icon className="w-[17px] h-[17px]" strokeWidth={active ? 2.5 : 2} />
                {active && <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-brand-400" />}
                <span className="absolute left-full ml-2.5 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg
                                 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap
                                 transition-opacity z-50 shadow-lg border border-white/10">
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {copySettings.isActive && (
          <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center mb-1" title="Copy ativo hoje">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          </div>
        )}

        <div className="flex flex-col gap-0.5 w-full px-2.5">
          <button title="Ajuda"
            className="w-full h-10 flex items-center justify-center rounded-lg text-gray-600 hover:bg-sidebar-hover hover:text-gray-300 transition-all">
            <HelpCircle className="w-[17px] h-[17px]" strokeWidth={2} />
          </button>
          <button onClick={handleLogout} title="Sair"
            className="w-full h-10 flex items-center justify-center rounded-lg text-gray-600 hover:bg-red-500/15 hover:text-red-400 transition-all">
            <LogOut className="w-[17px] h-[17px]" strokeWidth={2} />
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <header className="flex min-h-14 flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-sm sm:h-14 sm:flex-nowrap sm:px-6 sm:py-0">
          <div className="min-w-0 flex-1 sm:flex-none">
            <h1 className="text-sm font-bold leading-tight text-[var(--text-1)] sm:text-base">{pageTitle[activePage]}</h1>
            <p className="truncate text-[11px] text-[var(--text-3)] sm:text-xs">
              <span className="hidden sm:inline">
                {f.name} · {f.email} ·{' '}
              </span>
              <span className={copySettings.isActive ? 'text-emerald-500' : 'text-amber-500'}>
                {copySettings.isActive ? 'Copy ativo' : 'Copy inativo'}
              </span>
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={handleCopyPowerClick}
              disabled={togglingCopy}
              className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 text-[10px] font-semibold transition-all sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-xs ${
                copySettings.isActive
                  ? 'border-red-300 bg-red-50 text-red-500 dark:border-red-500/30 dark:bg-red-500/10'
                  : 'btn-brand'
              }`}
            >
              {togglingCopy ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              ) : (
                <Power className="h-3.5 w-3.5" />
              )}
              <span className="max-sm:hidden">{copySettings.isActive ? 'Pausar copy' : 'Ativar copy'}</span>
              <span className="sm:hidden">{copySettings.isActive ? 'Pausar' : 'Ativar'}</span>
            </button>
            <button type="button" onClick={toggle} className="btn-icon" title="Tema">
              {isDark ? <Sun className="h-4 w-4 text-yellow-400" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
              {f.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <div className="mx-auto max-w-[1440px] animate-fade-in p-3 sm:p-5">

            {activePage === 'overview' && (
              <OverviewPage
                follower={f} balance={balance} winRate={winRate} todaySummary={overviewSummary}
                trades={overviewTrades} onGoHistory={() => setActivePage('history')}
                onGoSettings={() => setActivePage('settings')}
              />
            )}

            {activePage === 'history' && (
              <HistoryPage
                trades={trades} loading={tradesLoading}
                filterStatus={filterStatus} setFilterStatus={setFilterStatus}
                filterFrom={filterFrom} setFilterFrom={setFilterFrom}
                filterTo={filterTo} setFilterTo={setFilterTo}
                filterSearch={filterSearch} setFilterSearch={setFilterSearch}
                showFilters={showFilters} setShowFilters={setShowFilters}
                onRefresh={fetchTrades}
              />
            )}

            {activePage === 'settings' && (
              <SettingsPage
                sMode={sMode} setSMode={setSMode}
                sAmountStr={sAmountStr} setSAmountStr={setSAmountStr}
                sStopWin={sStopWin} setSStopWin={setSStopWin}
                sStopLoss={sStopLoss} setSStopLoss={setSStopLoss}
                saving={saving} onSave={handleSaveSettings}
                follower={f} isDark={isDark} onToggleTheme={toggle}
              />
            )}

          </div>
        </main>
      </div>

      <MobileDockNav
        items={PORTAL_DOCK_ITEMS}
        activeId={activePage}
        onSelect={(id) => setActivePage(id as Page)}
        showLiveOnFirst={copySettings.isActive}
        onLogout={() => {
          void handleLogout();
        }}
      />

      {showActivateCopyConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="activate-copy-title"
          onClick={() => setShowActivateCopyConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="activate-copy-title" className="text-lg font-bold text-[var(--text-1)]">
              Ativar copy?
            </h2>
            <p className="mt-2 text-sm text-[var(--text-2)] leading-relaxed">
              Ao confirmar, o servidor verifica a ligação à Bullex e, se precisar, reconecta automaticamente para o copy
              funcionar. Isto pode levar até cerca de um minuto.
            </p>
            <p className="mt-3 text-xs text-[var(--text-3)]">
              Garanta que o operador já iniciou o copy no painel dele antes de abrir operações.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text-2)] hover:bg-[var(--bg)]"
                onClick={() => setShowActivateCopyConfirm(false)}
              >
                Cancelar
              </button>
              <button type="button" className="btn-brand px-4 py-2.5 text-sm font-semibold" onClick={confirmActivateCopy}>
                Confirmar e verificar ligação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Overview Page ──────────────────────────────────────────────────────────── */
function OverviewPage({ follower: f, balance, winRate, todaySummary, trades, onGoHistory, onGoSettings }: {
  follower: FollowerData; balance: number; winRate: number;
  todaySummary: TodaySummary; trades: Trade[];
  onGoHistory: () => void; onGoSettings: () => void;
}) {
  const { sessionStats, copySettings } = f;
  const todayWinRate = (todaySummary.wins + todaySummary.losses) > 0
    ? Math.round((todaySummary.wins / (todaySummary.wins + todaySummary.losses)) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-[var(--text-1)] sm:text-2xl">
          Olá, {f.name.split(' ')[0]} 👋
        </h2>
        <p className="text-[var(--text-2)] text-sm mt-0.5">
          Acompanhe suas operações copiadas em tempo real
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <PortalStatCard
          title="Saldo da Conta" icon={Wallet} color="blue"
          value={`${f.currency} ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subValue="Conta real"
        />
        <PortalStatCard
          title="Lucro da Sessão" icon={DollarSign}
          color={sessionStats.profit >= 0 ? 'green' : 'red'}
          trend={sessionStats.profit > 0 ? 'up' : sessionStats.profit < 0 ? 'down' : 'neutral'}
          value={`${sessionStats.profit >= 0 ? '+' : ''}R$${sessionStats.profit.toFixed(2)}`}
          subValue={`${sessionStats.totalTrades} operações`}
        />
        <PortalStatCard
          title="Win Rate" icon={Activity}
          color={winRate >= 60 ? 'green' : winRate >= 40 ? 'yellow' : 'red'}
          trend={winRate >= 60 ? 'up' : winRate >= 40 ? 'neutral' : 'down'}
          value={`${winRate}%`}
          subValue={`${sessionStats.wins}W / ${sessionStats.losses}L`}
        />
        <PortalStatCard
          title="Lucro Hoje" icon={BarChart2}
          color={todaySummary.profit >= 0 ? 'green' : 'red'}
          value={`${todaySummary.profit >= 0 ? '+' : ''}R$${todaySummary.profit.toFixed(2)}`}
          subValue={`${todaySummary.totalTrades} ops · ${todayWinRate}% acerto`}
        />
      </div>

      {/* Middle row: balance card + today summary + config */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left col: balance hero + config */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Hero balance */}
          <div className="card overflow-hidden">
            <div className="relative h-28 flex flex-col justify-end px-5 pb-4"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f3460 100%)' }}>
              <div className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(132,204,22,0.4) 0%, transparent 60%)' }} />
              <p className="text-gray-400 text-xs font-medium relative z-10">
                Saldo real
              </p>
              <p className="text-white text-2xl font-bold tracking-tight num relative z-10">
                {f.currency} {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-3)]">Lucro da sessão</span>
                <span className={`font-bold num ${sessionStats.profit >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {`${sessionStats.profit >= 0 ? '+' : ''}R$${sessionStats.profit.toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-3)]">Status do copy</span>
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${copySettings.isActive ? 'text-emerald-500' : 'text-amber-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${copySettings.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {copySettings.isActive ? 'Ativo hoje' : 'Inativo'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-3)]">Modo de cópia</span>
                <span className="text-[var(--text-1)] font-semibold text-xs capitalize">
                  {copySettings.mode === 'fixed' ? 'Valor Fixo' : copySettings.mode === 'multiplier' ? 'Multiplicador' : '% Saldo'}
                </span>
              </div>
            </div>
          </div>

          {/* Config summary */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <p className="text-[var(--text-1)] font-semibold text-sm">Parâmetros de cópia</p>
              <button onClick={onGoSettings} className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                <Settings className="w-3 h-3" /> Editar
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {[
                { icon: <Copy className="w-3.5 h-3.5" />, label: 'Valor', value: copySettings.mode === 'fixed' ? `R$${copySettings.amount}` : copySettings.mode === 'multiplier' ? `${copySettings.amount}×` : `${copySettings.amount}%` },
                { icon: <Users className="w-3.5 h-3.5" />, label: 'Conta', value: 'Real' },
                { icon: <Target className="w-3.5 h-3.5 text-emerald-500" />, label: 'Stop Win', value: copySettings.stopWin ? `R$${copySettings.stopWin}` : '—', accent: 'text-emerald-500' },
                { icon: <ShieldAlert className="w-3.5 h-3.5 text-red-400" />, label: 'Stop Loss', value: copySettings.stopLoss ? `R$${copySettings.stopLoss}` : '—', accent: 'text-red-400' },
              ].map((item) => (
                <div key={item.label} className="bg-[var(--bg)] rounded-xl p-3 flex items-center gap-2">
                  <span className={`text-[var(--text-3)] flex-shrink-0 ${(item as any).accent ?? ''}`}>{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">{item.label}</p>
                    <p className={`text-sm font-bold num truncate ${(item as any).accent ?? 'text-[var(--text-1)]'}`}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col: today detail + recent trades */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Today summary */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[var(--text-1)] font-bold text-base">Resumo de hoje</h3>
                <p className="text-[var(--text-3)] text-xs">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
              </div>
              {todaySummary.totalTrades > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Win Rate hoje</p>
                  <p className={`text-lg font-bold num ${todayWinRate >= 50 ? 'text-emerald-500' : 'text-red-400'}`}>{todayWinRate}%</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total ops', value: todaySummary.totalTrades, color: '' },
                { label: 'Ganhos', value: todaySummary.wins, color: 'text-emerald-500' },
                { label: 'Perdas', value: todaySummary.losses, color: 'text-red-400' },
                { label: 'Em aberto', value: todaySummary.open, color: 'text-amber-500' },
              ].map((s) => (
                <div key={s.label} className="bg-[var(--bg)] rounded-xl p-4 text-center">
                  <p className={`text-2xl font-bold num ${s.color || 'text-[var(--text-1)]'}`}>{s.value}</p>
                  <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {todaySummary.totalTrades > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-3)] mb-1.5">
                  <span>{todaySummary.wins} ganhos</span>
                  <span>{todaySummary.losses} perdas</span>
                </div>
                <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden flex">
                  {todaySummary.wins > 0 && (
                    <div className="h-full bg-emerald-500 rounded-l-full transition-all"
                      style={{ width: `${todayWinRate}%` }} />
                  )}
                  {todaySummary.losses > 0 && (
                    <div className="h-full bg-red-400 rounded-r-full transition-all"
                      style={{ width: `${100 - todayWinRate}%` }} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Recent trades */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
              <div>
                <h3 className="text-[var(--text-1)] font-bold text-sm">Últimas Operações</h3>
                <p className="text-[var(--text-3)] text-xs">Todas as operações copiadas hoje</p>
              </div>
              <button onClick={onGoHistory} className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                Ver histórico completo →
              </button>
            </div>

            {trades.length === 0 ? (
              <div className="py-16 text-center">
                <BarChart2 className="w-8 h-8 text-[var(--text-3)] mx-auto mb-2 opacity-30" />
                <p className="text-sm text-[var(--text-2)] font-medium">Sem operações hoje</p>
                <p className="text-xs text-[var(--text-3)] mt-0.5 max-w-xs mx-auto">
                  Operações de dias anteriores ficam em <span className="font-semibold text-[var(--text-2)]">Histórico completo</span>
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] max-h-[min(28rem,55vh)] overflow-y-auto overscroll-contain">
                {trades.map((t) => <TradeRow key={t.id} trade={t} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── History Page ────────────────────────────────────────────────────────────── */
function HistoryPage({ trades, loading, filterStatus, setFilterStatus, filterFrom, setFilterFrom,
  filterTo, setFilterTo, filterSearch, setFilterSearch, showFilters, setShowFilters, onRefresh }: {
  trades: Trade[]; loading: boolean;
  filterStatus: 'ALL' | 'OPEN' | 'WIN' | 'LOSS' | 'DRAW'; setFilterStatus: (s: any) => void;
  filterFrom: string; setFilterFrom: (s: string) => void;
  filterTo: string; setFilterTo: (s: string) => void;
  filterSearch: string; setFilterSearch: (s: string) => void;
  showFilters: boolean; setShowFilters: (v: boolean) => void;
  onRefresh: () => void;
}) {
  const activeFilters = [filterStatus !== 'ALL', filterFrom, filterTo, filterSearch].filter(Boolean).length;
  const totalProfit = trades.filter(t => t.status !== 'OPEN').reduce((s, t) => s + t.profit, 0);
  const wins   = trades.filter(t => t.status === 'WIN').length;
  const losses = trades.filter(t => t.status === 'LOSS').length;
  const draws  = trades.filter(t => t.status === 'DRAW').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[var(--text-1)]">Histórico de Operações</h2>
          <p className="text-[var(--text-2)] text-sm mt-0.5">{trades.length} operações encontradas</p>
        </div>
        <button onClick={onRefresh} className="btn-icon" title="Atualizar">
          <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: trades.length,   color: '' },
          { label: 'Wins',     value: wins,             color: 'text-emerald-500' },
          { label: 'Losses',   value: losses,           color: 'text-red-400' },
          { label: 'Empates',  value: draws,            color: 'text-blue-400' },
          { label: 'Lucro',    value: `${totalProfit >= 0 ? '+' : ''}R$${Math.abs(totalProfit).toFixed(2)}`, color: totalProfit >= 0 ? 'text-emerald-500' : 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold num ${s.color || 'text-[var(--text-1)]'}`}>{s.value}</p>
            <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input className="field pl-9" placeholder="Buscar ativo, direção..."
              value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
          </div>

          {/* Status pills */}
          <div className="flex gap-1.5 flex-wrap">
            {(['ALL', 'OPEN', 'WIN', 'LOSS', 'DRAW'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  filterStatus === s
                    ? s === 'WIN'  ? 'bg-emerald-500 text-white border-emerald-500'
                    : s === 'LOSS' ? 'bg-red-500 text-white border-red-500'
                    : s === 'OPEN' ? 'bg-amber-500 text-white border-amber-500'
                    : s === 'DRAW' ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-[var(--text-1)] text-[var(--bg)] border-[var(--text-1)]'
                    : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--text-3)]'
                }`}>
                {s === 'ALL' ? 'Todos' : s === 'OPEN' ? 'Abertas' : s === 'DRAW' ? 'Empate' : s}
              </button>
            ))}
          </div>

          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              showFilters || activeFilters > 0
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400'
                : 'border-[var(--border)] text-[var(--text-2)]'
            }`}>
            <Filter className="w-3.5 h-3.5" />
            Datas
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] flex items-center justify-center font-bold">{activeFilters}</span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-end gap-3 flex-wrap">
            <div>
              <label className="label text-[10px]">Data início</label>
              <input type="date" className="field" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div>
              <label className="label text-[10px]">Data fim</label>
              <input type="date" className="field" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
            <div className="flex gap-2 pb-0.5">
              <button onClick={() => { setFilterFrom(todayStr()); setFilterTo(todayStr()); }}
                className="btn-white text-xs px-3 py-1.5">Hoje</button>
              <button onClick={() => {
                const d = new Date(); d.setDate(d.getDate() - d.getDay());
                setFilterFrom(d.toISOString().slice(0, 10)); setFilterTo(todayStr());
              }} className="btn-white text-xs px-3 py-1.5">Esta semana</button>
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterStatus('ALL'); setFilterSearch(''); }}
                className="btn-ghost text-xs px-3 py-1.5 text-red-500">
                <RotateCcw className="w-3 h-3" /> Limpar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Trade list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <span className="w-6 h-6 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin inline-block" />
            <p className="text-[var(--text-3)] text-sm mt-3">Carregando operações...</p>
          </div>
        ) : trades.length === 0 ? (
          <div className="py-16 text-center">
            <BarChart2 className="w-8 h-8 text-[var(--text-3)] mx-auto mb-2 opacity-30" />
            <p className="text-sm text-[var(--text-2)] font-medium">Nenhuma operação encontrada</p>
            {activeFilters > 0 && (
              <button onClick={() => { setFilterStatus('ALL'); setFilterFrom(''); setFilterTo(''); setFilterSearch(''); }}
                className="mt-2 text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-5 py-2.5 border-b border-[var(--border)] bg-[var(--bg)]">
              {['Ativo', 'Direção', 'Valor', 'Data', 'Resultado'].map((h) => (
                <p key={h} className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">{h}</p>
              ))}
            </div>
            <div className="divide-y divide-[var(--border)]">
              {trades.map((t) => <TradeRow key={t.id} trade={t} showDate table />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Settings Page ───────────────────────────────────────────────────────────── */
function SettingsPage({ sMode, setSMode, sAmountStr, setSAmountStr,
  sStopWin, setSStopWin, sStopLoss, setSStopLoss, saving, onSave, follower: f, isDark, onToggleTheme }: {
  sMode: string; setSMode: (v: string) => void;
  sAmountStr: string; setSAmountStr: (v: string) => void;
  sStopWin: string; setSStopWin: (v: string) => void;
  sStopLoss: string; setSStopLoss: (v: string) => void;
  saving: boolean; onSave: (e: React.FormEvent) => void;
  follower: FollowerData; isDark: boolean; onToggleTheme: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-[var(--text-1)]">Configurações</h2>
        <p className="text-[var(--text-2)] text-sm mt-0.5">Personalize como suas operações são copiadas</p>
      </div>

      <form onSubmit={onSave} className="space-y-4">
        {/* Mode */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--border)]">
            <h3 className="text-[var(--text-1)] font-semibold text-sm">Modo de cópia</h3>
          </div>
          <div className="p-4 space-y-2">
            {MODES.map((m) => (
              <label key={m.value} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                sMode === m.value
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-[var(--border)] hover:border-brand-400/50'
              }`}>
                <input type="radio" name="mode" value={m.value} checked={sMode === m.value}
                  onChange={(e) => setSMode(e.target.value)} className="sr-only" />
                <span className="text-lg">{m.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text-1)]">{m.label}</p>
                  <p className="text-xs text-[var(--text-3)]">{m.desc}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${sMode === m.value ? 'border-brand-500' : 'border-[var(--border)]'}`}>
                  {sMode === m.value && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Amount (sempre conta real) */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--border)]">
            <h3 className="text-[var(--text-1)] font-semibold text-sm">Valores</h3>
            <p className="text-[var(--text-3)] text-xs mt-0.5">A cópia utiliza sempre a sua conta real Bullex</p>
          </div>
          <div className="p-4">
            <div>
              <label className="label">
                {sMode === 'fixed' ? 'Valor por operação' : sMode === 'multiplier' ? 'Multiplicador' : 'Porcentagem do saldo'}
              </label>
              <div className="relative">
                {sMode === 'fixed' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] font-bold text-sm">R$</span>}
                <input
                  type="text"
                  inputMode="decimal"
                  value={sAmountStr}
                  onChange={(e) => setSAmountStr(e.target.value)}
                  required
                  className={`field ${sMode === 'fixed' ? 'pl-10' : ''}`}
                  placeholder={sMode === 'fixed' ? '5.00' : sMode === 'multiplier' ? '2' : '5'}
                  autoComplete="off"
                />
                {sMode !== 'fixed' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">{sMode === 'multiplier' ? '×' : '%'}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Stop Win / Loss */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--border)]">
            <h3 className="text-[var(--text-1)] font-semibold text-sm">Proteção automática</h3>
            <p className="text-[var(--text-3)] text-xs mt-0.5">O sistema pausará automaticamente ao atingir os limites</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1.5 uppercase tracking-wider">Stop Win (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">R$</span>
                <input type="number" value={sStopWin} onChange={(e) => setSStopWin(e.target.value)}
                  min="0" step="any" placeholder="Ex: 100" className="field pl-9" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-red-500 mb-1.5 uppercase tracking-wider">Stop Loss (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-sm">R$</span>
                <input type="number" value={sStopLoss} onChange={(e) => setSStopLoss(e.target.value)}
                  min="0" step="any" placeholder="Ex: 50" className="field pl-9" />
              </div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-brand w-full">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✓ Salvar configurações'}
        </button>
      </form>

      {/* Appearance */}
      <div className="card">
        <div className="px-5 py-3.5 border-b border-[var(--border)]">
          <h3 className="text-[var(--text-1)] font-semibold text-sm">Aparência</h3>
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
          <button onClick={onToggleTheme}
            className={`w-12 h-6 rounded-full transition-all relative ${isDark ? 'bg-brand-500' : 'bg-gray-200 dark:bg-white/15'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isDark ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Account info */}
      <div className="card">
        <div className="px-5 py-3.5 border-b border-[var(--border)]">
          <h3 className="text-[var(--text-1)] font-semibold text-sm">Conta</h3>
        </div>
        <div className="p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-bold text-lg">
            {f.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[var(--text-1)]">{f.name}</p>
            <p className="text-xs text-[var(--text-3)]">{f.email}</p>
          </div>
          <span className={`badge ${f.isConnected ? 'badge-green' : 'badge-yellow'}`}>
            {f.isConnected ? 'Conectado' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared Components ──────────────────────────────────────────────────────── */

function PortalStatCard({ title, value, subValue, icon: Icon, trend, color = 'green' }: {
  title: string; value: string; subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'green' | 'red' | 'blue' | 'purple' | 'yellow';
}) {
  const colorMap: Record<string, { iconBg: string; icon: string; ring: string }> = {
    green:  { iconBg: 'bg-brand-100 dark:bg-brand-500/15',   icon: 'text-brand-600 dark:text-brand-400',    ring: 'ring-brand-200 dark:ring-brand-500/20'  },
    red:    { iconBg: 'bg-red-100 dark:bg-red-500/15',       icon: 'text-red-500 dark:text-red-400',        ring: 'ring-red-200 dark:ring-red-500/20'      },
    blue:   { iconBg: 'bg-blue-100 dark:bg-blue-500/15',     icon: 'text-blue-500 dark:text-blue-400',      ring: 'ring-blue-200 dark:ring-blue-500/20'    },
    purple: { iconBg: 'bg-purple-100 dark:bg-purple-500/15', icon: 'text-purple-500 dark:text-purple-400',  ring: 'ring-purple-200 dark:ring-purple-500/20' },
    yellow: { iconBg: 'bg-yellow-100 dark:bg-yellow-500/15', icon: 'text-yellow-600 dark:text-yellow-400',  ring: 'ring-yellow-200 dark:ring-yellow-500/20' },
  };
  const c = colorMap[color];
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  const trendCls = trend === 'up'
    ? 'text-brand-600 bg-brand-100 dark:text-brand-400 dark:bg-brand-500/15'
    : trend === 'down'
    ? 'text-red-500 bg-red-100 dark:text-red-400 dark:bg-red-500/15'
    : 'text-gray-400 bg-gray-100 dark:bg-white/5';

  return (
    <div className="card card-hover p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${c.iconBg} ring-1 ${c.ring} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {TrendIcon && trend && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${trendCls}`}>
            <TrendIcon className="w-3 h-3" />
          </div>
        )}
      </div>
      <div className="stat-big mb-0.5">{value}</div>
      <div className="text-sm font-medium text-c2">{title}</div>
      {subValue && <div className="text-xs text-c3 mt-0.5">{subValue}</div>}
    </div>
  );
}

function statusColor(status: string) {
  if (status === 'WIN')  return { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-500', textSm: 'text-emerald-400' };
  if (status === 'OPEN') return { bg: 'bg-amber-50 dark:bg-amber-500/10',     text: 'text-amber-500',   textSm: 'text-amber-400'   };
  if (status === 'DRAW') return { bg: 'bg-blue-50 dark:bg-blue-500/10',        text: 'text-blue-400',    textSm: 'text-blue-400'    };
  return                        { bg: 'bg-red-50 dark:bg-red-500/10',          text: 'text-red-400',     textSm: 'text-red-400'     };
}

function statusIcon(status: string, size: 'sm' | 'md' = 'md') {
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  if (status === 'WIN')  return <CheckCircle className={`${cls} text-emerald-500`} />;
  if (status === 'OPEN') return <Clock       className={`${cls} text-amber-500`}   />;
  if (status === 'DRAW') return <RotateCcw   className={`${cls} text-blue-400`}    />;
  return                        <XCircle     className={`${cls} text-red-400`}     />;
}

function statusLabel(status: string) {
  if (status === 'WIN')  return 'Win';
  if (status === 'OPEN') return 'Aberta';
  if (status === 'DRAW') return 'Empate';
  return 'Loss';
}

function TradeRow({ trade: t, showDate, table }: { trade: Trade; showDate?: boolean; table?: boolean }) {
  const sc     = statusColor(t.status);
  const isOpen = t.status === 'OPEN';
  const isCall = t.direction === 'call';
  const time   = new Date(t.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const date   = new Date(t.openedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  if (table) {
    return (
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 px-5 py-3 hover:bg-[var(--bg)] transition-colors items-center">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${sc.bg}`}>
            {statusIcon(t.status, 'sm')}
          </div>
          <span className="text-sm font-semibold text-[var(--text-1)] truncate">{t.instrumentName || `#${t.positionId}`}</span>
        </div>
        <span className={`flex items-center gap-1 text-xs font-bold ${isCall ? 'text-brand-600 dark:text-brand-400' : 'text-red-500 dark:text-red-400'}`}>
          {isCall ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isCall ? 'CALL' : 'PUT'}
        </span>
        <span className="text-sm num text-[var(--text-1)] font-medium">{`R$${t.amount.toFixed(2)}`}</span>
        <span className="text-xs text-[var(--text-3)]">{date} {time}</span>
        <span className={`text-sm font-bold num ${sc.text}`}>
          {isOpen ? '—' : `${t.profit >= 0 ? '+' : ''}R$${Math.abs(t.profit).toFixed(2)}`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg)] transition-colors">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sc.bg}`}>
        {statusIcon(t.status)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-[var(--text-1)] truncate">{t.instrumentName || `#${t.positionId}`}</p>
          <span className={`flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isCall ? 'bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300'
                   : 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-300'
          }`}>
            {isCall ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {isCall ? 'CALL' : 'PUT'}
          </span>
        </div>
        <p className="text-xs text-[var(--text-3)] mt-0.5">
          {`R$${t.amount.toFixed(2)}`} · {showDate ? `${date} ` : ''}{time}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold num ${sc.text}`}>
          {isOpen ? '—' : `${t.profit >= 0 ? '+' : ''}R$${Math.abs(t.profit).toFixed(2)}`}
        </p>
        <p className={`text-[10px] font-semibold ${sc.textSm}`}>
          {statusLabel(t.status)}
        </p>
      </div>
    </div>
  );
}
