import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { adminLoginRouter } from './login';
import { adminOrdersRouter } from './orders';
import { adminProductsRouter } from './products';
import { adminCategoriesRouter } from './categories';
import { adminStoreRouter } from './store';

export const adminRouter = Router();

// Login é a única rota pública dentro de /api/admin.
adminRouter.use('/login', adminLoginRouter);

// Tudo abaixo exige Bearer token.
adminRouter.use(requireAuth);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/products', adminProductsRouter);
adminRouter.use('/categories', adminCategoriesRouter);
adminRouter.use('/store', adminStoreRouter);
