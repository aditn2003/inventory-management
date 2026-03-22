/**
 * Shared Axios client for `/api/v1`: attaches JWT + `X-Tenant-Id`, refreshes access token on 401.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { store } from '@/store';
import { updateAccessToken, logout } from '@/store/authSlice';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT + X-Tenant-Id
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const state = store.getState();
  const token = state.auth.accessToken;
  const tenant = state.tenant.selectedTenant;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (tenant && config.headers) {
    config.headers['X-Tenant-Id'] = tenant.id;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

/** 401 on these routes means bad credentials / validation — not an expired access token. */
function isCredentialAuth401Request(config: InternalAxiosRequestConfig | undefined): boolean {
  const url = config?.url ?? '';
  if (url.includes('/auth/login')) return true;
  if (url.includes('/auth/register-invite')) return true;
  // Avoid matching .../register-invite via a lone "/auth/register" check
  if (url.includes('/auth/register') && !url.includes('register-invite')) return true;
  if (url.includes('/auth/google/complete')) return true;
  return false;
}

// Response interceptor — silent refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isCredentialAuth401Request(originalRequest)) {
        return Promise.reject(error);
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = store.getState().auth.refreshToken;
      if (!refreshToken) {
        store.dispatch(logout());
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken,
        });
        const newToken: string = data.access_token;
        store.dispatch(updateAccessToken({ accessToken: newToken, refreshToken: data.refresh_token }));
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        store.dispatch(logout());
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
