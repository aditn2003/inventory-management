import apiClient from './client';
import type { Tenant } from '@/types/tenant';
import type { UserDetail, UserListResponse, UserRoleUpdate } from '@/types/user';

export const usersApi = {
  list: async (params?: { page?: number; page_size?: number }): Promise<UserListResponse> => {
    const res = await apiClient.get('/users', { params });
    return res.data;
  },

  get: async (id: string): Promise<UserDetail> => {
    const res = await apiClient.get(`/users/${id}`);
    return res.data;
  },

  updateRole: async (id: string, data: UserRoleUpdate): Promise<UserDetail> => {
    const res = await apiClient.put(`/users/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },

  getTenants: async (id: string): Promise<Tenant[]> => {
    const res = await apiClient.get(`/users/${id}/tenants`);
    return res.data;
  },

  assignTenant: async (userId: string, tenantId: string): Promise<void> => {
    await apiClient.post(`/users/${userId}/tenants`, { tenant_id: tenantId });
  },

  removeTenant: async (userId: string, tenantId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}/tenants/${tenantId}`);
  },
};
