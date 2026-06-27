import { Router } from 'express';
import { prisma } from '../prisma';

export const deliveryZonesRouter = Router();

deliveryZonesRouter.get('/', async (_req, res) => {
  const zones = await prisma.deliveryZone.findMany({
    where: { active: true },
    orderBy: { neighborhood: 'asc' },
  });
  res.json(zones);
});
