import type { Category, CreateOrderInput, LoyaltyInfo, Order, Product, Store } from '../types';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    issues?: { path: (string | number)[]; message: string }[];
  };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: ApiErrorBody['error'] extends infer T
      ? T extends { issues?: infer I }
        ? I
        : undefined
      : undefined,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // resposta não-JSON
    }
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? res.statusText,
      body?.error?.issues,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  getStore: () => request<Store>('/api/store'),
  getCategories: () => request<Category[]>('/api/categories'),
  getProducts: (categoryId?: number) =>
    request<Product[]>(`/api/products${categoryId ? `?categoryId=${categoryId}` : ''}`),
  createOrder: (body: CreateOrderInput) =>
    request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  getLoyalty: (phone: string) =>
    request<LoyaltyInfo>(`/api/loyalty/${encodeURIComponent(phone)}`),
};
