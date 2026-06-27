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
};
