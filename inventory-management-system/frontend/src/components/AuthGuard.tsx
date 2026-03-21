import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  requiredRole?: 'admin' | 'user';
}

export function AuthGuard({ requiredRole }: AuthGuardProps) {
  const { user, accessToken } = useAuth();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/products" replace />;
  }

  return <Outlet />;
}
