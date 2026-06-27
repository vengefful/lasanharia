// Prova das 3 partes:
//   1. mensagem WA do CLIENTE → loja, sem e com localização anexada
//   2. URL wa.me que o "Avisar cliente" do admin gera (com prefixo "55")
//   3. URL "Ver rota" só com endereço de texto
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../src/lib/whatsapp';
import { buildMapsSearchUrl, joinAddressForMaps } from '../src/lib/maps';
import { customerNotifyMessage, normalizeCustomerPhone } from '../src/admin/customerNotify';
import type { Order } from '../src/types';

const order: Order = {
  id: 99,
  orderNumber: 1234,
  customerName: 'Fernando',
  customerPhone: '82991413741',
  orderType: 'entrega',
  address: 'Rua das Massas',
  addressNumber: '123',
  neighborhood: 'Centro',
  reference: 'portão azul, ao lado da padaria',
  notes: 'sem cebola',
  paymentMethod: 'Dinheiro',
  changeFor: 10000,
  subtotal: 5700,
  deliveryFee: 500,
  total: 6200,
  status: 'Pendente',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: [
    { id: 1, orderId: 99, productId: 2, productName: 'Lasanha de Frango Grande', quantity: 1, unitPrice: 4500, totalPrice: 4500 },
    { id: 2, orderId: 99, productId: 5, productName: 'Coca-Cola 350ml', quantity: 2, unitPrice: 600, totalPrice: 1200 },
  ],
};

function divider(title: string) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' ' + title);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// 1a) cliente NÃO anexou localização
divider('PARTE 1a — mensagem do CLIENTE (sem localização)');
console.log(buildWhatsAppMessage(order));

// 1b) cliente anexou (lat/long fictícios em Maceió)
const geo = { lat: -9.649849, lng: -35.708949 };
divider('PARTE 1b — mensagem do CLIENTE (com 📍 anexada)');
console.log(buildWhatsAppMessage(order, { location: geo }));

// 2) Admin "Avisar cliente" para cada um dos 4 status
divider('PARTE 2 — botão "Avisar cliente" no admin');
const phone = normalizeCustomerPhone(order.customerPhone);
console.log('Telefone bruto:', order.customerPhone);
console.log('Normalizado:   ', phone.digits, '   (válido?', phone.valid, ')');
console.log();
// pixKey vazio aqui — assinatura antiga continua compatível para os outros status.
for (const status of ['Confirmado', 'Em preparo', 'Saiu para entrega', 'Entregue'] as const) {
  const msg = customerNotifyMessage(order, status, { pixKey: '' });
  const url = buildWhatsAppUrl(phone.digits, msg);
  console.log(`  [${status}]`);
  console.log('    mensagem:', msg);
  console.log('    URL:     ', url);
  console.log();
}

// 2b) Telefone curto (inválido)
const phoneShort = normalizeCustomerPhone('999');
console.log('Telefone curto "999" → digits =', phoneShort.digits, ' valid =', phoneShort.valid, '(botão fica desabilitado)');

// 3) "Ver rota" — só endereço de texto (geo não persiste no banco)
divider('PARTE 3 — botão "Ver rota" (admin, pedido entrega)');
const addressText = joinAddressForMaps({
  address: order.address,
  addressNumber: order.addressNumber,
  neighborhood: order.neighborhood,
});
console.log('Endereço montado:', addressText);
console.log('URL Maps:        ', buildMapsSearchUrl(addressText));

// 3b) pedido de RETIRADA não tem "Ver rota"
divider('PARTE 3b — pedido RETIRADA (não deve ter "Ver rota")');
const orderRetirada: Order = {
  ...order,
  id: 100,
  orderNumber: 1235,
  orderType: 'retirada',
  address: null,
  addressNumber: null,
  neighborhood: null,
  reference: null,
  deliveryFee: 0,
  total: 5700,
};
const wouldShow = orderRetirada.orderType === 'entrega';
console.log('Mostrar "Ver rota"?', wouldShow);
