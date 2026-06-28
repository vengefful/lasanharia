import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { Category, Product, Store } from '../types';
import { Header } from '../components/Header';
import { CategoryTabs } from '../components/CategoryTabs';
import { ProductCard } from '../components/ProductCard';
import { CartFloatingButton } from '../components/CartFloatingButton';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../admin/auth';

export function StorefrontPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getStore(), api.getCategories(), api.getProducts()])
      .then(([s, c, p]) => {
        setStore(s);
        setCategories(c);
        setProducts(p);
        if (c.length) setActiveCategoryId(c[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const grouped = useMemo(() => {
    if (activeCategoryId == null) return products;
    return products.filter((p) => p.categoryId === activeCategoryId);
  }, [products, activeCategoryId]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center">
        <h2 className="text-xl font-bold">Não consegui carregar o cardápio.</h2>
        <p className="mt-2 text-stone-600">{error}</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-stone-500">Carregando…</div>
    );
  }

  return (
    <div className="mx-auto min-h-full max-w-2xl bg-cream-50 pb-32">
      <AdminReturnBar />
      <Header store={store} />

      <main className="px-5 sm:px-8">
        <CategoryTabs
          categories={categories}
          activeId={activeCategoryId}
          onChange={setActiveCategoryId}
        />

        {!store.isOpen && (
          <div className="mt-4 rounded-xl bg-stone-900/5 px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-200">
            A loja está <strong>fechada</strong> no momento — você pode navegar o cardápio, mas
            pedidos voltam quando reabrirmos.
          </div>
        )}

        <Link
          to="/fidelidade"
          className="mt-3 flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-stone-200 hover:bg-cream-100"
        >
          <span>
            🍒 <strong>Programa de Fidelidade</strong> — 10 lasanhas, 1 grátis
          </span>
          <span className="text-tomato-700">Ver meus pontos →</span>
        </Link>

        <section className="mt-5 grid gap-3 pb-6">
          {grouped.length === 0 ? (
            <p className="py-12 text-center text-stone-500">Nenhum produto nessa categoria ainda.</p>
          ) : (
            grouped.map((p) => <ProductCard key={p.id} product={p} disabled={!store.isOpen} />)
          )}
        </section>

        {/* Acesso ao painel admin a partir da loja — discreto, padrão "área do administrador" no pé. */}
        <footer className="mt-8 border-t border-stone-200/60 pt-4 pb-24 text-center text-xs text-stone-400">
          <Link to="/admin" className="hover:text-stone-600 hover:underline">
            Acesso administrativo
          </Link>
        </footer>
      </main>

      <CartFloatingButton />
    </div>
  );
}

/**
 * Faixa fina mostrada SÓ pra quem está logada no admin (JWT em localStorage).
 * O cliente comum não vê nada — fica null. Reage à mudança do token via Zustand,
 * então sumir/aparecer é automático após login/logout no admin.
 */
function AdminReturnBar() {
  const adminToken = useAdminAuth((s) => s.token);
  if (!adminToken) return null;
  return (
    <Link
      to="/admin"
      className="block bg-stone-900 text-center text-sm font-medium text-white hover:bg-stone-800"
    >
      <span className="inline-block py-2">← Voltar ao painel</span>
    </Link>
  );
}
