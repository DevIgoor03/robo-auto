# CopyTrader Bullex — Documentação Completa

**Projeto:** CopyTrader profissional para a plataforma Bullex  
**Versão:** 1.0.0  
**Data:** Março 2026  
**Stack:** Node.js + TypeScript + React + Vite + Tailwind CSS

---

## Arquitetura

```
Copytrader/
├── backend/               # API + WebSocket (Node.js/TypeScript)
│   ├── src/
│   │   ├── index.ts       # Express + Socket.IO server (porta 4000)
│   │   ├── config.ts      # Configurações via .env
│   │   ├── types.ts       # Tipos TypeScript compartilhados
│   │   ├── services/
│   │   │   ├── AccountService.ts    # Gerencia instâncias do SDK
│   │   │   └── CopyTradeService.ts  # Lógica central de copy trading
│   │   └── routes/
│   │       ├── accounts.ts  # Rotas de contas (master + seguidores)
│   │       └── trades.ts    # Rotas de trades e copy
├── frontend/              # Interface React (porta 5173)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx       # Tela de login master
│   │   │   └── DashboardPage.tsx   # Dashboard principal
│   │   ├── components/
│   │   │   ├── Sidebar.tsx         # Menu lateral
│   │   │   ├── StatCard.tsx        # Cards de estatísticas
│   │   │   ├── MasterCard.tsx      # Card da conta master
│   │   │   ├── FollowerCard.tsx    # Card de seguidor
│   │   │   ├── TradeHistory.tsx    # Tabela de histórico
│   │   │   └── AddFollowerModal.tsx # Modal para adicionar seguidor
│   │   ├── hooks/useSocket.ts      # Hook Socket.IO (tempo real)
│   │   ├── services/api.ts         # Cliente HTTP (axios)
│   │   └── types/index.ts          # Tipos TypeScript
├── docker-compose.yml
├── .env.example
└── start-dev.ps1          # Script de inicialização Windows
```

---

## SDK Utilizado

**Pacote:** `@quadcode-tech/client-sdk-js` v1.3.7  
**Autenticação:** `LoginPasswordAuthMethod` (email + senha)  
**Plataforma:** Bullex (Platform ID: 580)  
**WebSocket:** `wss://ws.trade.bull-ex.com/echo/websocket`  
**API REST:** `https://api.trade.bull-ex.com`

---

## Como Funciona o Copy Trading

1. **Conta Master** faz login → SDK conecta via WebSocket
2. CopyTrader é **iniciado** → `positions.subscribeOnUpdatePosition(callback)` monitora posições
3. Quando master abre nova posição → callback detecta (por ID não visto antes)
4. Para cada seguidor **ativo**: calcula valor, verifica stop, replica operação
5. Updates em tempo real via **Socket.IO** para o frontend

### Fluxo de detecção de novas posições

```
Master abre trade
       ↓
subscribeOnUpdatePosition dispara
       ↓
Verifica se externalId é novo (knownPositionIds Set)
       ↓
Se novo → replicatePosition()
       ↓
Para cada seguidor ativo:
  ├── Calcula valor (fixed/% master/% saldo)
  ├── Verifica stop win/loss
  └── Executa buy no tipo de instrumento correspondente
```

---

## API Endpoints

### Contas

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/accounts/master/connect` | Conectar conta master |
| `POST` | `/api/accounts/master/disconnect` | Desconectar master |
| `GET`  | `/api/accounts/master/balance` | Saldo do master |
| `GET`  | `/api/accounts/master/status` | Status da conexão |
| `POST` | `/api/accounts/followers` | Adicionar seguidor |
| `GET`  | `/api/accounts/followers` | Listar seguidores |
| `DELETE` | `/api/accounts/followers/:id` | Remover seguidor |
| `PATCH` | `/api/accounts/followers/:id/settings` | Atualizar configurações |
| `PATCH` | `/api/accounts/followers/:id/toggle` | Ativar/pausar seguidor |

### Trades

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/trades/copy/start` | Iniciar copy trading |
| `POST` | `/api/trades/copy/stop` | Parar copy trading |
| `GET`  | `/api/trades/copy/status` | Status do copy |
| `GET`  | `/api/trades/history` | Histórico de trades |
| `DELETE` | `/api/trades/history` | Limpar histórico |
| `GET`  | `/api/trades/master/positions` | Posições abertas |
| `GET`  | `/api/trades/master/pares` | Ativos disponíveis |

---

## Eventos Socket.IO

| Evento | Direção | Dados |
|--------|---------|-------|
| `init` | Servidor → Cliente | Estado inicial completo |
| `copy:started` | Servidor → Cliente | Timestamp de início |
| `copy:stopped` | Servidor → Cliente | Timestamp de parada |
| `trade:new` | Servidor → Cliente | TradeRecord |
| `follower:updated` | Servidor → Cliente | FollowerAccount |
| `follower:stopped` | Servidor → Cliente | `{ followerId, reason }` |
| `copy:error` | Servidor → Cliente | `{ followerId, error }` |

---

## Configurações de Cópia

| Modo | Descrição | Exemplo |
|------|-----------|---------|
| `fixed` | Valor fixo por operação | R$ 5 sempre |
| `percent_master` | % do valor do master | 50% → master R$ 10 = R$ 5 |
| `percent_balance` | % do saldo do seguidor | 2% do saldo atual |

---

## Instrumentos Suportados

- **blitz-option** ✅ (principal)
- **turbo-option** ✅
- **binary-option** ✅
- digital-option (não implementado ainda)
- margin-cfd/forex/crypto (não implementado ainda)

---

## Como Iniciar (Desenvolvimento)

### Pré-requisitos
- Node.js 20+
- npm 10+

### Passos

```powershell
# 1. Clonar / abrir a pasta
cd C:\Users\supig\Downloads\Copytrader

# 2. Instalar dependências do backend
cd backend; npm install; cd ..

# 3. Instalar dependências do frontend
cd frontend; npm install; cd ..

# 4. Iniciar (abre duas janelas PowerShell)
.\start-dev.ps1
```

### Ou manualmente

```powershell
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Abrir: http://localhost:5173

---

## Como Iniciar (Docker)

```bash
# Build e start limpos
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

# Verificar logs
docker-compose logs -f backend
```

Abrir: http://localhost:5173

---

## Variáveis de Ambiente

```env
PORT=4000                                          # Porta do backend
NODE_ENV=development                               # Ambiente
SESSION_SECRET=seu-segredo-aqui                   # Segredo de sessão
FRONTEND_URL=http://localhost:5173                # URL do frontend (CORS)
BULLEX_API_URL=https://api.trade.bull-ex.com     # API REST Bullex
BULLEX_WS_URL=wss://ws.trade.bull-ex.com/echo/websocket  # WebSocket
BULLEX_PLATFORM_ID=580                            # ID da plataforma
```

---

## TODO / Melhorias Futuras

- [ ] Persistência em banco de dados (SQLite/PostgreSQL)
- [ ] Dashboard de analytics com gráficos de win rate
- [ ] Suporte a Digital Options
- [ ] Notificações Telegram/WhatsApp de trades
- [ ] Sistema de grupos (vários masters)
- [ ] Logs exportáveis em CSV/Excel
- [ ] Autenticação OAuth 2.0 da Bullex
- [ ] Rate limiting e proteção de API
