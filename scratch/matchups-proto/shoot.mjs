import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];
const files = fs.readdirSync(path.join(HERE, 'preview')).filter((f) => f.endsWith('.html') && (!only || f.includes(only)));
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch();
const heights = fs.existsSync(path.join(HERE, 'heights.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'heights.json'), 'utf8')) : {};
const report = {};
for (const f of files) {
  const w = /FormationsPhone/.test(f) ? 1230 : /FormationsDesktop/.test(f) ? 1300 : /Landscape/.test(f) ? 844 : /Phone/.test(f) ? 390 : 1440;
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(HERE, 'preview', f));
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const s = document.querySelector('.screen'); s.style.height = 'auto';
    const h = Math.ceil(s.getBoundingClientRect().height);
    const W = s.getBoundingClientRect().right; const issues = [];
    const skip = (el) => el.closest('.ribCells, .tpGrid, .mbTies, .rib');
    document.querySelectorAll('.screen *').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > W + 0.5 && !skip(el)) issues.push('overflow-x ' + (el.getAttribute('class') || el.tagName));
      const cs = getComputedStyle(el);
      if ((cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && !skip(el)) issues.push('TRUNC ' + (el.getAttribute('class')) + ': ' + el.textContent.trim().slice(0, 40));
    });
    document.querySelectorAll('.screen *').forEach((el) => {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own.length || getComputedStyle(el).display === 'none') return;
      const tops = new Set();
      own.forEach((n) => { const rg = document.createRange(); rg.selectNodeContents(n); [...rg.getClientRects()].forEach((q) => { if (q.width > 1) tops.add(Math.round(q.top / 4)); }); });
      if (tops.size > 1 && !el.closest('.rrLead, .mrBody, .h2Note, .pbEv, .rcN2')) issues.push('WRAP ' + (el.getAttribute('class') || el.tagName) + ': ' + el.textContent.trim().slice(0, 50));
    });
    // chips on the grass must not touch each other or leave the field
    const chips = [...document.querySelectorAll('.pa .ch, .pv .ch, .phField .ch, .rpField .rcC')];
    for (let i = 0; i < chips.length; i++) {
      const a = chips[i].getBoundingClientRect();
      const field = chips[i].closest('.pa, .pv, .phField, .rpField').getBoundingClientRect();
      if (a.left < field.left + 4 || a.right > field.right - 4 || a.top < field.top + 4 || a.bottom > field.bottom - 4) issues.push('OFF-FIELD ' + chips[i].getAttribute('aria-label'));
      for (let j = i + 1; j < chips.length; j++) {
        const b = chips[j].getBoundingClientRect();
        if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) issues.push('OVERLAP ' + chips[i].getAttribute('aria-label') + ' / ' + chips[j].getAttribute('aria-label'));
      }
    }
    document.querySelectorAll('.rcN').forEach((n) => { if (n.scrollWidth > n.clientWidth + 0.5) issues.push('NAME-CUT ' + n.textContent); const lines = Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight)); if (lines > 2) issues.push('NAME-3LINES ' + n.textContent); });
    document.querySelectorAll('.rpCell').forEach((c) => { const cb = c.getBoundingClientRect(); c.querySelectorAll('.pts, .rcSub, .rcBox').forEach((e) => { const b = e.getBoundingClientRect(); const f = c.closest('.rpField').getBoundingClientRect(); if (b.left < f.left || b.right > f.right) issues.push('CELL-SPILL ' + c.textContent.trim().slice(0, 20)); }); });
    const broken = [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src.split('/').pop());
    return { h, issues: [...new Set(issues)].slice(0, 30), broken };
  });
  heights[f.replace('.html', '.dc.html')] = r.h; report[f] = r;
  await page.setViewportSize({ width: w, height: Math.min(r.h, 6000) });
  await page.screenshot({ path: path.join(HERE, 'shots', f.replace('.html', '.png')), fullPage: true });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(HERE, 'heights.json'), JSON.stringify(heights, null, 1));
for (const [f, r] of Object.entries(report)) console.log(f, r.h, r.broken.length ? 'BROKEN ' + r.broken.join(',') : '', '\n  ' + r.issues.join('\n  '));
