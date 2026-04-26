#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# CopyTrader — SSL com Let's Encrypt (após ter domínio apontado para VPS)
# Uso: sudo bash ssl-setup.sh seudominio.com [email-para-lets-encrypt@opcional]
#      CERTBOT_EMAIL=voce@email.com sudo bash ssl-setup.sh seudominio.com
# ─────────────────────────────────────────────────────────────────────────────
set -e

DOMAIN="$1"
[ -z "$DOMAIN" ] && echo "Uso: sudo bash ssl-setup.sh seudominio.com [email-certbot@opcional]" && exit 1
CERTBOT_EMAIL="${2:-${CERTBOT_EMAIL:-}}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[SSL]${NC}  $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
error()   { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

info "Domínio: $DOMAIN"

# ─── Install Certbot ──────────────────────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
  info "Instalando Certbot..."
  apt-get install -y certbot python3-certbot-nginx
fi

# ─── Parar container frontend (libera porta 80 temporariamente) ───────────────
info "Parando frontend temporariamente para validação SSL..."
docker stop ct_frontend 2>/dev/null || true

# ─── Obter certificado ────────────────────────────────────────────────────────
info "Obtendo certificado SSL para $DOMAIN (+ www)..."
CERT_ARGS=(-d "$DOMAIN")
if [[ "$DOMAIN" != www.* ]]; then
  CERT_ARGS+=(-d "www.$DOMAIN")
fi
if [ -n "$CERTBOT_EMAIL" ]; then
  certbot certonly --standalone "${CERT_ARGS[@]}" \
    --non-interactive --agree-tos --email "$CERTBOT_EMAIL" --no-eff-email
else
  certbot certonly --standalone "${CERT_ARGS[@]}" \
    --non-interactive --agree-tos --register-unsafely-without-email
fi

# ─── Gerar nginx.conf com SSL ─────────────────────────────────────────────────
info "Atualizando configuração Nginx com SSL..."

cat > /opt/copytrader/nginx-ssl.conf << NGINXCONF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    root  /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location /api/ {
        proxy_pass         http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_read_timeout 30s;
    }

    location /socket.io/ {
        proxy_pass         http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       \$host;
        proxy_read_timeout 86400s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINXCONF

info "Substituindo nginx.conf com versão SSL..."
cp /opt/copytrader/nginx-ssl.conf /opt/copytrader/frontend/nginx.conf

# ─── Atualizar FRONTEND_URL no .env.prod ──────────────────────────────────────
info "Atualizando FRONTEND_URL no .env.prod..."
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|" /opt/copytrader/.env.prod

# ─── Rebuild frontend com SSL ─────────────────────────────────────────────────
info "Reconstruindo frontend e reiniciando..."
cd /opt/copytrader
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build frontend

# ─── Auto-renovação SSL ───────────────────────────────────────────────────────
info "Configurando renovação automática do certificado..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker restart ct_frontend") | sort -u | crontab -

echo ""
success "=== SSL configurado com sucesso! ==="
echo ""
echo "  Acesse: https://$DOMAIN"
echo ""
