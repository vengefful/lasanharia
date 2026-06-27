// Prova dos 2 ajustes:
//   1. "Ver rota" do admin inclui Cidade/UF quando configurados na loja.
//   2. CheckoutPage vem pré-preenchido em pedidos seguintes (mesmo aparelho).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = 'http://localhost:5173';
const SHOTS = resolve('scripts/admin-shots');
mkdirSync(SHOTS, { recursive: true });

const log = (...a: unknown[]) => console.log('▸', ...a);

async function loginAdminAndGetToken(): Promise<string> {
  const res = await fetch(`${APP}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' }),
  });
  if (!res.ok) throw new Error('login admin falhou: ' + (await res.text()));
  const body = (await res.json()) as { token: string };
  return body.token;
}

async function setCityState(token: string, city: string, state: string) {
  const res = await fetch(`${APP}/api/admin/store`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ city, state }),
  });
  if (!res.ok) throw new Error('PUT store falhou: ' + (await res.text()));
}

async function main() {
  // === PARTE 1: Ver rota com Coruripe/AL ===
  const token = await loginAdminAndGetToken();
  await setCityState(token, 'Coruripe', 'AL');
  log('PUT /api/admin/store → Coruripe / AL');

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();

  await page.goto(`${APP}/admin/login`);
  await page.fill('input[type=email]', 'admin@admin.com');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/orders');
  await page.waitForSelector('text=#1013');
  await page.waitForTimeout(800);

  const verRota1013 = page.locator('li:has(h2:has-text("#1013")) a:has-text("Ver rota")');
  const href1013 = await verRota1013.getAttribute('href');
  log('href de "Ver rota" no #1013 (entrega):');
  console.log('    ', href1013);

  // snap só do card #1013 e da página inteira
  await page.locator('li:has(h2:has-text("#1013"))').screenshot({
    path: `${SHOTS}/13-ver-rota-com-uf.png`,
  });

  // === PARTE 1b: limpar city/state e mostrar que o "Ver rota" cai no fallback ===
  await setCityState(token, '', '');
  await page.reload();
  await page.waitForSelector('text=#1013');
  await page.waitForTimeout(800);
  const href1013Fallback = await page
    .locator('li:has(h2:has-text("#1013")) a:has-text("Ver rota")')
    .getAttribute('href');
  log('Sem city/state, "Ver rota" volta a:');
  console.log('    ', href1013Fallback);

  // === PARTE 2: checkout pré-preenchido no 2º pedido ===
  // Voltamos com Coruripe/AL pra deixar a loja bonita
  await setCityState(token, 'Coruripe', 'AL');

  // Novo contexto (localStorage zerado) para o "cliente"
  const customer = await browser.newContext({ viewport: { width: 414, height: 900 } });
  const cust = await customer.newPage();

  await cust.goto(APP);
  await cust.waitForSelector('text=Lasanhas da Dona Maria');
  await cust.click('button:has-text("Adicionar"):right-of(:text("Coca-Cola 350ml"))').catch(() => {});
  // Adiciona via primeira lasanha que tem "Adicionar" visível
  await cust.locator('button:has-text("Adicionar")').first().click();
  await cust.click('a:has-text("Ver carrinho")');
  await cust.waitForSelector('text=Como você quer receber?');
  await cust.fill('input[placeholder*="Centro"]', 'Centro');
  await cust.click('button:has-text("Continuar para checkout")');
  await cust.waitForSelector('text=Finalizar pedido');

  log('— 1º pedido: preenchendo dados');
  await cust.fill('input[autocomplete=name]', 'Joana Silva');
  await cust.fill('input[autocomplete=tel]', '82994567890');
  await cust.fill('input[autocomplete=street-address]', 'Av. Beira-Mar');
  // O nº é o segundo input do grid; localizo pelo label
  const numInput = cust.locator('label:has-text("Nº") + input').first();
  await numInput.fill('999');
  await cust.fill('input[autocomplete=address-level3]', 'Pontal');
  await cust.fill('input[placeholder*="portão"]', 'casa verde');
  // Pagamento Dinheiro: troco aparece como input adicional, deixar vazio
  await cust.click('button:has-text("Dinheiro")');
  await cust.screenshot({ path: `${SHOTS}/14-checkout-1.png`, fullPage: true });
  log('14-checkout-1.png salvo (form preenchido)');

  // Submete
  await cust.click('button:has-text("Finalizar pedido pelo WhatsApp")');
  await cust.waitForURL(/\/pedido\//, { timeout: 8000 });
  log('1º pedido enviado, navegou para /pedido/...');

  // Verifica que localStorage foi populado
  const stored = await cust.evaluate(() => window.localStorage.getItem('lasanharia-customer-info'));
  log('localStorage["lasanharia-customer-info"]:');
  console.log('    ', stored);

  // — 2º pedido: novo carrinho, vai direto pra /checkout
  await cust.goto(APP);
  await cust.waitForSelector('text=Lasanhas da Dona Maria');
  await cust.locator('button:has-text("Adicionar")').first().click();
  await cust.goto(`${APP}/checkout`);
  await cust.waitForSelector('text=Finalizar pedido');
  await cust.waitForTimeout(400);

  // Lê os valores dos campos
  const dump = {
    nome: await cust.locator('input[autocomplete=name]').inputValue(),
    tel: await cust.locator('input[autocomplete=tel]').inputValue(),
    endereco: await cust.locator('input[autocomplete=street-address]').inputValue(),
    numero: await cust.locator('label:has-text("Nº") + input').first().inputValue(),
    bairro: await cust.locator('input[autocomplete=address-level3]').inputValue(),
    referencia: await cust.locator('input[placeholder*="portão"]').inputValue(),
    pagamentoDinheiroAtivo: await cust
      .locator('button:has-text("Dinheiro")')
      .first()
      .evaluate((el) => el.className.includes('bg-tomato-600')),
  };
  log('— 2º pedido: campos pré-preenchidos:');
  console.log('    ', dump);

  await cust.screenshot({ path: `${SHOTS}/15-checkout-2-prefilled.png`, fullPage: true });
  log('15-checkout-2-prefilled.png salvo');

  await browser.close();
  console.log('\n✅ Provas OK');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
