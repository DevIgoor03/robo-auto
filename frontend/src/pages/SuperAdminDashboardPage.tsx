import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Users, Plus, Trash2, KeyRound, RefreshCw, Mail, User, Moon, Sun, BarChart3, Link2, UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, authApi, tokenStore, type CopyPlanTier } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { DashboardInviteBackdrop } from '../components/layout/DashboardInviteBackdrop';
import { CopyFyMark } from '../components/brand/CopyFyLogo';

interface PlanPublicSpec {
  id: CopyPlanTier;
  name: string;
  emoji: string;
  priceBrlPerUser: number;
  suggestedLimitLabel: string;
  maxFollowers: number | null;
  copyWaveDelayMs: number;
  followersPerWave: number;
  initialCopyDelayMs: number;
  optimizedCopy: boolean;
  priorityServer: boolean;
  vipSupport: boolean;
  earlyAccess: boolean;
  features: string[];
}

interface MasterPlanRow {
  tier: CopyPlanTier;
  name: string;
  emoji: string;
  priceBrlPerUser: number;
  suggestedLimitLabel: string;
  maxFollowers: number | null;
  followerCount: number;
  followerSlotsRemaining: number | null;
  features: string[];
  optimizedCopy: boolean;
  priorityServer: boolean;
  vipSupport: boolean;
}

interface PortalAllowlistEntry {
  id: string;
  bullexEmail: string;
  createdAt: string;
  createdByUserId: string | null;
}

interface MasterRow {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  subscriptionPlan?: CopyPlanTier;
  portalSlug?: string | null;
  plan?: MasterPlanRow;
  masterAccount: null | {
    id: string;
    bullexEmail: string;
    isConnected: boolean;
    copyRunning: boolean;
    balanceReal: number;
    balanceDemo: number;
    currency: string;
    followerCount: number;
    tradeCount: number;
  };
}

const PLAN_ORDER: CopyPlanTier[] = ['START', 'PRO', 'ELITE'];

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createPw, setCreatePw] = useState('');
  const [createPlan, setCreatePlan] = useState<CopyPlanTier>('START');
  const [createBusy, setCreateBusy] = useState(false);

  const [catalog, setCatalog] = useState<PlanPublicSpec[]>([]);
  const [planBusyId, setPlanBusyId] = useState<string | null>(null);
  const [slugDraft, setSlugDraft] = useState<Record<string, string>>({});
  const [slugSavingId, setSlugSavingId] = useState<string | null>(null);

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  const [allowlistUserId, setAllowlistUserId] = useState<string | null>(null);
  const [allowlistMasterName, setAllowlistMasterName] = useState('');
  const [allowlistEntries, setAllowlistEntries] = useState<PortalAllowlistEntry[]>([]);
  const [allowlistLoading, setAllowlistLoading] = useState(false);
  const [allowlistEmail, setAllowlistEmail] = useState('');
  const [allowlistBusy, setAllowlistBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, plansData] = await Promise.all([
        adminApi.listMasters(),
        adminApi.listPlans().catch(() => ({ plans: [] as PlanPublicSpec[] })),
      ]);
      const list = data.masters ?? [];
      setMasters(list);
      setSlugDraft(Object.fromEntries(list.map((m: MasterRow) => [m.id, m.portalSlug ?? ''])));
      if (plansData.plans?.length) setCatalog(plansData.plans);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erro ao carregar masters');
      if (err.response?.status === 401 || err.response?.status === 403) {
        tokenStore.clearTokens();
        navigate('/admin/login', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!allowlistUserId) return;
    setAllowlistLoading(true);
    adminApi.getPortalAllowlist(allowlistUserId)
      .then((d: { entries?: PortalAllowlistEntry[] }) => setAllowlistEntries(d.entries ?? []))
      .catch((err: any) => {
        toast.error(err.response?.data?.error ?? 'Erro ao carregar emails liberados');
        setAllowlistUserId(null);
      })
      .finally(() => setAllowlistLoading(false));
  }, [allowlistUserId]);

  const user = tokenStore.getUser();

  const openAllowlist = (m: MasterRow) => {
    if (!m.masterAccount) {
      toast.error('Este operador ainda não tem conta Bullex no painel — o portal não está ativo.');
      return;
    }
    setAllowlistMasterName(m.name);
    setAllowlistEmail('');
    setAllowlistEntries([]);
    setAllowlistUserId(m.id);
  };

  const handleAddAllowlistEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowlistUserId || !allowlistEmail.trim()) return;
    setAllowlistBusy(true);
    try {
      await adminApi.addPortalAllowlistEmail(allowlistUserId, allowlistEmail.trim());
      toast.success('Email adicionado à lista do portal');
      setAllowlistEmail('');
      const d = await adminApi.getPortalAllowlist(allowlistUserId);
      setAllowlistEntries(d.entries ?? []);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Falha ao adicionar');
    } finally {
      setAllowlistBusy(false);
    }
  };

  const handleRemoveAllowlistEntry = async (entryId: string) => {
    if (!allowlistUserId) return;
    setAllowlistBusy(true);
    try {
      await adminApi.removePortalAllowlistEntry(allowlistUserId, entryId);
      toast.success('Removido da lista');
      setAllowlistEntries((prev) => prev.filter((x) => x.id !== entryId));
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Falha ao remover');
    } finally {
      setAllowlistBusy(false);
    }
  };

  const handleLogout = () => {
    const refresh = tokenStore.getRefresh();
    if (refresh) authApi.logout(refresh).catch(() => {});
    tokenStore.clearTokens();
    navigate('/admin/login', { replace: true });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateBusy(true);
    try {
      await adminApi.createMaster(createEmail.trim(), createPw, createName.trim(), createPlan);
      toast.success('Conta master criada. O operador pode entrar em /login');
      setShowCreate(false);
      setCreateEmail('');
      setCreateName('');
      setCreatePw('');
      setCreatePlan('START');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Falha ao criar');
    } finally {
      setCreateBusy(false);
    }
  };

  const handleDelete = async (row: MasterRow) => {
    if (!window.confirm(`Excluir permanentemente "${row.name}" (${row.email})? Isso remove seguidores e histórico associados.`)) return;
    try {
      await adminApi.deleteMaster(row.id);
      toast.success('Conta removida');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Falha ao excluir');
    }
  };

  const savePortalSlug = async (userId: string) => {
    const raw = (slugDraft[userId] ?? '').trim();
    setSlugSavingId(userId);
    try {
      await adminApi.updateMasterPortalSlug(userId, raw === '' ? null : raw);
      toast.success(raw ? 'Identificador do portal salvo' : 'Removido — o operador pode usar o link com ID interno');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Falha ao salvar o link');
    } finally {
      setSlugSavingId(null);
    }
  };

  const handlePlanChange = async (userId: string, tier: CopyPlanTier) => {
    setPlanBusyId(userId);
    try {
      await adminApi.updateMasterPlan(userId, tier);
      toast.success(`Plano alterado para ${tier}`);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Falha ao alterar plano');
    } finally {
      setPlanBusyId(null);
    }
  };

  const handleResetPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId) return;
    setResetBusy(true);
    try {
      await adminApi.resetMasterPassword(resetUserId, newPw);
      toast.success('Senha atualizada. O operador precisa entrar de novo.');
      setResetUserId(null);
      setNewPw('');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Falha ao alterar senha');
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <DashboardInviteBackdrop variant={isDark ? 'dark' : 'light'} />
      <header
        className={`relative z-10 flex min-h-14 flex-shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 backdrop-blur-xl sm:h-14 sm:flex-nowrap sm:px-6 sm:py-0 ${
          isDark
            ? 'border-b border-white/[0.1] bg-[#212B36]/92 backdrop-blur-md'
            : 'border-b border-gray-200/90 bg-white/80'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center" title="Robô Auto">
            <CopyFyMark className="h-8 w-auto" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[var(--text-1)] font-bold text-sm truncate">Super Admin</h1>
            <p className="text-[var(--text-3)] text-xs truncate">Contas master da plataforma</p>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
          <span className="hidden max-w-[140px] truncate text-xs text-[var(--text-3)] sm:inline">{user?.email}</span>
          <button type="button" onClick={toggle} className="btn-icon" title="Tema">
            {isDark ? <Sun className="h-4 w-4 text-yellow-400" /> : <Moon className="h-4 w-4" />}
          </button>
          <button type="button" onClick={load} className="btn-icon" title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 sm:px-3"
          >
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 space-y-4 overflow-y-auto p-3 sm:space-y-5 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-1)] sm:text-xl">Operadores (masters)</h2>
            <p className="mt-0.5 text-sm text-[var(--text-2)]">
              {masters.length} conta(s). Painel em <span className="font-mono text-brand-600 dark:text-brand-400">/login</span>
              <span className="hidden sm:inline"> e conexão Bullex depois</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[oklch(0.62_0.20_152)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
            style={{ boxShadow: '0 8px 24px oklch(0.62 0.20 152 / 0.28)' }}
          >
            <Plus className="h-4 w-4" /> Nova conta master
          </button>
        </div>

        {catalog.length > 0 && (
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-1)] flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[oklch(0.62_0.20_152)]" /> Catálogo de planos
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {catalog.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-sm"
                >
                  <p className="font-bold text-[var(--text-1)]">
                    {p.emoji} {p.name}{' '}
                    <span className="text-[var(--text-3)] font-normal">R$ {p.priceBrlPerUser}/mês</span>
                  </p>
                  <p className="text-xs text-[var(--text-3)] mt-1">{p.suggestedLimitLabel}</p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--text-2)] list-disc list-inside">
                    {p.features.slice(0, 4).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-[var(--text-3)] text-sm">Carregando…</div>
          ) : masters.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-[var(--text-3)] mx-auto mb-3" />
              <p className="text-[var(--text-1)] font-semibold mb-1">Nenhuma conta master</p>
              <p className="text-sm text-[var(--text-3)] mb-4">Crie a primeira para liberar o login dos operadores.</p>
              <button type="button" onClick={() => setShowCreate(true)} className="btn-brand px-5 py-2.5 text-sm">Criar conta master</button>
            </div>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
                    <th className="text-left font-semibold text-[var(--text-2)] px-4 py-3">Operador</th>
                    <th className="text-left font-semibold text-[var(--text-2)] px-4 py-3">
                      <span className="inline-flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Portal</span>
                    </th>
                    <th className="text-left font-semibold text-[var(--text-2)] px-4 py-3">Plano</th>
                    <th className="text-left font-semibold text-[var(--text-2)] px-4 py-3">Bullex (painel)</th>
                    <th className="text-left font-semibold text-[var(--text-2)] px-4 py-3">Seguidores</th>
                    <th className="text-left font-semibold text-[var(--text-2)] px-4 py-3">Trades</th>
                    <th className="text-left font-semibold text-[var(--text-2)] px-4 py-3">Status</th>
                    <th className="text-right font-semibold text-[var(--text-2)] px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {masters.map((m) => (
                    <tr key={m.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]/80">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--text-1)]">{m.name}</p>
                        <p className="text-xs text-[var(--text-3)] flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{m.email}</p>
                      </td>
                      <td className="px-4 py-3 align-top max-w-[200px]">
                        <p className="text-[10px] text-[var(--text-3)] font-mono truncate mb-1" title="/portal/…">
                          /portal/
                          <span className="text-[var(--text-2)]">{slugDraft[m.id]?.trim() || m.portalSlug || '…'}</span>
                        </p>
                        <div className="flex gap-1">
                          <input
                            className="field text-xs py-1 flex-1 min-w-0"
                            placeholder="ex: copyhelio123"
                            value={slugDraft[m.id] ?? ''}
                            onChange={(e) => setSlugDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                          />
                          <button
                            type="button"
                            disabled={slugSavingId === m.id}
                            onClick={() => { void savePortalSlug(m.id); }}
                            className="flex-shrink-0 rounded-lg bg-[oklch(0.62_0.20_152)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50 hover:brightness-110"
                          >
                            OK
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-[var(--text-1)]">
                            {m.plan?.emoji ?? '🟢'} {m.plan?.name ?? m.subscriptionPlan ?? 'START'}
                          </p>
                          <p className="text-[10px] text-[var(--text-3)] leading-tight">
                            {m.plan?.maxFollowers == null
                              ? `${m.plan?.followerCount ?? m.masterAccount?.followerCount ?? 0} seguidores (ilimitado)`
                              : `${m.plan?.followerCount ?? m.masterAccount?.followerCount ?? 0} / ${m.plan.maxFollowers} slots`}
                          </p>
                          <select
                            className="field text-xs py-1 max-w-[9rem]"
                            value={m.subscriptionPlan ?? 'START'}
                            disabled={planBusyId === m.id}
                            onChange={(e) => {
                              const v = e.target.value as CopyPlanTier;
                              if (v === (m.subscriptionPlan ?? 'START')) return;
                              void handlePlanChange(m.id, v);
                            }}
                          >
                            {PLAN_ORDER.map((id) => (
                              <option key={id} value={id}>{id}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-2)]">
                        {m.masterAccount ? (
                          <span className="text-xs font-mono">{m.masterAccount.bullexEmail}</span>
                        ) : (
                          <span className="text-[var(--text-3)] text-xs">Ainda não conectou Bullex</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-1)]">{m.masterAccount?.followerCount ?? 0}</td>
                      <td className="px-4 py-3 text-[var(--text-1)] tabular-nums">{m.masterAccount?.tradeCount ?? 0}</td>
                      <td className="px-4 py-3">
                        {!m.masterAccount ? (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Só login criado</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className={m.masterAccount.isConnected ? 'text-xs font-medium text-[oklch(0.72_0.18_155)]' : 'text-xs text-[var(--text-3)]'}>
                              {m.masterAccount.isConnected ? 'Corretora OK' : 'Desconectado'}
                            </span>
                            {m.masterAccount.copyRunning && (
                              <span className="text-[10px] font-medium text-[oklch(0.62_0.20_152)]">Copy ativo</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openAllowlist(m)}
                            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-2)] hover:border-[oklch(0.62_0.20_152/0.4)]"
                            title="Emails Bullex liberados no portal"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setResetUserId(m.id); setNewPw(''); }}
                            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-2)] hover:border-[oklch(0.62_0.20_152/0.4)]"
                            title="Redefinir senha do painel"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(m)}
                            className="p-2 rounded-lg border border-[var(--border)] hover:border-red-500/40 text-red-500"
                            title="Excluir conta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--text-1)]"><User className="h-5 w-5 text-[oklch(0.62_0.20_152)]" /> Nova conta master</h3>
            <p className="text-xs text-[var(--text-3)]">O operador usará estes dados em <strong>/login</strong> (painel master). A conexão Bullex ele faz depois no dashboard.</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Nome</label>
                <input className="field w-full" value={createName} onChange={(e) => setCreateName(e.target.value)} required minLength={2} placeholder="Nome do operador" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Email (login)</label>
                <input type="email" className="field w-full" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Senha (mín. 8)</label>
                <input type="password" className="field w-full" value={createPw} onChange={(e) => setCreatePw(e.target.value)} required minLength={8} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Plano inicial</label>
                <select
                  className="field w-full text-sm"
                  value={createPlan}
                  onChange={(e) => setCreatePlan(e.target.value as CopyPlanTier)}
                >
                  {PLAN_ORDER.map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)]">Cancelar</button>
                <button type="submit" disabled={createBusy} className="flex-1 rounded-xl bg-[oklch(0.62_0.20_152)] py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60">Criar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {allowlistUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-[var(--text-1)] flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-[oklch(0.62_0.20_152)]" /> Portal — emails liberados
            </h3>
            <p className="text-xs text-[var(--text-3)]">
              Só quem estiver nesta lista consegue entrar no <span className="font-mono">/portal/…</span> deste operador com o email Bullex indicado.
              <span className="block mt-1 font-medium text-[var(--text-2)]">{allowlistMasterName}</span>
            </p>
            <form onSubmit={handleAddAllowlistEmail} className="flex gap-2 flex-wrap items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Email Bullex do seguidor</label>
                <input
                  type="email"
                  className="field w-full text-sm"
                  value={allowlistEmail}
                  onChange={(e) => setAllowlistEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  disabled={allowlistBusy}
                />
              </div>
              <button
                type="submit"
                disabled={allowlistBusy || !allowlistEmail.trim()}
                className="rounded-xl bg-[oklch(0.62_0.20_152)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                Adicionar
              </button>
            </form>
            <div className="border border-[var(--border)] rounded-xl overflow-hidden">
              {allowlistLoading ? (
                <p className="p-4 text-sm text-[var(--text-3)] text-center">Carregando…</p>
              ) : allowlistEntries.length === 0 ? (
                <p className="p-4 text-sm text-[var(--text-3)] text-center">Nenhum email liberado ainda.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] text-sm">
                  {allowlistEntries.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <span className="font-mono text-[var(--text-1)] truncate" title={row.bullexEmail}>{row.bullexEmail}</span>
                      <button
                        type="button"
                        disabled={allowlistBusy}
                        onClick={() => { void handleRemoveAllowlistEntry(row.id); }}
                        className="flex-shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-500/10"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setAllowlistUserId(null); setAllowlistEntries([]); }}
              className="w-full py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-2)]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {resetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--text-1)]"><KeyRound className="h-5 w-5 text-[oklch(0.62_0.20_152)]" /> Nova senha do painel</h3>
            <form onSubmit={handleResetPw} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Nova senha (mín. 8)</label>
                <input type="password" className="field w-full" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setResetUserId(null); setNewPw(''); }} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold">Cancelar</button>
                <button type="submit" disabled={resetBusy} className="flex-1 rounded-xl bg-[oklch(0.62_0.20_152)] py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
