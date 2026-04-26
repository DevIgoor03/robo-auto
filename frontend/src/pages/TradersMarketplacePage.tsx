/**
 * Marketplace público de traders. Rota /traders pode estar desligada em `src/config/features.ts`
 * (`MARKETPLACE_TRADERS_ENABLED`); o ficheiro mantém-se para reativar sem reescrever.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Users, BarChart2, Zap, ArrowRight,
  Moon, Sun, Star, Shield, Award, Activity, DollarSign, Target,
  CheckCircle, Clock, ChevronRight,
} from 'lucide-react';
import { portalApi } from '../services/portalApi';
import { useTheme } from '../hooks/useTheme';
import { CopyFyLogo } from '../components/brand/CopyFyLogo';

interface Trader {
  id: string;
  name: string;
  plan: 'START' | 'PRO' | 'ELITE';
  isActive: boolean;
  followerCount: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  recentWinRate: number;
  totalProfit: number;
  recentProfit: number;
  currency: string;
  since: string;
}

type PlanFilter = 'ALL' | 'ELITE' | 'PRO' | 'START';

const PLAN_META: Record<string, { label: string; icon: React.ElementType; gradient: string; badge: string }> = {
  ELITE: { label: 'Elite', icon: Award,  gradient: 'from-amber-500 to-yellow-400',  badge: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
  PRO:   { label: 'Pro',   icon: Star,   gradient: 'from-blue-500 to-cyan-400',      badge: 'bg-blue-400/15 text-blue-400 border-blue-400/30'   },
  START: { label: 'Start', icon: Zap,    gradient: 'from-brand-500 to-emerald-400',  badge: 'bg-brand-400/15 text-brand-400 border-brand-400/30' },
};

function riskLevel(winRate: number): { label: string; color: string; bg: string; bars: number } {
  if (winRate >= 65) return { label: 'BAIXO', color: 'text-emerald-400', bg: 'bg-emerald-500', bars: 1 };
  if (winRate >= 50) return { label: 'MÉDIO', color: 'text-amber-400',   bg: 'bg-amber-500',   bars: 2 };
  return               { label: 'ALTO',  color: 'text-red-400',     bg: 'bg-red-500',     bars: 3 };
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function monthsSince(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months < 1) return 'Novo';
  if (months === 1) return '1 mês';
  if (months < 12) return `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 ano' : `${years} anos`;
}

/* ─── Trader Card ─────────────────────────────────────────────────────────── */
function TraderCard({ trader, rank, onFollow }: { trader: Trader; rank: number; onFollow: () => void }) {
  const plan = PLAN_META[trader.plan] ?? PLAN_META.START;
  const PlanIcon = plan.icon;
  const risk = riskLevel(trader.winRate);
  const initials = trader.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const profitPos = trader.totalProfit >= 0;
  const recentPos = trader.recentProfit >= 0;

  const rankColors: Record<number, string> = {
    1: 'text-amber-400',
    2: 'text-slate-300',
    3: 'text-amber-600',
  };

  return (
    <div className="card card-hover group relative overflow-hidden flex flex-col">
      {/* Top gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${plan.gradient} opacity-70`} />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Rank */}
          <span className={`text-xs font-black w-5 text-center ${rankColors[rank] ?? 'text-[var(--text-3)]'}`}>
            #{rank}
          </span>

          {/* Avatar */}
          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center text-white font-black text-sm shadow-lg flex-shrink-0`}>
            {initials}
          </div>

          <div>
            <h3 className="font-bold text-[var(--text-1)] text-[15px] leading-tight">{trader.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3 text-[var(--text-3)]" />
              <span className="text-[11px] text-[var(--text-3)]">{monthsSince(trader.since)} na plataforma</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {/* Plan badge */}
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${plan.badge}`}>
            <PlanIcon className="w-3 h-3" />
            {plan.label}
          </span>
          {/* Status */}
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${trader.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className={`text-[10px] font-semibold ${trader.isActive ? 'text-emerald-400' : 'text-[var(--text-3)]'}`}>
              {trader.isActive ? 'Operando' : 'Inativo'}
            </span>
          </div>
        </div>
      </div>

      {/* Win Rate section */}
      <div className="px-5 pb-4">
        <div className="bg-[var(--bg)] rounded-2xl p-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-0.5">Win Rate</p>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-black num ${trader.winRate >= 60 ? 'text-emerald-400' : trader.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                  {trader.winRate}%
                </span>
                {trader.recentWinRate !== trader.winRate && (
                  <span className={`text-xs font-semibold num ${trader.recentWinRate >= trader.winRate ? 'text-emerald-400' : 'text-red-400'}`}>
                    {trader.recentWinRate >= trader.winRate ? '↑' : '↓'} {trader.recentWinRate}% (30d)
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">W/L</p>
              <p className="text-sm font-bold text-[var(--text-1)] num">{trader.wins}/{trader.losses}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden flex">
            {trader.wins > 0 && (
              <div
                className="h-full bg-emerald-500 rounded-l-full transition-all"
                style={{ width: `${trader.winRate}%` }}
              />
            )}
            {trader.losses > 0 && (
              <div
                className="h-full bg-red-400 rounded-r-full"
                style={{ width: `${100 - trader.winRate}%` }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 pb-4 grid grid-cols-3 gap-2">
        {[
          { icon: BarChart2, label: 'Operações', value: formatNumber(trader.totalTrades), color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { icon: Users,     label: 'Seguidores', value: formatNumber(trader.followerCount), color: 'text-purple-400', bg: 'bg-purple-400/10' },
          { icon: Target,    label: 'Risco',      value: risk.label, color: risk.color, bg: `${risk.bg}/10` },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`rounded-xl p-3 text-center ${bg}`}>
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className={`text-sm font-bold num ${color}`}>{value}</p>
            <p className="text-[9px] text-[var(--text-3)] uppercase tracking-wider mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Profit section */}
      <div className="px-5 pb-4 flex gap-2">
        <div className="flex-1 bg-[var(--bg)] rounded-xl p-3">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Lucro Total</p>
          <div className="flex items-center gap-1 mt-0.5">
            {profitPos ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
            <p className={`text-sm font-bold num ${profitPos ? 'text-emerald-400' : 'text-red-400'}`}>
              {profitPos ? '+' : ''}{trader.currency} {Math.abs(trader.totalProfit).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="flex-1 bg-[var(--bg)] rounded-xl p-3">
          <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Últ. 30 dias</p>
          <div className="flex items-center gap-1 mt-0.5">
            {recentPos ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
            <p className={`text-sm font-bold num ${recentPos ? 'text-emerald-400' : 'text-red-400'}`}>
              {recentPos ? '+' : ''}{trader.currency} {Math.abs(trader.recentProfit).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5 mt-auto">
        <button
          onClick={onFollow}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all
            bg-brand-gradient text-white shadow-lg shadow-brand-500/20
            hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] group/btn"
        >
          <Zap className="w-4 h-4" />
          Seguir este Trader
          <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Loading Skeleton ────────────────────────────────────────────────────── */
function TraderSkeleton() {
  return (
    <div className="card p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-5 h-4 bg-[var(--border)] rounded" />
        <div className="w-11 h-11 bg-[var(--border)] rounded-2xl" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[var(--border)] rounded w-2/3" />
          <div className="h-3 bg-[var(--border)] rounded w-1/2" />
        </div>
      </div>
      <div className="h-20 bg-[var(--border)] rounded-2xl" />
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--border)] rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2].map(i => <div key={i} className="h-14 bg-[var(--border)] rounded-xl" />)}
      </div>
      <div className="h-12 bg-[var(--border)] rounded-xl" />
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function TradersMarketplacePage() {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PlanFilter>('ALL');
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    portalApi.traders()
      .then((data: { traders: Trader[] }) => setTraders(data.traders ?? []))
      .catch(() => setTraders([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? traders : traders.filter(t => t.plan === filter);

  const totalFollowers = traders.reduce((s, t) => s + t.followerCount, 0);
  const avgWinRate = traders.length > 0
    ? Math.round(traders.reduce((s, t) => s + t.winRate, 0) / traders.length)
    : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-80 -right-80 w-[700px] h-[700px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #84cc16 0%, transparent 70%)' }} />
        <div className="absolute -bottom-60 -left-60 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
      </div>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90" aria-label="Robô Auto — início">
            <CopyFyLogo
              iconClassName="h-8 w-auto"
              wordmarkClassName="font-extrabold text-[var(--text-1)] text-base tracking-tight"
            />
          </Link>

          <div className="flex items-center gap-2">
            <button onClick={toggle} className="btn-icon" title="Alternar tema">
              {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-5 py-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-500 border border-brand-500/20">
                  <Activity className="w-3 h-3 animate-pulse" />
                  Ao Vivo
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-1)] tracking-tight leading-tight">
                Top Traders da Corretora
              </h1>
              <p className="text-[var(--text-2)] mt-2 text-base max-w-lg">
                Escolha um operador profissional para copiar automaticamente. Todas as operações são replicadas em tempo real na sua conta.
              </p>
            </div>

            {/* Live stats */}
            {!loading && traders.length > 0 && (
              <div className="flex gap-4 flex-shrink-0">
                {[
                  { label: 'Traders Ativos', value: traders.filter(t => t.isActive).length, icon: CheckCircle, color: 'text-emerald-400' },
                  { label: 'Total Seguidores', value: formatNumber(totalFollowers), icon: Users, color: 'text-blue-400' },
                  { label: 'Win Rate Médio', value: `${avgWinRate}%`, icon: Target, color: 'text-brand-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="text-center px-4 py-3 bg-[var(--bg)] rounded-2xl border border-[var(--border)]">
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                    <p className={`text-lg font-black num ${color}`}>{value}</p>
                    <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="max-w-6xl mx-auto px-5 py-5 w-full flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          {(['ALL', 'ELITE', 'PRO', 'START'] as PlanFilter[]).map(p => {
            const meta = p !== 'ALL' ? PLAN_META[p] : null;
            const Icon = meta?.icon;
            return (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                  filter === p
                    ? p === 'ALL'
                      ? 'bg-[var(--text-1)] text-[var(--bg)] border-[var(--text-1)]'
                      : meta
                        ? `bg-gradient-to-r ${meta.gradient} text-white border-transparent`
                        : ''
                    : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--text-3)]'
                }`}
              >
                {Icon && filter === p && <Icon className="w-3.5 h-3.5" />}
                {p === 'ALL' ? 'Todos' : PLAN_META[p].label}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-[var(--text-3)]">
          {loading ? 'Carregando...' : `${filtered.length} trader${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* ── Trader Grid ── */}
      <main className="flex-1 max-w-6xl mx-auto px-5 pb-10 w-full">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => <TraderSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-[var(--text-3)]" />
            </div>
            <p className="font-bold text-[var(--text-1)] text-lg mb-1">Nenhum trader disponível</p>
            <p className="text-[var(--text-3)] text-sm max-w-xs">
              {filter !== 'ALL'
                ? 'Tente outro plano ou visualize todos os traders.'
                : 'Ainda não há traders cadastrados na plataforma.'}
            </p>
            {filter !== 'ALL' && (
              <button onClick={() => setFilter('ALL')} className="mt-4 btn-brand text-sm px-4 py-2">
                Ver todos
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((trader, index) => (
              <TraderCard
                key={trader.id}
                trader={trader}
                rank={traders.indexOf(trader) + 1}
                onFollow={() => navigate(`/portal/${trader.id}`)}
              />
            ))}
          </div>
        )}

        {/* Info banner */}
        {!loading && filtered.length > 0 && (
          <div className="mt-8 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex items-start gap-3">
            <Shield className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-1)]">Como funciona o Copy Trading?</p>
              <p className="text-xs text-[var(--text-3)] mt-0.5">
                Escolha um trader, clique em <strong className="text-[var(--text-2)]">Seguir</strong> e entre com suas credenciais Bullex.
                Após configurar o valor por operação e ativar o copy, todas as operações do trader serão replicadas automaticamente na sua conta.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-4 text-center">
        <p className="text-[11px] text-[var(--text-3)]">
          🔒 Suas credenciais são criptografadas e usadas apenas para autenticação na Bullex
        </p>
      </footer>
    </div>
  );
}
