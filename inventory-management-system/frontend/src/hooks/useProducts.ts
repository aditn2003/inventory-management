import { useState, useEffect, useCallback } from 'react';
import { productsApi } from '@/api/products';
import type { ProductListResponse } from '@/types/product';

export function useProducts(
  tenantId: string | null,
  params?: { page?: number; page_size?: number; q?: string }
) {
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await productsApi.list(params);
      setData(result);
    } catch {
      setError('Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, JSON.stringify(params)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
