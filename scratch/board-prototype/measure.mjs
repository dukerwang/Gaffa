import { chromium } from '/Users/dukewang/Fantasy Futbol/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('file://' + new URL('preview/HeadsModule.html', import.meta.url).pathname); await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  await document.fonts.ready;
  const btn = getComputedStyle(document.querySelector('.cAct .btn')).fontFamily;
  const seg = getComputedStyle(document.querySelector('.segB')).fontFamily;
  const baseline = (el) => { // y of the text baseline of the first text in el
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.textContent.trim() ? 1 : 3 });
    const t = w.nextNode(); if (!t) return null;
    const probe = document.createElement('span'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    t.parentNode.insertBefore(probe, t); const y = probe.getBoundingClientRect().top; probe.remove(); return Math.round(y * 10) / 10;
  };
  const rows = [...document.querySelectorAll('.rw')].map((rw) => {
    const q = (s) => rw.querySelector(s);
    const ends = q('.cEnds').getBoundingClientRect(), act = q('.cAct .btn').getBoundingClientRect();
    return { btn: baseline(q('.cAct .btn')), name: baseline(q('.pName')), who: baseline(q('.cWho')), terms: baseline(q('.cTerms')), priceK: baseline(q('.pk')) , price: baseline(q('.cPrice b')), ends: q('.cEnds').textContent.trim() ? baseline(q('.cEnds')) : null, gapToButton: Math.round(act.left - ends.right) };
  });
  const cols = (sel) => [...document.querySelectorAll(sel)].map((e) => Math.round(e.getBoundingClientRect().left));
  return { btn, seg, rows, pkLeft: [...new Set(cols('.rw .pk'))], priceRight: [...new Set([...document.querySelectorAll('.cPrice b')].map((e) => Math.round(e.getBoundingClientRect().right)))], headPriceRight: [...document.querySelectorAll('.rh .r')].map((e) => Math.round(e.getBoundingClientRect().right)) };
});
console.log(JSON.stringify(r, null, 1)); await b.close();
