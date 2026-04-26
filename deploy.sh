#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# CopyTrader — Deploy / Update Script
# Usage: bash deploy.sh [--no-cache]
# ─────────────────────────────────────────────────────────────────────────────
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}    $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

NO_CACHE=""
if [[ "$1" == "--no-cache" ]]; then
  NO_CACHE="--no-cache"
  info "Build mode: --no-cache"
fi

# ─── Checks ───────────────────────────────────────────────────────────────────
command -v docker &>/dev/null || error "Docker não instalado. Execute setup-vps.sh primeiro."
[ -f ".env.prod" ]            || error "Arquivo .env.prod não encontrado. Copie de .env.production e preencha."

info "=== CopyTrader Deploy ==="
info "Iniciando build e deploy..."

# ─── Stop current containers ──────────────────────────────────────────────────
info "Parando containers antigos..."
docker compose -f docker-compose.prod.yml --env-file .env.prod down --remove-orphans 2>/dev/null || true

# ─── Build images ─────────────────────────────────────────────────────────────
if [[ -n "$NO_CACHE" ]]; then
  info "Construindo imagens (rebuild completo, sem cache)..."
else
  info "Construindo imagens..."
fi
docker compose -f docker-compose.prod.yml --env-file .env.prod build $NO_CACHE

# ─── Start services ───────────────────────────────────────────────────────────
info "Iniciando todos os serviços..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# ─── Wait and show status ─────────────────────────────────────────────────────
info "Aguardando serviços ficarem saudáveis..."
sleep 10

echo ""
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
echo ""

# ─── Health check ─────────────────────────────────────────────────────────────
info "Verificando health do backend..."
MAX_TRIES=12; TRY=0
until curl -sf http://localhost/api/health > /dev/null 2>&1; do
  TRY=$((TRY+1))
  [ $TRY -ge $MAX_TRIES ] && { echo -e "${YELLOW}Backend não respondeu em 60s — verifique: docker compose logs ct_backend${NC}"; break; }
  echo "  Aguardando... ($TRY/$MAX_TRIES)"
  sleep 5
done

if curl -sf http://localhost/api/health > /dev/null 2>&1; then
  success "Backend saudável!"
fi

echo ""
success "=== Deploy concluído! ==="
echo ""
echo "  Acesse: http://$(curl -s ifconfig.me 2>/dev/null || echo 'SEU_IP')"
echo ""
echo "Comandos úteis:"
echo "  Logs backend:  docker compose -f docker-compose.prod.yml logs -f ct_backend"
echo "  Logs frontend: docker compose -f docker-compose.prod.yml logs -f ct_frontend"
echo "  Status:        docker compose -f docker-compose.prod.yml ps"
echo "  Parar tudo:    docker compose -f docker-compose.prod.yml down"
