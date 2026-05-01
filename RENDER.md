# Deploy na Render

1. Abre o guia: **[`documents/deploy-render-passo-a-passo.md`](documents/deploy-render-passo-a-passo.md)**  
2. No Render: **New → Blueprint** → repositório com o ficheiro **`render.yaml`** na raiz.  
3. Preenche **JWT_SECRET**, **JWT_REFRESH_SECRET** e **ENCRYPTION_KEY** quando o assistente pedir.  
4. **Sem domínio:** as URLs vêm do painel (`*.onrender.com`). O `render.yaml` já usa `https://robo-auto-web.onrender.com` e `https://robo-auto-api.onrender.com`; se a Render mostrar outro URL, ajusta **FRONTEND_URL** e **VITE_API_URL** no painel e faz **redeploy** do static com *clear build cache*.

O **`.env.production`** é só para **VPS/Docker**, não para a Render.

O backend já usa **`process.env.PORT`** (Render injeta a porta).
