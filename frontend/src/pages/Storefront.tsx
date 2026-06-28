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

  // Empilha categorias com seus produtos, na ordem do backend (categoryId asc + featured desc).
  // Pula categoria sem produto disponível pra não mostrar seção vazia.
  const sections = useMemo(() => {
    const list: { category: Category; products: Product[] }[] = [];
    for (const cat of categories) {
      const prods = products.filter((p) => p.categoryId === cat.id);
      if (prods.length > 0) list.push({ category: cat, products: prods });
    }
    return list;
  }, [categories, products]);

  // Scroll-spy: destaca a aba conforme a seção entra no topo (logo abaixo da sticky bar).
  // Banda fina via rootMargin: -64px no topo (altura da sticky bar) e -85% embaixo
  // (só conta o pedaço logo abaixo da barra). Quem cair nessa banda fica ativo;
  // se mais de uma seção cair ao mesmo tempo (transições rápidas), pega a mais alta.
  useEffect(() => {
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length === 0) return;
        const id = Number((visible[0].target as HTMLElement).dataset.sectionCat);
        if (!Number.isNaN(id)) setActiveCategoryId(id);
      },
      { rootMargin: '-64px 0px -85% 0px', threshold: 0 },
    );
    document
      .querySelectorAll<HTMLElement>('[data-section-cat]')
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  function scrollToCategory(catId: number) {
    setActiveCategoryId(catId); // feedback imediato; o observer reconfirma ao chegar
    const el = document.getElementById(`cat-${catId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
          onChange={scrollToCategory}
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

        {sections.length === 0 && (
          <p className="py-12 text-center text-stone-500">Nenhum produto cadastrado ainda.</p>
        )}

        {/* Uma seção por categoria, todas empilhadas. scroll-mt-16 (64px) compensa a sticky bar
            quando o cliente toca uma aba e rolamos a seção pra começar logo abaixo dela. */}
        {sections.map(({ category, products: prods }) => (
          <section
            key={category.id}
            id={`cat-${category.id}`}
            data-section-cat={category.id}
            className="scroll-mt-16 pb-2"
          >
            <h2 className="mt-6 mb-3 text-xl font-bold text-stone-900">{category.name}</h2>
            <div className="grid gap-3">
              {prods.map((p) => (
                <ProductCard key={p.id} product={p} disabled={!store.isOpen} />
              ))}
            </div>
          </section>
        ))}

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
