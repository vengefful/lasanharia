import { useEffect, useState } from 'react';
import { adminApi, AuthExpiredError, type CategoryInput } from '../api';
import type { Category } from '../../types';

type FormState = { id: number | null; name: string; sortOrder: number; active: boolean };
const EMPTY: FormState = { id: null, name: '', sortOrder: 0, active: true };

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);

  async function refresh() {
    setError(null);
    try {
      setCategories(await adminApi.listCategories());
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

  async function toggleActive(c: Category) {
    setCategories((cur) => cur.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
    try {
      await adminApi.updateCategory(c.id, { active: !c.active });
    } catch (e) {
      setCategories((cur) => cur.map((x) => (x.id === c.id ? { ...x, active: c.active } : x)));
      if (!(e instanceof AuthExpiredError)) {
        setError(e instanceof Error ? e.message : 'Erro ao alternar');
      }
    }
  }

  async function save(form: FormState) {
    const payload: CategoryInput = {
      name: form.name.trim(),
      sortOrder: form.sortOrder,
      active: form.active,
    };
    if (form.id) await adminApi.updateCategory(form.id, payload);
    else await adminApi.createCategory(payload);
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-sm text-stone-500">{categories.length} no total</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY })}
          className="btn-primary px-4 py-2 text-sm"
        >
          + Nova categoria
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-tomato-50 px-3 py-2 text-sm text-tomato-700 ring-1 ring-tomato-100">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl bg-white ring-1 ring-stone-200">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2 text-center">Ordem</th>
              <th className="px-4 py-2 text-center">Ativa</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-stone-500">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-stone-500">
                  Sem categorias.
                </td>
              </tr>
            )}
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="px-4 py-3 text-center tabular-nums">{c.sortOrder}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleActive(c)}
                    className={`inline-flex h-6 w-11 items-center rounded-full px-0.5 transition ${
                      c.active ? 'bg-emerald-500' : 'bg-stone-300'
                    }`}
                    aria-label={c.active ? 'Desativar' : 'Ativar'}
                  >
                    <span
                      className={`block h-5 w-5 rounded-full bg-white shadow transition ${
                        c.active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ id: c.id, name: c.name, sortOrder: c.sortOrder, active: c.active })
                    }
                    className="rounded-lg px-2 py-1 text-sm font-semibold text-tomato-700 hover:bg-cream-100"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CategoryFormModal
          form={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
          onError={(msg) => setError(msg)}
          save={save}
        />
      )}
    </div>
  );
}

function CategoryFormModal({
  form,
  onClose,
  onSaved,
  onError,
  save,
}: {
  form: FormState;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
  save: (form: FormState) => Promise<void>;
}) {
  const [state, setState] = useState(form);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.name.trim()) return;
    setSubmitting(true);
    try {
      await save(state);
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
        className="grid w-full max-w-sm gap-3 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold">{state.id ? 'Editar categoria' : 'Nova categoria'}</h2>
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
          <label className="text-sm font-medium text-stone-700">Ordem de exibição</label>
          <input
            type="number"
            className="input mt-1"
            value={state.sortOrder}
            onChange={(e) => setState({ ...state, sortOrder: Number(e.target.value) })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.active}
            onChange={(e) => setState({ ...state, active: e.target.checked })}
          />
          Categoria ativa (aparece para o cliente)
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
