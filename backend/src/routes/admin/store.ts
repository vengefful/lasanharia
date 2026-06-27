import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { HttpError } from '../../middleware/errorHandler';

export const adminStoreRouter = Router();

const storeUpdateSchema = z
  .object({
    storeName: z.string().trim().min(1).max(120),
    whatsappNumber: z.string().trim().regex(/^\d{10,15}$/, 'WhatsApp deve conter só dígitos (DDI+DDD+número)'),
    address: z.string().trim().min(1).max(200),
    isOpen: z.boolean(),
    preparationTime: z.string().trim().min(1).max(60),
    announcement: z.string().trim().max(300).nullable().optional(),
  })
  .partial();

adminStoreRouter.get('/', async (_req, res) => {
  const store = await prisma.storeConfig.findFirst();
  if (!store) throw new HttpError(404, 'STORE_NOT_CONFIGURED', 'Loja ainda não configurada');
  res.json(store);
});

adminStoreRouter.put('/', async (req, res) => {
  const data = storeUpdateSchema.parse(req.body);
  const current = await prisma.storeConfig.findFirst();
  if (!current) throw new HttpError(404, 'STORE_NOT_CONFIGURED', 'Loja ainda não configurada');

  const updated = await prisma.storeConfig.update({
    where: { id: current.id },
    data,
  });
  res.json(updated);
});
