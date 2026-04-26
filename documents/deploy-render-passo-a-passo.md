# Deploy do robo-auto na Render — passo a passo

Este projeto está preparado com **`render.yaml`** na raiz (Blueprint): PostgreSQL, Key Value (Redis), API Node (`backend`) e site estático (`frontend`).

---

## Pré-requisitos

- Conta em [render.com](https://render.com) com GitHub ligado.
- Repositório Git com este código (incluindo `render.yaml`).

---

## Passo 1 — Criar a stack (Blueprint)

1. No dashboard Render: **New** → **Blueprint**.
2. Escolhe o **repositório** e a **branch** (ex.: `main`).
3. A Render lê o `render.yaml` e mostra:
   - **roboauto-postgres** (PostgreSQL)
   - **roboauto-cache** (Key Value / Redis)
   - **robo-auto-api** (Web Service Node)
   - **robo-auto-web** (Static Site)
4. Na primeira vez, a interface pede valores para:
   - **JWT_SECRET**
   - **JWT_REFRESH_SECRET**
   - **ENCRYPTION_KEY**  
   Usa strings longas e aleatórias (no teu PC: `openssl rand -hex 32` ou `openssl rand -hex 64`).
5. Confirma a criação e espera o **primeiro deploy** (vários minutos).

---

## Passo 2 — URLs `.onrender.com`

Cada serviço ganha um URL do tipo `https://<nome>.onrender.com` (o nome pode ter um sufixo extra em alguns workspaces).

1. Abre **robo-auto-api** → copia a **URL pública** (ex.: `https://robo-auto-api.onrender.com`).
2. Abre **robo-auto-web** → copia a **URL pública**.

Se forem **diferentes** das que estão no `render.yaml`:

| Serviço | Variável | Valor |
|---------|----------|--------|
| **robo-auto-api** | `FRONTEND_URL` | URL **exacta** do static (ex.: `https://robo-auto-web.onrender.com`) |
| **robo-auto-web** | `VITE_API_URL` | URL **exacta** da API |

**Importante:** depois de alterar `VITE_API_URL`, no static faz **Manual Deploy** → **Clear build cache & deploy** (o Vite embute a URL no build).

---

## Passo 3 — Vários frontends no CORS (opcional)

A variável **`FRONTEND_URL`** na API pode ter **várias origens separadas por vírgula**, por exemplo:

```text
https://robo-auto-web.onrender.com,https://robo-auto-web-pr-123.onrender.com
```

Isto cobre **preview deploys** do static sem perder produção.

---

## Passo 4 — Testar

- API: `https://<url-da-api>/api/health` → JSON com `status: ok`.
- Site: abre o URL do **robo-auto-web** e faz login / fluxo normal.

---

## Limitações (plano gratuito)

- O **Web Service** free **adormece** após inatividade; o primeiro pedido pode demorar ~30–60 s.
- PostgreSQL e Key Value free têm **limites** de armazenamento e conexões — para produção real avalia planos pagos.

---

## Ficheiros relevantes

| Ficheiro | Descrição |
|----------|-----------|
| `render.yaml` | Blueprint (Postgres + Redis + API + Static) |
| `backend/src/config.ts` | `PORT`, `FRONTEND_URL` (várias origens com vírgula) |
| `backend/prisma/schema.prisma` | `binaryTargets` inclui Debian (Render) e musl (Docker) |

---

## Problemas comuns

| Sintoma | O quê fazer |
|---------|-------------|
| Build Prisma falha | Ver logs do **robo-auto-api**; confirma `DATABASE_URL` (a Render injeta SSL na connection string). |
| CORS / login falha | `FRONTEND_URL` tem de coincidir com o URL **exacto** do browser (inclui `https://`). |
| Socket.IO não liga | Mesma origem CORS + `VITE_API_URL` correcto no build do static. |
| `better-sqlite3` / nativo | O ficheiro `src/database/db.ts` (SQLite local) **não** é usado pelo fluxo principal com Prisma; se o build falhar por nativos, vê os logs do `npm ci`. |
