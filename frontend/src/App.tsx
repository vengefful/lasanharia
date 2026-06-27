import { Route, Routes } from 'react-router-dom';
import { StorefrontPage } from './pages/Storefront';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderSuccessPage } from './pages/OrderSuccessPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<StorefrontPage />} />
      <Route path="/carrinho" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/pedido/:orderNumber" element={<OrderSuccessPage />} />
      <Route path="*" element={<StorefrontPage />} />
    </Routes>
  );
}
