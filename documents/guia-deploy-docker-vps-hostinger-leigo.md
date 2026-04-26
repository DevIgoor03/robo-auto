# Guia leigo: subir o CopyTrader na VPS Hostinger com Docker

Este texto explica **do zero**, em linguagem simples, como colocar o projeto a rodar na sua VPS da Hostinger **sem erros comuns**. Guarde este ficheiro para consulta.

**Tempo:** cerca de 30–45 minutos na primeira vez.  
**Requisito da VPS:** Ubuntu 22.04 (ou 24.04), **pelo menos 2 GB de RAM** (plano KVM 2 ou superior na Hostinger).

---

## 1. O que você vai fazer (visão geral)

| Conceito | Em palavras simples |
|----------|---------------------|
| **VPS** | Um computador Linux na internet só seu, com IP fixo. |
| **Docker** | Empacota a aplicação (site + API + base de dados) em “caixas” que arrancam sempre igual. |
| **SSH** | Ligação segura do seu PC ao terminal desse computador, para dar comandos. |
| **Repositório GitHub** | O código está em `https://github.com/DevIgoor03/CopyTraderV3.git` — a VPS vai **baixar** de lá. |

O que sobe na VPS:

- **Frontend** (página web) na **porta 80** — é o que abre no browser com `http://SEU_IP`.
- **Backend** (API) **dentro** da rede Docker — o Nginx do frontend encaminha `/api/` para ele.
- **PostgreSQL** e **Redis** — também dentro do Docker, com dados guardados em **volumes** (não se perdem ao reiniciar o contentor).

---

## 2. O que precisa antes de começar

1. **IP público da VPS** (ex.: `72.61.xxx.xxx`) — vem no e-mail/painel Hostinger.  
2. **Palavra-passe root** (ou utilizador com `sudo`) — também da Hostinger.  
3. **Sistema da VPS = Ubuntu** — ao criar a VPS, escolha Ubuntu 22.04 LTS.  
4. No **GitHub**, o repositório **CopyTraderV3** tem de estar **público** ou a VPS precisa de **token** para clonar (se for privado).

---

## 3. Ligar à VPS (SSH)

No **Windows**, abra o **PowerShell** ou o **Terminal**.

Substitua `SEU_IP` pelo IP real:

```bash
ssh root@SEU_IP
```

- Na primeira vez pode perguntar se confia no servidor — escreva `yes` e Enter.  
- Depois pede a **password** — ao escrever, **não aparece nada** no ecrã; é normal. Enter no fim.

Se não conseguir entrar: confirme IP, password e se a Hostinger já terminou de criar a VPS (às vezes demora alguns minutos).

---

## 4. Preparar a VPS (Docker + firewall) — uma vez

Ainda **como root** no SSH, instale o Git (para clonar o projeto) e depois execute o script que já vem no repositório.

### 4.1 Instalar Git e clonar o projeto

```bash
apt-get update -qq && apt-get install -y -qq git curl
mkdir -p /opt/copytrader
git clone https://github.com/DevIgoor03/CopyTraderV3.git /opt/copytrader
cd /opt/copytrader
```

Se o `git clone` falhar com **403** ou **autenticação**, o repositório pode estar privado ou há bloqueio — use um [Personal Access Token](https://github.com/settings/tokens) no URL ou torne o repo público.

### 4.2 Rodar o script de setup (Docker + UFW)

```bash
chmod +x setup-vps.sh
bash setup-vps.sh
```

Isto faz, de forma automática:

- Atualiza pacotes do Ubuntu.  
- Instala **Docker** e **docker compose**.  
- Configura o **firewall (UFW)** para permitir **SSH (22)**, **HTTP (80)** e **HTTPS (443)**.

**Nota:** Se no fim aparecer que o seu utilizador foi adicionado ao grupo `docker`, para usar Docker **sem sudo** teria de sair e voltar a entrar no SSH. Para este guia, **pode continuar como root** e não há problema.

---

## 5. Criar o ficheiro de segredos (`.env.prod`)

O Docker **obriga** variáveis como senhas do Postgres, Redis e chaves JWT. **Nunca** commite `.env.prod` para o Git.

```bash
cd /opt/copytrader
cp .env.production .env.prod
nano .env.prod
```

No **nano**, altere **obrigatoriamente**:

| Variável | O que pôr |
|----------|-----------|
| `POSTGRES_PASSWORD` | Senha forte (guarde num sítio seguro). |
| `REDIS_PASSWORD` | **Outra** senha forte. |
| `JWT_SECRET` | Ver abaixo — gerar na VPS. |
| `JWT_REFRESH_SECRET` | **Outro** valor gerado (não pode ser igual ao JWT_SECRET). |
| `ENCRYPTION_KEY` | Ver abaixo — comprimento correto. |
| `FRONTEND_URL` | `http://SEU_IP` **exatamente** como vai abrir no browser (se usar domínio depois, muda para `https://...`). |

**Gerar valores seguros** (abra **outro** terminal SSH ou saia do nano com `Ctrl+X`, gere, e volte a editar):

```bash
# JWT (corre duas vezes e copia valores DIFERENTES)
openssl rand -hex 64

# Chave de encriptação (uma vez)
openssl rand -hex 32
```

No nano: **guardar** = `Ctrl+O`, Enter; **sair** = `Ctrl+X`.

**Erro comum:** deixar `FRONTEND_URL` com `SEU_IP_OU_DOMINIO` sem substituir — cookies/CORS podem falhar. Use o IP real, ex.: `http://72.61.xxx.xxx`.

---

## 6. Fazer o deploy (build + arranque)

```bash
cd /opt/copytrader
chmod +x deploy.sh
bash deploy.sh
```

- Na **primeira vez** o build pode demorar **vários minutos** (é normal).  
- O script para contentores antigos, constrói imagens, sobe Postgres → Redis → Backend → Frontend e testa o health.

### Quando atualizar o código (mais tarde)

Depois de `git pull`, a Hostinger/regra do projeto pede rebuild limpo:

```bash
cd /opt/copytrader
git pull origin main
bash deploy.sh --no-cache
```

`--no-cache` força o Docker a **não** reutilizar camadas antigas — evita “fantasmas” de builds anteriores.

---

## 7. Confirmar que está tudo bem

```bash
cd /opt/copytrader
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

Quer ver os serviços **running** e, para os que têm healthcheck, **healthy**.

Teste no próprio servidor:

```bash
curl -s http://localhost/api/health
```

No **seu PC**, abra o browser:

`http://SEU_IP`

(Substitua pelo IP da VPS.)

---

## 8. Se algo correr mal (checklist leigo)

### “Permission denied” no `git clone`

- Repo privado → use token ou SSH key da conta GitHub certa.  
- Repo público → confirme o URL: `https://github.com/DevIgoor03/CopyTraderV3.git`

### “`.env.prod` não encontrado”

```bash
cd /opt/copytrader
ls -la .env.prod
cp .env.production .env.prod && nano .env.prod
```

### Backend não fica healthy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs backend --tail 100
```

Causas típicas: senha Postgres errada no `.env.prod`, variáveis ainda com `TROQUE_POR_...`, Postgres ainda a inicializar (espere 1 minuto e `docker compose ... restart backend`).

### Prisma no Docker: “openssl”, “Error load”, “not valid JSON”

No **Alpine**, o Prisma precisa do binário certo (OpenSSL 3) e das libs no contentor. O projeto já define `binaryTargets` no `schema.prisma` e instala `openssl` + `libc6-compat` no `Dockerfile`. Atualize o código (`git pull`) e faça **`bash deploy.sh --no-cache`**.

### Página 502 no browser

O frontend já está no ar mas o backend ainda não. Veja logs do `ct_backend` e do `ct_frontend`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs ct_frontend --tail 50
```

### Porta 80 já em uso

Outro serviço (Apache, outro Nginx) está na 80. Na VPS:

```bash
ss -tlnp | grep ':80'
```

Pare o serviço conflituoso ou ajuste o mapeamento em `docker-compose.prod.yml` (avançado).

### Firewall bloqueia

O `setup-vps.sh` deve abrir 80 e 443. Confirme:

```bash
ufw status
```

---

## 9. Domínio e HTTPS (opcional, depois)

1. No painel do **domínio**, crie registo **A** para o **IP da VPS**.  
2. Atualize `FRONTEND_URL` para `https://seudominio.com` e refaça deploy.  
3. Na VPS existe o script `ssl-setup.sh` — siga as instruções em `documents/deploy-vps-hostinger.md` ou no próprio script.

---

## 10. Resumo dos comandos (cola rápida)

```bash
# 1) SSH
ssh root@SEU_IP

# 2) Clonar + setup (primeira vez)
apt-get update -qq && apt-get install -y -qq git curl
mkdir -p /opt/copytrader
git clone https://github.com/DevIgoor03/CopyTraderV3.git /opt/copytrader
cd /opt/copytrader
chmod +x setup-vps.sh && bash setup-vps.sh

# 3) Variáveis
cp .env.production .env.prod
nano .env.prod

# 4) Deploy
chmod +x deploy.sh && bash deploy.sh
```

---

## Referências no projeto

- Stack de produção: `docker-compose.prod.yml`  
- Script de deploy: `deploy.sh`  
- Template de env: `.env.production` → cópia local **`.env.prod`** (não vai para o Git)  
- Guia técnico complementar: `documents/deploy-vps-hostinger.md`  
- Repositório: [DevIgoor03/CopyTraderV3](https://github.com/DevIgoor03/CopyTraderV3)
