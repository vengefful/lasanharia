// Tira screenshot do /carrinho num iPhone simulado (~375px de viewport)
// pra provar visualmente que não há rolagem horizontal e o X fica dentro do viewport.
import { chromium } from 'playwright';

const APP = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch();
  // ~375px conforme pedido pelo usuário. iPhone SE / iPhone Mini.
  const context = await browser.newContext({
    viewport: { width: 375, height: 720 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  });
  const page = await context.newPage();

  // Pré-popula o carrinho via localStorage no domínio antes de navegar (Zustand persist).
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'lasanharia-cart',
      JSON.stringify({
        state: {
          items: [
            { productId: 8, name: 'Combo Lasanha Grande + Refrigerante 2L', price: 5500, quantity: 3 },
            { productId: 4, name: 'Lasanha Bolonhesa Grande', price: 4500, quantity: 2 },
            { productId: 5, name: 'Coca-Cola 350ml', price: 600, quantity: 1 },
          ],
        },
        version: 0,
      }),
    );
  });

  await page.goto(`${APP}/carrinho`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Seu carrinho');

  // Mede largura do html e do body — se body > viewport, há scroll horizontal.
  const dims = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    canScrollX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  console.log('Dimensões:', dims);

  // Verifica que o último X visível está dentro do viewport.
  const xButtons = await page.$$('button[aria-label^="Remover"]');
  for (const btn of xButtons) {
    const box = await btn.boundingBox();
    console.log('  X "Remover" box:', box);
    if (box && box.x + box.width > dims.viewportWidth) {
      console.error(`  ❌ X fora do viewport (x+w=${box.x + box.width} > ${dims.viewportWidth})`);
      process.exitCode = 1;
    }
  }

  await page.screenshot({ path: 'cart-375.png', fullPage: true });
  console.log('📸 cart-375.png salvo');

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
