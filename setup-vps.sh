#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# CopyTrader — VPS Setup Script (Ubuntu 22.04 / Hostinger)
# Run once on a fresh VPS as root:
#   chmod +x setup-vps.sh && sudo bash setup-vps.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }

info "=== CopyTrader VPS Setup ==="
info "OS: $(lsb_release -d 2>/dev/null | cut -f2 || echo 'Unknown')"

# ─── 1. System update ─────────────────────────────────────────────────────────
info "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git wget unzip ufw

# ─── 2. Docker Engine ─────────────────────────────────────────────────────────
if command -v docker &>/dev/null; then
  success "Docker already installed: $(docker --version)"
else
  info "Installing Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  success "Docker installed: $(docker --version)"
fi

# ─── 3. Docker Compose (plugin) ───────────────────────────────────────────────
if docker compose version &>/dev/null; then
  success "Docker Compose already available: $(docker compose version)"
else
  info "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
  success "Docker Compose installed: $(docker compose version)"
fi

# ─── 4. Add current user to docker group ──────────────────────────────────────
if [ -n "$SUDO_USER" ]; then
  usermod -aG docker "$SUDO_USER"
  info "User '$SUDO_USER' added to docker group (re-login required)"
fi

# ─── 5. Firewall ──────────────────────────────────────────────────────────────
info "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (future SSL)
ufw --force enable
success "Firewall configured"

# ─── 6. Directory ─────────────────────────────────────────────────────────────
mkdir -p /opt/copytrader
info "App directory: /opt/copytrader"

echo ""
success "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Upload project files to /opt/copytrader"
echo "  2. cp .env.production .env.prod"
echo "  3. Edit .env.prod with your values"
echo "  4. bash deploy.sh"
echo ""
echo "  Or read the full guide: documents/deploy-vps.md"
