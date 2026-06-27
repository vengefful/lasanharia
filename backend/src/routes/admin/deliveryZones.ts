import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../middleware/errorHandler';

export const adminDeliveryZonesRouter = Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const zoneCreateSchema = z.object({
  neighborhood: z.string().trim().min(1).max(100),
  fee: z.number().int().nonnegative(),
  active: z.boolean().default(true),
});

const zoneUpdateSchema = zoneCreateSchema.partial();

adminDeliveryZonesRouter.get('/', async (_req, res) => {
  const zones = await prisma.deliveryZone.findMany({ orderBy: { neighborhood: 'asc' } });
  res.json(zones);
});

adminDeliveryZonesRouter.post('/', async (req, res) => {
  const data = zoneCreateSchema.parse(req.body);
  try {
    const created = await prisma.deliveryZone.create({ data });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'NEIGHBORHOOD_TAKEN', `Bairro "${data.neighborhood}" já cadastrado`);
    }
    throw err;
  }
});

adminDeliveryZonesRouter.put('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const data = zoneUpdateSchema.parse(req.body);
  try {
    const updated = await prisma.deliveryZone.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        throw new HttpError(404, 'ZONE_NOT_FOUND', `Bairro ${id} não encontrado`);
      }
      if (err.code === 'P2002') {
        throw new HttpError(409, 'NEIGHBORHOOD_TAKEN', `Bairro "${data.neighborhood}" já cadastrado`);
      }
    }
    throw err;
  }
});
