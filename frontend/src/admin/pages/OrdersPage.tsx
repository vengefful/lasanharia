import { useEffect, useRef, useState } from 'react';
import { adminApi, AuthExpiredError } from '../api';
import { useAdminAuth } from '../auth';
import type { Order, Store } from '../../types';
import { formatMoney } from '../../lib/format';
import { buildWhatsAppUrl } from '../../lib/whatsapp';
import { buildMapsSearchUrl, joinAddressForMaps } from '../../lib/maps';
import {
  customerNotifyMessage,
  isNotifiableStatus,
  normalizeCustomerPhone,
} from '../customerNotify';

const STATUSES = [
  'Pendente',
  'Confirmado',
  'Em preparo',
  'Saiu para entrega',
  'Entregue',
  'Cancelado',
] as const;

const STATUS_STYLE: Record<string, string> = {
  Pendente: 'bg-amber-100 text-amber-800 ring-amber-200',
  Confirmado: 'bg-sky-100 text-sky-800 ring-sky-200',
  'Em preparo': 'bg-orange-100 text-orange-800 ring-orange-200',
  'Saiu para entrega': 'bg-violet-100 text-violet-800 ring-violet-200',
  Entregue: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  Cancelado: 'bg-stone-200 text-stone-700 ring-stone-300',
};

const POLL_INTERVAL_MS = 10_000;

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const previousIdsRef = useRef<Set<number>>(new Set());
  const newlyArrivedRef = useRef<Set<number>>(new Set());

  // Busca a config da loja UMA vez para completar a URL de "Ver rota" com cidade/UF.
  useEffect(() => {
    adminApi
      .getStore()
      .then(setStore)
      .catch(() => {
        // Sem store config, "Ver rota" cai no fallback (só campos do pedido).
        setStore(null);
      });
  }, []);

  // Polling: para no AuthExpiredError, sem loop. Marca pedidos novos para destacar.
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      // Cinto-e-suspensórios: se o token sumir (logout manual), não dispara mais nada.
      if (cancelled || !useAdminAuth.getState().token) return;
      try {
        const data = await adminApi.listOrders();
        if (cancelled) return;
        const incomingIds = new Set(data.map((o) => o.id));
        const previousIds = previousIdsRef.current;
        if (previousIds.size > 0) {
          const fresh = new Set<number>();
          for (const id of incomingIds) {
            if (!previousIds.has(id)) fresh.add(id);
          }
          if (fresh.size) {
            newlyArrivedRef.current = fresh;
            // limpa o highlight depois de 6s
            setTimeout(() => {
              if (cancelled) return;
              newlyArrivedRef.current = new Set();
              setNow(Date.now());
            }, 6000);
          }
        }
        previousIdsRef.current = incomingIds;
        setOrders(data);
        setLastFetch(new Date());
        setError(null);
      } catch (e) {
        if (e instanceof AuthExpiredError) {
          // logout() já rodou em api.ts → o RequireAdminAuth vai redirecionar.
          cancelled = true;
          if (interval) clearInterval(interval);
          return;
        }
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro de rede');
      }
    }

    tick();
    interval = setInterval(tick, POLL_INTERVAL_MS);

    // mantém o "atualizado há Xs" atualizando
    const ticker = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      clearInterval(ticker);
    };
  }, []);

  async function changeStatus(order: Order, status: string) {
    if (status === order.status) return;
    setUpdatingId(order.id);
    // otimista
    const previousStatus = order.status;
    setOrders((current) => current.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      const updated = await adminApi.updateOrderStatus(order.id, status);
      setOrders((current) => current.map((o) => (o.id === order.id ? updated : o)));
    } catch (e) {
      // reverte
      setOrders((current) =>
        current.map((o) => (o.id === order.id ? { ...o, status: previousStatus } : o)),
      );
      if (!(e instanceof AuthExpiredError)) {
        setError(e instanceof Error ? e.message : 'Erro ao mudar status');
      }
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-stone-500">
            Atualizado a cada 10s · {orders.length} pedido{orders.length === 1 ? '' : 's'}
            {lastFetch && (
              <>
                {' '}
                · há {Math.max(0, Math.round((now - lastFetch.getTime()) / 1000))}s
              </>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-tomato-50 px-3 py-2 text-sm text-tomato-700 ring-1 ring-tomato-100">
          {error}
        </div>
      )}

      <ul className="mt-4 grid gap-3">
        {orders.length === 0 && !error && (
          <li className="rounded-xl bg-white p-8 text-center text-stone-500 ring-1 ring-stone-200">
            Nenhum pedido ainda — fica de olho.
          </li>
        )}
        {orders.map((o) => {
          const isNew = newlyArrivedRef.current.has(o.id);
          return (
            <li
              key={o.id}
              className={`rounded-xl bg-white p-4 ring-1 ring-stone-200 transition ${
                isNew ? 'ring-2 ring-emerald-400 shadow-soft' : ''
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">#{o.orderNumber}</h2>
                    {isNew && (
                      <span className="badge bg-emerald-100 text-emerald-800">novo</span>
                    )}
                    <span
                      className={`badge ring-1 ${STATUS_STYLE[o.status] ?? 'bg-stone-100 text-stone-700 ring-stone-200'}`}
                    >
                      {o.status}
                    </span>
                    {o.isRedemption && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-800 ring-1 ring-pink-200">
                        🎁 Resgate: 1 grátis
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-stone-600">
                    {o.customerName} · {o.customerPhone} ·{' '}
                    {new Date(o.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={o.status}
                    disabled={updatingId === o.id}
                    onChange={(e) => changeStatus(o, e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm font-semibold focus:border-tomato-500 focus:outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <ul className="text-sm text-stone-700">
                  {o.items.map((i) => (
                    <li key={i.id}>
                      <span className="font-semibold tabular-nums">{i.quantity}×</span>{' '}
                      {i.productName}{' '}
                      <span className="text-stone-400">— {formatMoney(i.totalPrice)}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-sm">
                  <div className="text-right text-stone-600">
                    Subtotal: <span className="tabular-nums">{formatMoney(o.subtotal)}</span>
                  </div>
                  <div className="text-right text-stone-600">
                    Entrega:{' '}
                    <span className="tabular-nums">
                      {o.deliveryFee === 0 ? 'Grátis' : formatMoney(o.deliveryFee)}
                    </span>
                  </div>
                  <div className="text-right text-base font-bold">
                    Total: <span className="tabular-nums">{formatMoney(o.total)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-1 border-t border-stone-100 pt-3 text-sm text-stone-700 sm:grid-cols-2">
                <div>
                  <span className="text-stone-500">Tipo:</span>{' '}
                  {o.orderType === 'entrega' ? '🛵 Entrega' : '🛍 Retirada'}
                </div>
                <div>
                  <span className="text-stone-500">Pagamento:</span> {o.paymentMethod}
                  {o.paymentMethod === 'Dinheiro' && o.changeFor != null && (
                    <> (troco para {formatMoney(o.changeFor)})</>
                  )}
                </div>
                {o.orderType === 'entrega' && (
                  <div className="sm:col-span-2">
                    <span className="text-stone-500">Endereço:</span>{' '}
                    {[o.address, o.addressNumber].filter(Boolean).join(', ') || '—'}
                    {o.neighborhood ? ` · ${o.neighborhood}` : ''}
                    {o.reference ? ` · ${o.reference}` : ''}
                  </div>
                )}
                {o.notes && (
                  <div className="sm:col-span-2">
                    <span className="text-stone-500">Obs.:</span> {o.notes}
                  </div>
                )}
                {o.loyaltyCustomer && (
                  <div className="sm:col-span-2">
                    <span className="text-stone-500">🍒 Fidelidade:</span>{' '}
                    <span className="font-semibold">{o.loyaltyCustomer.name}</span>{' '}
                    <span className="text-stone-500">
                      · saldo {o.loyaltyCustomer.points} pts
                      {o.pointsEarned > 0 && ` (+${o.pointsEarned} deste pedido já creditados)`}
                    </span>
                  </div>
                )}
              </div>

              <OrderActions order={o} store={store} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OrderActions({ order, store }: { order: Order; store: Store | null }) {
  const notifyStatus = isNotifiableStatus(order.status) ? order.status : null;
  const phone = normalizeCustomerPhone(order.customerPhone);

  const notifyUrl = notifyStatus
    ? buildWhatsAppUrl(
        phone.digits,
        customerNotifyMessage(order, notifyStatus, { pixKey: store?.pixKey ?? '' }),
      )
    : null;

  const routeUrl =
    order.orderType === 'entrega'
      ? buildMapsSearchUrl(
          joinAddressForMaps({
            address: order.address,
            addressNumber: order.addressNumber,
            neighborhood: order.neighborhood,
            city: store?.city,
            state: store?.state,
          }),
        )
      : null;

  if (!notifyUrl && !routeUrl) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
      {notifyUrl &&
        (phone.valid ? (
          <a
            href={notifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            💬 Avisar cliente
          </a>
        ) : (
          <button
            type="button"
            disabled
            title="Telefone do cliente parece inválido (menos de 10 dígitos). Edite no banco se for o caso."
            className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg bg-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-500"
          >
            💬 Avisar cliente
          </button>
        ))}
      {routeUrl && (
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg bg-stone-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
        >
          🗺 Ver rota
        </a>
      )}
    </div>
  );
}
