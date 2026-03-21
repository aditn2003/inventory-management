import apiClient from './client';
import type { Inventory, InventoryListResponse, StockUpdateInput } from '@/types/inventory';

export type InventoryListSortBy =
  | 'product_name'
  | 'sku'
  | 'cost_per_unit'
  | 'current_stock'
  | 'reorder_threshold'
  | 'created_at';

export const inventoryApi = {
  list: async (params?: {
    page?: number;
    page_size?: number;
    q?: string;
    sort_by?: InventoryListSortBy;
    sort_dir?: 'asc' | 'desc';
    below_reorder_only?: boolean;
  }): Promise<InventoryListResponse> => {
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

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/inventory/${id}`);
  },
};
