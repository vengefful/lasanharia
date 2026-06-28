import type { Category, Order, Product, Store } from '../types';
import { useAdminAuth } from './auth';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const AUTH_FAILURE_CODES = new Set(['AUTH_MISSING', 'AUTH_INVALID', 'AUTH_EXPIRED']);

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    issues?: { path: (string | number)[]; message: string }[];
  };
};

export class AdminApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'AdminApiError';
  }
}

/** Disparado quando o backend retorna 401 com AUTH_*: o token foi limpo, redirecionar para /admin/login. */
export class AuthExpiredError extends Error {
  constructor(public readonly code: string) {
    super(`auth: ${code}`);
    this.name = 'AuthExpiredError';
  }
}

async function adminRequest<T>(path: string, init?: RequestInit, requireToken = true): Promise<T> {
  const token = useAdminAuth.getState().token;
  if (requireToken && !token) throw new AuthExpiredError('AUTH_MISSING');

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  // Trata falha de auth de forma especial: limpa token e sinaliza com erro tipado.
  if (res.status === 401) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    const code = body?.error?.code ?? 'AUTH_INVALID';
    if (AUTH_FAILURE_CODES.has(code)) {
      useAdminAuth.getState().logout();
      throw new AuthExpiredError(code);
    }
    throw new AdminApiError(401, code, body?.error?.message ?? 'Não autorizado');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new AdminApiError(
      res.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? res.statusText,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type LoginResponse = {
  token: string;
  expiresIn: string;
  admin: { id: number; email: string };
};

export const adminApi = {
  login: (email: string, password: string) =>
    adminRequest<LoginResponse>(
      '/api/admin/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    ),

  // Pedidos
  listOrders: () => adminRequest<Order[]>('/api/admin/orders'),
  updateOrderStatus: (id: number, status: string) =>
    adminRequest<Order>(`/api/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Produtos
  listProducts: () => adminRequest<Product[]>('/api/admin/products'),
  createProduct: (data: ProductInput) =>
    adminRequest<Product>('/api/admin/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: number, data: Partial<ProductInput>) =>
    adminRequest<Product>(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProduct: (id: number) =>
    adminRequest<void>(`/api/admin/products/${id}`, { method: 'DELETE' }),

  // Categorias
  listCategories: () => adminRequest<Category[]>('/api/admin/categories'),
  createCategory: (data: CategoryInput) =>
    adminRequest<Category>('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCategory: (id: number, data: Partial<CategoryInput>) =>
    adminRequest<Category>(`/api/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Loja
  getStore: () => adminRequest<Store>('/api/admin/store'),
  updateStore: (data: Partial<Store>) =>
    adminRequest<Store>('/api/admin/store', { method: 'PUT', body: JSON.stringify(data) }),

  // Resumo / clientes
  getStats: () => adminRequest<Stats>('/api/admin/stats'),
  getCustomers: () => adminRequest<CustomerRow[]>('/api/admin/customers'),

  // Fidelidade
  listLoyaltyCustomers: () => adminRequest<LoyaltyCustomerRow[]>('/api/admin/loyalty-customers'),
  adjustLoyaltyPoints: (id: number, body: { delta: number; reason?: string }) =>
    adminRequest<LoyaltyCustomerRow & { requestedDelta: number; reason: string | null }>(
      `/api/admin/loyalty-customers/${id}/adjust`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
};

export type Stats = {
  totalPedidos: number;
  faturamentoTotal: number;
  ticketMedio: number;
  pedidosUltimos30dias: number;
  faturamento30dias: number;
  mediaPedidosPorDia: number;
  faturamentoPorMes: { ym: string; total: number; count: number }[];
  produtosMaisVendidos: { productName: string; quantity: number; revenue: number }[];
  divisaoEntregaRetirada: { orderType: string; count: number; pct: number }[];
  divisaoPagamento: { paymentMethod: string; count: number }[];
};

export type CustomerRow = {
  customerName: string;
  customerPhone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
};

export type ProductInput = {
  name: string;
  description: string;
  price: number;
  categoryId: number;
  imageUrl?: string | null;
  available?: boolean;
  featured?: boolean;
  /** Programa de Fidelidade — true se cada unidade vendida vale 1 ponto. */
  countsForLoyalty?: boolean;
};

export type LoyaltyCustomerRow = {
  id: number;
  phone: string;
  name: string;
  points: number;
  totalEarned: number;
  rewardsAvailable: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryInput = {
  name: string;
  sortOrder?: number;
  active?: boolean;
};
