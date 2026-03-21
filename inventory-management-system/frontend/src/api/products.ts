import apiClient from './client';
import type { Product, ProductCreateInput, ProductListResponse, ProductUpdateInput } from '@/types/product';

export const productsApi = {
  list: async (params?: { page?: number; page_size?: number; q?: string }): Promise<ProductListResponse> => {
    const res = await apiClient.get('/products', { params });
    return res.data;
  },

  get: async (id: string): Promise<Product> => {
    const res = await apiClient.get(`/products/${id}`);
    return res.data;
  },

  create: async (data: ProductCreateInput): Promise<Product> => {
    const res = await apiClient.post('/products', data);
    return res.data;
  },

  update: async (id: string, data: ProductUpdateInput): Promise<Product> => {
    const res = await apiClient.put(`/products/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/products/${id}`);
  },
};
