import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

export const productsRouter = Router();

const querySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
});

productsRouter.get('/', async (req, res) => {
  const { categoryId } = querySchema.parse(req.query);
  const products = await prisma.product.findMany({
    where: {
      available: true,
      ...(categoryId ? { categoryId } : {}),
    },
    include: { category: true },
    orderBy: [{ categoryId: 'asc' }, { id: 'asc' }],
  });
  res.json(products);
});
