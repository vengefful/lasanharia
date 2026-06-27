import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { HttpError } from '../middleware/errorHandler';
import { normalizePhone, REWARD_THRESHOLD } from '../lib/loyalty';

export const ordersRouter = Router();

const orderItemInputSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(99),
});

const loyaltyInputSchema = z.object({
  phone: z.string().min(8).max(20),
  name: z.string().trim().min(1).max(100),
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
    // Programa de Fidelidade (opt-in). Ver CLAUDE.md.
    loyalty: loyaltyInputSchema.optional(),
    redeemReward: z.boolean().optional(),
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
    if (data.redeemReward && !data.loyalty) {
      ctx.addIssue({
        code: 'custom',
        path: ['redeemReward'],
        message: 'Resgate exige identificação no programa de fidelidade (campo loyalty)',
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

  // 3.b Conta unidades elegíveis ao programa de fidelidade — o flag vive em Product.countsForLoyalty.
  //     Pré-condição do resgate (precisa de pelo menos 1 item elegível no pedido).
  const eligibleUnits = input.items.reduce((sum, it) => {
    const p = productMap.get(it.productId)!;
    return p.countsForLoyalty ? sum + it.quantity : sum;
  }, 0);
  if (input.redeemReward && eligibleUnits === 0) {
    throw new HttpError(
      400,
      'LOYALTY_NO_ELIGIBLE_ITEMS',
      'Resgate exige pelo menos 1 item que conta para fidelidade no pedido',
    );
  }

  // 4. Frete único: 0 se retirada; senão usa StoreConfig.deliveryFee (0 = grátis).
  //    Bairro é texto livre — não há mais tabela de zonas.
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
  //    A mesma transação cuida de: upsert do LoyaltyCustomer (find-or-create por telefone),
  //    débito atômico de 10 pontos quando é resgate (compare-and-swap), e criação do Order
  //    com loyaltyCustomerId/isRedemption. Qualquer erro rola tudo back.
  for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        let loyaltyCustomerId: number | null = null;
        let isRedemption = false;

        if (input.loyalty) {
          const phone = normalizePhone(input.loyalty.phone);
          const name = input.loyalty.name.trim();

          // Find-or-create. Atualiza o nome a cada pedido (último vence) — barato e mantém
          // o cadastro alinhado com o que o cliente prefere ser chamado agora.
          const lc = await tx.loyaltyCustomer.upsert({
            where: { phone },
            create: { phone, name },
            update: { name },
          });
          loyaltyCustomerId = lc.id;

          if (input.redeemReward) {
            // Compare-and-swap atômico: só decrementa se ainda houver saldo >= 10.
            // Evita race se o cliente fizer 2 pedidos com resgate quase simultâneos.
            const dec = await tx.loyaltyCustomer.updateMany({
              where: { id: lc.id, points: { gte: REWARD_THRESHOLD } },
              data: { points: { decrement: REWARD_THRESHOLD } },
            });
            if (dec.count === 0) {
              throw new HttpError(
                400,
                'LOYALTY_INSUFFICIENT_POINTS',
                `Saldo insuficiente para resgate (precisa de ${REWARD_THRESHOLD} pontos)`,
              );
            }
            isRedemption = true;
          }
        }

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
            // Fidelidade: pointsEarned começa 0 (preenchido na entrega).
            loyaltyCustomerId,
            isRedemption,
            items: { create: orderItems },
          },
          include: { items: true, loyaltyCustomer: true },
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
