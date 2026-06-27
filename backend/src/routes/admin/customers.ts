import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';

export const adminCustomersRouter = Router();

const CANCELED = 'Cancelado';

/**
 * Lista de clientes derivada dos pedidos — não há tabela própria.
 *
 * Esta rota é PARA ATENDIMENTO/CONSULTA. Não dispara nada em massa, não exporta,
 * não tem opt-in. Use o botão WhatsApp da UI para conversar individualmente.
 */
adminCustomersRouter.get('/', async (_req, res) => {
  // Agrupa por customerPhone (o frontend já posta só dígitos). Usa window functions
  // para extrair o NOME do pedido mais recente sem precisar de subqueries por linha.
  // lastOrderAt vem como INTEGER (epoch ms) — convertemos para ISO no JS.
  type Row = {
    customerPhone: string;
    customerName: string;
    orderCount: number | bigint;
    totalSpent: number | bigint;
    lastOrderAt: number | bigint;
  };
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT
      customerPhone,
      customerName,
      CAST(orderCount AS INTEGER) AS orderCount,
      CAST(totalSpent AS INTEGER) AS totalSpent,
      lastOrderAt
    FROM (
      SELECT
        customerPhone,
        customerName,
        -- contagem e soma já excluem Cancelado (consistente com /stats).
        SUM(CASE WHEN status != ${CANCELED} THEN 1 ELSE 0 END)
          OVER (PARTITION BY customerPhone) AS orderCount,
        SUM(CASE WHEN status != ${CANCELED} THEN total ELSE 0 END)
          OVER (PARTITION BY customerPhone) AS totalSpent,
        MAX(createdAt)
          OVER (PARTITION BY customerPhone) AS lastOrderAt,
        -- pega APENAS o pedido mais recente de cada cliente para o nome ser o atual.
        ROW_NUMBER()
          OVER (PARTITION BY customerPhone ORDER BY createdAt DESC) AS rn
      FROM "Order"
    )
    WHERE rn = 1
      AND orderCount > 0
    ORDER BY orderCount DESC, lastOrderAt DESC
  `);

  res.json(
    rows.map((r) => ({
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      orderCount: Number(r.orderCount),
      totalSpent: Number(r.totalSpent),
      lastOrderAt: new Date(Number(r.lastOrderAt)).toISOString(),
    })),
  );
});
