import { CopyPlan } from '@prisma/client';
import { prisma } from '../database/prisma.js';

export type PlanTier = 'START' | 'PRO' | 'ELITE';

export interface PlanPublicSpec {
  id: PlanTier;
  name: string;
  emoji: string;
  priceBrlPerUser: number;
  suggestedLimitLabel: string;
  maxFollowers: number | null;
  /** Atraso entre “ondas” de cópia para seguidores (simula prioridade). */
  copyWaveDelayMs: number;
  /** Quantos seguidores copiam em paralelo por onda. */
  followersPerWave: number;
  /** Atraso extra antes da primeira onda (START mais lento). */
  initialCopyDelayMs: number;
  optimizedCopy: boolean;
  priorityServer: boolean;
  vipSupport: boolean;
  earlyAccess: boolean;
  features: string[];
}

export const PLAN_CATALOG: Record<PlanTier, PlanPublicSpec> = {
  START: {
    id: 'START',
    name: 'START',
    emoji: '🟢',
    priceBrlPerUser: 57,
    suggestedLimitLabel: 'até 10 seguidores',
    maxFollowers: 10,
    copyWaveDelayMs: 380,
    followersPerWave: 2,
    initialCopyDelayMs: 180,
    optimizedCopy: false,
    priorityServer: false,
    vipSupport: false,
    earlyAccess: false,
    features: [
      'Copy trade padrão',
      'Execução em tempo real',
      'Acesso à plataforma',
      'Suporte básico',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'PRO',
    emoji: '🔵',
    priceBrlPerUser: 80,
    suggestedLimitLabel: 'até 20 seguidores',
    maxFollowers: 20,
    copyWaveDelayMs: 120,
    followersPerWave: 6,
    initialCopyDelayMs: 40,
    optimizedCopy: true,
    priorityServer: true,
    vipSupport: false,
    earlyAccess: false,
    features: [
      'Copy trade otimizado',
      'Execução mais rápida (menor delay)',
      'Prioridade no processamento',
      'Mais estabilidade nas operações',
      'Suporte prioritário',
    ],
  },
  ELITE: {
    id: 'ELITE',
    name: 'ELITE',
    emoji: '🟣',
    priceBrlPerUser: 110,
    suggestedLimitLabel: 'seguidores ilimitados',
    maxFollowers: null,
    copyWaveDelayMs: 0,
    followersPerWave: 999,
    initialCopyDelayMs: 0,
    optimizedCopy: true,
    priorityServer: true,
    vipSupport: true,
    earlyAccess: true,
    features: [
      'Copy ultra rápido',
      'Prioridade máxima nas execuções',
      'Menor latência possível',
      'Fila dedicada / prioritária',
      'Suporte VIP',
      'Acesso antecipado a melhorias',
    ],
  },
};

function toTier(p: CopyPlan): PlanTier {
  return p as PlanTier;
}

export class PlanService {
  spec(plan: CopyPlan): PlanPublicSpec {
    return PLAN_CATALOG[toTier(plan)];
  }

  catalogList(): PlanPublicSpec[] {
    return [PLAN_CATALOG.START, PLAN_CATALOG.PRO, PLAN_CATALOG.ELITE];
  }

  async getPlanForMasterId(masterId: string): Promise<{ userId: string; plan: CopyPlan; spec: PlanPublicSpec }> {
    const row = await prisma.masterAccount.findUnique({
      where:   { id: masterId },
      select:  { userId: true, user: { select: { subscriptionPlan: true } } },
    });
    if (!row) throw new Error('Master não encontrado');
    const plan = row.user.subscriptionPlan;
    return { userId: row.userId, plan, spec: this.spec(plan) };
  }

  async getFollowerCount(masterId: string): Promise<number> {
    return prisma.followerAccount.count({ where: { masterId } });
  }

  /** Lança erro se não puder adicionar novo seguidor (limite do plano). */
  async assertCanAddFollower(masterId: string): Promise<void> {
    const { plan, spec } = await this.getPlanForMasterId(masterId);
    if (spec.maxFollowers === null) return;
    const n = await this.getFollowerCount(masterId);
    if (n >= spec.maxFollowers) {
      throw new Error(
        `Limite do plano ${plan} atingido (${spec.maxFollowers} seguidores). Faça upgrade com o administrador.`
      );
    }
  }
}

export const planService = new PlanService();
