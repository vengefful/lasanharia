import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = 'http://localhost:5173';
const SHOTS = resolve('scripts/admin-shots');
mkdirSync(SHOTS, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await ctx.newPage();

  await page.goto(`${APP}/admin/login`);
  await page.fill('input[type=email]', 'admin@admin.com');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  // Index do admin agora redireciona para /admin/summary
  await page.waitForURL('**/admin/summary');
  await page.waitForSelector('text=Resumo');
  await page.waitForSelector('text=Top produtos');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/18-resumo.png`, fullPage: true });
  console.log('▸ 18-resumo.png salvo');

  await page.click('a:has-text("Clientes")');
  await page.waitForURL('**/admin/customers');
  await page.waitForSelector('text=Clientes');
  await page.waitForSelector('text=Total gasto');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/19-clientes.png`, fullPage: true });
  console.log('▸ 19-clientes.png salvo');

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
