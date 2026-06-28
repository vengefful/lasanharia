import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../middleware/errorHandler';
import { REWARD_THRESHOLD } from '../../lib/loyalty';

export const adminOrdersRouter = Router();

// Lista canônica de status. Mantém alinhada com o CLAUDE.md e a validação Zod abaixo.
export const ORDER_STATUSES = [
  'Pendente',
  'Confirmado',
  'Em preparo',
  'Saiu para entrega',
  'Entregue',
  'Cancelado',
] as const;

const querySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  take: z.coerce.number().int().positive().max(200).default(100),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

adminOrdersRouter.get('/', async (req, res) => {
  const { status, take } = querySchema.parse(req.query);
  const orders = await prisma.order.findMany({
    where: status ? { status } : undefined,
    include: { items: true, loyaltyCustomer: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
  res.json(orders);
});

adminOrdersRouter.patch('/:id/status', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { status } = updateStatusSchema.parse(req.body);

  try {
    // Toda a transição roda em transação para que mudança de status + efeitos
    // colaterais de fidelidade fiquem consistentes (crédito, estorno, refund-resgate).
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!before) {
        throw new HttpError(404, 'ORDER_NOT_FOUND', `Pedido ${id} não encontrado`);
      }

      // Aplica a mudança de status primeiro — depois ajustamos os efeitos de fidelidade.
      await tx.order.update({ where: { id }, data: { status } });

      // ── Fidelidade ─────────────────────────────────────────────────────
      // Só faz qualquer coisa se o pedido tem cliente do programa vinculado.
      if (before.loyaltyCustomerId != null) {
        if (status === 'Entregue' && before.pointsEarned === 0) {
          // CRÉDITO. Re-fetch dos produtos para descobrir quais contam (countsForLoyalty).
          //  - Se before.pointsEarned > 0, NÃO credita de novo (idempotência).
          //  - O resgate (isRedemption) NÃO impede o crédito: as lasanhas pagas no mesmo
          //    pedido ainda valem pontos (a lasanha "grátis" não está nos OrderItem).
          const productIds = before.items.map((i) => i.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, countsForLoyalty: true },
          });
          const eligibleIds = new Set(products.filter((p) => p.countsForLoyalty).map((p) => p.id));
          const earned = before.items.reduce(
            (sum, i) => (eligibleIds.has(i.productId) ? sum + i.quantity : sum),
            0,
          );
          if (earned > 0) {
            await tx.loyaltyCustomer.update({
              where: { id: before.loyaltyCustomerId },
              data: {
                points: { increment: earned },
                totalEarned: { increment: earned },
              },
            });
            await tx.order.update({ where: { id }, data: { pointsEarned: earned } });
          }
        } else if (status === 'Cancelado') {
          // ESTORNO do que já foi creditado (se já tinha sido entregue antes).
          if (before.pointsEarned > 0) {
            const cust = await tx.loyaltyCustomer.findUnique({
              where: { id: before.loyaltyCustomerId },
            });
            if (cust) {
              const wouldBe = cust.points - before.pointsEarned;
              const newPoints = Math.max(0, wouldBe);
              if (wouldBe < 0) {
                // Saldo já tinha sido gasto/resgatado — registra e trava em 0 (totalEarned NÃO decrementa).
                console.warn(
                  `[loyalty] Estorno do pedido #${before.orderNumber} tentaria deixar saldo do cliente ` +
                    `${before.loyaltyCustomerId} negativo (${cust.points} - ${before.pointsEarned} = ${wouldBe}). ` +
                    `Travado em 0.`,
                );
              }
              await tx.loyaltyCustomer.update({
                where: { id: before.loyaltyCustomerId },
                data: { points: newPoints },
              });
            }
            await tx.order.update({ where: { id }, data: { pointsEarned: 0 } });
          }
          // REFUND do resgate: cancelar um pedido que tinha consumido a recompensa devolve os pontos.
          if (before.isRedemption) {
            await tx.loyaltyCustomer.update({
              where: { id: before.loyaltyCustomerId },
              data: { points: { increment: REWARD_THRESHOLD } },
            });
            await tx.order.update({ where: { id }, data: { isRedemption: false } });
          }
        }
      }

      return tx.order.findUnique({
        where: { id },
        include: { items: true, loyaltyCustomer: true },
      });
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new HttpError(404, 'ORDER_NOT_FOUND', `Pedido ${id} não encontrado`);
    }
    throw err;
  }
});
