import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api/client';
import { StorefrontPage } from './pages/Storefront';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { LoyaltyPage } from './pages/LoyaltyPage';
import { AdminLayout } from './admin/AdminLayout';
import { RequireAdminAuth } from './admin/RequireAdminAuth';
import { LoginPage as AdminLoginPage } from './admin/pages/LoginPage';
import { SummaryPage as AdminSummaryPage } from './admin/pages/SummaryPage';
import { OrdersPage as AdminOrdersPage } from './admin/pages/OrdersPage';
import { CustomersPage as AdminCustomersPage } from './admin/pages/CustomersPage';
import { ProductsPage as AdminProductsPage } from './admin/pages/ProductsPage';
import { CategoriesPage as AdminCategoriesPage } from './admin/pages/CategoriesPage';
import { StorePage as AdminStorePage } from './admin/pages/StorePage';
import { LoyaltyPage as AdminLoyaltyPage } from './admin/pages/LoyaltyPage';

export function App() {
  useDocumentTitleFromStore();

  return (
    <Routes>
      {/* Cliente */}
      <Route path="/" element={<StorefrontPage />} />
      <Route path="/carrinho" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/pedido/:orderNumber" element={<OrderSuccessPage />} />
      <Route path="/fidelidade" element={<LoyaltyPage />} />

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAdminAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/summary" replace />} />
          <Route path="summary" element={<AdminSummaryPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="customers" element={<AdminCustomersPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="store" element={<AdminStorePage />} />
          <Route path="loyalty" element={<AdminLoyaltyPage />} />
        </Route>
      </Route>

      <Route path="*" element={<StorefrontPage />} />
    </Routes>
  );
}

/**
 * Mantém document.title sincronizado com o StoreConfig.storeName.
 * Faz UMA busca em /api/store no mount; depois, qualquer mudança de rota só altera o prefixo
 * ("Admin · " quando entra em /admin/*) — sem refetch a cada navegação.
 * Se o nome mudar no painel, basta o cliente recarregar a página para o título acompanhar.
 */
function useDocumentTitleFromStore() {
  const [storeName, setStoreName] = useState<string | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    api
      .getStore()
      .then((s) => {
        if (!cancelled) setStoreName(s.storeName);
      })
      .catch(() => {
        // GET /api/store falhou (loja não configurada, rede etc) — fallback neutro,
        // ainda melhor que deixar "Carregando…" pra sempre.
        if (!cancelled) setStoreName('Lasanharia');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storeName) return;
    const isAdmin = pathname.startsWith('/admin');
    document.title = isAdmin ? `Admin · ${storeName}` : storeName;
  }, [storeName, pathname]);
}
