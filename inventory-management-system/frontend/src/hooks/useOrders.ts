import { useState, useEffect, useCallback } from 'react';
import { ordersApi, type OrderListSortBy } from '@/api/orders';
import type { OrderListResponse } from '@/types/order';

export function useOrders(
  tenantId: string | null,
  params?: {
    page?: number;
    page_size?: number;
    q?: string;
    sort_by?: OrderListSortBy;
    sort_dir?: 'asc' | 'desc';
    status?: string;
  },
) {
  const [data, setData] = useState<OrderListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ordersApi.list(params);
      setData(result);
    } catch {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, JSON.stringify(params)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
