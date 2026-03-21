import { useState, useEffect, useCallback } from 'react';
import { inventoryApi, type InventoryListSortBy } from '@/api/inventory';
import type { InventoryListResponse } from '@/types/inventory';

export function useInventory(
  tenantId: string | null,
  params?: {
    page?: number;
    page_size?: number;
    q?: string;
    sort_by?: InventoryListSortBy;
    sort_dir?: 'asc' | 'desc';
    below_reorder_only?: boolean;
  },
) {
  const [data, setData] = useState<InventoryListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await inventoryApi.list(params);
      setData(result);
    } catch {
      setError('Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, JSON.stringify(params)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
