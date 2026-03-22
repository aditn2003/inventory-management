import { NavLink, useLocation } from 'react-router-dom';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  Buildings,
  Package,
  Stack,
  ShoppingCart,
  UsersThree,
  Cube,
  CaretLeft,
  House,
} from '@phosphor-icons/react';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from './SidebarContext';

interface NavItem {
  to: string;
  label: string;
  icon: PhosphorIcon;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: House },
  { to: '/tenants', label: 'Tenants', icon: Buildings, adminOnly: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: Stack },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/users', label: 'Users', icon: UsersThree, adminOnly: true },
];

export function Sidebar() {
  const { user } = useAuth();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const location = useLocation();

  const sidebarContent = (
    <aside
      className={`bg-neutral-900 border-r border-neutral-800 flex flex-col h-full
        transition-all duration-300 ease-in-out ${collapsed ? 'w-[68px]' : 'w-60'}`}
    >
      <div className={`h-16 shrink-0 flex items-center border-b border-neutral-800
        ${collapsed ? 'flex-col justify-center px-0 gap-0' : 'px-5'}`}
      >
        <button
          onClick={collapsed ? toggle : undefined}
          className={`w-9 h-9 rounded-lg bg-primary-500/20 flex items-center justify-center shrink-0
            ${collapsed ? 'cursor-pointer hover:bg-primary-500/30 transition-colors' : 'cursor-default'}`}
          title={collapsed ? 'Expand sidebar' : undefined}
        >
          <Cube size={22} weight="fill" className="text-primary-400" />
        </button>
        {!collapsed && (
          <>
            <span className="font-bold text-white text-lg tracking-tight whitespace-nowrap ml-3">IMS</span>
            <button
              onClick={toggle}
              className="ml-auto p-1.5 rounded-lg text-neutral-500 hover:bg-white/10 hover:text-neutral-300
                transition-all duration-200"
              title="Collapse sidebar"
            >
              <CaretLeft size={16} />
            </button>
          </>
        )}
      </div>

      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          if (item.adminOnly && user?.role !== 'admin') return null;
          const Icon = item.icon;
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={`group relative flex items-center rounded-lg text-sm font-medium
                transition-all duration-200 overflow-hidden
                ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'}
                ${isActive
                  ? 'bg-primary-500/15 text-primary-300'
                  : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                }`}
              title={collapsed ? item.label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-400 rounded-r-full" />
              )}
              <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block shrink-0">{sidebarContent}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 h-full w-60 animate-fade-up">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
