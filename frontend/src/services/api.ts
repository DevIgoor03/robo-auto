import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Token management ──────────────────────────────────────────────────────────

const TOKEN_KEY   = 'ct_access_token';
const REFRESH_KEY = 'ct_refresh_token';
const USER_KEY    = 'ct_user';

export const tokenStore = {
  getAccess:    ()     => localStorage.getItem(TOKEN_KEY)   ?? '',
  getRefresh:   ()     => localStorage.getItem(REFRESH_KEY) ?? '',
  setTokens:    (access: string, refresh: string) => {
    localStorage.setItem(TOKEN_KEY,   access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clearTokens:  ()     => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
  setUser:      (u: any) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  getUser:      ()       => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
  },
};

// ─── Axios instance ────────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

// Attach JWT
api.interceptors.request.use((cfg) => {
  const token = tokenStore.getAccess();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let refreshing = false;
let queue: Array<(token: string) => void> = [];

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as any;
    if (
      error.response?.status === 401 &&
      (error.response.data as any)?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      original._retry = true;
      const refresh = tokenStore.getRefresh();
      if (!refresh) {
        tokenStore.clearTokens();
        window.location.href = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
        return Promise.reject(error);
      }

      if (refreshing) {
        return new Promise((resolve) => {
          queue.push((token) => { original.headers.Authorization = `Bearer ${token}`; resolve(api(original)); });
        });
      }

      refreshing = true;
      try {
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken: refresh });
        tokenStore.setTokens(data.accessToken, data.refreshToken);
        queue.forEach((cb) => cb(data.accessToken));
        queue = [];
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        tokenStore.clearTokens();
        window.location.href = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
        return Promise.reject(error);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }).then((r) => r.data),

  logout: (refreshToken: string) =>
    api.post('/api/auth/logout', { refreshToken }).then((r) => r.data),

  me: () =>
    api.get('/api/auth/me').then((r) => r.data),
};

// ─── Super Admin API ──────────────────────────────────────────────────────────

export type CopyPlanTier = 'START' | 'PRO' | 'ELITE';

export const adminApi = {
  listPlans: () =>
    api.get('/api/admin/plans').then((r) => r.data),

  listMasters: () =>
    api.get('/api/admin/masters').then((r) => r.data),

  createMaster: (email: string, password: string, name: string, subscriptionPlan?: CopyPlanTier) =>
    api.post('/api/admin/masters', { email, password, name, subscriptionPlan }).then((r) => r.data),

  updateMasterPlan: (userId: string, subscriptionPlan: CopyPlanTier) =>
    api.patch(`/api/admin/masters/${userId}/plan`, { subscriptionPlan }).then((r) => r.data),

  updateMasterPortalSlug: (userId: string, portalSlug: string | null) =>
    api.patch(`/api/admin/masters/${userId}/portal-slug`, { portalSlug }).then((r) => r.data),

  deleteMaster: (userId: string) =>
    api.delete(`/api/admin/masters/${userId}`).then((r) => r.data),

  resetMasterPassword: (userId: string, newPassword: string) =>
    api.patch(`/api/admin/masters/${userId}/password`, { newPassword }).then((r) => r.data),

  getPortalAllowlist: (userId: string) =>
    api.get(`/api/admin/masters/${userId}/portal-allowlist`).then((r) => r.data),

  addPortalAllowlistEmail: (userId: string, bullexEmail: string) =>
    api.post(`/api/admin/masters/${userId}/portal-allowlist`, { bullexEmail }).then((r) => r.data),

  removePortalAllowlistEntry: (userId: string, entryId: string) =>
    api.delete(`/api/admin/masters/${userId}/portal-allowlist/${entryId}`).then((r) => r.data),
};

// ─── Accounts API ─────────────────────────────────────────────────────────────

export const accountsApi = {
  connectMaster: (email: string, password: string) =>
    api.post('/api/accounts/master/connect', { email, password }).then((r) => r.data),

  disconnectMaster: () =>
    api.delete('/api/accounts/master').then((r) => r.data),

  getStatus: () =>
    api.get('/api/accounts/status').then((r) => r.data),

  startCopy: () =>
    api.post('/api/accounts/copy/start').then((r) => r.data),

  stopCopy: () =>
    api.post('/api/accounts/copy/stop').then((r) => r.data),

  startRobot: (body: {
    mode: 'auto' | 'common';
    stake: number;
    stopWin: number;
    stopLoss: number;
    accountType?: 'real' | 'demo';
  }) =>
    api.post('/api/accounts/robot/start', body).then((r) => r.data),

  stopRobot: () =>
    api.post('/api/accounts/robot/stop').then((r) => r.data),

  addFollower: (email: string, password: string, copySettings?: any) =>
    api.post('/api/accounts/followers', { email, password, copySettings }).then((r) => r.data),

  updateFollower: (id: string, settings: any) =>
    api.patch(`/api/accounts/followers/${id}`, settings).then((r) => r.data),

  removeFollower: (id: string) =>
    api.delete(`/api/accounts/followers/${id}`).then((r) => r.data),
};

// ─── Trades API ───────────────────────────────────────────────────────────────

export const tradesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    followerId?: string;
    status?: 'OPEN' | 'WIN' | 'LOSS' | 'all';
    search?: string;
    from?: string;
    to?: string;
  }) =>
    api.get('/api/trades', { params }).then((r) => r.data),

  summary: () =>
    api.get('/api/trades/summary').then((r) => r.data),
};

export default api;
