import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { normalizePhone, rewardsFromPoints } from '../lib/loyalty';

export const loyaltyRouter = Router();

const phoneParam = z.string().min(8).max(20);

/**
 * GET /api/loyalty/:phone  (público)
 *
 * Procura o cliente do programa por telefone (normalizado). Não é "endpoint de cadastro" —
 * o vínculo nasce do POST /api/orders quando o cliente opta por entrar. Aqui é só consulta.
 */
loyaltyRouter.get('/:phone', async (req, res) => {
  const phone = normalizePhone(phoneParam.parse(req.params.phone));

  const customer = await prisma.loyaltyCustomer.findUnique({ where: { phone } });
  if (!customer) {
    res.json({ exists: false, phone });
    return;
  }

  res.json({
    exists: true,
    phone: customer.phone,
    name: customer.name,
    points: customer.points,
    totalEarned: customer.totalEarned,
    rewardsAvailable: rewardsFromPoints(customer.points),
  });
});
