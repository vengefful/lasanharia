import type { Order } from '../types';
import { formatMoney } from './format';
import { buildMapsUrlFromCoords } from './maps';

const TYPE_LABEL: Record<Order['orderType'], string> = {
  entrega: 'Entrega',
  retirada: 'Retirada',
};

export type WhatsAppOptions = {
  /** Localização opcional anexada pelo cliente no checkout. Só aparece em entrega. */
  location?: { lat: number; lng: number } | null;
  /**
   * Dados de Fidelidade pra atendente. `pendingCredit` é o nº de pontos que serão
   * creditados quando a Dona Maria mudar o status para Entregue (calculado no checkout
   * a partir dos itens do carrinho com `countsForLoyalty=true`).
   */
  loyalty?: {
    name: string;
    /** Saldo atual depois do débito do resgate (se houve), antes do crédito da entrega. */
    currentBalance: number;
    /** Quantos pontos este pedido vai creditar ao entregar. */
    pendingCredit: number;
    /** True se o cliente resgatou 1 lasanha grátis neste pedido. */
    isRedemption: boolean;
  } | null;
};

export function buildWhatsAppMessage(order: Order, options: WhatsAppOptions = {}): string {
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
    if (options.location) {
      lines.push(
        `📍 Localização: ${buildMapsUrlFromCoords(options.location.lat, options.location.lng)}`,
      );
    }
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
  if (order.discountAmount > 0) {
    lines.push(`Desconto fidelidade (1 lasanha grátis): −${formatMoney(order.discountAmount)}`);
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

  if (options.loyalty) {
    const l = options.loyalty;
    lines.push('');
    lines.push(`🍒 Fidelidade: ${l.name}`);
    const future = l.currentBalance + l.pendingCredit;
    if (l.pendingCredit > 0) {
      lines.push(
        `Saldo: ${l.currentBalance} ${l.currentBalance === 1 ? 'ponto' : 'pontos'}` +
          ` (+${l.pendingCredit} ao entregar = ${future})`,
      );
    } else {
      lines.push(`Saldo: ${l.currentBalance} ${l.currentBalance === 1 ? 'ponto' : 'pontos'}`);
    }
    if (l.isRedemption) {
      lines.push('🎁 Resgate: 1 lasanha grátis neste pedido (combinar no acerto)');
    }
  }

  return lines.join('\n');
}

export function buildWhatsAppUrl(whatsappNumber: string, message: string): string {
  // wa.me só aceita dígitos (formato internacional).
  const digits = whatsappNumber.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
