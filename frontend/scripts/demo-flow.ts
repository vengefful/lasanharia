// Simula o fluxo completo do front: carrinho → POST /api/orders → mensagem wa.me.
// Roda fora do browser, só pra provar end-to-end via curl/tsx neste terminal.
import { buildWhatsAppMessage, buildWhatsAppUrl } from '../src/lib/whatsapp';
import type { Order, Store } from '../src/types';

const BASE = 'http://localhost:5173'; // via proxy do Vite

async function main() {
  const store = (await (await fetch(`${BASE}/api/store`)).json()) as Store;

  // "Carrinho" simulado pelo cliente: 1 Lasanha de Frango Grande + 2 Coca-Cola 350ml
  const cart = [
    { productId: 2, quantity: 1 },
    { productId: 5, quantity: 2 },
  ];

  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Fernando',
      customerPhone: '11987654321',
      orderType: 'entrega',
      address: 'Rua das Massas',
      addressNumber: '123',
      neighborhood: 'Centro',
      reference: 'portão azul, ao lado da padaria',
      notes: 'sem cebola',
      paymentMethod: 'Dinheiro',
      changeFor: 10000,
      items: cart,
    }),
  });
  if (!res.ok) {
    console.error('FALHOU:', res.status, await res.text());
    process.exit(1);
  }
  const order = (await res.json()) as Order;

  const message = buildWhatsAppMessage(order);
  const url = buildWhatsAppUrl(store.whatsappNumber, message);

  console.log('━━━━━━━━━ MENSAGEM ━━━━━━━━━');
  console.log(message);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();
  console.log('Pedido salvo no banco: #' + order.orderNumber, '| total cents:', order.total);
  console.log();
  console.log('URL wa.me que o front abriria:');
  console.log(url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
