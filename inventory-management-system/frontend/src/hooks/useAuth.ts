import { useAppSelector } from '@/store/hooks';

export function useAuth() {
  return useAppSelector((state) => state.auth);
}
