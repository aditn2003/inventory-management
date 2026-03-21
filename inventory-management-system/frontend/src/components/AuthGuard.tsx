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
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-600">403 — Access Denied</p>
          <p className="text-sm text-gray-400 mt-1">Admin access required.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
