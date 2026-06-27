import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../middleware/errorHandler';

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
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
  res.json(orders);
});

adminOrdersRouter.patch('/:id/status', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { status } = updateStatusSchema.parse(req.body);

  try {
    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: true },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new HttpError(404, 'ORDER_NOT_FOUND', `Pedido ${id} não encontrado`);
    }
    throw err;
  }
});
