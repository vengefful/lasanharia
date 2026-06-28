import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../store/cart';
import { api, ApiError } from '../api/client';
import type { LoyaltyInfo, OrderType, PaymentMethod, Store } from '../types';
import { formatMoney, parseMoneyToCents } from '../lib/format';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../lib/whatsapp';
import { loadCustomerInfo, saveCustomerInfo } from '../lib/customerInfo';
import { loadLoyaltyPhone, saveLoyaltyPhone } from '../lib/loyaltyStorage';

const PAYMENT_METHODS: PaymentMethod[] = ['Pix', 'Cartão na entrega', 'Dinheiro'];

type LocationState = { orderType?: OrderType; neighborhood?: string };

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = (location.state ?? {}) as LocationState;
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);

  const [store, setStore] = useState<Store | null>(null);

  // Pré-preenchimento por-aparelho (localStorage). Incoming (vindo do carrinho) ainda manda.
  const persisted = useMemo(() => loadCustomerInfo(), []);
  const [customerName, setCustomerName] = useState(persisted.customerName ?? '');
  // Prioridade do telefone: customerInfo > loyaltyPhone (caso o cliente tenha consultado
  // /fidelidade antes mas não tenha pedido neste aparelho) > vazio.
  const [customerPhone, setCustomerPhone] = useState(
    persisted.customerPhone ?? loadLoyaltyPhone(),
  );
  const [orderType, setOrderType] = useState<OrderType>(
    incoming.orderType ?? persisted.orderType ?? 'entrega',
  );
  const [address, setAddress] = useState(persisted.address ?? '');
  const [addressNumber, setAddressNumber] = useState(persisted.addressNumber ?? '');
  const [neighborhood, setNeighborhood] = useState(
    incoming.neighborhood ?? persisted.neighborhood ?? '',
  );
  const [reference, setReference] = useState(persisted.reference ?? '');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    persisted.paymentMethod ?? 'Pix',
  );
  const [changeForReais, setChangeForReais] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Localização opcional do cliente. NÃO persiste em lugar nenhum — só estado local.
  // Vai junto na mensagem do WhatsApp se anexada; nunca no POST /api/orders.
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  // Programa de Fidelidade (opcional, opt-in explícito; identificado pelo telefone do checkout).
  const [enrolled, setEnrolled] = useState(false);
  const [loyaltyInfo, setLoyaltyInfo] = useState<LoyaltyInfo | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [redeemReward, setRedeemReward] = useState(false);

  // Quantas unidades elegíveis (countsForLoyalty=true) há no carrinho — usado pra:
  //  - mostrar quantos pontos serão creditados na entrega (na msg do WhatsApp);
  //  - habilitar/desabilitar o botão de resgate.
  const eligibleUnits = items.reduce(
    (sum, i) => (i.countsForLoyalty ? sum + i.quantity : sum),
    0,
  );
  const hasEligibleItem = eligibleUnits > 0;

  // Busca debounced do saldo quando o opt-in está ativo e o telefone tem ao menos 8 dígitos.
  useEffect(() => {
    if (!enrolled) {
      setLoyaltyInfo(null);
      return;
    }
    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 8) {
      setLoyaltyInfo(null);
      return;
    }
    setLoyaltyLoading(true);
    const handle = setTimeout(() => {
      api
        .getLoyalty(phoneDigits)
        .then((info) => setLoyaltyInfo(info))
        .catch(() => setLoyaltyInfo(null))
        .finally(() => setLoyaltyLoading(false));
    }, 400);
    return () => clearTimeout(handle);
  }, [enrolled, customerPhone]);

  // Se o opt-in cair OU a elegibilidade some, desmarcar resgate automaticamente.
  useEffect(() => {
    if (!enrolled) setRedeemReward(false);
  }, [enrolled]);
  useEffect(() => {
    const rewards = loyaltyInfo?.exists ? loyaltyInfo.rewardsAvailable : 0;
    if (!hasEligibleItem || rewards < 1) setRedeemReward(false);
  }, [hasEligibleItem, loyaltyInfo]);

  const canRedeem =
    enrolled &&
    loyaltyInfo?.exists === true &&
    loyaltyInfo.rewardsAvailable >= 1 &&
    hasEligibleItem;

  function captureLocation() {
    if (!('geolocation' in navigator)) {
      setGeoStatus('error');
      setGeoError('Seu navegador não tem geolocalização. O pedido segue normal com o endereço.');
      return;
    }
    setGeoStatus('loading');
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('idle');
      },
      (err) => {
        setGeoStatus('error');
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Você negou a permissão. Sem problemas, o pedido segue só com o endereço.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError('Não consegui pegar sua localização. O pedido segue só com o endereço.');
        } else if (err.code === err.TIMEOUT) {
          setGeoError('Demorou demais para localizar. Tente de novo ou siga só com o endereço.');
        } else {
          setGeoError('Não foi possível anexar a localização. O pedido segue normal.');
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

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

  // Espelha o cálculo do backend p/ exibir o total já descontado ANTES do submit.
  // Backend recomputa do banco — esse valor aqui é só preview; o pedido salvo usa o do servidor.
  const eligibleUnitPrice =
    items.find((i) => i.countsForLoyalty === true)?.price ?? 0;
  const previewDiscount =
    redeemReward && canRedeem ? eligibleUnitPrice : 0;
  const total = subtotal + deliveryFee - previewDiscount;

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

      const phoneDigits = customerPhone.replace(/\D/g, '');
      const wantsLoyalty = enrolled && phoneDigits.length >= 8 && customerName.trim().length > 0;

      const order = await api.createOrder({
        customerName: customerName.trim(),
        customerPhone: phoneDigits,
        orderType,
        address: orderType === 'entrega' ? address.trim() : undefined,
        addressNumber: orderType === 'entrega' ? addressNumber.trim() : undefined,
        neighborhood: orderType === 'entrega' ? neighborhood : undefined,
        reference: orderType === 'entrega' && reference ? reference.trim() : undefined,
        notes: notes.trim() || undefined,
        paymentMethod,
        changeFor: paymentMethod === 'Dinheiro' && changeFor ? changeFor : undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        // Fidelidade: backend é a fonte da verdade; aqui só sinaliza opt-in/resgate.
        loyalty: wantsLoyalty ? { phone: phoneDigits, name: customerName.trim() } : undefined,
        redeemReward: wantsLoyalty && redeemReward && canRedeem ? true : undefined,
      });

      // Persiste no aparelho do cliente — conveniência, não cadastro.
      // Pula notes/changeFor (variam) e geoLocation (privacidade + irrelevante depois).
      saveCustomerInfo({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        orderType,
        address: orderType === 'entrega' ? address.trim() : '',
        addressNumber: orderType === 'entrega' ? addressNumber.trim() : '',
        neighborhood: orderType === 'entrega' ? neighborhood.trim() : '',
        reference: orderType === 'entrega' ? reference.trim() : '',
        paymentMethod,
      });
      // Telefone da fidelidade em chave própria — útil se o customerInfo for
      // limpo / aparelho compartilhado / cliente entra direto em /fidelidade.
      if (wantsLoyalty) saveLoyaltyPhone(phoneDigits);

      // location e loyalty só entram na mensagem; nunca no POST direto.
      // pendingCredit = pontos que serão creditados quando a Dona Maria mudar pra Entregue.
      const message = buildWhatsAppMessage(order, {
        location: orderType === 'entrega' ? geoLocation : null,
        loyalty: order.loyaltyCustomer
          ? {
              name: order.loyaltyCustomer.name,
              currentBalance: order.loyaltyCustomer.points,
              pendingCredit: eligibleUnits,
              isRedemption: order.isRedemption,
            }
          : null,
      });
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

              <div className="rounded-xl border border-dashed border-stone-300 p-3">
                {geoLocation ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <div className="font-semibold text-emerald-700">Localização anexada ✓</div>
                      <div className="truncate text-xs text-stone-500 tabular-nums">
                        {geoLocation.lat.toFixed(6)}, {geoLocation.lng.toFixed(6)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGeoLocation(null);
                        setGeoStatus('idle');
                        setGeoError(null);
                      }}
                      className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-200"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={captureLocation}
                      disabled={geoStatus === 'loading'}
                      className="btn-secondary w-full py-2 text-sm"
                    >
                      {geoStatus === 'loading'
                        ? 'Buscando sua localização…'
                        : '📍 Estou em casa? Anexar minha localização'}
                    </button>
                    <p className="mt-1 text-xs text-stone-500">
                      Opcional. O endereço acima continua obrigatório; isto só ajuda o entregador.
                    </p>
                    {geoError && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
                        {geoError}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold">🍒 Fidelidade</h2>
              <p className="mt-1 text-sm text-stone-500">
                A cada <strong>10 lasanhas</strong>, ganhe <strong>1 grátis</strong>. Cadastro
                opcional, sem senha — identificamos pelo telefone acima.
              </p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enrolled}
                onChange={(e) => setEnrolled(e.target.checked)}
              />
              <span className="select-none font-medium">Quero acumular</span>
            </label>
          </div>

          {enrolled && (
            <div className="mt-4 grid gap-2 rounded-xl bg-cream-50 p-3 ring-1 ring-cream-200">
              <div className="text-xs text-stone-500">
                Telefone do programa:{' '}
                <span className="font-semibold text-stone-700 tabular-nums">
                  {customerPhone.replace(/\D/g, '') || '—'}
                </span>
              </div>

              {customerPhone.replace(/\D/g, '').length < 8 && (
                <p className="text-xs text-amber-700">
                  Preencha seu telefone acima primeiro pra ver seu saldo.
                </p>
              )}

              {loyaltyLoading && (
                <p className="text-sm text-stone-500">Buscando seu saldo…</p>
              )}

              {!loyaltyLoading && loyaltyInfo && loyaltyInfo.exists === false && (
                <p className="text-sm text-stone-700">
                  ✨ Bem-vindo! Você será cadastrado neste pedido. Os pontos das lasanhas
                  contam <strong>quando o pedido for entregue</strong>.
                </p>
              )}

              {!loyaltyLoading && loyaltyInfo && loyaltyInfo.exists === true && (
                <>
                  <div className="text-sm text-stone-700">
                    Olá, <strong>{loyaltyInfo.name}</strong>! Você tem{' '}
                    <strong className="text-tomato-700">
                      {loyaltyInfo.points} {loyaltyInfo.points === 1 ? 'ponto' : 'pontos'}
                    </strong>
                    .
                  </div>
                  {loyaltyInfo.rewardsAvailable >= 1 ? (
                    <div className="text-sm font-semibold text-emerald-700">
                      🎁 Você tem {loyaltyInfo.rewardsAvailable} lasanha
                      {loyaltyInfo.rewardsAvailable === 1 ? '' : 's'} grátis disponível
                      {loyaltyInfo.rewardsAvailable === 1 ? '' : 'is'}!
                    </div>
                  ) : (
                    <div className="text-xs text-stone-500">
                      Faltam <strong>{10 - (loyaltyInfo.points % 10)}</strong> pontos para a
                      próxima lasanha grátis.
                    </div>
                  )}

                  {canRedeem && (
                    <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-dashed border-emerald-400 bg-emerald-50 p-3">
                      <input
                        type="checkbox"
                        checked={redeemReward}
                        onChange={(e) => setRedeemReward(e.target.checked)}
                        className="mt-0.5"
                      />
                      <div className="text-sm">
                        <div className="font-semibold text-emerald-800">
                          Usar 1 lasanha grátis (−10 pontos)
                        </div>
                        <div className="mt-0.5 text-xs text-emerald-700">
                          O total já vai aparecer com o desconto da lasanha grátis aplicado.
                        </div>
                      </div>
                    </label>
                  )}

                  {loyaltyInfo.rewardsAvailable >= 1 && !hasEligibleItem && (
                    <p className="mt-1 text-xs text-stone-500">
                      Pra usar a lasanha grátis, inclua pelo menos 1 lasanha no carrinho.
                    </p>
                  )}
                </>
              )}
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
          {previewDiscount > 0 && (
            <Line
              label="Desconto fidelidade (1 lasanha grátis)"
              value={`−${formatMoney(previewDiscount)}`}
            />
          )}
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
