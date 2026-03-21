import { NavLink } from 'react-router-dom';
import {
  Buildings,
  Package,
  Stack,
  ShoppingCart,
  UsersThree,
  Cube,
} from '@phosphor-icons/react';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/tenants', label: 'Tenants', icon: <Buildings size={20} /> },
  { to: '/products', label: 'Products', icon: <Package size={20} /> },
  { to: '/inventory', label: 'Inventory', icon: <Stack size={20} /> },
  { to: '/orders', label: 'Orders', icon: <ShoppingCart size={20} /> },
  { to: '/users', label: 'Users', icon: <UsersThree size={20} />, adminOnly: true },
];

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-center gap-2">
        <Cube size={24} weight="fill" className="text-blue-600" />
        <span className="font-semibold text-gray-900 text-base">IMS</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          if (item.adminOnly && user?.role !== 'admin') return null;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
