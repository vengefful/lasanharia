export type Store = {
  id: number;
  storeName: string;
  whatsappNumber: string;
  address: string;
  /** Cidade da loja — texto livre, completa o "Ver rota" no admin. */
  city: string;
  /** UF da loja (2 letras). */
  state: string;
  isOpen: boolean;
  preparationTime: string;
  announcement: string | null;
  /** Frete único da loja em centavos. 0 = grátis. */
  deliveryFee: number;
  /** Chave PIX (CPF, telefone, email, aleatória, qualquer texto). "" = sem chave configurada. */
  pixKey: string;
};

export type Category = {
  id: number;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  price: number; // centavos
  categoryId: number;
  category?: Category;
  imageUrl: string | null;
  available: boolean;
  featured: boolean;
  /** Flag por produto que indica se ele soma pontos no Programa de Fidelidade. */
  countsForLoyalty: boolean;
};

export type OrderType = 'entrega' | 'retirada';
export type PaymentMethod = 'Pix' | 'Cartão na entrega' | 'Dinheiro';

export type CreateOrderInput = {
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  reference?: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  changeFor?: number; // centavos
  items: { productId: number; quantity: number }[];
  /** Programa de Fidelidade (opcional). Quando vier, o pedido é vinculado/cria o cliente. */
  loyalty?: { phone: string; name: string };
  /** Quando true, debita 10 pontos do saldo do cliente identificado. Backend rejeita se saldo insuficiente. */
  redeemReward?: boolean;
};

export type OrderItem = {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type Order = {
  id: number;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  address: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  reference: string | null;
  notes: string | null;
  paymentMethod: PaymentMethod;
  changeFor: number | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  /** Fidelidade — preenchidos quando o pedido está vinculado ao programa. */
  loyaltyCustomerId: number | null;
  isRedemption: boolean;
  pointsEarned: number;
  loyaltyCustomer?: {
    id: number;
    phone: string;
    name: string;
    points: number;
    totalEarned: number;
  } | null;
};

/** Resposta do GET /api/loyalty/:phone. */
export type LoyaltyInfo =
  | { exists: false; phone: string }
  | {
      exists: true;
      phone: string;
      name: string;
      points: number;
      totalEarned: number;
      rewardsAvailable: number;
    };
