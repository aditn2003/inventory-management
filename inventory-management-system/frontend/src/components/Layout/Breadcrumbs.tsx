import { Link, useLocation, useParams } from 'react-router-dom';
import { CaretRight } from '@phosphor-icons/react';

const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  tenants: 'Tenants',
  products: 'Products',
  inventory: 'Inventory',
  orders: 'Orders',
  users: 'Users',
  new: 'Create',
  edit: 'Edit',
};

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const params = useParams();

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs: { label: string; path: string }[] = [];
  let currentPath = '';

  for (const segment of segments) {
    currentPath += `/${segment}`;

    if (params.id && segment === params.id) {
      crumbs.push({ label: 'Detail', path: currentPath });
    } else {
      crumbs.push({
        label: routeLabels[segment] ?? segment,
        path: currentPath,
      });
    }
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.path} className="flex items-center gap-1.5">
            {i > 0 && <CaretRight size={12} className="text-slate-300 dark:text-neutral-600" />}
            {isLast ? (
              <span className="text-slate-700 dark:text-neutral-200 font-medium">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="text-slate-400 dark:text-neutral-500 hover:text-primary-600 transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
