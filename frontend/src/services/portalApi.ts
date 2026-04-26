import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const PORTAL_TOKEN_KEY = 'ct_portal_token';

export const portalTokenStore = {
  get:   () => localStorage.getItem(PORTAL_TOKEN_KEY) ?? '',
  set:   (t: string) => localStorage.setItem(PORTAL_TOKEN_KEY, t),
  clear: () => localStorage.removeItem(PORTAL_TOKEN_KEY),
};

const portalAxios = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

portalAxios.interceptors.request.use((cfg) => {
  const token = portalTokenStore.get();
  if (token) cfg.headers['x-portal-token'] = token;
  return cfg;
});

export const portalApi = {
  /** Dados públicos para a tela de login do seguidor (nome do operador). */
  masterPublic: (routeKey: string) =>
    portalAxios.get(`/api/portal/${encodeURIComponent(routeKey)}/public`).then((r) => r.data),

  login: (masterId: string, email: string, password: string) =>
    portalAxios.post(`/api/portal/${masterId}/login`, { email, password }).then((r) => r.data),

  me: () =>
    portalAxios.get('/api/portal/me').then((r) => r.data),

  updateSettings: (settings: any) =>
    portalAxios.patch('/api/portal/settings', settings).then((r) => r.data),

  /** Ativar copy pode reconectar à Bullex no servidor — timeout maior. */
  toggleCopy: (isActive: boolean) =>
    portalAxios
      .post('/api/portal/copy/toggle', { isActive }, { timeout: isActive ? 90_000 : 15_000 })
      .then((r) => r.data),

  trades: (params?: {
    page?: number;
    limit?: number;
    status?: 'ALL' | 'OPEN' | 'WIN' | 'LOSS' | 'DRAW';
    from?: string;
    to?: string;
    search?: string;
  }) =>
    portalAxios.get('/api/portal/trades', { params }).then((r) => r.data),

  logout: () =>
    portalAxios.post('/api/portal/logout').then((r) => r.data),

  traders: () =>
    portalAxios.get('/api/portal/traders').then((r) => r.data),
};
