# CopyTrader — Documentação Completa do Sistema

## 1. Visão Geral

O CopyTrader é uma plataforma de copy trade para operações em Bullex, com três superfícies principais:

- **Painel Master**: operador conecta conta, liga/desliga copy, gerencia seguidores, acompanha histórico e performance.
- **Portal do Seguidor**: seguidor faz login, configura parâmetros e ativa/desativa o copy por conta própria.
- **Admin**: gestão de masters, plano de assinatura, slug do portal e manutenção operacional.

Arquitetura geral:

- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL + Redis + Socket.IO + BullMQ
- **Frontend**: React + Vite + TypeScript + Tailwind + Axios + Socket.IO client
- **Integração trading**: `@quadcode-tech/client-sdk-js` (Bullex API + WebSocket)

---

## 2. Stack Técnica

## Backend

- Runtime: Node.js
- API: Express 4
- Banco: PostgreSQL (Prisma)
- Cache/fila/adaptador real-time: Redis + BullMQ + Socket.IO Redis Adapter
- Auth: JWT access/refresh + sessão de portal por token próprio
- Validação: Zod
- Logging: Pino

## Frontend

- React 18 + TypeScript
- Vite 5
- React Router 6
- Tailwind CSS
- Axios para API
- `socket.io-client` para updates em tempo real

---

## 3. Módulos Funcionais

## 3.1 Autenticação

- Login master/admin com JWT (`/api/auth/login`)
- Refresh token (`/api/auth/refresh`)
- Logout e limpeza de sessão (`/api/auth/logout`)
- Perfil autenticado (`/api/auth/me`)

## 3.2 Gestão de Conta Master

- Conectar credenciais Bullex no backend
- Desconectar conta master
- Iniciar/parar mecanismo de copy
- Estado consolidado do dashboard (`/api/accounts/status`)

## 3.3 Gestão de Seguidores

- Criar, atualizar configurações e remover seguidores
- Limite por plano (START/PRO/ELITE)
- Ativação de copy do seguidor controlada no portal (regra de negócio)

## 3.4 Copy Trade Engine

- Escuta posições do master
- Replica para seguidores ativos
- Idempotência para evitar duplicidade
- Resolução de trade por evento real da posição do seguidor

## 3.5 Portal do Seguidor

- Login por rota pública do master (`/portal/:masterId` ou slug)
- Configuração de copy (modo/valor/conta/stops)
- Toggle de ativação do copy
- Histórico paginado e resumo de sessão

## 3.6 Marketplace de Traders

- Endpoint público com top 5 traders (`/api/portal/traders`)
- Métricas de win rate, lucro, volume, seguidores e plano

## 3.7 Painel Admin

- Listar planos
- Listar/editar masters
- Criar/remover master
- Trocar senha
- Alterar slug de portal

---

## 4. Fluxos de Usuário

## 4.1 Fluxo Master

1. Login no sistema.
2. Conectar conta Bullex.
3. Adicionar seguidores.
4. Iniciar copy.
5. Acompanhar operação em tempo real e histórico.

## 4.2 Fluxo Seguidor

1. Acessar `/traders`.
2. Escolher trader e ir para `/portal/:id-ou-slug`.
3. Login com credenciais Bullex.
4. Configurar copy.
5. Ativar copy.
6. Acompanhar dashboard (sessão) e histórico completo.

## 4.3 Fluxo Admin

1. Login admin.
2. Gerenciar usuários master.
3. Ajustar plano e slug.
4. Monitorar estado geral da operação.

---

## 5. Backend: Estrutura e Responsabilidades

## 5.1 Bootstrap (`backend/src/index.ts`)

- Inicializa Express, CORS, Helmet, JSON parser e logger
- Conecta Redis
- Inicializa Socket.IO e adapter Redis (se disponível)
- Conecta banco e garante super admin inicial
- Sobe rotas:
  - `/api/auth`
  - `/api/accounts`
  - `/api/trades`
  - `/api/portal`
  - `/api/admin`
- Endpoints utilitários:
  - `GET /api/health`
  - `GET /api/admin/queue-stats` (admin)

## 5.2 Serviços principais

- `AuthService`: JWT, refresh, sessão, bootstrap de admin
- `AccountService`: conexão master/follower no SDK, saldos, sessão de follower
- `CopyTradeService`: núcleo de replicação e resolução de trades
- `PlanService`: catálogo e enforcement de limites por plano
- `QueueService`: fila/estatísticas com BullMQ

---

## 6. API REST (Resumo por área)

## 6.1 Auth (`/api/auth`)

- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`
- `GET /me`

## 6.2 Accounts Master/Followers (`/api/accounts`)

- `POST /master/connect`
- `DELETE /master`
- `GET /status`
- `POST /copy/start`
- `POST /copy/stop`
- `POST /session/reset` (bloqueado para master, retorna 403)
- `POST /followers`
- `PATCH /followers/:id`
- `DELETE /followers/:id`
- `DELETE /history`
- `GET /follower/:followerId/balances`
- `POST /followers/reactivate-all` (endpoint de recuperação)

## 6.3 Trades (`/api/trades`)

- `GET /api/trades`
- `GET /api/trades/summary`

## 6.4 Portal (`/api/portal`)

- `POST /:masterId/login`
- `GET /me`
- `POST /copy/toggle`
- `PATCH /settings`
- `GET /trades`
- `POST /logout`
- `GET /traders` (público, marketplace)

## 6.5 Admin (`/api/admin`)

- `GET /plans`
- `GET /masters`
- `POST /masters`
- `PATCH /masters/:userId/portal-slug`
- `PATCH /masters/:userId/plan`
- `PATCH /masters/:userId/password`
- `DELETE /masters/:userId`

---

## 7. Copy Trade Engine (Detalhamento)

## 7.1 Start/Stop

- Ao iniciar:
  - valida conexão do master
  - inicializa sessão de dashboard
  - cria token de sessão em memória (evita callbacks antigos)
  - snapshot de posições já abertas para não duplicar no bootstrap

- Ao parar:
  - invalida token de sessão
  - limpa estruturas de posição conhecidas
  - marca `copyRunning=false`

## 7.2 Replicação

- Captura nova posição do master (Blitz/Turbo)
- Determina seguidores ativos
- Executa em ondas conforme plano:
  - START: mais lento e menos paralelismo
  - PRO: intermediário
  - ELITE: prioridade máxima
- Calcula valor por modo:
  - `fixed`
  - `multiplier`
  - `proportional`

## 7.3 Idempotência e Anti-duplicação

- Lock por chave de cópia em memória
- Verificação no banco por `masterPositionId + followerId`
- Ignora replay histórico recebido no início da sessão

## 7.4 Resolução de resultado (estado atual)

O fechamento usa o evento da posição real do seguidor, evitando inconsistências:

- `win` -> `WIN`
- `loss` / `loose` -> `LOSS`
- `expired` / `cancel` / `manual` / `manual-close` -> `DRAW`

Com isso:

- evita “win antes de terminar”
- evita “empate mostrado como win”

---

## 8. Sessão e Regras de Negócio

- Master não reseta sessão por endpoint dedicado (bloqueado)
- Ativação/desativação do copy do seguidor ocorre no portal do seguidor
- Quando seguidor ativa copy:
  - nova sessão de stats do seguidor inicia em `sessionStartedAt`
  - dashboard session do master é reiniciada (`dashboardSessionStartedAt`)
- Histórico completo continua no banco; recortes de dashboard são por sessão

---

## 9. Modelo de Dados (Prisma)

Entidades principais:

- `User` (roles: `MASTER`, `ADMIN`)
- `MasterAccount`
- `FollowerAccount`
- `Trade`
- `RefreshSession`
- `PortalSession`

Enums principais:

- `CopyPlan`: `START`, `PRO`, `ELITE`
- `CopyMode`: `FIXED`, `MULTIPLIER`, `PROPORTIONAL`
- `AccountType`: `REAL`, `DEMO`

Campos críticos:

- `MasterAccount.dashboardSessionStartedAt`
- `FollowerAccount.sessionStartedAt`
- `Trade.masterPositionId`
- `Trade.positionId`
- `Trade.status` (inclui `DRAW` em runtime)

---

## 10. Planos Comerciais e Limites

Definições em `PlanService`:

- **START**: até 10 seguidores
- **PRO**: até 20 seguidores
- **ELITE**: ilimitado

Além de limite, plano define perfil de execução:

- delay inicial
- delay entre ondas
- seguidores por onda

Isso impacta latência de replicação e priorização operacional.

---

## 11. Frontend: Estrutura de Páginas

- `LoginPage`: autenticação master
- `AdminLoginPage`: autenticação admin
- `DashboardPage`: painel master
- `SuperAdminDashboardPage`: painel admin
- `TradersMarketplacePage`: vitrine dos top traders
- `FollowerPortalPage`: portal do seguidor

Rotas centrais:

- `/login`
- `/admin/login`
- `/dashboard`
- `/admin`
- `/traders`
- `/portal/:masterId`

---

## 12. Clientes HTTP no Frontend

## `api.ts`

- Armazena access/refresh token no `localStorage`
- Interceptor de request adiciona `Authorization: Bearer`
- Interceptor de response faz auto-refresh em `401 TOKEN_EXPIRED`
- Redireciona para login quando refresh falha

## `portalApi.ts`

- Usa token separado (`x-portal-token`)
- Operações específicas do portal do seguidor
- Endpoint de marketplace (`traders`)

---

## 13. Real-time (Socket.IO)

Backend:

- autentica socket por JWT
- usuário entra em sala `master:{masterId}`

Eventos principais:

- `copy:started`
- `copy:stopped`
- `trade:new`
- `trade:updated`
- `follower:updated`
- `follower:stopped`
- `master:balance`

Objetivo:

- manter dashboard sincronizado sem polling agressivo

---

## 14. Segurança

- Helmet + CORS restritivo
- Rate limit por janela
- JWT access/refresh
- Sessão de portal com token próprio e expiração
- Senhas Bullex armazenadas criptografadas
- Sanitização/validação de payload com Zod

Recomendações contínuas:

- rotacionar secrets em produção
- reforçar política de senha admin
- mascarar dados sensíveis em logs

---

## 15. Configuração e Ambiente

Variáveis importantes:

- `PORT`
- `FRONTEND_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY`
- `BULLEX_API_URL`
- `BULLEX_WS_URL`
- `BULLEX_PLATFORM_ID`
- `RATE_LIMIT_*`

Portas padrão:

- Backend: `3001`
- Frontend (Vite): `5173`
- PostgreSQL local (compose dev): `5433`
- Redis local: `6379`

---

## 16. Execução Local

## Backend

```bash
cd backend
npm install
npm run dev
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 17. Build e Deploy (resumo operacional)

Fluxo recomendado para alterações:

1. Type-check backend e frontend
2. Build sem cache de imagens
3. Subir containers limpos
4. Validar logs
5. Testar fluxos críticos (master, follower, portal, admin)

Comandos de referência:

```bash
docker build --no-cache -t copytrader-backend:latest -f backend/Dockerfile backend
docker build --no-cache -t copytrader-frontend:latest -f frontend/Dockerfile frontend
```

Observação:

- Em ambiente com Docker Compose, preferir reconstrução `--no-cache`.

---

## 18. Monitoramento e Troubleshooting

## Verificações rápidas

- `GET /api/health`
- logs backend (erros de Bullex, reconexão, resolução de trade)
- estado Redis e fila

## Sintomas comuns e causa provável

- **Tela preta frontend**: erro runtime de hook/render
- **Trade duplicado**: falha de idempotência/locks
- **Resultado incorreto (draw/win)**: resolução por evento errado
- **Falha no login Bullex**: indisponibilidade API externa ou rate limit

---

## 19. Limitações Conhecidas

- Dependência de disponibilidade dos endpoints Bullex
- Recuperação automática de conexões é conservadora para evitar bloqueio de IP
- Parte de endpoints legados pode coexistir com regras novas (ex.: reativação em massa)

---

## 20. Checklist de Aceite (produção)

- [ ] Autenticação master/admin funcionando
- [ ] Conexão Bullex do master estabelecida
- [ ] Cadastro de seguidor funcionando
- [ ] Portal login e toggle de copy funcionando
- [ ] Replicação de operações sem duplicidade
- [ ] Resultado de trade correto (`WIN/LOSS/DRAW`)
- [ ] Dashboard atualizado em tempo real
- [ ] Logs sem erros críticos
- [ ] Build/containers sem cache concluídos com sucesso

