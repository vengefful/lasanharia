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
  usePwaInstallTags();

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
    // /admin* tem título FIXO "Painel Vovó" — bate com o que o script inline do
    // index.html escreveu no carregamento. iOS 26 usa o <title> para nomear o ícone
    // ao Adicionar à Tela de Início (ignora apple-mobile-web-app-title), então
    // qualquer "Admin · <storeName>" vazaria como "Vovó Magal" no nome do ícone.
    const isAdmin = pathname.startsWith('/admin');
    if (isAdmin) {
      document.title = 'Painel Vovó';
      return;
    }
    if (!storeName) return;
    document.title = storeName;
  }, [storeName, pathname]);
}

/**
 * Troca o <link rel="manifest"> e o título do iOS ("apple-mobile-web-app-title")
 * conforme a aba atual. Importa pra PWA install:
 *
 *   - iOS Safari ≥ 16.4 respeita o `start_url` do manifest no Add to Home Screen,
 *     então um manifest único com start_url=/ faria o ícone do PAINEL abrir a loja.
 *     Aqui apontamos para um manifest-admin.json quando o usuário está em /admin*,
 *     que tem start_url=/admin/summary.
 *
 *   - O título sob o ícone do iPhone vem do apple-mobile-web-app-title da aba —
 *     também trocamos para "Painel Vovó" em /admin.
 *
 * Tudo via DOM porque o index.html é o mesmo para todas as rotas (SPA).
 * O Safari relê essas tags ao abrir o Share menu, então o swap precisa só ter
 * acontecido antes do usuário tocar "Adicionar à Tela de Início".
 */
function usePwaInstallTags() {
  const { pathname } = useLocation();
  useEffect(() => {
    const isAdmin = pathname.startsWith('/admin');
    const manifestHref = isAdmin ? '/manifest-admin.json' : '/manifest.json';
    const appleTitle = isAdmin ? 'Painel Vovó' : 'Vovó Magal';

    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifestLink && manifestLink.getAttribute('href') !== manifestHref) {
      manifestLink.setAttribute('href', manifestHref);
    }

    const appleTitleMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    if (appleTitleMeta && appleTitleMeta.getAttribute('content') !== appleTitle) {
      appleTitleMeta.setAttribute('content', appleTitle);
    }
  }, [pathname]);
}
