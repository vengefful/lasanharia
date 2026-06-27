import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../prisma';
import { env } from '../../env';
import { HttpError } from '../../middleware/errorHandler';

export const adminLoginRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const TOKEN_TTL = '12h';

adminLoginRouter.post('/', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  // Mensagem genérica para não revelar se o e-mail existe.
  const fail = () => new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos');
  if (!admin) throw fail();

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) throw fail();

  const token = jwt.sign({ sub: admin.id, email: admin.email }, env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });

  res.json({
    token,
    expiresIn: TOKEN_TTL,
    admin: { id: admin.id, email: admin.email },
  });
});
