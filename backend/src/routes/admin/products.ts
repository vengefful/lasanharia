import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../middleware/errorHandler';

export const adminProductsRouter = Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  price: z.number().int().nonnegative(),
  categoryId: z.number().int().positive(),
  imageUrl: z.string().url().optional().nullable(),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
});

const productUpdateSchema = productCreateSchema.partial();

adminProductsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: [{ categoryId: 'asc' }, { id: 'asc' }],
  });
  res.json(products);
});

adminProductsRouter.post('/', async (req, res) => {
  const data = productCreateSchema.parse(req.body);
  try {
    const created = await prisma.product.create({ data, include: { category: true } });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new HttpError(400, 'CATEGORY_NOT_FOUND', `Categoria ${data.categoryId} não existe`);
    }
    throw err;
  }
});

adminProductsRouter.put('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const data = productUpdateSchema.parse(req.body);
  try {
    const updated = await prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        throw new HttpError(404, 'PRODUCT_NOT_FOUND', `Produto ${id} não encontrado`);
      }
      if (err.code === 'P2003') {
        throw new HttpError(400, 'CATEGORY_NOT_FOUND', 'Categoria informada não existe');
      }
    }
    throw err;
  }
});

adminProductsRouter.delete('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  try {
    await prisma.product.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new HttpError(404, 'PRODUCT_NOT_FOUND', `Produto ${id} não encontrado`);
    }
    throw err;
  }
});
