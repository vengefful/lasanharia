import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { HttpError } from '../middleware/errorHandler';

export const ordersRouter = Router();

const orderItemInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(99),
});

const createOrderSchema = z
  .object({
    customerName: z.string().trim().min(1).max(100),
    customerPhone: z.string().trim().min(8).max(20),
    orderType: z.enum(['entrega', 'retirada']),
    address: z.string().trim().max(200).optional(),
    addressNumber: z.string().trim().max(20).optional(),
    neighborhood: z.string().trim().max(100).optional(),
    reference: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(500).optional(),
    paymentMethod: z.enum(['Pix', 'Cartão na entrega', 'Dinheiro']),
    changeFor: z.number().int().nonnegative().optional(),
    items: z.array(orderItemInputSchema).min(1, 'O pedido precisa ter pelo menos um item'),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === 'entrega') {
      if (!data.address) {
        ctx.addIssue({ code: 'custom', path: ['address'], message: 'Endereço obrigatório para entrega' });
      }
      if (!data.neighborhood) {
        ctx.addIssue({ code: 'custom', path: ['neighborhood'], message: 'Bairro obrigatório para entrega' });
      }
    }
    if (data.paymentMethod !== 'Dinheiro' && data.changeFor != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['changeFor'],
        message: 'changeFor só se aplica a pagamento em Dinheiro',
      });
    }
  });

const ORDER_NUMBER_START = 1000;
const MAX_INSERT_ATTEMPTS = 3;

ordersRouter.post('/', async (req, res) => {
  const input = createOrderSchema.parse(req.body);

  // 0. Loja precisa estar aberta. Checa antes de qualquer outra coisa.
  //    Aproveita e lê o frete único (StoreConfig.deliveryFee).
  const store = await prisma.storeConfig.findFirst({
    select: { isOpen: true, deliveryFee: true },
  });
  if (!store?.isOpen) {
    throw new HttpError(400, 'STORE_CLOSED', 'A loja está fechada no momento. Tente novamente mais tarde.');
  }

  // 1. Busca os produtos (preço atual = fonte da verdade).
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // 2. Valida disponibilidade e existência.
  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new HttpError(400, 'PRODUCT_NOT_FOUND', `Produto ${item.productId} não encontrado`);
    }
    if (!product.available) {
      throw new HttpError(400, 'PRODUCT_UNAVAILABLE', `Produto "${product.name}" está indisponível`);
    }
  }

  // 3. Calcula subtotal a partir do banco (ignora qualquer preço vindo do cliente).
  const orderItems = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    return {
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      totalPrice: product.price * item.quantity,
    };
  });
  const subtotal = orderItems.reduce((sum, i) => sum + i.totalPrice, 0);

  // 4. Frete único: 0 se retirada; senão usa StoreConfig.deliveryFee (0 = grátis).
  //    O bairro é só texto livre; não consulta DeliveryZone no fluxo do cliente.
  const deliveryFee = input.orderType === 'entrega' ? store.deliveryFee : 0;

  // 5. Total final.
  const total = subtotal + deliveryFee;

  // 6. Validação de troco (em centavos).
  if (input.paymentMethod === 'Dinheiro' && input.changeFor != null && input.changeFor < total) {
    throw new HttpError(
      400,
      'CHANGE_LESS_THAN_TOTAL',
      'Valor do troco deve ser maior ou igual ao total do pedido',
    );
  }

  // 7. Gera orderNumber sequencial dentro de transação. Em colisão única (concorrência), tenta de novo.
  for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const last = await tx.order.findFirst({
          orderBy: { orderNumber: 'desc' },
          select: { orderNumber: true },
        });
        const nextOrderNumber = Math.max(ORDER_NUMBER_START, (last?.orderNumber ?? ORDER_NUMBER_START - 1) + 1);
        return tx.order.create({
          data: {
            orderNumber: nextOrderNumber,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            orderType: input.orderType,
            address: input.address ?? null,
            addressNumber: input.addressNumber ?? null,
            neighborhood: input.neighborhood ?? null,
            reference: input.reference ?? null,
            notes: input.notes ?? null,
            paymentMethod: input.paymentMethod,
            changeFor: input.paymentMethod === 'Dinheiro' ? input.changeFor ?? null : null,
            subtotal,
            deliveryFee,
            total,
            status: 'Pendente',
            items: { create: orderItems },
          },
          include: { items: true },
        });
      });

      res.status(201).json(created);
      return;
    } catch (err) {
      const isUniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (isUniqueViolation && attempt < MAX_INSERT_ATTEMPTS) continue;
      throw err;
    }
  }
});
