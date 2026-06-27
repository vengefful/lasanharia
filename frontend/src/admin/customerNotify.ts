// Mensagens prontas e normalização de telefone para o botão "Avisar cliente" da OrdersPage.
// customerPhone é texto livre SEM código do país — sempre prefixamos "55".
import { formatMoney } from '../lib/format';

export type CustomerNotifyStatus =
  | 'Confirmado'
  | 'Em preparo'
  | 'Saiu para entrega'
  | 'Entregue';

export const CUSTOMER_NOTIFY_STATUSES: readonly CustomerNotifyStatus[] = [
  'Confirmado',
  'Em preparo',
  'Saiu para entrega',
  'Entregue',
] as const;

const MIN_LOCAL_DIGITS = 10; // DDD (2) + número (8 a 9). Brasil: fixo=10, celular=11.

export type CustomerNotifyOrder = {
  orderNumber: number;
  paymentMethod: string;
  total: number; // centavos
};

export type CustomerNotifyStore = {
  pixKey: string;
};

export function customerNotifyMessage(
  order: CustomerNotifyOrder,
  status: CustomerNotifyStatus,
  store: CustomerNotifyStore,
): string {
  // Caso especial: pedido confirmado pagando via PIX → incluir chave + valor + pedido de comprovante.
  if (status === 'Confirmado' && order.paymentMethod === 'Pix') {
    const value = formatMoney(order.total);
    if (store.pixKey) {
      return (
        `Olá! Seu pedido #${order.orderNumber} foi confirmado. 🍝 ` +
        `Pagamento via PIX — chave: ${store.pixKey}. Valor: ${value}. ` +
        `Assim que pagar, por favor envie o comprovante aqui por mensagem. 🙏 ` +
        `(Se preferir, pode pagar na entrega.)`
      );
    }
    return (
      `Olá! Seu pedido #${order.orderNumber} foi confirmado. 🍝 ` +
      `Pagamento via PIX — me chame aqui para passar a chave, ou pague na entrega.`
    );
  }

  switch (status) {
    case 'Confirmado':
      return `Olá! Seu pedido #${order.orderNumber} foi confirmado e já vamos preparar. 🍝`;
    case 'Em preparo':
      return `Seu pedido #${order.orderNumber} já está em preparo! 👩‍🍳`;
    case 'Saiu para entrega':
      return `Seu pedido #${order.orderNumber} saiu para entrega! 🛵 Já está a caminho.`;
    case 'Entregue':
      return `Seu pedido #${order.orderNumber} foi entregue. Obrigado pela preferência! 😋`;
  }
}

export type NormalizedPhone = {
  digits: string; // já com prefixo "55" quando válido
  valid: boolean;
};

export function normalizeCustomerPhone(rawPhone: string): NormalizedPhone {
  const local = rawPhone.replace(/\D/g, '');
  return {
    digits: '55' + local,
    valid: local.length >= MIN_LOCAL_DIGITS,
  };
}

export function isNotifiableStatus(status: string): status is CustomerNotifyStatus {
  return (CUSTOMER_NOTIFY_STATUSES as readonly string[]).includes(status);
}
