import apiClient from './client';
import type { Inventory, InventoryListResponse, StockUpdateInput } from '@/types/inventory';

export const inventoryApi = {
  list: async (params?: { page?: number; page_size?: number; q?: string }): Promise<InventoryListResponse> => {
    const res = await apiClient.get('/inventory', { params });
    return res.data;
  },

  get: async (id: string): Promise<Inventory> => {
    const res = await apiClient.get(`/inventory/${id}`);
    return res.data;
  },

  patchStock: async (id: string, data: StockUpdateInput): Promise<Inventory> => {
    const res = await apiClient.patch(`/inventory/${id}`, data);
    return res.data;
  },

  resetStock: async (id: string): Promise<Inventory> => {
    const res = await apiClient.patch(`/inventory/${id}`, { current_stock: 0 });
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/inventory/${id}`);
  },
};
