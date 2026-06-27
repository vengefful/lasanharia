import type { Order } from '../types';
import { formatMoney } from './format';

const TYPE_LABEL: Record<Order['orderType'], string> = {
  entrega: 'Entrega',
  retirada: 'Retirada',
};

export function buildWhatsAppMessage(order: Order): string {
  const lines: string[] = [];
  lines.push(`🍝 NOVO PEDIDO #${order.orderNumber}`);
  lines.push('');
  lines.push(`Cliente: ${order.customerName}`);
  lines.push(`Telefone: ${order.customerPhone}`);
  lines.push(`Tipo: ${TYPE_LABEL[order.orderType]}`);

  if (order.orderType === 'entrega') {
    const addressLine = [order.address, order.addressNumber].filter(Boolean).join(', ');
    if (addressLine) lines.push(`Endereço: ${addressLine}`);
    if (order.neighborhood) lines.push(`Bairro: ${order.neighborhood}`);
    if (order.reference) lines.push(`Referência: ${order.reference}`);
  }

  lines.push('');
  lines.push('Itens:');
  for (const item of order.items) {
    lines.push(`• ${item.quantity}x ${item.productName} — ${formatMoney(item.totalPrice)}`);
  }

  lines.push('');
  lines.push(`Subtotal: ${formatMoney(order.subtotal)}`);
  if (order.deliveryFee > 0) {
    lines.push(`Taxa de entrega: ${formatMoney(order.deliveryFee)}`);
  }
  lines.push(`Total: ${formatMoney(order.total)}`);

  lines.push('');
  let payment = `Pagamento: ${order.paymentMethod}`;
  if (order.paymentMethod === 'Dinheiro' && order.changeFor != null) {
    payment += ` (troco para ${formatMoney(order.changeFor)})`;
  }
  lines.push(payment);

  if (order.notes) {
    lines.push('');
    lines.push(`Observações: ${order.notes}`);
  }

  return lines.join('\n');
}

export function buildWhatsAppUrl(whatsappNumber: string, message: string): string {
  // wa.me só aceita dígitos (formato internacional).
  const digits = whatsappNumber.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
