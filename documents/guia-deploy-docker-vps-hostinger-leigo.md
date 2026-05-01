# Guia leigo: subir o **robo-auto** na VPS Ubuntu (Hostinger) com Docker

Passo a passo **do zero** para colocar o site + API + PostgreSQL + Redis a correr na VPS **sem erros comuns**.

**Tempo:** 30–60 minutos na 1.ª vez.  
**VPS:** **Ubuntu 22.04** ou **24.04**, **≥ 2 GB RAM** (recomendado).

---

## 1. O que vais fazer (resumo)

| Peça | Função |
|------|--------|
| **VPS** | Servidor Linux com IP fixo (Hostinger). |
| **Docker** | Corre frontend (Nginx), backend (Node), Postgres e Redis em contentores. |
| **SSH** | Entras no servidor a partir do teu PC para correr comandos. |
| **GitHub** | Código em `https://github.com/DevIgoor03/robo-auto.git` (ou o teu fork). |

No fim abres **`http://IP_DA_VPS`** no browser; a API fica em **`/api/`** atrás do mesmo Nginx.

---

## 2. Antes de começar

1. **IP público** da VPS (painel Hostinger).  
2. **Password** do `root` (ou utilizador com `sudo`).  
3. Ubuntu **22.04 LTS** ao criar a VPS.  
4. Repositório **público** ou **token** GitHub se for privado.

---

## 3. SSH a partir do Windows

PowerShell ou Terminal:

```bash
ssh root@SEU_IP
```

- 1.ª vez: escreve `yes` se perguntar.  
- Password não aparece ao escrever — é normal.

---

## 4. Git + pasta do projeto (evita pasta duplicada)

**Forma certa** (código fica directamente em `/opt/robo-auto`):

```bash
apt-get update -qq && apt-get install -y -qq git curl
mkdir -p /opt/robo-auto
cd /opt/robo-auto
git clone https://github.com/DevIgoor03/robo-auto.git .
```

O **`.`** no fim do `git clone` evita criar `/opt/robo-auto/robo-auto/`.

**Se já clonaste sem o `.`** e tens `/opt/robo-auto/robo-auto/` com o código:

```bash
cd /opt/robo-auto/robo-auto
```

(Usa **esta** pasta para todos os comandos seguintes.)

---

## 5. Docker e firewall (uma vez)

Na pasta onde estão `setup-vps.sh` e `docker-compose.prod.yml`:

```bash
chmod +x setup-vps.sh
bash setup-vps.sh
```

Instala Docker, Docker Compose e abre **22**, **80** e **443** no UFW.

---

## 6. Ficheiro `.env.prod` (segredos)

Na **mesma pasta** do `docker-compose.prod.yml`:

```bash
cp .env.production .env.prod
nano .env.prod
```

Substitui **tudo** o que for `TROQUE_...` por valores reais:

| Variável | O quê |
|----------|--------|
| `POSTGRES_PASSWORD` | Senha forte (Postgres). |
| `REDIS_PASSWORD` | **Outra** senha (Redis). |
| `JWT_SECRET` | `openssl rand -hex 64` (na VPS). |
| `JWT_REFRESH_SECRET` | **Outro** `openssl rand -hex 64` (diferente do anterior). |
| `ENCRYPTION_KEY` | `openssl rand -hex 32`. |
| `FRONTEND_URL` | Como vais abrir o site: `http://IP_DA_VPS` ou `https://teu-dominio.com` (tem de bater **certo** com o browser, senão CORS/cookies falham). |

Se **não** existir `.env.production` no clone, cria `.env.prod` à mão com as mesmas chaves que o `docker-compose.prod.yml` exige.

Nano: gravar `Ctrl+O`, Enter · sair `Ctrl+X`.

---

## 7. Deploy

```bash
chmod +x deploy.sh
bash deploy.sh
```

A 1.ª vez o build pode demorar **vários minutos**.

**Actualizar código mais tarde:**

```bash
cd /opt/robo-auto
git pull
bash deploy.sh --no-cache
```

---

## 8. Confirmar

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
curl -s http://localhost/api/health
```

No PC, no browser: **`http://SEU_IP`**.

---

## 9. Porta 80 ocupada (outro site na mesma VPS)

Se o deploy do frontend falhar com *port already allocated*:

```bash
ss -tlnp | grep ':80'
docker ps
```

Para o que estiver a usar a **80** (outro Nginx, outro Docker) ou usa **um só** reverse proxy para vários domínios.

---

## 10. HTTPS com domínio (opcional)

1. DNS **A** do domínio → IP da VPS.  
2. `FRONTEND_URL=https://teu-dominio.com` no `.env.prod`.  
3. Na VPS, com Certbot (exemplo; ajusta o domínio):

```bash
docker stop roboauto_frontend
apt-get install -y certbot
certbot certonly --standalone -d teu-dominio.com --email teu@email.com --agree-tos --non-interactive
```

4. Configura **SSL** no `frontend/nginx.conf` (ou script `ssl-setup.sh` do repo, se estiver alinhado ao teu domínio) e volta a subir o frontend.

---

## 11. Resumo rápido (copiar)

```bash
ssh root@SEU_IP
apt-get update -qq && apt-get install -y -qq git curl
mkdir -p /opt/robo-auto && cd /opt/robo-auto
git clone https://github.com/DevIgoor03/robo-auto.git .
chmod +x setup-vps.sh && bash setup-vps.sh
cp .env.production .env.prod && nano .env.prod
chmod +x deploy.sh && bash deploy.sh
```

---

## Referências no repositório

- `docker-compose.prod.yml` — stack de produção  
- `deploy.sh` — build e `docker compose up`  
- `.env.production` — modelo para criar `.env.prod`  
- [Repositório robo-auto](https://github.com/DevIgoor03/robo-auto)  

### Logs úteis

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs backend --tail 80
docker compose -f docker-compose.prod.yml --env-file .env.prod logs frontend --tail 50
```

Contentores típicos: `roboauto_backend`, `roboauto_frontend`, `roboauto_postgres`, `roboauto_redis`.
