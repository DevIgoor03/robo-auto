# ─── Stage 1: Build React ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci --no-cache

COPY . .
RUN npm run build

# ─── Stage 2: Nginx serve + reverse proxy ─────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy production nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 443

# Health via backend (evita falhar quando o Nginx em HTTPS redireciona só o domínio na porta 80)
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://backend:3001/api/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
