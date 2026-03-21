import { useState, useRef, useEffect } from 'react';
import { User, SignOut, CaretDown } from '@phosphor-icons/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/authSlice';
import { authApi } from '@/api/auth';
import { TenantSelector } from '@/components/ui/TenantSelector';

export function Header() {
  const { user, refreshToken } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const showTenantSelector =
    !pathname.startsWith('/tenants') && !pathname.startsWith('/users');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (refreshToken) {
      try { await authApi.logout(refreshToken); } catch {}
    }
    dispatch(logout());
    navigate('/login');
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-6 shrink-0">
      {showTenantSelector && <TenantSelector />}

      <div className="relative ml-auto" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 py-1.5 px-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <User size={14} className="text-blue-700" />
          </div>
          <span className="font-medium">{user?.email}</span>
          <span className="text-xs text-gray-400 capitalize">({user?.role})</span>
          <CaretDown size={14} className="text-gray-400" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <button
              onClick={handleLogout}
              className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <SignOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
