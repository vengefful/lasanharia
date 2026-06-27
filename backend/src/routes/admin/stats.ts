import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

export const adminStatsRouter = Router();

const CANCELED = 'Cancelado';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

adminStatsRouter.get('/', async (_req, res) => {
  // ── 1) Agregado geral (exclui Cancelado).
  //    aggregate é uma única query SQL (COUNT + SUM + AVG no servidor).
  const all = await prisma.order.aggregate({
    where: { status: { not: CANCELED } },
    _count: { _all: true },
    _sum: { total: true },
    _avg: { total: true },
  });

  // ── 2) Janela últimos 30 dias.
  const since30 = new Date(Date.now() - THIRTY_DAYS_MS);
  const last30 = await prisma.order.aggregate({
    where: { status: { not: CANCELED }, createdAt: { gte: since30 } },
    _count: { _all: true },
    _sum: { total: true },
  });

  // ── 3) Faturamento por mês — últimos ~6 meses (mês atual + 5 anteriores).
  //    Prisma groupBy não trunca data; usamos SQLite strftime via $queryRaw.
  //    Prisma armazena DateTime em SQLite como INTEGER (epoch ms), por isso convertemos
  //    com `createdAt / 1000` + modifier 'unixepoch'. Cutoff é epoch ms também.
  const sixMonthsAgoMs = startOfMonthMonthsAgo(5);
  type MonthRow = { ym: string; total: number; count: number };
  const monthsRaw = await prisma.$queryRaw<MonthRow[]>(Prisma.sql`
    SELECT strftime('%Y-%m', createdAt / 1000, 'unixepoch') AS ym,
           CAST(COALESCE(SUM(total), 0) AS INTEGER) AS total,
           CAST(COUNT(*) AS INTEGER) AS count
    FROM "Order"
    WHERE status != ${CANCELED}
      AND createdAt >= ${sixMonthsAgoMs}
    GROUP BY ym
    ORDER BY ym ASC
  `);
  const faturamentoPorMes = monthsRaw.map((m) => ({
    ym: m.ym,
    total: Number(m.total),
    count: Number(m.count),
  }));

  // ── 4) Top 10 produtos por quantidade somada.
  //    groupBy em OrderItem, filtrando via relation { order: { status != Cancelado } }.
  //    Uma única query — Prisma traduz para GROUP BY + JOIN.
  const topItems = await prisma.orderItem.groupBy({
    by: ['productName'],
    where: { order: { status: { not: CANCELED } } },
    _sum: { quantity: true, totalPrice: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  });
  const produtosMaisVendidos = topItems.map((r) => ({
    productName: r.productName,
    quantity: r._sum.quantity ?? 0,
    revenue: r._sum.totalPrice ?? 0,
  }));

  // ── 5) Divisão entrega vs retirada (com %).
  const typeRows = await prisma.order.groupBy({
    by: ['orderType'],
    where: { status: { not: CANCELED } },
    _count: { _all: true },
  });
  const totalNonCancel = all._count._all || 1; // evita /0 quando ainda não há pedidos
  const divisaoEntregaRetirada = typeRows.map((r) => ({
    orderType: r.orderType,
    count: r._count._all,
    pct: (r._count._all / totalNonCancel) * 100,
  }));

  // ── 6) Divisão por forma de pagamento.
  const payRows = await prisma.order.groupBy({
    by: ['paymentMethod'],
    where: { status: { not: CANCELED } },
    _count: { _all: true },
  });
  const divisaoPagamento = payRows.map((r) => ({
    paymentMethod: r.paymentMethod,
    count: r._count._all,
  }));

  res.json({
    totalPedidos: all._count._all,
    faturamentoTotal: all._sum.total ?? 0,
    ticketMedio: Math.round(all._avg.total ?? 0),
    pedidosUltimos30dias: last30._count._all,
    faturamento30dias: last30._sum.total ?? 0,
    mediaPedidosPorDia: last30._count._all / 30,
    faturamentoPorMes,
    produtosMaisVendidos,
    divisaoEntregaRetirada,
    divisaoPagamento,
  });
});

/** Início do mês N meses atrás, em epoch ms. Ex.: 5 → 1º dia do mês 5 meses antes do mês corrente. */
function startOfMonthMonthsAgo(n: number): number {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
  return d.getTime();
}
