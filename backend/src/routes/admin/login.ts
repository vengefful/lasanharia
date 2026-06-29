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

// Lê do env (default 30d). Pra mudar: ajustar JWT_EXPIRES_IN no .env e reiniciar.
const TOKEN_TTL = env.JWT_EXPIRES_IN;

adminLoginRouter.post('/', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  // Mensagem genérica para não revelar se o e-mail existe.
  const fail = () => new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos');
  if (!admin) throw fail();

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) throw fail();

  // `expiresIn` aceita string com unidade (ex.: "30d", "12h"). Cast pra qualquer evita
  // estreitamento do tipo do jsonwebtoken (StringValue) com string genérica do env.
  const token = jwt.sign({ sub: admin.id, email: admin.email }, env.JWT_SECRET, {
    expiresIn: TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });

  res.json({
    token,
    expiresIn: TOKEN_TTL,
    admin: { id: admin.id, email: admin.email },
  });
});
