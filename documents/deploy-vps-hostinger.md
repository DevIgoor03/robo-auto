# CopyTrader — Deploy na VPS Hostinger

**Tempo estimado:** 15–20 minutos  
**Requisito mínimo de VPS:** 2 GB RAM, 1 vCPU, 20 GB SSD

---

## Visão Geral da Arquitetura na VPS

```
Internet (Porta 80 / 443)
         │
         ▼
┌─────────────────────────────┐
│  ct_frontend (Nginx)        │  porta 80 exposta
│  - Serve React SPA          │
│  - Proxy /api/ → backend    │
│  - Proxy /socket.io/ → back │
└──────────────┬──────────────┘
               │ rede interna Docker
         ┌─────▼──────┐
         │ ct_backend │  porta 3001 (interna)
         │ Node.js    │
         └──────┬──────┘
        ┌───────┴────────┐
        │                │
   ┌────▼────┐     ┌─────▼──────┐
   │ Postgres│     │   Redis    │
   │  :5432  │     │   :6379    │
   └─────────┘     └────────────┘
   (volumes persistentes no disco da VPS)
```

---

## Passo 1 — Comprar a VPS na Hostinger

1. Acesse [hstgr.io](https://www.hostinger.com/vps-hosting)
2. Selecione o plano **VPS KVM 2** ou superior (mínimo 2 GB RAM)
3. **Sistema operacional:** `Ubuntu 22.04`
4. Salve o **IP da VPS** e a senha root que será enviada por e-mail

---

## Passo 2 — Conectar na VPS via SSH

No seu computador (PowerShell ou Terminal):

```bash
ssh root@SEU_IP_DA_VPS
```

> Dica: Para Windows, use o **PuTTY** ou o Terminal do VS Code

---

## Passo 3 — Configurar a VPS (uma vez só)

Faça upload do script ou cole diretamente:

```bash
# Depois de clonar o repo (ver Passo 4), na pasta do projeto:
cd /opt/copytrader && bash setup-vps.sh
```

**OU** copie o conteúdo de `setup-vps.sh` e cole no terminal.

O script instala automaticamente:
- Docker Engine
- Docker Compose
- UFW Firewall (libera portas 80, 443, 22)

---

## Passo 4 — Enviar o projeto para a VPS

### Opção A — Via Git (recomendado)

```bash
cd /opt/copytrader
git clone https://github.com/DevIgoor03/CopyTraderV3.git .
```

### Opção B — Via SCP (do seu PC)

No seu PC (PowerShell):

```powershell
# Compactar projeto (excluindo node_modules e .env)
cd C:\Users\supig\Downloads
tar -czf copytrader.tar.gz Copytrader --exclude='*/node_modules' --exclude='*/.env*' --exclude='*/dist'

# Enviar para VPS
scp copytrader.tar.gz root@SEU_IP:/opt/copytrader/

# Extrair na VPS
ssh root@SEU_IP "cd /opt/copytrader && tar -xzf copytrader.tar.gz --strip-components=1"
```

---

## Passo 5 — Configurar as variáveis de ambiente

Na VPS:

```bash
cd /opt/copytrader

# Copiar template
cp .env.production .env.prod

# Abrir para editar
nano .env.prod
```

Preencha **TODOS** os valores marcados:

```env
POSTGRES_PASSWORD=MinhaSenh@Forte123     # qualquer senha forte
REDIS_PASSWORD=OutraSenha@Forte456       # qualquer senha forte
FRONTEND_URL=http://SEU_IP_DA_VPS        # ex: http://123.456.789.0

# Gere as chaves JWT:
# Rode no terminal da VPS: openssl rand -hex 64
JWT_SECRET=RESULTADO_DO_COMANDO_ACIMA
JWT_REFRESH_SECRET=OUTRO_RESULTADO

# Gere a chave de criptografia:
# Rode: openssl rand -hex 32
ENCRYPTION_KEY=RESULTADO_DO_COMANDO
```

**Como gerar as chaves na VPS:**

```bash
# JWT Secret
openssl rand -hex 64

# Encryption Key
openssl rand -hex 32
```

Salve e feche o nano: `Ctrl+X → Y → Enter`

---

## Passo 6 — Fazer o Deploy

```bash
cd /opt/copytrader
bash deploy.sh
```

O script vai:
1. Construir as imagens Docker
2. Iniciar PostgreSQL e Redis
3. Rodar as migrations do banco de dados automaticamente
4. Iniciar o backend e o frontend
5. Verificar se tudo está saudável

**Aguarde 2-3 minutos** na primeira execução (build das imagens).

---

## Passo 7 — Verificar se funcionou

```bash
# Status dos containers
docker compose -f docker-compose.prod.yml ps

# Deve mostrar todos como "running" ou "healthy":
# ct_postgres   - running
# ct_redis      - running
# ct_backend    - running
# ct_frontend   - running
```

Acesse no navegador: `http://SEU_IP_DA_VPS`

---

## (Opcional) Passo 8 — Configurar Domínio + SSL

### 8.1 — Apontar domínio para a VPS

No painel do seu domínio (onde comprou o domínio):
- Crie um registro **A** apontando para o **IP da VPS**
- Aguarde a propagação DNS (pode levar até 24h, geralmente 5-15 min)

### 8.2 — Instalar SSL (HTTPS)

```bash
cd /opt/copytrader
sudo bash ssl-setup.sh seudominio.com
```

O script instala o certificado Let's Encrypt e reconfigura o Nginx com HTTPS automático. **A renovação é automática.**

---

## Comandos úteis no dia a dia

```bash
# Logs em tempo real
docker compose -f docker-compose.prod.yml logs -f ct_backend

# Reiniciar um serviço
docker compose -f docker-compose.prod.yml restart ct_backend

# Parar tudo
docker compose -f docker-compose.prod.yml down

# Atualizar o projeto (após git pull)
bash deploy.sh --no-cache

# Ver uso de recursos
docker stats

# Verificar saúde
curl http://localhost/api/health
```

---

## Atualizar o sistema (após mudanças no código)

```bash
cd /opt/copytrader

# Se usar Git:
git pull origin main

# Rebuild e redeploy
bash deploy.sh --no-cache
```

---

## Solução de Problemas

### Backend não inicia

```bash
docker compose -f docker-compose.prod.yml logs ct_backend
```

Causas comuns:
- `DATABASE_URL` incorreta → verifique o `.env.prod`
- PostgreSQL ainda inicializando → aguarde mais 30s

### Frontend retorna 502 Bad Gateway

```bash
docker compose -f docker-compose.prod.yml logs ct_frontend
```

Causa: backend ainda não está pronto. Aguarde ou verifique os logs do backend.

### Banco de dados corrompido

```bash
# Ver dados do volume
docker volume inspect copytrader_postgres_data

# Em último caso (APAGA TUDO)
docker compose -f docker-compose.prod.yml down -v
bash deploy.sh
```

---

## Segurança em produção

- As senhas nunca aparecem em logs (mascaradas pelo Pino)
- Credenciais Bullex armazenadas com AES-256-CBC
- JWT com expiração de 15 minutos + refresh de 7 dias
- Rate limiting: 100 req/min geral, 10 req/min em login
- Firewall UFW: apenas portas 22, 80, 443 abertas
- Banco e Redis acessíveis apenas internamente (rede Docker)

---

## Custos estimados (Hostinger)

| Plano | RAM | Preço/mês | Capacidade |
|-------|-----|-----------|-----------|
| KVM 1 | 1 GB | ~R$ 25 | Apenas testes |
| KVM 2 | 2 GB | ~R$ 40 | **Recomendado** — até ~50 seguidores |
| KVM 4 | 4 GB | ~R$ 70 | Até ~200 seguidores |
| KVM 8 | 8 GB | ~R$ 120 | Produção pesada |
