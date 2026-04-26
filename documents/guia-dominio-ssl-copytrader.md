# Ligar o domínio **copy-fy.com** ao CopyTrader na VPS

Guia prático: DNS → HTTPS → variáveis. Exemplo com **copy-fy.com** e VPS na Hostinger.

---

## 1. O que precisas

- Domínio **copy-fy.com** (ou outro) com acesso ao painel DNS (onde compraste o domínio).
- **IP público fixo** da VPS (o mesmo que já usas com `http://IP`).
- Portas **80** e **443** abertas no firewall da VPS (`setup-vps.sh` já costuma abrir).

---

## 2. DNS — apontar o domínio para a VPS

No painel DNS do teu registro (Hostinger Domains, Registro.br, Cloudflare, etc.):

### Registo **A** (domínio principal)

| Tipo | Nome / Host | Valor / Aponta para | TTL |
|------|-------------|---------------------|-----|
| **A** | `@` (ou vazio, ou `copy-fy.com`) | **IP_DA_TUA_VPS** | 300 ou automático |

### Registo **www** (recomendado)

**Opção A — A para www**

| Tipo | Nome | Valor |
|------|------|--------|
| **A** | `www` | **IP_DA_TUA_VPS** |

**Opção B — CNAME**

| Tipo | Nome | Valor |
|------|------|--------|
| **CNAME** | `www` | `copy-fy.com.` (com ponto final se o painel pedir) |

O script `ssl-setup.sh` pede certificado para **copy-fy.com** e **www.copy-fy.com**; os dois têm de resolver para o **mesmo IP** da VPS.

### Verificar propagação (no teu PC)

```bash
ping copy-fy.com
ping www.copy-fy.com
```

Ou [https://dnschecker.org](https://dnschecker.org) — ambos devem mostrar o IP da VPS. Pode demorar de minutos a algumas horas.

---

## 3. Antes do SSL — código atualizado na VPS

O `docker-compose.prod.yml` expõe **443** e monta **`/etc/letsencrypt`** no contentor do Nginx. Garante que tens a última versão do projeto:

```bash
cd /opt/copytrader
git pull origin main
bash deploy.sh --no-cache
```

(Se ainda não tens HTTPS, o site continua a funcionar em **http://IP** e **http://copy-fy.com** após o DNS.)

---

## 4. Instalar HTTPS (Let's Encrypt)

Na VPS, **com DNS já a apontar para o IP**:

```bash
cd /opt/copytrader
```

**Com e-mail** (recomendado — avisos de expiração do certificado):

```bash
sudo bash ssl-setup.sh copy-fy.com teuemail@exemplo.com
```

**Sem segundo argumento** (usa registo sem e-mail no Let's Encrypt, menos ideal):

```bash
sudo bash ssl-setup.sh copy-fy.com
```

O script:

1. Para o contentor `ct_frontend` (liberta a porta **80**).
2. Corre o **Certbot** em modo standalone e grava certificados em `/etc/letsencrypt` **no host**.
3. Gera `nginx.conf` com **HTTPS** e redirecionamento de HTTP → HTTPS.
4. Atualiza **`FRONTEND_URL=https://copy-fy.com`** no `.env.prod`.
5. Reconstrói e levanta o frontend (com volume dos certificados).
6. Agenda **renovação** automática via `cron`.

Depois abre: **https://copy-fy.com**

---

## 5. Backend e CORS

O `FRONTEND_URL` no `.env.prod` tem de ser exatamente a URL que o browser usa (ex.: `https://copy-fy.com`). O script `ssl-setup.sh` já faz o `sed` no `.env.prod`. Se mudares de ideias (só `www`), edita manualmente:

```bash
nano /opt/copytrader/.env.prod
# FRONTEND_URL=https://copy-fy.com   ou   https://www.copy-fy.com
```

Depois:

```bash
cd /opt/copytrader
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate backend
```

(Força o backend a reler variáveis; ou `bash deploy.sh` completo.)

---

## 6. Cloudflare (se usares)

- Modo SSL: **Full** ou **Full (strict)** depois de teres HTTPS na origem.
- Para o **Certbot standalone** funcionar na **primeira** emissão, o proxy laranja pode interferir; para o primeiro certificado costuma ser mais simples **desligar o proxy** (DNS only) em `copy-fy.com` e `www`, emitir o certificado, e voltar a ligar o proxy se quiseres.

---

## 7. Problemas frequentes

| Sintoma | O que verificar |
|---------|-----------------|
| Certbot falha | DNS ainda não propagado; porta 80 bloqueada; outro serviço na 80. |
| HTTPS não abre | `docker compose ... logs frontend`; certificados em `/etc/letsencrypt/live/copy-fy.com/` no host. |
| Login / API bloqueados | `FRONTEND_URL` igual ao URL real (com `https://`). |
| Só www funciona | Certificado inclui `www` se correste o script com domínio apex; ambos os registos DNS devem existir. |

---

## Resumo rápido (copy-fy.com)

1. DNS **A** `@` → IP da VPS.  
2. DNS **A** ou **CNAME** `www` → mesmo destino.  
3. Esperar propagar.  
4. `git pull` + `bash deploy.sh --no-cache` na VPS.  
5. `sudo bash ssl-setup.sh copy-fy.com teuemail@exemplo.com`  
6. Usar **https://copy-fy.com**.
