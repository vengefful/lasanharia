import { useEffect, useState } from 'react';
import { adminApi, AuthExpiredError } from '../api';
import type { Store } from '../../types';
import { formatMoney, parseMoneyToCents } from '../../lib/format';

type FormState = {
  storeName: string;
  whatsappNumber: string;
  address: string;
  city: string;
  state: string;
  isOpen: boolean;
  preparationTime: string;
  announcement: string;
  deliveryFeeReais: string; // input em reais; convertemos para centavos no submit
  pixKey: string;
};

export function StorePage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError(null);
    try {
      const s = await adminApi.getStore();
      setForm(storeToForm(s));
    } catch (e) {
      if (!(e instanceof AuthExpiredError)) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const deliveryFee = parseMoneyToCents(form.deliveryFeeReais || '0');
    if (!Number.isFinite(deliveryFee)) {
      setError('Taxa de entrega inválida');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Partial<Store> = {
        storeName: form.storeName.trim(),
        whatsappNumber: form.whatsappNumber.replace(/\D/g, ''),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase().slice(0, 2),
        isOpen: form.isOpen,
        preparationTime: form.preparationTime.trim(),
        announcement: form.announcement.trim() || null,
        deliveryFee,
        pixKey: form.pixKey.trim(),
      };
      const updated = await adminApi.updateStore(payload);
      setForm(storeToForm(updated));
      setSavedAt(new Date());
    } catch (e) {
      if (!(e instanceof AuthExpiredError)) {
        setError(e instanceof Error ? e.message : 'Erro ao salvar');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-stone-500">Carregando…</p>;
  if (!form) return <p className="text-stone-500">Loja não configurada.</p>;

  const previewFee = parseMoneyToCents(form.deliveryFeeReais || '0');

  return (
    <div>
      <h1 className="text-2xl font-bold">Configuração da loja</h1>
      <p className="text-sm text-stone-500">Editar aqui afeta o cardápio do cliente imediatamente.</p>

      {error && (
        <div className="mt-3 rounded-lg bg-tomato-50 px-3 py-2 text-sm text-tomato-700 ring-1 ring-tomato-100">
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100">
          Salvo às {savedAt.toLocaleTimeString('pt-BR')}.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 grid gap-5">
        <section className="card p-5">
          <h2 className="text-lg font-bold">Identidade</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-stone-700">Nome da loja</label>
              <input
                required
                className="input mt-1"
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-stone-700">Endereço</label>
              <input
                required
                className="input mt-1"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Cidade</label>
              <input
                className="input mt-1"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Coruripe"
                autoComplete="address-level2"
              />
              <p className="mt-1 text-xs text-stone-500">
                Usada no botão "Ver rota" do painel para completar o endereço no Google Maps.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Estado (UF)</label>
              <input
                className="input mt-1 uppercase"
                value={form.state}
                onChange={(e) =>
                  setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })
                }
                placeholder="AL"
                maxLength={2}
                autoComplete="address-level1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">WhatsApp (só dígitos)</label>
              <input
                required
                className="input mt-1"
                value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                placeholder="5582991413741"
              />
              <p className="mt-1 text-xs text-stone-500">
                Formato internacional, sem espaço: 55 + DDD + número. Este é o WhatsApp para onde
                vai o link <code>wa.me</code>.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Tempo de preparo</label>
              <input
                required
                className="input mt-1"
                value={form.preparationTime}
                onChange={(e) => setForm({ ...form, preparationTime: e.target.value })}
                placeholder="40 a 60 min"
              />
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold">Operação</h2>
          <div className="mt-3 grid gap-3">
            <label className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, isOpen: !form.isOpen })}
                className={`inline-flex h-6 w-11 items-center rounded-full px-0.5 transition ${
                  form.isOpen ? 'bg-emerald-500' : 'bg-stone-300'
                }`}
                aria-label={form.isOpen ? 'Fechar loja' : 'Abrir loja'}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow transition ${
                    form.isOpen ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-stone-700">
                Loja {form.isOpen ? 'aberta — recebendo pedidos' : 'fechada — POST /api/orders recusado'}
              </span>
            </label>

            <div>
              <label className="text-sm font-medium text-stone-700">
                Aviso no topo do cardápio (opcional)
              </label>
              <textarea
                className="input mt-1 min-h-[60px]"
                value={form.announcement}
                onChange={(e) => setForm({ ...form, announcement: e.target.value })}
                placeholder="Hoje a entrega pode demorar um pouco mais…"
                maxLength={300}
              />
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold">Frete único</h2>
          <p className="text-sm text-stone-500">
            Taxa única cobrada para todo pedido com <strong>entrega</strong>. <strong>0 = frete grátis</strong>.
            Pedidos com <strong>retirada</strong> nunca pagam frete. O sistema de zonas por bairro não existe — bairro
            é texto livre só pra orientar o atendente.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-stone-700">Taxa de entrega (R$)</label>
              <input
                inputMode="decimal"
                className="input mt-1"
                value={form.deliveryFeeReais}
                onChange={(e) => setForm({ ...form, deliveryFeeReais: e.target.value })}
                placeholder="0,00"
              />
              <p className="mt-1 text-xs text-stone-500">
                {Number.isFinite(previewFee)
                  ? previewFee === 0
                    ? 'Será cobrado: grátis'
                    : `Será cobrado: ${formatMoney(previewFee)} por pedido com entrega`
                  : 'valor inválido'}
              </p>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold">PIX</h2>
          <p className="text-sm text-stone-500">
            Chave PIX usada na mensagem do botão <strong>"Avisar cliente"</strong> quando o pedido for
            confirmado e o pagamento for PIX. Pode ser CPF, telefone, e-mail ou chave aleatória.
          </p>
          <div className="mt-3">
            <label className="text-sm font-medium text-stone-700">Chave PIX</label>
            <input
              className="input mt-1"
              value={form.pixKey}
              onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
              placeholder="ex.: 82991413741 ou lasanharia@exemplo.com"
              autoComplete="off"
              maxLength={200}
            />
            <p className="mt-1 text-xs text-stone-500">
              Vazio = a mensagem de confirmação pede para o cliente chamar para receber a chave.
            </p>
          </div>
        </section>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-stone-200 bg-stone-100/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <button type="submit" disabled={submitting} className="btn-primary px-5 py-2 text-sm">
            {submitting ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </div>
      </form>
    </div>
  );
}

function storeToForm(s: Store): FormState {
  return {
    storeName: s.storeName,
    whatsappNumber: s.whatsappNumber,
    address: s.address,
    city: s.city ?? '',
    state: s.state ?? '',
    isOpen: s.isOpen,
    preparationTime: s.preparationTime,
    announcement: s.announcement ?? '',
    deliveryFeeReais: (s.deliveryFee / 100).toFixed(2).replace('.', ','),
    pixKey: s.pixKey ?? '',
  };
}
