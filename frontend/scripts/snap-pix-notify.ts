// Prova do "Avisar cliente" Confirmado + Pix:
//   A) com pixKey configurada na loja → mensagem traz chave + valor + pedido de comprovante
//   B) sem pixKey → mensagem fallback genérica
//   C) outros status / outros pagamentos → mensagens originais intactas
//   D) screenshot da config da loja com o campo "Chave PIX" salvo
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  customerNotifyMessage,
  normalizeCustomerPhone,
  type CustomerNotifyStatus,
} from '../src/admin/customerNotify';
import { buildWhatsAppUrl } from '../src/lib/whatsapp';

const APP = 'http://localhost:5173';
const SHOTS = resolve('scripts/admin-shots');
mkdirSync(SHOTS, { recursive: true });

const log = (...a: unknown[]) => console.log('▸', ...a);

async function loginAndGetToken(): Promise<string> {
  const r = await fetch(`${APP}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' }),
  });
  if (!r.ok) throw new Error('login: ' + (await r.text()));
  return ((await r.json()) as { token: string }).token;
}

async function setPixKey(token: string, pixKey: string) {
  const r = await fetch(`${APP}/api/admin/store`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pixKey }),
  });
  if (!r.ok) throw new Error('PUT store: ' + (await r.text()));
}

function divider(t: string) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' ' + t);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function main() {
  // ===== PARTE A: pixKey configurada ===================================
  const token = await loginAndGetToken();
  const PIX_KEY = '82991413741';
  await setPixKey(token, PIX_KEY);
  log(`PUT /api/admin/store → pixKey="${PIX_KEY}"`);

  const orderPixConfirmado = { orderNumber: 1234, paymentMethod: 'Pix', total: 6200 };
  const phone = normalizeCustomerPhone('82991413741');

  divider('A) Confirmado + Pix + pixKey configurada');
  const msgA = customerNotifyMessage(orderPixConfirmado, 'Confirmado', { pixKey: PIX_KEY });
  console.log('mensagem:', msgA);
  console.log('URL:     ', buildWhatsAppUrl(phone.digits, msgA));

  // ===== PARTE B: pixKey vazia → fallback =============================
  divider('B) Confirmado + Pix + pixKey VAZIA (fallback)');
  const msgB = customerNotifyMessage(orderPixConfirmado, 'Confirmado', { pixKey: '' });
  console.log('mensagem:', msgB);
  console.log('URL:     ', buildWhatsAppUrl(phone.digits, msgB));

  // ===== PARTE C: outros status / outros pagamentos =====================
  divider('C) Confirmado + Dinheiro (não muda)');
  const orderDinheiro = { orderNumber: 1235, paymentMethod: 'Dinheiro', total: 4500 };
  console.log(customerNotifyMessage(orderDinheiro, 'Confirmado', { pixKey: PIX_KEY }));

  divider('C) Outros status com Pix (não muda — só Confirmado é especial)');
  for (const s of ['Em preparo', 'Saiu para entrega', 'Entregue'] as CustomerNotifyStatus[]) {
    console.log(`  [${s}]`, customerNotifyMessage(orderPixConfirmado, s, { pixKey: PIX_KEY }));
  }

  // ===== PARTE D: screenshot da config da loja =========================
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await ctx.newPage();
  await page.goto(`${APP}/admin/login`);
  await page.fill('input[type=email]', 'admin@admin.com');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/orders');
  await page.click('a:has-text("Loja")');
  await page.waitForSelector('text=Configuração da loja');
  await page.waitForSelector('label:has-text("Chave PIX")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/16-loja-com-pix.png`, fullPage: true });
  log('16-loja-com-pix.png salvo');

  // Verifica que GET público também devolve pixKey
  const storeNow = (await (await fetch(`${APP}/api/store`)).json()) as { pixKey: string };
  log(`GET /api/store devolveu pixKey = "${storeNow.pixKey}"`);

  // Pega o snap de um pedido entrega "Confirmado" + paymentMethod "Pix" pra mostrar
  // que o botão "Avisar cliente" agora gera a URL com PIX.
  await page.click('a:has-text("Pedidos")');
  await page.waitForSelector('text=Pedidos');
  // Acha o primeiro pedido Pix que esteja Confirmado ou muda um pra confirmado.
  // Cria um pedido fresco via API e seta Confirmado via PATCH admin pra garantir.
  const created = (await (await fetch(`${APP}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Cliente Pix',
      customerPhone: '82994321000',
      orderType: 'retirada',
      paymentMethod: 'Pix',
      items: [{ productId: 8, quantity: 1 }],
    }),
  })).json()) as { id: number; orderNumber: number };
  log(`pedido Pix #${created.orderNumber} criado (id ${created.id})`);
  await fetch(`${APP}/api/admin/orders/${created.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'Confirmado' }),
  });
  log(`status #${created.orderNumber} → Confirmado`);

  await page.reload();
  await page.waitForSelector(`text=#${created.orderNumber}`);
  await page.waitForTimeout(700);
  const avisar = page.locator(
    `li:has(h2:has-text("#${created.orderNumber}")) a:has-text("Avisar cliente")`,
  );
  const href = await avisar.getAttribute('href');
  log('href real do "Avisar cliente" no pedido recém-confirmado (Pix):');
  console.log('    ', href);

  await page
    .locator(`li:has(h2:has-text("#${created.orderNumber}"))`)
    .screenshot({ path: `${SHOTS}/17-pedido-pix-confirmado.png` });
  log('17-pedido-pix-confirmado.png salvo');

  await browser.close();
  console.log('\n✅ Prova PIX OK');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
