import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../store/cart';
import { api, ApiError } from '../api/client';
import type { OrderType, PaymentMethod, Store } from '../types';
import { formatMoney, parseMoneyToCents } from '../lib/format';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../lib/whatsapp';

const PAYMENT_METHODS: PaymentMethod[] = ['Pix', 'Cartão na entrega', 'Dinheiro'];

type LocationState = { orderType?: OrderType; neighborhood?: string };

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = (location.state ?? {}) as LocationState;
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);

  const [store, setStore] = useState<Store | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>(incoming.orderType ?? 'entrega');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState(incoming.neighborhood ?? '');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [changeForReais, setChangeForReais] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getStore()
      .then(setStore)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (items.length === 0 && !submitting) navigate('/carrinho', { replace: true });
  }, [items.length, navigate, submitting]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = orderType === 'retirada' ? 0 : store?.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!store) return;
    setError(null);
    setSubmitting(true);
    try {
      const changeFor =
        paymentMethod === 'Dinheiro' && changeForReais
          ? parseMoneyToCents(changeForReais)
          : undefined;
      if (paymentMethod === 'Dinheiro' && changeForReais && (Number.isNaN(changeFor) || (changeFor ?? 0) < total)) {
        setError('Troco precisa ser maior ou igual ao total.');
        setSubmitting(false);
        return;
      }

      const order = await api.createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.replace(/\D/g, ''),
        orderType,
        address: orderType === 'entrega' ? address.trim() : undefined,
        addressNumber: orderType === 'entrega' ? addressNumber.trim() : undefined,
        neighborhood: orderType === 'entrega' ? neighborhood : undefined,
        reference: orderType === 'entrega' && reference ? reference.trim() : undefined,
        notes: notes.trim() || undefined,
        paymentMethod,
        changeFor: paymentMethod === 'Dinheiro' && changeFor ? changeFor : undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });

      const message = buildWhatsAppMessage(order);
      const url = buildWhatsAppUrl(store.whatsappNumber, message);
      clearCart();
      // Salva os dados pra próxima tela conseguir reabrir se o popup foi bloqueado.
      sessionStorage.setItem(
        'lasanharia-last-order',
        JSON.stringify({ orderNumber: order.orderNumber, url, message }),
      );
      window.open(url, '_blank', 'noopener');
      navigate(`/pedido/${order.orderNumber}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setSubmitting(false);
    }
  }

  if (!store) {
    return <div className="px-5 py-12 text-center text-stone-500">Carregando…</div>;
  }

  return (
    <div className="mx-auto min-h-full max-w-2xl bg-cream-50 px-5 pb-12 sm:px-8">
      <div className="flex items-center gap-2 pt-5">
        <Link to="/carrinho" className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-stone-200">
          ←
        </Link>
        <h1 className="text-2xl font-bold">Finalizar pedido</h1>
      </div>

      {!store.isOpen && (
        <div className="mt-4 rounded-xl bg-stone-900/5 px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-200">
          A loja está <strong>fechada</strong> agora — o pedido não vai poder ser enviado.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 grid gap-5">
        <section className="card p-5">
          <h2 className="text-lg font-bold">Seus dados</h2>
          <div className="mt-3 grid gap-3">
            <div>
              <label className="text-sm font-medium text-stone-700">Nome</label>
              <input
                required
                className="input mt-1"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Telefone (WhatsApp)</label>
              <input
                required
                type="tel"
                inputMode="tel"
                placeholder="(11) 98765-4321"
                className="input mt-1"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold">Como entregar</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['entrega', 'retirada'] as OrderType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                className={`rounded-xl px-4 py-3 font-semibold transition ${
                  orderType === t
                    ? 'bg-tomato-600 text-white shadow-soft'
                    : 'bg-cream-100 text-stone-700 hover:bg-cream-200'
                }`}
              >
                {t === 'entrega' ? '🛵 Entrega' : '🛍 Retirada'}
              </button>
            ))}
          </div>

          {orderType === 'entrega' && (
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-[1fr_5rem] gap-3">
                <div>
                  <label className="text-sm font-medium text-stone-700">Endereço</label>
                  <input
                    required
                    className="input mt-1"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, avenida…"
                    autoComplete="street-address"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700">Nº</label>
                  <input
                    className="input mt-1"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Bairro</label>
                <input
                  required
                  className="input mt-1"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Ex.: Centro"
                  autoComplete="address-level3"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Taxa única: {formatMoney(store.deliveryFee)}
                  {store.deliveryFee === 0 ? ' (grátis)' : ''}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700">Referência (opcional)</label>
                <input
                  className="input mt-1"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="portão azul, ao lado da padaria…"
                />
              </div>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold">Pagamento</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  paymentMethod === m
                    ? 'bg-tomato-600 text-white shadow-soft'
                    : 'bg-cream-100 text-stone-700 hover:bg-cream-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {paymentMethod === 'Dinheiro' && (
            <div className="mt-4">
              <label className="text-sm font-medium text-stone-700">
                Troco para quanto? (opcional)
              </label>
              <input
                className="input mt-1"
                inputMode="decimal"
                placeholder="Ex.: 100,00"
                value={changeForReais}
                onChange={(e) => setChangeForReais(e.target.value)}
              />
              <p className="mt-1 text-xs text-stone-500">
                Deixe vazio se não vai precisar de troco. Total do pedido: {formatMoney(total)}.
              </p>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold">Observações</h2>
          <textarea
            className="input mt-3 min-h-[80px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sem cebola, ponto da carne, etc."
            maxLength={500}
          />
        </section>

        <section className="card p-5">
          <Line label="Subtotal" value={formatMoney(subtotal)} />
          <Line
            label="Taxa de entrega"
            value={
              orderType === 'retirada'
                ? 'Grátis (retirada)'
                : deliveryFee === 0
                ? 'Grátis'
                : formatMoney(deliveryFee)
            }
          />
          <div className="my-3 h-px bg-stone-200" />
          <Line label="Total" value={formatMoney(total)} bold />
        </section>

        {error && (
          <div className="rounded-xl bg-tomato-50 px-4 py-3 text-sm text-tomato-700 ring-1 ring-tomato-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !store.isOpen}
          className="btn-primary w-full py-4 text-base"
        >
          {submitting ? 'Enviando…' : '📲 Finalizar pedido pelo WhatsApp'}
        </button>
      </form>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'text-base font-bold' : 'text-stone-700'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
