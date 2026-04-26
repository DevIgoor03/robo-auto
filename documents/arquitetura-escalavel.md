# CopyTrader — Arquitetura Escalável

**Data:** 2026-03-20  
**Versão:** 2.0.0-scalable

---

## Stack Tecnológico

| Camada | Tecnologia | Finalidade |
|--------|-----------|-----------|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind | UI moderna, dark mode, portal |
| **Backend** | Node.js + Express + TypeScript | API REST + Socket.IO |
| **Banco de dados** | PostgreSQL 16 + Prisma ORM v5 | Persistência multi-tenant |
| **Cache/Queue** | Redis 7 + BullMQ | Jobs resilientes, escalabilidade |
| **Real-time** | Socket.IO + Redis Adapter | WebSocket clusterizado |
| **Autenticação** | JWT (access 15min + refresh 7d) | Sessões seguras |
| **SDK** | @quadcode-tech/client-sdk-js | Bullex integration |

---

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                  │
├──────────────────────┬──────────────────────────────────────────┤
│  Dashboard (React)   │  Portal Seguidores (React /portal/:id)   │
│  JWT auth            │  Portal Token (x-portal-token)           │
└──────────┬───────────┴──────────────────┬───────────────────────┘
           │ HTTPS/WebSocket              │ HTTPS
           ▼                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BACKEND (Express)                             │
│                                                                   │
│  /api/auth/*         → AuthService (JWT, bcrypt)                 │
│  /api/accounts/*     → AccountService (Bullex SDK, multi-tenant)│
│  /api/trades/*       → CopyTradeService (trade history)          │
│  /api/portal/:id/*   → Portal routes (seguidores self-service)   │
│                                                                   │
│  Socket.IO ──── Redis Adapter (clusterizável)                    │
│                                                                   │
│  AccountService                                                   │
│  ├── masterConnections: Map<masterId, SdkEntry>                  │
│  └── followerConnections: Map<followerId, FollowerConn>          │
│                                                                   │
│  CopyTradeService                                                 │
│  ├── runningMasters: Map<masterId, boolean>                      │
│  ├── Replica posições Master → Followers (parallel)              │
│  └── Resolve trades (Win/Loss/Equal) → DB + Socket              │
│                                                                   │
│  QueueService (BullMQ)                                           │
│  ├── copy-trades (3 retries, exponential backoff)                │
│  └── resolve-trades (3 retries, fixed delay)                     │
└──────────────┬───────────────────────────────┬───────────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────┐            ┌─────────────────────┐
│    PostgreSQL 16     │            │      Redis 7         │
│                      │            │                      │
│  users               │            │  Socket.IO adapter   │
│  master_accounts     │            │  BullMQ queues       │
│  follower_accounts   │            │  (rate limiting)     │
│  trades              │            │                      │
│  refresh_sessions    │            └─────────────────────┘
│  portal_sessions     │
└─────────────────────┘
```

---

## Segurança Implementada

- **JWT**: Access token 15min + Refresh token 7 dias (rotativo)
- **bcrypt**: Custo 12 para hash de senhas do sistema
- **AES-256-CBC**: Credenciais Bullex criptografadas em repouso
- **Helmet**: Headers HTTP de segurança
- **Rate limiting**: 100 req/min geral, 10 req/min em auth/portal
- **Zod**: Validação de schema em todas as rotas
- **CORS**: Restrito ao frontend URL configurado
- **Socket.IO auth**: JWT obrigatório para conectar
- **Rooms isolados**: `master:{id}` — cada master só recebe seus eventos

---

## Multi-tenancy

```
User A (master)
└── MasterAccount A
    ├── FollowerAccount A1 (portal: /portal/{masterId-A})
    ├── FollowerAccount A2
    └── Trades de A

User B (master)
└── MasterAccount B
    ├── FollowerAccount B1 (portal: /portal/{masterId-B})
    └── Trades de B
```

Cada master opera em isolamento completo:
- Socket.IO rooms separadas
- Dados no DB com `masterId` como foreign key
- AccountService mapeia conexões por `masterId`

---

## Escalabilidade Horizontal

Com Redis configurado, é possível rodar **múltiplas instâncias** do backend:

```
Load Balancer (Nginx)
      ├── Backend Instance 1
      ├── Backend Instance 2  ──── Redis (Socket.IO adapter)
      └── Backend Instance 3       └── BullMQ workers
              │
         PostgreSQL (single ou replicado)
```

---

## Fluxo de Copy Trading

```
Master abre posição
      │
      ▼
CopyTradeService.subscribeOnUpdatePosition()
      │
      ├── Salva trade master no DB (result: PENDING)
      ├── Emite trade:new via Socket.IO (room do master)
      │
      └── Para cada follower ativo:
          ├── Verifica Stop Win / Stop Loss
          ├── Calcula valor (FIXED | % master | % saldo)
          ├── Compra opção via Bullex SDK
          ├── Salva trade follower no DB
          └── Atualiza stats do seguidor

Master fecha posição (win/loss/equal)
      │
      ▼
_resolveTrade()
      ├── Atualiza DB (result, profit, closeTime)
      ├── Emite trade:updated via Socket.IO
      ├── Atualiza stats do seguidor (wins, losses, profit)
      ├── Atualiza saldo via SDK
      └── Verifica Stop Win/Loss automático
```

---

## Variáveis de Ambiente

```env
# Servidor
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://copytrader.seudominio.com

# Banco de Dados
DATABASE_URL=postgresql://user:pass@localhost:5432/copytrader

# Redis
REDIS_URL=redis://:senha@localhost:6379

# JWT (gere com: openssl rand -hex 64)
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Criptografia Bullex
ENCRYPTION_KEY=...

# Rate Limiting
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=10
```

---

## Como Executar (Desenvolvimento)

```bash
# 1. Iniciar PostgreSQL + Redis
docker-compose up -d

# 2. Backend
cd backend
cp .env.example .env        # configure as variáveis
npx prisma migrate dev      # cria as tabelas
npm run dev

# 3. Frontend
cd frontend
npm run dev
```

## Como Executar (Produção)

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## Endpoints da API

### Auth (`/api/auth`)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/register` | Registrar novo master |
| POST | `/login` | Login + tokens JWT |
| POST | `/refresh` | Renovar access token |
| POST | `/logout` | Invalidar refresh token |
| GET | `/me` | Dados do usuário logado |

### Accounts (`/api/accounts`) — requer JWT
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/master/connect` | Conectar conta Bullex |
| DELETE | `/master` | Desconectar master |
| GET | `/status` | Estado completo (master + seguidores + trades) |
| POST | `/copy/start` | Iniciar copy trading |
| POST | `/copy/stop` | Pausar copy trading |
| POST | `/followers` | Adicionar seguidor |
| PATCH | `/followers/:id` | Editar configurações |
| DELETE | `/followers/:id` | Remover seguidor |
| DELETE | `/history` | Limpar histórico |

### Portal (`/api/portal`) — auto-serviço do seguidor
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/:masterId/login` | Login do seguidor (Bullex credentials) |
| GET | `/me` | Dados do seguidor logado |
| PATCH | `/settings` | Atualizar configurações de cópia |
| GET | `/trades` | Histórico paginado de trades |
| POST | `/logout` | Logout |

---

## Próximas Melhorias (Roadmap)

- [ ] Notificações push (email/WhatsApp) em Stop Win/Loss
- [ ] Dashboard de analytics (gráficos de performance)
- [ ] Webhook para eventos de trading
- [ ] 2FA para login do master
- [ ] Limites por plano (freemium/premium)
- [ ] Multi-idioma (i18n)
