import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { HttpError } from './errorHandler';

export interface AuthPayload {
  sub: number;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AuthPayload;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return next(new HttpError(401, 'AUTH_MISSING', 'Token de autenticação ausente'));
  }
  const token = header.slice(7).trim();
  if (!token) {
    return next(new HttpError(401, 'AUTH_MISSING', 'Token de autenticação ausente'));
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== 'number' || typeof payload.email !== 'string') {
      return next(new HttpError(401, 'AUTH_INVALID', 'Token inválido'));
    }
    req.admin = { sub: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new HttpError(401, 'AUTH_EXPIRED', 'Token expirado, faça login novamente'));
    }
    return next(new HttpError(401, 'AUTH_INVALID', 'Token inválido'));
  }
};
