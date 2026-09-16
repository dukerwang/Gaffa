/**
 * Renders the League Home probe at both target widths in both themes and
 * writes full-page PNGs. Throwaway.
 *
 *   node scratch/shoot_home.mjs <outDir> [url]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2];
const url = process.argv[3] ?? 'http://localhost:3020/share/home-probe';
mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const themes = ['light', 'dark'];

const browser = await chromium.launch();

for (const size of sizes) {
  for (const theme of themes) {
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 2,
      isMobile: !!size.mobile,
      hasTouch: !!size.mobile,
    });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('theme', t);
      } catch {}
    }, theme);

    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForTimeout(2500);

    // Horizontal overflow is the one thing a screenshot hides.
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));

    const file = `${outDir}/${size.name}-${theme}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(
      `${file}  overflow=${overflow.scrollW - overflow.clientW}px  errors=${errors.length}`,
    );
    for (const e of errors.slice(0, 5)) console.log(`   ! ${e}`);
    await ctx.close();
  }
}

await browser.close();
