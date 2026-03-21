import { useState, useEffect, useCallback } from 'react';
import { tenantsApi } from '@/api/tenants';
import type { Tenant, TenantListResponse } from '@/types/tenant';

export function useTenants(params?: { page?: number; page_size?: number; q?: string }) {
  const [data, setData] = useState<TenantListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tenantsApi.list(params);
      setData(result);
    } catch (err: unknown) {
      setError('Failed to load tenants.');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
