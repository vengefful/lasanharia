import { useEffect, useState } from 'react';
import { adminApi, AuthExpiredError, type Stats } from '../api';
import { formatMoney } from '../../lib/format';

export function SummaryPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getStats()
      .then(setStats)
      .catch((e) => {
        if (!(e instanceof AuthExpiredError)) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar');
        }
      });
  }, []);

  if (error) {
    return <p className="rounded-lg bg-tomato-50 px-3 py-2 text-sm text-tomato-700">{error}</p>;
  }
  if (!stats) return <p className="text-stone-500">Carregando…</p>;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Resumo</h1>
        <p className="text-sm text-stone-500">
          Visão rápida da operação. Pedidos cancelados não entram nos números.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Faturamento (30d)" value={formatMoney(stats.faturamento30dias)} />
        <Card label="Pedidos (30d)" value={String(stats.pedidosUltimos30dias)} />
        <Card label="Ticket médio" value={formatMoney(stats.ticketMedio)} />
        <Card label="Média/dia (30d)" value={stats.mediaPedidosPorDia.toFixed(1)} />
      </section>

      <section className="card p-5">
        <header className="flex items-end justify-between">
          <h2 className="text-lg font-bold">Faturamento por mês</h2>
          <span className="text-xs text-stone-500">últimos 6 meses</span>
        </header>
        <MonthlyBars data={stats.faturamentoPorMes} />
      </section>

      <section className="card p-5">
        <header className="flex items-end justify-between">
          <h2 className="text-lg font-bold">Top produtos</h2>
          <span className="text-xs text-stone-500">por quantidade vendida</span>
        </header>
        <ProductRanking items={stats.produtosMaisVendidos} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
            Entrega vs Retirada
          </h3>
          <ul className="mt-3 grid gap-2">
            {stats.divisaoEntregaRetirada.map((d) => (
              <li key={d.orderType} className="grid gap-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">
                    {d.orderType === 'entrega' ? '🛵 Entrega' : '🛍 Retirada'}
                  </span>
                  <span className="tabular-nums text-stone-600">
                    {d.count} ({d.pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-cream-100">
                  <div
                    className="h-full bg-tomato-500"
                    style={{ width: `${Math.min(100, d.pct)}%` }}
                  />
                </div>
              </li>
            ))}
            {stats.divisaoEntregaRetirada.length === 0 && (
              <li className="text-sm text-stone-400">Sem dados ainda.</li>
            )}
          </ul>
        </section>

        <section className="card p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
            Forma de pagamento
          </h3>
          <ul className="mt-3 grid gap-2">
            {stats.divisaoPagamento.map((d) => (
              <li key={d.paymentMethod} className="flex justify-between text-sm">
                <span>{d.paymentMethod}</span>
                <span className="tabular-nums text-stone-600">{d.count}</span>
              </li>
            ))}
            {stats.divisaoPagamento.length === 0 && (
              <li className="text-sm text-stone-400">Sem dados ainda.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  // ex.: "jun./26"
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function MonthlyBars({ data }: { data: Stats['faturamentoPorMes'] }) {
  if (data.length === 0) {
    return <p className="mt-4 text-sm text-stone-400">Sem pedidos nos últimos meses.</p>;
  }
  const max = data.reduce((m, x) => Math.max(m, x.total), 0) || 1;
  return (
    <ul className="mt-3 grid gap-2">
      {data.map((m) => (
        <li key={m.ym} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3">
          <span className="text-sm text-stone-600">{formatYearMonth(m.ym)}</span>
          <div className="h-3 overflow-hidden rounded-full bg-cream-100">
            <div
              className="h-full bg-tomato-500"
              style={{ width: `${(m.total / max) * 100}%` }}
            />
          </div>
          <span className="w-28 text-right text-sm tabular-nums">
            {formatMoney(m.total)} <span className="text-stone-400">· {m.count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ProductRanking({ items }: { items: Stats['produtosMaisVendidos'] }) {
  if (items.length === 0) {
    return <p className="mt-4 text-sm text-stone-400">Nenhum produto vendido ainda.</p>;
  }
  const max = items[0]?.quantity ?? 1;
  return (
    <ol className="mt-3 grid gap-2">
      {items.map((p, idx) => (
        <li key={p.productName} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3">
          <span className="text-sm font-semibold text-stone-400 tabular-nums">{idx + 1}.</span>
          <div>
            <div className="truncate text-sm font-semibold">{p.productName}</div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream-100">
              <div
                className="h-full bg-ember-500"
                style={{ width: `${(p.quantity / max) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold tabular-nums">{p.quantity}</div>
            <div className="text-xs text-stone-500 tabular-nums">{formatMoney(p.revenue)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
