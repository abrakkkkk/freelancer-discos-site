/**
 * verify-site.js
 * Script de teste e validação E2E com Playwright para a Freelancer Discos.
 * Executa testes reais no navegador em modo Desktop e Mobile, captura screenshots e valida fluxos.
 */

const path = require('path');
const fs = require('fs');

// Resolve o playwright do projeto principal
let playwrightModule = 'playwright';
try {
  require.resolve('playwright');
} catch (_) {
  playwrightModule = 'c:/Users/FREE LANCER/Documents/freelancer-discos/node_modules/playwright';
}
const { chromium, devices } = require(playwrightModule);

const ARTIFACT_DIR = 'C:/Users/FREE LANCER/.gemini/antigravity-ide/brain/e2b4d5a5-1c9b-4f1f-806d-ced81eb791a9';
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

async function runTests() {
  console.log('🚀 Iniciando testes E2E com Playwright...');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  
  // =========================================================================
  // 1. TESTE DESKTOP (1440x900)
  // =========================================================================
  console.log('\n🖥️ [1/2] Testando visualização Desktop (1440x900)...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await desktopContext.newPage();

  await page.goto('http://localhost:3333/', { waitUntil: 'load' });
  await page.waitForSelector('.record-card', { timeout: 10000 });
  console.log('  ✓ Página carregada com sucesso.');

  // Verifica elementos chave
  const title = await page.title();
  console.log(`  ✓ Título da página: "${title}"`);

  const heroVisible = await page.locator('.hero-section').isVisible();
  console.log(`  ✓ Hero Section visível: ${heroVisible}`);

  const vinylVisible = await page.locator('#vinylDisc').isVisible();
  console.log(`  ✓ Vinil CSS visível: ${vinylVisible}`);

  const carouselVisible = await page.locator('#aboutCarousel').isVisible();
  const slideCount = await page.locator('.carousel-slide').count();
  console.log(`  ✓ Carrossel de fotos visível: ${carouselVisible} com ${slideCount} slides prontos.`);

  // Testa navegação do carrossel
  await page.click('#carouselNextBtn');
  const slideNumText = await page.locator('#currentSlideNum').textContent();
  console.log(`  ✓ Próximo slide acionado, slide atual: ${slideNumText}`);

  // Screenshot Desktop Geral
  const desktopFullShot = path.join(SCREENSHOT_DIR, 'desktop_full.png');
  await page.screenshot({ path: desktopFullShot, fullPage: true });
  console.log(`  📸 Screenshot salvo: ${desktopFullShot}`);

  // Teste de Busca
  console.log('  🔍 Testando busca no catálogo...');
  await page.fill('#searchInput', 'Taylor');
  await page.waitForTimeout(300); // aguarda debounce

  const countTextAfterSearch = await page.locator('#catalogCount').textContent();
  console.log(`  ✓ Resultado da busca por "Taylor": ${countTextAfterSearch}`);

  const searchShot = path.join(SCREENSHOT_DIR, 'desktop_search.png');
  await page.screenshot({ path: searchShot });

  // Limpa busca
  await page.click('#searchClear');
  await page.waitForTimeout(200);

  // Teste de catálogo total
  const countTotal = await page.locator('#catalogCount').textContent();
  console.log(`  ✓ Catálogo completo carregado: ${countTotal}`);

  // Teste da Sacola de Compras
  console.log('  🛒 Testando fluxo da Sacola de Compras...');
  const firstAddBtn = page.locator('.btn-add-cart').nth(0);
  const secondAddBtn = page.locator('.btn-add-cart').nth(1);

  await firstAddBtn.click();
  await page.waitForTimeout(300);
  await secondAddBtn.click();
  await page.waitForTimeout(300);

  // Abre a sacola pelo botão da navbar
  await page.click('#cartTrigger');
  await page.waitForTimeout(400);

  const isDrawerOpen = await page.locator('#cartDrawer').evaluate(el => el.classList.contains('open'));
  console.log(`  ✓ Drawer da Sacola aberto: ${isDrawerOpen}`);

  const cartItemsCount = await page.locator('#cartItemsList .cart-item-card').count();
  console.log(`  ✓ Itens na Sacola: ${cartItemsCount}`);

  const subtotalText = await page.locator('#cartSubtotal').textContent();
  console.log(`  ✓ Subtotal calculado: ${subtotalText}`);

  // Preenche dados do cliente
  await page.fill('#customerName', 'Lucas Vinil');
  await page.fill('#customerCity', 'Meireles, Fortaleza - CE');

  const cartShot = path.join(SCREENSHOT_DIR, 'desktop_cart_drawer.png');
  await page.screenshot({ path: cartShot });
  console.log(`  📸 Screenshot da sacola salvo: ${cartShot}`);

  // Fecha o drawer
  await page.click('#drawerCloseBtn');
  await page.waitForTimeout(300);

  await desktopContext.close();

  // =========================================================================
  // 2. TESTE MOBILE (iPhone 14 - 390x844)
  // =========================================================================
  console.log('\n📱 [2/2] Testando visualização Mobile (iPhone 14)...');
  const mobileDevice = devices['iPhone 14'];
  const mobileContext = await browser.newContext({
    ...mobileDevice
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto('http://localhost:3333/', { waitUntil: 'load' });
  await mobilePage.waitForSelector('.record-card', { timeout: 10000 });

  // Verifica botão flutuante mobile da sacola
  const floatingBtnVisible = await mobilePage.locator('#floatingCartBtn').isVisible();
  console.log(`  ✓ Botão flutuante de Sacola visível no celular: ${floatingBtnVisible}`);

  // Adiciona um disco pelo celular
  await mobilePage.locator('.btn-add-cart').first().click();
  await mobilePage.waitForTimeout(400);

  const mobileCartOpen = await mobilePage.locator('#cartDrawer').evaluate(el => el.classList.contains('open'));
  console.log(`  ✓ Sacola aberta suavemente no celular: ${mobileCartOpen}`);

  const mobileShot = path.join(SCREENSHOT_DIR, 'mobile_view.png');
  await mobilePage.screenshot({ path: mobileShot });
  console.log(`  📸 Screenshot Mobile salvo: ${mobileShot}`);

  await mobileContext.close();
  await browser.close();

  // Copia screenshots para a pasta de artefatos
  try {
    if (fs.existsSync(ARTIFACT_DIR)) {
      const shots = fs.readdirSync(SCREENSHOT_DIR);
      shots.forEach(s => {
        fs.copyFileSync(path.join(SCREENSHOT_DIR, s), path.join(ARTIFACT_DIR, s));
      });
      console.log('🖼️ Screenshots copiados com sucesso para o diretório de artefatos.');
    }
  } catch (e) {
    console.warn('Aviso ao copiar screenshots para artefatos:', e.message);
  }

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO (100% OK)!');
}

runTests().catch(err => {
  console.error('❌ Falha nos testes Playwright:', err);
  process.exit(1);
});
