import apiClient from './client';
import type { User, LoginRequest, TokenResponse } from '@/types/auth';

export const authApi = {
  login: async (data: LoginRequest): Promise<{ access_token: string; token_type: string }> => {
    const res = await apiClient.post('/auth/login', data);
    return res.data;
  },

  register: async (email: string, password: string): Promise<User> => {
    const res = await apiClient.post('/auth/register', { email, password });
    return res.data;
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<{ access_token: string }> => {
    const res = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
    return res.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post('/auth/logout', { refresh_token: refreshToken });
  },
};
