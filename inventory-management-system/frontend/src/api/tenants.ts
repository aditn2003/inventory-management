import apiClient from './client';
import type { Tenant, TenantCreateInput, TenantListResponse, TenantUpdateInput } from '@/types/tenant';

export const tenantsApi = {
  list: async (
    params?: {
      page?: number;
      page_size?: number;
      q?: string;
      sort_by?: 'display_id' | 'name' | 'status' | 'created_at';
      sort_dir?: 'asc' | 'desc';
    },
  ): Promise<TenantListResponse> => {
    const res = await apiClient.get('/tenants', { params });
    return res.data;
  },

  get: async (id: string): Promise<Tenant> => {
    const res = await apiClient.get(`/tenants/${id}`);
    return res.data;
  },

  create: async (data: TenantCreateInput): Promise<Tenant> => {
    const res = await apiClient.post('/tenants', data);
    return res.data;
  },

  update: async (id: string, data: TenantUpdateInput): Promise<Tenant> => {
    const res = await apiClient.put(`/tenants/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/tenants/${id}`);
  },
};

/** All tenant IDs (paginates until complete) — for bulk access updates. */
export async function fetchAllTenantIds(): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const res = await tenantsApi.list({ page, page_size: pageSize });
    for (const t of res.data) ids.push(t.id);
    if (page * pageSize >= res.meta.total) break;
    page += 1;
  }
  return ids;
}
