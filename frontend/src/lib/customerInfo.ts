// Conveniência por-aparelho para pré-preencher o checkout. NÃO é cadastro:
// não há login, não vai pro backend, só fica no localStorage do navegador do cliente.
// Não persistimos observações nem troco (variam por pedido) nem localização GPS.
import type { OrderType, PaymentMethod } from '../types';

const STORAGE_KEY = 'lasanharia-customer-info';

export type PersistedCustomerInfo = {
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  address: string;
  addressNumber: string;
  neighborhood: string;
  reference: string;
  paymentMethod: PaymentMethod;
};

const VALID_ORDER_TYPES: OrderType[] = ['entrega', 'retirada'];
const VALID_PAYMENT_METHODS: PaymentMethod[] = ['Pix', 'Cartão na entrega', 'Dinheiro'];

export function loadCustomerInfo(): Partial<PersistedCustomerInfo> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedCustomerInfo>;
    // Sanitiza valores enum para não envenenar o estado se alguém mexer no localStorage.
    if (parsed.orderType && !VALID_ORDER_TYPES.includes(parsed.orderType)) {
      delete parsed.orderType;
    }
    if (parsed.paymentMethod && !VALID_PAYMENT_METHODS.includes(parsed.paymentMethod)) {
      delete parsed.paymentMethod;
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveCustomerInfo(info: PersistedCustomerInfo) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {
    // localStorage cheio / bloqueado: é só conveniência, ignora.
  }
}
