# Deploy na Render

1. Abre o guia: **[`documents/deploy-render-passo-a-passo.md`](documents/deploy-render-passo-a-passo.md)**  
2. No Render: **New → Blueprint** → repositório com o ficheiro **`render.yaml`** na raiz.  
3. Preenche **JWT_SECRET**, **JWT_REFRESH_SECRET** e **ENCRYPTION_KEY** quando o assistente pedir.  
4. Confirma as URLs dos serviços **robo-auto-api** e **robo-auto-web**; se não coincidirem com as do YAML, corrige **FRONTEND_URL** (API) e **VITE_API_URL** (static) e faz **redeploy** do front com *clear build cache*.

O backend já usa **`process.env.PORT`** (Render injeta a porta).
