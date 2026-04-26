import { prisma } from '../database/prisma.js';

const RESERVED = new Set([
  'api', 'admin', 'login', 'logout', 'dashboard', 'portal', 'me', 'settings',
  'copy', 'trades', 'follower', 'followers', 'master', 'static', 'assets',
  'www', 'cdn', 'app', 'help', 'support', 'status', 'health', 'traders',
]);

/** Normaliza para armazenamento (minúsculas, só a-z, 0-9 e hífens). */
export function normalizePortalSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validatePortalSlug(slug: string): string {
  if (slug.length < 3) throw new Error('Identificador do portal: mínimo 3 caracteres');
  if (slug.length > 40) throw new Error('Identificador do portal: máximo 40 caracteres');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Use apenas letras minúsculas, números e hífens (sem começar/terminar com hífen)');
  }
  if (RESERVED.has(slug)) throw new Error('Este identificador é reservado pelo sistema');
  return slug;
}

/** Garante que nenhum master use um slug igual ao id interno de outra conta (evita confusão nas URLs). */
export async function assertSlugNotConflictingWithMasterIds(slug: string, forUserId: string): Promise<void> {
  const row = await prisma.masterAccount.findUnique({
    where: { id: slug },
    select: { userId: true },
  });
  if (row && row.userId !== forUserId) {
    throw new Error('Este identificador não está disponível');
  }
}

/**
 * Resolve o segmento da URL `/portal/:key` para `master_accounts.id`.
 * 1) Slug configurado no usuário MASTER (match exato normalizado)
 * 2) ID interno do master (retrocompatibilidade)
 */
export async function resolvePortalRouteKey(key: string): Promise<string | null> {
  const trimmed = key.trim();
  if (!trimmed) return null;

  const slugTry = normalizePortalSlug(trimmed);
  if (slugTry.length >= 3) {
    const bySlug = await prisma.user.findFirst({
      where: { role: 'MASTER', portalSlug: slugTry },
      select: { masterAccount: { select: { id: true } } },
    });
    if (bySlug?.masterAccount?.id) return bySlug.masterAccount.id;
  }

  const byId = await prisma.masterAccount.findUnique({ where: { id: trimmed } });
  return byId?.id ?? null;
}
