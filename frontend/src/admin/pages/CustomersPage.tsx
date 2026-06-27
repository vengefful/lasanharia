import { useEffect, useState } from 'react';
import { adminApi, AuthExpiredError, type CustomerRow } from '../api';
import { formatMoney } from '../../lib/format';
import { buildWhatsAppUrl } from '../../lib/whatsapp';
import { normalizeCustomerPhone } from '../customerNotify';

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getCustomers()
      .then((c) => {
        setCustomers(c);
        setError(null);
      })
      .catch((e) => {
        if (!(e instanceof AuthExpiredError)) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-stone-500">
            {customers.length} cliente{customers.length === 1 ? '' : 's'} · derivados dos pedidos.
            Use o botão WhatsApp para atendimento individual — não há disparo em massa.
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
              <th className="px-4 py-2 text-right">Pedidos</th>
              <th className="px-4 py-2 text-right">Total gasto</th>
              <th className="px-4 py-2">Último pedido</th>
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
                  Nenhum cliente ainda — os primeiros pedidos vão preencher essa tabela.
                </td>
              </tr>
            )}
            {customers.map((c) => {
              const phone = normalizeCustomerPhone(c.customerPhone);
              const waUrl = phone.valid
                ? buildWhatsAppUrl(phone.digits, `Olá! Aqui é da loja.`)
                : null;
              return (
                <tr key={c.customerPhone}>
                  <td className="px-4 py-3 font-semibold">{c.customerName}</td>
                  <td className="px-4 py-3 text-stone-600 tabular-nums">{c.customerPhone}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.orderCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(c.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {new Date(c.lastOrderAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        💬 WhatsApp
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Telefone parece inválido (menos de 10 dígitos)"
                        className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg bg-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-500"
                      >
                        💬 WhatsApp
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
