import apiClient from './client';
import type { Tenant } from '@/types/tenant';
import type { UserDetail, UserInviteInput, UserInviteResponse, UserListResponse, UserRoleUpdate } from '@/types/user';

export const usersApi = {
  list: async (params?: { page?: number; page_size?: number }): Promise<UserListResponse> => {
    const res = await apiClient.get('/users', { params });
    return res.data;
  },

  sendInvitation: async (data: UserInviteInput): Promise<UserInviteResponse> => {
    const res = await apiClient.post('/users/invitations', data);
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

  /** Replace tenant access. Empty `tenant_ids` → user can use every tenant (default). */
  setTenantAccess: async (userId: string, body: { tenant_ids: string[] }): Promise<UserDetail> => {
    const res = await apiClient.put(`/users/${userId}/tenant-access`, body);
    return res.data;
  },
};
