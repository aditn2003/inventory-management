import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { store } from '@/store';
import { logout, setCredentials } from '@/store/authSlice';
import { authApi } from '@/api/auth';
import { Layout } from '@/components/Layout/Layout';
import { AuthGuard } from '@/components/AuthGuard';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { LoginPage } from '@/pages/LoginPage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { RegisterInvitePage } from '@/pages/RegisterInvitePage';
import { DashboardPage } from '@/pages/DashboardPage';

import { TenantListPage } from '@/pages/tenants/TenantListPage';
import { TenantDetailPage } from '@/pages/tenants/TenantDetailPage';
import { TenantEditPage } from '@/pages/tenants/TenantEditPage';

import { ProductListPage } from '@/pages/products/ProductListPage';
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';
import { ProductEditPage } from '@/pages/products/ProductEditPage';

import { InventoryListPage } from '@/pages/inventory/InventoryListPage';
import { InventoryDetailPage } from '@/pages/inventory/InventoryDetailPage';

import { OrderListPage } from '@/pages/orders/OrderListPage';
import { OrderDetailPage } from '@/pages/orders/OrderDetailPage';
import { OrderEditPage } from '@/pages/orders/OrderEditPage';

import { UserListPage } from '@/pages/users/UserListPage';
import { UserInvitePage } from '@/pages/users/UserInvitePage';
import { UserDetailPage } from '@/pages/users/UserDetailPage';

function AppInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/auth/oauth-callback') {
      setReady(true);
      return;
    }

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
      <div className="flex items-center justify-center h-screen bg-surface dark:bg-surface-dark">
        <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
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
        <Route path="/auth/oauth-callback" element={<OAuthCallbackPage />} />
        <Route path="/register/invite" element={<RegisterInvitePage />} />

        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />

            <Route element={<AuthGuard requiredRole="admin" />}>
              <Route path="tenants" element={<TenantListPage />} />
              <Route path="tenants/new" element={<TenantEditPage />} />
              <Route path="tenants/:id" element={<TenantDetailPage />} />
              <Route path="tenants/:id/edit" element={<TenantEditPage />} />
            </Route>

            <Route path="products" element={<ProductListPage />} />
            <Route path="products/new" element={<ProductEditPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="products/:id/edit" element={<ProductEditPage />} />

            <Route path="inventory" element={<InventoryListPage />} />
            <Route path="inventory/:id" element={<InventoryDetailPage />} />

            <Route path="orders" element={<OrderListPage />} />
            <Route path="orders/new" element={<OrderEditPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="orders/:id/edit" element={<OrderEditPage />} />

            <Route element={<AuthGuard requiredRole="admin" />}>
              <Route path="users" element={<UserListPage />} />
              <Route path="users/new" element={<UserInvitePage />} />
              <Route path="users/:id" element={<UserDetailPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      richColors
      theme={theme}
      toastOptions={{
        className: 'font-sans',
        style: {
          borderRadius: '0.75rem',
          fontSize: '0.875rem',
        },
      }}
    />
  );
}

function App() {
  return (
    <ThemeProvider>
      <Provider store={store}>
        <AppInitializer>
          <AppRoutes />
        </AppInitializer>
        <ThemedToaster />
      </Provider>
    </ThemeProvider>
  );
}

export default App;
