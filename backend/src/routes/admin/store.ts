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
    // Cidade e UF — usados para completar a query do "Ver rota" no admin. Aceita vazio.
    city: z.string().trim().max(80),
    state: z.string().trim().max(2),
    isOpen: z.boolean(),
    preparationTime: z.string().trim().min(1).max(60),
    announcement: z.string().trim().max(300).nullable().optional(),
    // Frete único da loja, em centavos. 0 = grátis.
    deliveryFee: z.number().int().nonnegative().max(100_000),
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
