import { chromium } from '/Users/dukewang/Fantasy Futbol/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const { BOARDS } = await import(process.argv[2] || './board.mjs');
const files = BOARDS.map(b => [b.file.replace('.dc.html',''), b.w, b.fixedH]);
const browser = await chromium.launch();
const heights = {}; const report = {};
for (const [f,w,fixedH] of files) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  if (fixedH) await page.addInitScript(() => { window.__fixed = true; });
  await page.goto('file://' + path.join(HERE, 'preview', f + '.html'));
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const s = document.querySelector('.screen');
    if (!window.__fixed) s.style.height = 'auto';
    const h = Math.ceil(s.getBoundingClientRect().height);
    const issues = [];
    const W = s.getBoundingClientRect().right;
    document.querySelectorAll('.screen *').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > W + 0.5 && !el.closest('.tiles, .spine, .subIn, .lots')) issues.push('overflow-x ' + el.className.baseVal ?? el.className);
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible' && !el.closest('.tiles, .spine, .subIn, .lots') && !el.matches('.tiles,.spine,.subIn,.lots,.face,.livePlinth,.tPlinth,.lotPlinth,.plateFace,.screen,.liveBody,.behind,.dlg')) issues.push('clipped ' + (el.className.baseVal ?? el.className) + ' ' + el.textContent.slice(0,40));
    });
    const wraps = [];
    document.querySelectorAll('.screen *').forEach(el => {
      const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
      if (!own.length || getComputedStyle(el).display === 'none') return;
      const tops = new Set();
      own.forEach(n => { const r = document.createRange(); r.selectNodeContents(n); [...r.getClientRects()].forEach(q => { if (q.width > 1) tops.add(Math.round(q.top / 4)); }); });
      if (tops.size > 1) wraps.push((el.getAttribute('class') || el.tagName) + ': ' + el.textContent.trim().slice(0, 50));
    });
    issues.push(...wraps.map(w => 'WRAP ' + w));
    const imgs = [...document.images].filter(i => !i.naturalWidth).map(i => i.src);
    return { h, issues: [...new Set(issues)].slice(0, 20), broken: imgs };
  });
  heights[f + '.dc.html'] = r.h; report[f] = r;
  await page.setViewportSize({ width: w, height: r.h });
  await page.screenshot({ path: path.join(HERE, 'shots', f + '.png'), fullPage: true });
  await page.close();
}
await browser.close();
const hp2 = path.join(HERE, 'board-heights.json');
const prev = fs.existsSync(hp2) ? JSON.parse(fs.readFileSync(hp2, 'utf8')) : {};
fs.writeFileSync(hp2, JSON.stringify({ ...prev, ...heights }, null, 1));
console.log(JSON.stringify(report, null, 1));
