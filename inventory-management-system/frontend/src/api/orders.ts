import apiClient from './client';
import type { Order, OrderCreateInput, OrderListResponse, OrderUpdateInput } from '@/types/order';

export type OrderListSortBy =
  | 'created_at'
  | 'order_date'
  | 'status'
  | 'requested_qty'
  | 'display_id'
  | 'product_name';

export const ordersApi = {
  list: async (params?: {
    page?: number;
    page_size?: number;
    q?: string;
    sort_by?: OrderListSortBy;
    sort_dir?: 'asc' | 'desc';
    status?: string;
  }): Promise<OrderListResponse> => {
    const res = await apiClient.get('/orders', { params });
    return res.data;
  },

  get: async (id: string): Promise<Order> => {
    const res = await apiClient.get(`/orders/${id}`);
    return res.data;
  },

  create: async (data: OrderCreateInput): Promise<Order> => {
    const res = await apiClient.post('/orders', data);
    return res.data;
  },

  update: async (id: string, data: OrderUpdateInput): Promise<Order> => {
    const res = await apiClient.put(`/orders/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/orders/${id}`);
  },

  confirm: async (id: string): Promise<Order> => {
    const res = await apiClient.post(`/orders/${id}/confirm`);
    return res.data;
  },

  cancel: async (id: string): Promise<Order> => {
    const res = await apiClient.post(`/orders/${id}/cancel`);
    return res.data;
  },
};
