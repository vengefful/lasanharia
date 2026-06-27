// Screenshot da OrdersPage com os botões "Avisar cliente" + "Ver rota".
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = 'http://localhost:5173';
const SHOTS = resolve('scripts/admin-shots');
mkdirSync(SHOTS, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${APP}/admin/login`);
  await page.fill('input[type=email]', 'admin@admin.com');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/admin/orders');
  await page.waitForSelector('text=Pedidos');

  // Espera renderizar a lista
  await page.waitForSelector('text=#1013');
  await page.waitForTimeout(700);

  // Inspeciona quais botões existem em #1013 (entrega Confirmado) vs #1011 (retirada Em preparo)
  for (const num of [1013, 1011]) {
    const li = page.locator(`li:has(h2:has-text("#${num}"))`);
    const buttons = await li.locator('a, button').allTextContents();
    console.log(`#${num}: botões = [${buttons.map((b) => JSON.stringify(b.trim())).join(', ')}]`);
  }

  // Captura uma área específica para enquadrar bem os 2 pedidos
  const li1013 = page.locator(`li:has(h2:has-text("#1013"))`);
  await li1013.screenshot({ path: `${SHOTS}/10-entrega-com-rota.png` });
  console.log('10-entrega-com-rota.png salvo');

  const li1011 = page.locator(`li:has(h2:has-text("#1011"))`);
  await li1011.screenshot({ path: `${SHOTS}/11-retirada-sem-rota.png` });
  console.log('11-retirada-sem-rota.png salvo');

  // Tira também a página inteira pra contexto
  await page.screenshot({ path: `${SHOTS}/12-orders-com-acoes.png`, fullPage: true });
  console.log('12-orders-com-acoes.png salvo');

  await browser.close();
  console.log('✅ Snap admin OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
