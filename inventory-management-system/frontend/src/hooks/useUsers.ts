import { useState, useEffect, useCallback, useRef } from 'react';
import { usersApi } from '@/api/users';
import type { UserListResponse, UserDetail } from '@/types/user';

export function useUsers(params?: { page?: number; page_size?: number }) {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await usersApi.list(params);
      setData(result);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useUserDetail(userId: string | undefined) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Avoid full-page skeleton + scroll jump on refetch after first load for this user. */
  const lastFetchedUserIdRef = useRef<string | undefined>(undefined);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const isInitialLoadForUser = lastFetchedUserIdRef.current !== userId;
    if (isInitialLoadForUser) setLoading(true);
    try {
      const result = await usersApi.get(userId);
      setData(result);
      lastFetchedUserIdRef.current = userId;
    } catch {
      setError('Failed to load user.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    lastFetchedUserIdRef.current = undefined;
    setData(null);
    setLoading(true);
  }, [userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
