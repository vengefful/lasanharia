import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../store/cart';
import { api } from '../api/client';
import type { OrderType, Store } from '../types';
import { formatMoney } from '../lib/format';

export function CartPage() {
  const navigate = useNavigate();
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.items.reduce((sum, i) => sum + i.price * i.quantity, 0));

  const [store, setStore] = useState<Store | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('entrega');

  useEffect(() => {
    api.getStore().then(setStore).catch(() => setStore(null));
  }, []);

  const deliveryFee = orderType === 'retirada' ? 0 : store?.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;

  // Bairro vive só no checkout — aqui o cliente só decide tipo + segue.
  const canCheckout = items.length > 0;

  function goCheckout() {
    if (!canCheckout) return;
    navigate('/checkout', { state: { orderType } });
  }

  return (
    <div className="mx-auto min-h-full max-w-2xl bg-cream-50 px-5 pb-12 sm:px-8">
      <PageTop title="Seu carrinho" />

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white p-8 text-center ring-1 ring-stone-200">
          <p className="text-stone-600">Seu carrinho está vazio.</p>
          <Link to="/" className="btn-primary mt-4 inline-flex">
            Ver cardápio
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-3">
            {items.map((item) => (
              <li
                key={item.productId}
                className="card flex items-center gap-2 overflow-hidden p-3"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-cream-100 text-xl">
                  🍝
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{item.name}</div>
                  <div className="text-sm text-stone-600">{formatMoney(item.price)} un.</div>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-cream-100 p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.productId, item.quantity - 1)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-tomato-700 ring-1 ring-stone-200 hover:bg-cream-50"
                    aria-label="Diminuir"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.productId, item.quantity + 1)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-tomato-600 text-white hover:bg-tomato-700"
                    aria-label="Aumentar"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.productId)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-cream-100 hover:text-tomato-700"
                  aria-label={`Remover ${item.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <section className="card mt-5 p-5">
            <h2 className="text-lg font-bold">Como você quer receber?</h2>
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
              <p className="mt-3 text-xs text-stone-500">
                Taxa única de entrega: {formatMoney(store?.deliveryFee ?? 0)}
                {(store?.deliveryFee ?? 0) === 0 ? ' (grátis)' : ''}. O endereço completo
                (rua, número, bairro) é preenchido no próximo passo.
              </p>
            )}
          </section>

          <section className="card mt-4 p-5">
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

          <button
            type="button"
            onClick={goCheckout}
            disabled={!canCheckout}
            className="btn-primary mt-5 w-full py-4 text-base"
          >
            Continuar para checkout
          </button>
          <Link to="/" className="btn-ghost mt-2 w-full">
            Adicionar mais itens
          </Link>
        </>
      )}
    </div>
  );
}

function PageTop({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-5">
      <Link to="/" className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-stone-200">
        ←
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
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
