import { chromium } from '/Users/dukewang/Fantasy Futbol/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1320 }, deviceScaleFactor: 2 });
await p.goto('file://' + new URL('preview/TargetsC.html', import.meta.url).pathname); await p.waitForTimeout(1200);
const box = await p.evaluate(() => { const r = document.querySelector('.inbox').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
await p.screenshot({ path: new URL('shots/inbox2x.png', import.meta.url).pathname, clip: { x: box[0] - 10, y: box[1] - 70, width: box[2] + 20, height: box[3] + 80 } });
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.ib')].map(ib => {
  const q = (s) => { const e = ib.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x*10)/10, Math.round(r.y*10)/10, Math.round(r.width), Math.round(r.height)]; };
  return { crest: q('.ibCrest .crest'), head: q('.ibHead'), who: q('.who'), whoFirst: q('.who > :first-child'), whoTxt: q('.whoTxt'), acts: q('.acts') };
}))));
await b.close();
