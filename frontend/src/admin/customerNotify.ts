// Mensagens prontas e normalização de telefone para o botão "Avisar cliente" da OrdersPage.
// customerPhone é texto livre SEM código do país — sempre prefixamos "55".

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

export function customerNotifyMessage(orderNumber: number, status: CustomerNotifyStatus): string {
  switch (status) {
    case 'Confirmado':
      return `Olá! Seu pedido #${orderNumber} foi confirmado e já vamos preparar. 🍝`;
    case 'Em preparo':
      return `Seu pedido #${orderNumber} já está em preparo! 👩‍🍳`;
    case 'Saiu para entrega':
      return `Seu pedido #${orderNumber} saiu para entrega! 🛵 Já está a caminho.`;
    case 'Entregue':
      return `Seu pedido #${orderNumber} foi entregue. Obrigado pela preferência! 😋`;
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
