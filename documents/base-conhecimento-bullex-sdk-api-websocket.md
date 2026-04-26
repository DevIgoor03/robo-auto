# Bullex: Documentação Completa (SDK, API e WebSocket)

## Objetivo

Este documento serve como base de conhecimento técnica e neutra da integração com a Bullex, cobrindo:

- SDK oficial para conexão e execução de ordens
- Camada de API HTTP usada no processo de autenticação
- Canal WebSocket para dados em tempo real
- Modelos de fluxo para monitoramento de posições e resolução de resultados
- Boas práticas de segurança, confiabilidade e observabilidade

---

## 1) Visão Geral da Arquitetura Bullex

A integração opera em dois planos:

- **Plano de autenticação (HTTP API):** valida credenciais e cria contexto de sessão/autorização.
- **Plano de execução/streaming (WebSocket):** fornece estado em tempo real (posições, saldos, eventos de fechamento) e permite operações de trading via SDK.

Em implementações com SDK JavaScript/TypeScript, normalmente o SDK encapsula os detalhes de chamadas HTTP e frames WebSocket.

---

## 2) SDK Oficial

## Pacote

- `@quadcode-tech/client-sdk-js`

## Instanciação típica

```ts
import { ClientSdk, LoginPasswordAuthMethod } from '@quadcode-tech/client-sdk-js';

const sdk = await ClientSdk.create(
  process.env.BULLEX_WS_URL!,
  Number(process.env.BULLEX_PLATFORM_ID),
  new LoginPasswordAuthMethod(
    process.env.BULLEX_API_URL!,
    email,
    password
  )
);
```

## Recursos mais usados

- `sdk.userProfile`
- `sdk.balances()`
- `sdk.positions()`
- `sdk.blitzOptions()`
- `sdk.turboOptions()`

## Tipos/enums comuns

- `BalanceType.Real`
- `BalanceType.Demo`
- `BlitzOptionsDirection.Call | Put`
- `TurboOptionsDirection.Call | Put`

---

## 3) Endpoints base e parâmetros globais

## API HTTP base

- `https://api.trade.bull-ex.com`

## WebSocket base

- `wss://ws.trade.bull-ex.com/echo/websocket`

## Platform ID (comum em integrações)

- `580`

---

## 4) Variáveis de Ambiente Recomendadas

```env
# Bullex
BULLEX_API_URL=https://api.trade.bull-ex.com
BULLEX_WS_URL=wss://ws.trade.bull-ex.com/echo/websocket
BULLEX_PLATFORM_ID=580

# Segurança da sua aplicação
ENCRYPTION_KEY=<hex_32_bytes>
JWT_SECRET=<hex_64_bytes>
JWT_REFRESH_SECRET=<hex_64_bytes>
```

## Política de credenciais

- Nunca salvar senha de trading em texto plano.
- Armazenar credenciais com criptografia forte em repouso.
- Rotacionar chaves (`ENCRYPTION_KEY`) com procedimento controlado.
- Evitar logar e-mail/senha em texto claro.

---

## 5) Fluxo de Conexão e Sessão

1. Receber credenciais do usuário.
2. Criar `LoginPasswordAuthMethod(apiUrl, email, password)`.
3. Inicializar `ClientSdk.create(wsUrl, platformId, authMethod)`.
4. Consultar perfil e saldos (`userProfile`, `balances()`).
5. Abrir fachada de posições (`positions()`).
6. Assinar atualizações em tempo real (`subscribeOnUpdatePosition`, saldo, etc.).

Falhas comuns:

- credenciais inválidas
- IP/rate limit
- socket desconectado/reconectando
- `platformId` incorreto

---

## 6) Saldos (Real e Demo)

Fluxo padrão:

1. `const balances = await sdk.balances()`
2. `const all = balances.getBalances()`
3. Selecionar saldo por tipo:
   - real: `BalanceType.Real`
   - demo: `BalanceType.Demo`
4. Assinar atualização de saldo para refletir mudanças em tempo real.

Recomendação:

- Sempre validar existência do saldo antes de enviar ordem.
- Persistir snapshot de saldo pós-operação.

---

## 7) Posições e Eventos em Tempo Real

Com `positions()`:

- Obter posições abertas atuais (`getOpenedPositions` quando disponível).
- Assinar stream de updates:
  - abertura de posição
  - mudança de estado
  - fechamento e motivo (`closeReason`)

Boas práticas:

- manter um cache de `externalId` para idempotência
- ignorar replay histórico no bootstrap de sessão
- separar claramente evento de “abertura” vs “fechamento”

---

## 8) Execução de Ordens: Blitz e Turbo

## Blitz

Fluxo:

1. `const blitz = await sdk.blitzOptions()`
2. Selecionar ativo disponível (`getActives()`)
3. Definir direção (`Call`/`Put`)
4. Definir expiração suportada
5. Executar `buy(...)`

## Turbo

Fluxo:

1. `const turbo = await sdk.turboOptions()`
2. Selecionar ativo
3. Carregar instrumentos/expirações disponíveis
4. Escolher o instrumento compatível com alvo de expiração
5. Executar `buy(...)`

Cuidados:

- validar ativo não suspenso
- validar janela de compra aberta
- tratar falha de execução com retry controlado (sem duplicar ordem)

---

## 9) Modelo de Estados de Trade

Modelo recomendado para sistemas de cópia:

- `OPEN`
- `WIN`
- `LOSS`
- `DRAW` (empate)

## Mapeamento por `closeReason` (referência prática)

- `win` -> `WIN`
- `loss` / `loose` -> `LOSS`
- `expired` / `cancel` / `manual` / `manual-close` -> `DRAW` (lucro zero)

Importante:

- A resolução deve usar o evento da **própria posição** monitorada, não inferência externa.

---

## 10) WebSocket: Estratégia de Confiabilidade

Checklist operacional:

- heartbeat/keepalive habilitado
- reconexão automática com backoff exponencial
- invalidação de listeners antigos após restart de sessão
- deduplicação por chave idempotente (ex.: `masterId:followerId:masterPositionId`)
- timeout defensivo para operações pendentes

Padrão recomendado:

- token de sessão em memória para invalidar callbacks “stale”
- lock por ordem durante replicação

---

## 11) Segurança e Governança

- Criptografar segredos em repouso.
- Redigir logs (mascarar dados sensíveis).
- Limitar tentativas de login por janela de tempo.
- Auditar alterações de configuração de conta e execução.
- Isolar contexto de produção e homologação.
- Não expor chaves em frontend.

---

## 12) Observabilidade (logs e métricas)

Mínimo recomendado:

- taxa de sucesso de login
- latência média de envio de ordem
- taxa de erro por tipo de instrumento
- taxa de reconexão WebSocket
- divergência de resultado (ordem origem vs ordem espelhada)
- contagem de `WIN/LOSS/DRAW`

Logs essenciais:

- `position_open_detected`
- `order_sent`
- `order_failed`
- `position_closed`
- `trade_resolved`
- `ws_reconnected`

---

## 13) Exemplo de Configuração Base

```env
BULLEX_API_URL=https://api.trade.bull-ex.com
BULLEX_WS_URL=wss://ws.trade.bull-ex.com/echo/websocket
BULLEX_PLATFORM_ID=580
```

```ts
const sdk = await ClientSdk.create(
  process.env.BULLEX_WS_URL!,
  Number(process.env.BULLEX_PLATFORM_ID),
  new LoginPasswordAuthMethod(
    process.env.BULLEX_API_URL!,
    email,
    password
  )
);
```

---

## 14) Troubleshooting Rápido

## Não conecta

- validar `BULLEX_API_URL`, `BULLEX_WS_URL`, `BULLEX_PLATFORM_ID`
- validar credenciais
- verificar bloqueio por rate limit/IP

## Ordem não abre

- saldo indisponível para tipo selecionado
- ativo suspenso
- expiração não suportada naquele momento

## Resultado inconsistente

- ausência de idempotência
- resolução por evento incorreto
- race condition entre callbacks antigos e sessão atual

---

## 15) Resumo Executivo

- A Bullex integra autenticação HTTP + execução/streaming por WebSocket.
- O SDK oficial simplifica esse fluxo e deve ser o ponto central da integração.
- Robustez depende de idempotência, reconexão segura e resolução por evento real da posição.
- Segurança exige criptografia de credenciais, controle de rate limit e logs auditáveis.

---

## 16) Inventário do que este documento já fixa (alto sinal)

### SDK

- Pacote: `@quadcode-tech/client-sdk-js`
- Auth method: `LoginPasswordAuthMethod(apiUrl, email, password)`
- Conexão: `ClientSdk.create(wsUrl, platformId, authMethod)`

### Bases e parâmetros globais

- API HTTP base: `https://api.trade.bull-ex.com`
- WebSocket base: `wss://ws.trade.bull-ex.com/echo/websocket`
- `platformId`: `580`

### Capacidades principais (pela lente de automação)

- **Sessão**: bootstrap via `ClientSdk.create(...)` e consultas iniciais (perfil/saldos).
- **Saldos**: obter e distinguir `Real` vs `Demo`.
- **Posições**: obter “abertas” e acompanhar ciclo de vida por eventos (abertura → atualização → fechamento).
- **Execução**: compra via **Blitz** e **Turbo** (call/put, ativo, expiração).
- **Resolução**: mapear `closeReason` para `WIN/LOSS/DRAW` (com alerta de valores inconsistentes como `loose`).
- **Confiabilidade**: reconexão, deduplicação, invalidação de listeners, “session token” em memória, lock por ordem.

---

## 17) Lacunas que você precisa confirmar (para virar plataforma de produção)

Este documento é uma base excelente, mas ainda faltam detalhes que normalmente travam a implementação “de verdade” (assinaturas, eventos e edge-cases). Recomendo preencher estes itens com evidências (ex.: logs reais, resposta do SDK, ou documentação oficial).

### Contratos de execução (Blitz/Turbo)

- Assinaturas exatas de `buy(...)` (parâmetros e retornos).
- Como selecionar instrumento/expiração “correta” no Turbo (estrutura e campos).
- Como indicar **tipo de saldo** (Real/Demo) na ordem (se é por `balanceId`, `balanceType` ou outro).
- Erros retornados (códigos, mensagens, retryability) e como diferenciar:
  - saldo insuficiente
  - ativo fechado/suspenso
  - janela de compra fechada
  - “order duplicated / already exists”

### Eventos e callbacks de posição

- Nomes exatos das subscriptions (ex.: `subscribeOnUpdatePosition`) e payloads.
- Quais campos são confiáveis para idempotência:
  - `externalId` existe sempre?
  - existe `id`, `positionId`, `createdAt`, `userId`, `accountId`?
- Como detectar “replay” vs evento novo na reconexão (há `sequence`, `timestamp`, `offset`, `snapshot`?).

### Autenticação e limites

- Rate limit e bloqueios por IP (limites, headers, tempos de ban).
- Políticas de sessão (expiração, reautenticação automática, refresh).
- Regras de compliance/termos para automação/cópia (se aplicável ao seu caso).

### Mercado/dados em tempo real (se necessário)

- Fonte de “preços”/quotes e latência (o SDK entrega ticks/candles? ou só posições?).
- Como enumerar ativos e estados (aberto/fechado/suspenso) e como cachear.

---

## 18) Arquitetura recomendada para sua plataforma de operações automáticas

Abaixo está uma arquitetura “robusta e simples” para evoluir para produção sem reescrever tudo.

### Componentes

- **API da sua plataforma (Backend)**: autenticação do seu usuário, configuração de robôs, regras de risco, e painéis.
- **Serviço de Conectores Bullex**: responsável por manter sessões/WS e expor eventos normalizados (posição aberta/fechada, saldo, erro).
- **Motor de Estratégias / Copy Engine**:
  - Estratégia: decide quando abrir/fechar (se você for operar “por sinais”).
  - Copy: replica posição de um “master” para “followers”.
- **Fila de Jobs**: garante reprocessamento, retries e ordenação (envio de ordem, reconciliação, backfill).
- **Banco de dados**: estados de contas, mapeamentos de posições e auditoria.
- **Observabilidade**: métricas, logs estruturados e trilha de auditoria.

### Fluxo (Copy Trading como exemplo)

1. **Conta conectada**: usuário fornece credenciais Bullex → você cria sessão via SDK.
2. **Listener mestre**: conector do master assina eventos de posições.
3. **Evento de abertura**: ao receber abertura de posição do master:
   - cria um `replication_intent` com chave idempotente
   - enfileira `place_follower_order` para cada follower elegível
4. **Execução follower**: worker consome job e chama `buy(...)` no follower:
   - aplica risco (valor fixo, % do saldo, max ordens simultâneas, stop diário)
   - grava `follower_position_mapping` (masterPositionId → followerPositionId)
5. **Evento de fechamento**: ao fechar master:
   - se existir ação de hedge/close (caso o produto suporte), executa; caso não, apenas resolve e audita
6. **Reconciliação**: tarefa periódica compara estado local vs `sdk.positions()` e corrige divergências.

### Modelo de dados mínimo (sugestão)

- `accounts`
  - `id`, `user_id`, `provider` (= bullex), `status`, `created_at`
- `account_secrets`
  - `account_id`, `encrypted_payload`, `key_version`, `created_at`
- `sessions` (opcional, para auditoria/monitoramento)
  - `account_id`, `session_id`, `started_at`, `ended_at`, `last_heartbeat_at`
- `positions_provider`
  - `account_id`, `provider_position_id` (ou `externalId`), `state`, `open_at`, `close_at`, `close_reason`, `pnl`, `raw_payload`
- `replication_intents`
  - `idempotency_key`, `master_account_id`, `master_position_id`, `created_at`, `status`
- `replication_orders`
  - `intent_id`, `follower_account_id`, `status`, `provider_order_id/position_id`, `error_code`, `error_message`

### Idempotência (regra prática)

- Chave sugerida (exemplo): `bullex:{masterAccountId}:{followerAccountId}:{masterPositionId}:{action}`
- `action` em geral: `OPEN` (e `CLOSE` se suportado).
- Persistir a chave **antes** de enviar ordem; no retry, checar e não duplicar.

### Reconexão WebSocket (o que “quebra” plataformas na prática)

- Ao reconectar:
  - invalidar handlers antigos (token de sessão atual)
  - re-subscrever tudo
  - fazer um **snapshot** de `positions()` e “marcar” o baseline
  - só então aceitar eventos como novos, com deduplicação por ids + timestamps

---

## 19) Próximos passos recomendados (para sair do documento e ir para código)

1. Criar um “conector Bullex” isolado (módulo/serviço) com:
   - login + reconexão
   - fetch inicial (perfil/saldos/posições)
   - stream normalizado de eventos
2. Definir contratos internos:
   - `OrderRequest`, `OrderResult`, `PositionOpened/Closed`, `ProviderError`
3. Implementar idempotência + fila de jobs (mesmo que simples no início).
4. Implementar reconciliação periódica (segurança contra perda de eventos).
5. Só depois plugar UI/painéis.

