import { useState, useEffect, useCallback, useRef } from 'react';
import { tenantsApi } from '@/api/tenants';
import type { Tenant, TenantListResponse } from '@/types/tenant';

export function useTenants(params?: {
  page?: number;
  page_size?: number;
  q?: string;
  sort_by?: 'display_id' | 'name' | 'status' | 'created_at';
  sort_dir?: 'asc' | 'desc';
}) {
  const paramsKey = JSON.stringify(params ?? {});
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [data, setData] = useState<TenantListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Skip table loading skeleton on silent refetch (same filters/page) to avoid layout jump. */
  const lastLoadedKeyRef = useRef<string | null>(null);

  const fetch = useCallback(async () => {
    setError(null);
    const sameQuery = lastLoadedKeyRef.current === paramsKey;
    if (!sameQuery) setLoading(true);
    try {
      const result = await tenantsApi.list(paramsRef.current);
      setData(result);
      lastLoadedKeyRef.current = paramsKey;
    } catch (err: unknown) {
      setError('Failed to load tenants.');
    } finally {
      setLoading(false);
    }
  }, [paramsKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
