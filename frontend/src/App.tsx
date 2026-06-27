import { Navigate, Route, Routes } from 'react-router-dom';
import { StorefrontPage } from './pages/Storefront';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';
import { AdminLayout } from './admin/AdminLayout';
import { RequireAdminAuth } from './admin/RequireAdminAuth';
import { LoginPage as AdminLoginPage } from './admin/pages/LoginPage';
import { OrdersPage as AdminOrdersPage } from './admin/pages/OrdersPage';
import { ProductsPage as AdminProductsPage } from './admin/pages/ProductsPage';
import { CategoriesPage as AdminCategoriesPage } from './admin/pages/CategoriesPage';
import { StorePage as AdminStorePage } from './admin/pages/StorePage';

export function App() {
  return (
    <Routes>
      {/* Cliente */}
      <Route path="/" element={<StorefrontPage />} />
      <Route path="/carrinho" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/pedido/:orderNumber" element={<OrderSuccessPage />} />

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAdminAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/orders" replace />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="store" element={<AdminStorePage />} />
        </Route>
      </Route>

      <Route path="*" element={<StorefrontPage />} />
    </Routes>
  );
}
