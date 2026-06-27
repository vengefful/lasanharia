import { Router } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../middleware/errorHandler';

export const storeRouter = Router();

storeRouter.get('/', async (_req, res) => {
  const store = await prisma.storeConfig.findFirst();
  if (!store) {
    throw new HttpError(404, 'STORE_NOT_CONFIGURED', 'Loja ainda não configurada');
  }
  res.json(store);
});
