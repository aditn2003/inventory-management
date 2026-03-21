import { useCallback, useEffect, useRef, useState } from 'react';
import { authApi } from '@/api/auth';
import type { Tenant } from '@/types/tenant';

export function useAccessibleTenants(params?: { page?: number; page_size?: number }) {
  const [data, setData] = useState<Tenant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await authApi.listAccessibleTenants(paramsRef.current);
      setData(rows);
    } catch {
      setError('Failed to load tenants.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
