/**
 * Demo end-to-end da Fase 5 (admin):
 *  1. Login no /admin
 *  2. OrdersPage carregada via polling
 *  3. Dispara POST /api/orders público e mostra o pedido novo entrando sem refresh
 *  4. Muda status do novo pedido pelo dropdown
 *  5. Edita um produto (muda o preço)
 *  6. Salva config da loja com deliveryFee novo
 *
 * Snapa screenshots de cada etapa em scripts/admin-shots/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = 'http://localhost:5173';
const SHOTS = resolve('scripts/admin-shots');
mkdirSync(SHOTS, { recursive: true });

const log = (...a: unknown[]) => console.log('▸', ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createPublicOrder() {
  const res = await fetch(`${APP}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Polling Demo',
      customerPhone: '11912340000',
      orderType: 'retirada',
      paymentMethod: 'Pix',
      items: [{ productId: 2, quantity: 1 }],
    }),
  });
  if (!res.ok) throw new Error('Falha criando pedido público: ' + (await res.text()));
  return res.json();
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 1. LOGIN
  await page.goto(`${APP}/admin/login`);
  await page.fill('input[type=email]', 'admin@admin.com');
  await page.fill('input[type=password]', 'admin123');
  await page.screenshot({ path: `${SHOTS}/01-login.png`, fullPage: true });
  log('01-login.png salvo');

  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/orders');
  await page.waitForSelector('text=Pedidos');
  await sleep(800);
  const initialCount = await page.locator('li:has(h2)').count();
  await page.screenshot({ path: `${SHOTS}/02-orders.png`, fullPage: true });
  log(`02-orders.png salvo — ${initialCount} pedidos visíveis`);

  // 3. POST público enquanto a página fica em polling
  log('disparando POST público...');
  const created = (await createPublicOrder()) as { orderNumber: number; id: number };
  log(`pedido público criado: #${created.orderNumber} (id ${created.id})`);

  // Espera o polling rodar (≤10s) — o item deve aparecer com badge "novo"
  await page.waitForSelector(`text=#${created.orderNumber}`, { timeout: 13_000 });
  log(`#${created.orderNumber} apareceu via polling`);
  await page.screenshot({ path: `${SHOTS}/03-novo-pedido.png`, fullPage: true });
  log('03-novo-pedido.png salvo');

  // 4. Muda status do pedido novo
  const newOrderItem = page.locator(`li:has(h2:has-text("#${created.orderNumber}"))`);
  await newOrderItem.locator('select').selectOption('Em preparo');
  // backend retorna o pedido atualizado, badge muda
  await newOrderItem.locator('text=Em preparo').first().waitFor({ timeout: 5000 });
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/04-status-mudado.png`, fullPage: true });
  log('04-status-mudado.png salvo (status "Em preparo")');

  // 5. PRODUTOS — edita Coca-Cola 350ml, troca preço 6,00 → 7,50
  await page.click('a:has-text("Produtos")');
  await page.waitForSelector('text=Produtos');
  await page.waitForSelector('text=Coca-Cola 350ml');
  await sleep(500);
  await page.screenshot({ path: `${SHOTS}/05-produtos-lista.png`, fullPage: true });
  log('05-produtos-lista.png salvo');

  // Abrir o "Editar" do Coca-Cola 350ml
  await page.locator('tr:has-text("Coca-Cola 350ml") button:has-text("Editar")').click();
  await page.waitForSelector('text=Editar produto');
  await page.fill('input[inputmode=decimal]', '7,50');
  await page.screenshot({ path: `${SHOTS}/06-produto-modal.png`, fullPage: true });
  log('06-produto-modal.png salvo (preço 6,00 → 7,50)');
  await page.click('button:has-text("Salvar")');
  await page.waitForSelector('text=Editar produto', { state: 'detached' });
  await page.waitForSelector('text=R$ 7,50');
  await sleep(300);
  await page.screenshot({ path: `${SHOTS}/07-produto-salvo.png`, fullPage: true });
  log('07-produto-salvo.png salvo (lista mostra R$ 7,50)');

  // 6. LOJA — muda deliveryFee para 6,50 e salva
  await page.click('a:has-text("Loja")');
  await page.waitForSelector('text=Configuração da loja');
  await page.waitForSelector('label:has-text("Taxa de entrega")');
  await sleep(300);

  const feeInput = page.locator('label:has-text("Taxa de entrega") + input').first();
  await feeInput.fill('6,50');
  await page.screenshot({ path: `${SHOTS}/08-loja-form.png`, fullPage: true });
  log('08-loja-form.png salvo (form com 6,50)');

  await page.click('button:has-text("Salvar configuração")');
  await page.waitForSelector('text=/Salvo às/');
  await sleep(400);
  await page.screenshot({ path: `${SHOTS}/09-loja-salvo.png`, fullPage: true });
  log('09-loja-salvo.png salvo');

  // Verifica que o backend persistiu (faz GET sem token, store é público)
  const storeNow = await (await fetch(`${APP}/api/store`)).json();
  log('GET /api/store → deliveryFee =', storeNow.deliveryFee);
  if (storeNow.deliveryFee !== 650) {
    throw new Error('Esperava deliveryFee=650, veio ' + storeNow.deliveryFee);
  }

  // volta loja pra zero pra não vazar pra próxima sessão
  await feeInput.fill('0,00');
  await page.click('button:has-text("Salvar configuração")');
  await page.waitForSelector('text=/Salvo às/');

  await browser.close();
  console.log('\n✅ Tudo OK — screenshots em scripts/admin-shots/');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
