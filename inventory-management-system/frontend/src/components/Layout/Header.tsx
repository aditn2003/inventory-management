import { useState, useRef, useEffect } from 'react';
import { SignOut, CaretDown, List } from '@phosphor-icons/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/authSlice';
import { authApi } from '@/api/auth';
import { TenantSelector } from '@/components/ui/TenantSelector';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useSidebar } from './SidebarContext';

export function Header() {
  const { user, refreshToken } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { setMobileOpen } = useSidebar();
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

  const initials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center gap-4 px-6 shrink-0 sticky top-0 z-20
      dark:bg-neutral-900 dark:border-neutral-800">
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors
          dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <List size={22} />
      </button>

      {showTenantSelector && <TenantSelector />}

      <div className="flex-1" />

      <ThemeToggle />

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-xl
            hover:bg-slate-50 transition-all duration-200 group dark:hover:bg-neutral-800"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600
            flex items-center justify-center shadow-sm">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="hidden sm:block text-left">
            <p className="font-medium text-slate-700 dark:text-neutral-200 text-sm leading-tight">{user?.name || 'User'}</p>
            <p className="text-xs text-slate-400 dark:text-neutral-500 capitalize leading-tight">{user?.role}</p>
          </div>
          <CaretDown
            size={14}
            className={`text-slate-400 dark:text-neutral-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200/80
            rounded-xl shadow-elevated z-30 animate-scale-in overflow-hidden
            dark:bg-neutral-800 dark:border-neutral-700/80">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-neutral-700">
              <p className="text-sm font-medium text-slate-700 dark:text-neutral-200">{user?.name}</p>
              <p className="text-xs text-slate-400 dark:text-neutral-500 capitalize">{user?.role}</p>
            </div>
            <div className="p-1.5">
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm
                  text-rose-600 hover:bg-rose-50 rounded-lg transition-colors
                  dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <SignOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
