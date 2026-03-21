import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { store } from '@/store';
import { logout, setCredentials } from '@/store/authSlice';
import { authApi } from '@/api/auth';
import { Layout } from '@/components/Layout/Layout';
import { AuthGuard } from '@/components/AuthGuard';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterInvitePage } from '@/pages/RegisterInvitePage';

// Tenant pages
import { TenantListPage } from '@/pages/tenants/TenantListPage';
import { TenantDetailPage } from '@/pages/tenants/TenantDetailPage';
import { TenantEditPage } from '@/pages/tenants/TenantEditPage';

// Product pages
import { ProductListPage } from '@/pages/products/ProductListPage';
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';
import { ProductEditPage } from '@/pages/products/ProductEditPage';

// Inventory pages
import { InventoryListPage } from '@/pages/inventory/InventoryListPage';
import { InventoryDetailPage } from '@/pages/inventory/InventoryDetailPage';

// Order pages
import { OrderListPage } from '@/pages/orders/OrderListPage';
import { OrderDetailPage } from '@/pages/orders/OrderDetailPage';
import { OrderEditPage } from '@/pages/orders/OrderEditPage';

// User pages (admin only)
import { UserListPage } from '@/pages/users/UserListPage';
import { UserInvitePage } from '@/pages/users/UserInvitePage';
import { UserDetailPage } from '@/pages/users/UserDetailPage';

// Validates the stored access token with the server on startup.
// If the token is expired or invalid, clears auth state so the login page
// is shown instead of a redirect loop.
function AppInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const state = store.getState();
    const token = state.auth.accessToken;

    if (!token) {
      setReady(true);
      return;
    }

    authApi.me()
      .then((user) => {
        store.dispatch(setCredentials({ user, accessToken: token }));
      })
      .catch(() => {
        store.dispatch(logout());
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register/invite" element={<RegisterInvitePage />} />

        {/* Protected routes */}
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/products" replace />} />

            {/* Tenants — admin only */}
            <Route element={<AuthGuard requiredRole="admin" />}>
              <Route path="tenants" element={<TenantListPage />} />
              <Route path="tenants/new" element={<TenantEditPage />} />
              <Route path="tenants/:id" element={<TenantDetailPage />} />
              <Route path="tenants/:id/edit" element={<TenantEditPage />} />
            </Route>

            {/* Products */}
            <Route path="products" element={<ProductListPage />} />
            <Route path="products/new" element={<ProductEditPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="products/:id/edit" element={<ProductEditPage />} />

            {/* Inventory */}
            <Route path="inventory" element={<InventoryListPage />} />
            <Route path="inventory/:id" element={<InventoryDetailPage />} />

            {/* Orders */}
            <Route path="orders" element={<OrderListPage />} />
            <Route path="orders/new" element={<OrderEditPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="orders/:id/edit" element={<OrderEditPage />} />

            {/* Users — admin only */}
            <Route element={<AuthGuard requiredRole="admin" />}>
              <Route path="users" element={<UserListPage />} />
              <Route path="users/new" element={<UserInvitePage />} />
              <Route path="users/:id" element={<UserDetailPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppInitializer>
        <AppRoutes />
      </AppInitializer>
      <Toaster position="top-right" richColors />
    </Provider>
  );
}

export default App;
