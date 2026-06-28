import { useEffect, useMemo, useState } from 'react';
import { adminApi, AuthExpiredError, type ProductInput } from '../api';
import type { Category, Product } from '../../types';
import { formatMoney, parseMoneyToCents } from '../../lib/format';

type FormState = {
  id: number | null;
  name: string;
  description: string;
  priceReais: string;
  categoryId: number | '';
  imageUrl: string;
  available: boolean;
  featured: boolean;
  countsForLoyalty: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  description: '',
  priceReais: '',
  categoryId: '',
  imageUrl: '',
  available: true,
  featured: false,
  countsForLoyalty: false,
};

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);

  async function refresh() {
    setError(null);
    try {
      const [p, c] = await Promise.all([adminApi.listProducts(), adminApi.listCategories()]);
      setProducts(p);
      setCategories(c);
    } catch (e) {
      if (!(e instanceof AuthExpiredError)) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const grouped = useMemo(() => {
    const byCat = new Map<number, Product[]>();
    for (const p of products) {
      if (!byCat.has(p.categoryId)) byCat.set(p.categoryId, []);
      byCat.get(p.categoryId)!.push(p);
    }
    return byCat;
  }, [products]);

  function openNew() {
    setEditing({ ...EMPTY_FORM, categoryId: categories[0]?.id ?? '' });
  }

  function openEdit(p: Product) {
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description,
      priceReais: (p.price / 100).toFixed(2).replace('.', ','),
      categoryId: p.categoryId,
      imageUrl: p.imageUrl ?? '',
      available: p.available,
      featured: p.featured,
      countsForLoyalty: p.countsForLoyalty,
    });
  }

  async function toggleAvailable(p: Product) {
    // otimista
    setProducts((cur) => cur.map((x) => (x.id === p.id ? { ...x, available: !p.available } : x)));
    try {
      await adminApi.updateProduct(p.id, { available: !p.available });
    } catch (e) {
      setProducts((cur) => cur.map((x) => (x.id === p.id ? { ...x, available: p.available } : x)));
      if (!(e instanceof AuthExpiredError)) {
        setError(e instanceof Error ? e.message : 'Erro ao alternar disponibilidade');
      }
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Remover "${p.name}"? Pedidos antigos não são afetados.`)) return;
    try {
      await adminApi.deleteProduct(p.id);
      setProducts((cur) => cur.filter((x) => x.id !== p.id));
    } catch (e) {
      if (!(e instanceof AuthExpiredError)) {
        setError(e instanceof Error ? e.message : 'Erro ao remover');
      }
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-stone-500">
            {products.length} produto{products.length === 1 ? '' : 's'}
          </p>
        </div>
        <button type="button" onClick={openNew} className="btn-primary px-4 py-2 text-sm">
          + Novo produto
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-tomato-50 px-3 py-2 text-sm text-tomato-700 ring-1 ring-tomato-100">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-5">
        {loading && <p className="text-stone-500">Carregando…</p>}
        {!loading &&
          categories.map((cat) => {
            const items = grouped.get(cat.id) ?? [];
            return (
              <section key={cat.id}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-stone-500">
                  {cat.name}
                </h2>
                <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-stone-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
                      <tr>
                        <th className="px-4 py-2">Produto</th>
                        <th className="px-4 py-2 text-right">Preço</th>
                        <th className="px-4 py-2 text-center">Disponível</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-stone-400">
                            Sem produtos nesta categoria.
                          </td>
                        </tr>
                      )}
                      {items.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3">
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-xs text-stone-500">{p.description}</div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatMoney(p.price)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleAvailable(p)}
                              className={`inline-flex h-6 w-11 items-center rounded-full px-0.5 transition ${
                                p.available ? 'bg-emerald-500' : 'bg-stone-300'
                              }`}
                              aria-label={p.available ? 'Marcar indisponível' : 'Marcar disponível'}
                            >
                              <span
                                className={`block h-5 w-5 rounded-full bg-white shadow transition ${
                                  p.available ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="rounded-lg px-2 py-1 text-sm font-semibold text-tomato-700 hover:bg-cream-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(p)}
                              className="ml-1 rounded-lg px-2 py-1 text-sm font-semibold text-stone-500 hover:bg-stone-100 hover:text-tomato-700"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
      </div>

      {editing && (
        <ProductFormModal
          form={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}

function ProductFormModal({
  form,
  categories,
  onClose,
  onSaved,
  onError,
}: {
  form: FormState;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [state, setState] = useState(form);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = parseMoneyToCents(state.priceReais);
    if (!Number.isFinite(price)) {
      onError('Preço inválido');
      return;
    }
    if (typeof state.categoryId !== 'number') {
      onError('Escolha uma categoria');
      return;
    }
    setSubmitting(true);
    const payload: ProductInput = {
      name: state.name.trim(),
      description: state.description.trim(),
      price,
      categoryId: state.categoryId,
      imageUrl: state.imageUrl.trim() || null,
      available: state.available,
      featured: state.featured,
      countsForLoyalty: state.countsForLoyalty,
    };
    try {
      if (state.id) await adminApi.updateProduct(state.id, payload);
      else await adminApi.createProduct(payload);
      onSaved();
    } catch (e) {
      if (!(e instanceof AuthExpiredError)) {
        onError(e instanceof Error ? e.message : 'Erro ao salvar');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 grid place-items-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="grid w-full max-w-md gap-3 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold">{state.id ? 'Editar produto' : 'Novo produto'}</h2>

        <div>
          <label className="text-sm font-medium text-stone-700">Nome</label>
          <input
            required
            className="input mt-1"
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-stone-700">Descrição</label>
          <textarea
            className="input mt-1 min-h-[60px]"
            value={state.description}
            onChange={(e) => setState({ ...state, description: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-stone-700">Preço (R$)</label>
            <input
              required
              inputMode="decimal"
              className="input mt-1"
              value={state.priceReais}
              onChange={(e) => setState({ ...state, priceReais: e.target.value })}
              placeholder="25,00"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">Categoria</label>
            <select
              required
              className="input mt-1"
              value={state.categoryId === '' ? '' : String(state.categoryId)}
              onChange={(e) => setState({ ...state, categoryId: Number(e.target.value) })}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-stone-700">URL da imagem (opcional)</label>
          <input
            className="input mt-1"
            value={state.imageUrl}
            onChange={(e) => setState({ ...state, imageUrl: e.target.value })}
            placeholder="https://…"
          />
        </div>

        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.available}
              onChange={(e) => setState({ ...state, available: e.target.checked })}
            />
            Disponível
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.featured}
              onChange={(e) => setState({ ...state, featured: e.target.checked })}
            />
            Em destaque
          </label>
        </div>

        <label className="flex items-start gap-2 rounded-xl bg-cream-50 p-3 text-sm ring-1 ring-cream-200">
          <input
            type="checkbox"
            checked={state.countsForLoyalty}
            onChange={(e) => setState({ ...state, countsForLoyalty: e.target.checked })}
            className="mt-0.5"
          />
          <div>
            <div className="font-semibold text-stone-800">🍒 Conta para fidelidade</div>
            <div className="text-xs text-stone-500">
              Marque as <strong>lasanhas</strong>. Cada unidade vendida vale 1 ponto, creditado
              quando o pedido for entregue. Refrigerantes e combos normalmente ficam desmarcados.
            </div>
          </div>
        </label>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm">
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
