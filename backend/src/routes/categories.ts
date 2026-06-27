import { Router } from 'express';
import { prisma } from '../prisma';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json(categories);
});
