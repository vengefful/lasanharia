import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { Category, Product, Store } from '../types';
import { Header } from '../components/Header';
import { CategoryTabs } from '../components/CategoryTabs';
import { ProductCard } from '../components/ProductCard';
import { CartFloatingButton } from '../components/CartFloatingButton';

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

        <section className="mt-5 grid gap-3 pb-6">
          {grouped.length === 0 ? (
            <p className="py-12 text-center text-stone-500">Nenhum produto nessa categoria ainda.</p>
          ) : (
            grouped.map((p) => <ProductCard key={p.id} product={p} disabled={!store.isOpen} />)
          )}
        </section>
      </main>

      <CartFloatingButton />
    </div>
  );
}
