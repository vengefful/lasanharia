import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../middleware/errorHandler';
import { rewardsFromPoints } from '../../lib/loyalty';

export const adminLoyaltyCustomersRouter = Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const adjustSchema = z.object({
  // Inteiro com sinal: +5 (adicionar) ou -3 (subtrair). 0 não faz sentido.
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, 'delta não pode ser zero'),
  reason: z.string().trim().max(200).optional(),
});

function shape(c: {
  id: number;
  phone: string;
  name: string;
  points: number;
  totalEarned: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    phone: c.phone,
    name: c.name,
    points: c.points,
    totalEarned: c.totalEarned,
    rewardsAvailable: rewardsFromPoints(c.points),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** GET /api/admin/loyalty-customers — lista ordenada por saldo desc, depois totalEarned desc. */
adminLoyaltyCustomersRouter.get('/', async (_req, res) => {
  const customers = await prisma.loyaltyCustomer.findMany({
    orderBy: [{ points: 'desc' }, { totalEarned: 'desc' }],
  });
  res.json(customers.map(shape));
});

/**
 * PATCH /api/admin/loyalty-customers/:id/adjust — ajuste manual do saldo (correção).
 * Não mexe em totalEarned (histórico bruto). Trava em 0 se delta puxar pra negativo.
 * Loga motivo (auditoria mínima — não há tabela de ledger).
 */
adminLoyaltyCustomersRouter.patch('/:id/adjust', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { delta, reason } = adjustSchema.parse(req.body);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const cust = await tx.loyaltyCustomer.findUnique({ where: { id } });
      if (!cust) {
        throw new HttpError(404, 'LOYALTY_CUSTOMER_NOT_FOUND', `Cliente fidelidade ${id} não encontrado`);
      }
      const wouldBe = cust.points + delta;
      const newPoints = Math.max(0, wouldBe);
      const clamped = wouldBe < 0;
      // Registro para auditoria — não há tabela de ledger nesta fase.
      console.log(
        `[loyalty][adjust] id=${id} (${cust.name}/${cust.phone}) ${cust.points} ${delta >= 0 ? '+' : ''}${delta} → ${newPoints}` +
          (clamped ? ' [TRAVADO em 0]' : '') +
          ` motivo="${reason ?? '(sem motivo)'}"`,
      );
      return tx.loyaltyCustomer.update({
        where: { id },
        data: { points: newPoints },
      });
    });
    res.json({
      ...shape(updated),
      // info útil pra UI mostrar feedback claro
      requestedDelta: delta,
      reason: reason ?? null,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new HttpError(404, 'LOYALTY_CUSTOMER_NOT_FOUND', `Cliente fidelidade ${id} não encontrado`);
    }
    throw err;
  }
});
