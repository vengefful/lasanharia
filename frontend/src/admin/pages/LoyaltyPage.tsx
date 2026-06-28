import { useEffect, useState } from 'react';
import { adminApi, AuthExpiredError, type LoyaltyCustomerRow } from '../api';
import { buildWhatsAppUrl } from '../../lib/whatsapp';
import { normalizeCustomerPhone } from '../customerNotify';

export function LoyaltyPage() {
  const [customers, setCustomers] = useState<LoyaltyCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<LoyaltyCustomerRow | null>(null);

  async function refresh() {
    try {
      setCustomers(await adminApi.listLoyaltyCustomers());
      setError(null);
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

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🍒 Fidelidade</h1>
          <p className="text-sm text-stone-500">
            {customers.length} cliente{customers.length === 1 ? '' : 's'} no programa.
            Ordenados por saldo atual (descendente).
          </p>
        </div>
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
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Telefone</th>
              <th className="px-4 py-2 text-right">Saldo</th>
              <th className="px-4 py-2 text-right">Acumulado</th>
              <th className="px-4 py-2 text-right">Lasanhas grátis</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-stone-500">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-stone-500">
                  Ninguém no programa ainda. Os primeiros clientes a marcarem "Quero acumular"
                  no checkout aparecem aqui.
                </td>
              </tr>
            )}
            {customers.map((c) => {
              const phone = normalizeCustomerPhone(c.phone);
              const waUrl = phone.valid
                ? buildWhatsAppUrl(phone.digits, `Olá, ${c.name.split(' ')[0]}!`)
                : null;
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-4 py-3 text-stone-600 tabular-nums">{c.phone}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="rounded-full bg-tomato-100 px-2.5 py-0.5 text-sm font-bold text-tomato-700 tabular-nums">
                      {c.points}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-stone-600 tabular-nums">
                    {c.totalEarned}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.rewardsAvailable > 0 ? (
                      <span className="font-semibold text-emerald-700">
                        🎁 {c.rewardsAvailable}
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mr-1 inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        💬 WhatsApp
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setAdjusting(c)}
                      className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-200"
                    >
                      Ajustar pontos
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-stone-500">
        Saldo é o que pode ser resgatado agora. Acumulado é histórico bruto — não cai
        com cancelamento nem com ajuste manual.
      </div>

      {adjusting && (
        <AdjustModal
          customer={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            void refresh();
          }}
          onError={(msg) => setError(msg)}
        />
      )}
    </div>
  );
}

function AdjustModal({
  customer,
  onClose,
  onSaved,
  onError,
}: {
  customer: LoyaltyCustomerRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [op, setOp] = useState<'add' | 'sub'>('add');
  const [pointsStr, setPointsStr] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pts = Math.max(0, Math.floor(Number(pointsStr) || 0));
  const delta = op === 'add' ? pts : -pts;
  const wouldBe = customer.points + delta;
  const newPoints = Math.max(0, wouldBe);
  const wouldClamp = wouldBe < 0;
  const valid = pts > 0;

  async function apply() {
    setSubmitting(true);
    try {
      await adminApi.adjustLoyaltyPoints(customer.id, {
        delta,
        reason: reason.trim() || undefined,
      });
      onSaved();
    } catch (e) {
      if (!(e instanceof AuthExpiredError)) {
        onError(e instanceof Error ? e.message : 'Erro ao ajustar');
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
      <div
        onClick={(e) => e.stopPropagation()}
        className="grid w-full max-w-md gap-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div>
          <h2 className="text-lg font-bold">Ajustar pontos</h2>
          <p className="mt-1 text-sm text-stone-600">
            <strong>{customer.name}</strong> · {customer.phone} · saldo atual{' '}
            <span className="font-bold text-tomato-700 tabular-nums">{customer.points}</span> pts.
          </p>
        </div>

        {step === 'edit' && (
          <>
            <div>
              <label className="text-sm font-medium text-stone-700">Operação</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['add', 'sub'] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOp(o)}
                    className={`rounded-xl px-4 py-2 font-semibold transition ${
                      op === o
                        ? 'bg-tomato-600 text-white shadow-soft'
                        : 'bg-cream-100 text-stone-700 hover:bg-cream-200'
                    }`}
                  >
                    {o === 'add' ? '+ Adicionar' : '− Subtrair'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700">Pontos</label>
              <input
                autoFocus
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                className="input mt-1"
                value={pointsStr}
                onChange={(e) => setPointsStr(e.target.value)}
                placeholder="ex.: 3"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700">Motivo (opcional)</label>
              <textarea
                className="input mt-1 min-h-[60px]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: pedido entregue manualmente sem app; correção combinada por telefone…"
                maxLength={200}
              />
              <p className="mt-1 text-xs text-stone-500">
                O motivo fica registrado no log do servidor (auditoria mínima).
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
              ⚠️ Ajuste manual é ferramenta de correção. Não mexe no histórico
              acumulado ({customer.totalEarned} pts). Saldo não pode ficar negativo —
              se {Math.abs(delta) > customer.points && delta < 0 ? <strong>vai travar em 0</strong> : 'extrapolar, trava em 0'}.
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!valid}
                className="btn-primary px-4 py-2 text-sm"
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="rounded-xl bg-cream-50 p-4 text-sm ring-1 ring-cream-200">
              <div className="text-stone-700">
                Confirma este ajuste para <strong>{customer.name}</strong>?
              </div>
              <div className="mt-3 grid grid-cols-3 items-center gap-2 text-center">
                <div>
                  <div className="text-xs uppercase text-stone-500">Saldo atual</div>
                  <div className="text-2xl font-bold tabular-nums">{customer.points}</div>
                </div>
                <div
                  className={`text-2xl font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-tomato-700'}`}
                >
                  {delta >= 0 ? `+${delta}` : delta}
                </div>
                <div>
                  <div className="text-xs uppercase text-stone-500">Vira</div>
                  <div className="text-2xl font-bold tabular-nums">{newPoints}</div>
                </div>
              </div>
              {wouldClamp && (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
                  Saldo travado em <strong>0</strong> (subtraiu mais do que tinha).
                </div>
              )}
              {reason.trim() && (
                <div className="mt-3 text-xs text-stone-600">
                  <span className="font-semibold">Motivo:</span> {reason.trim()}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep('edit')}
                disabled={submitting}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={submitting}
                className="btn-primary px-4 py-2 text-sm"
              >
                {submitting ? 'Aplicando…' : 'Confirmar ajuste'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
