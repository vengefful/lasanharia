import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../middleware/errorHandler';

export const adminCategoriesRouter = Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

const categoryUpdateSchema = categoryCreateSchema.partial();

adminCategoriesRouter.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json(categories);
});

adminCategoriesRouter.post('/', async (req, res) => {
  const data = categoryCreateSchema.parse(req.body);
  const created = await prisma.category.create({ data });
  res.status(201).json(created);
});

adminCategoriesRouter.put('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const data = categoryUpdateSchema.parse(req.body);
  try {
    const updated = await prisma.category.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new HttpError(404, 'CATEGORY_NOT_FOUND', `Categoria ${id} não encontrada`);
    }
    throw err;
  }
});
