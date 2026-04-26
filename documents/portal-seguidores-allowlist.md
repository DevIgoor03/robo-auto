# Liberação de seguidores no portal (email Bullex)

## Fluxo

1. Após a compra do copytrade, o seguidor envia ao **super admin** o **email da conta Bullex** que usará no portal.
2. No painel **Super Admin**, em cada operador (master) com conta Bullex já conectada, use o botão **emails liberados** (ícone de usuário com check).
3. Adicione o email Bullex (normalizado em minúsculas). Só emails presentes nessa lista conseguem fazer login em `/portal/{slug ou id}` daquele master.
4. Se remover um email da lista, o seguidor deixa de conseguir novas requisições autenticadas (sessão invalidada no próximo uso do token).

## Migração

A migration `20260402160000_follower_portal_allowlist` cria a tabela `follower_portal_allowlist` e **pré-preenche** com os emails já existentes em `follower_accounts`, para não bloquear quem já era seguidor.

## API (admin, JWT ADMIN)

- `GET /api/admin/masters/:userId/portal-allowlist` — lista entradas.
- `POST /api/admin/masters/:userId/portal-allowlist` — body `{ "bullexEmail": "..." }`.
- `DELETE /api/admin/masters/:userId/portal-allowlist/:entryId` — remove entrada.

`:userId` é o **id do usuário master** (mesmo da listagem de operadores), não o `master_accounts.id`.

## Portal

- Login: `POST /api/portal/:routeKey/login` retorna **403** com mensagem clara se o email não estiver na lista (`code: PORTAL_NOT_ALLOWLISTED`).
- Chamadas com `x-portal-token`: se o email foi revogado da lista, resposta **403** (`code: PORTAL_ALLOWLIST_REVOKED`).

## Erro “table follower_portal_allowlist does not exist”

A migration não foi aplicada no Postgres. No diretório `backend`:

```bash
npx prisma migrate deploy
```

Se o Prisma acusar **migration failed** ou **P3009** porque uma migration antiga ficou “falhada” no histórico, mas o SQL dela **já foi aplicado** manualmente ou por outro deploy (ex.: coluna já existe), marque como aplicada e rode de novo o deploy:

```bash
npx prisma migrate resolve --applied NOME_DA_PASTA_DA_MIGRATION
npx prisma migrate deploy
```

Substitua `NOME_DA_PASTA_DA_MIGRATION` pelo nome exato da pasta em `prisma/migrations/` (ex.: `20260402120000_master_dashboard_session`).
