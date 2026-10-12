// Measures every name (and every part of a name) in the prototype's serif,
// so a name's size is solved, not guessed. The app does the same at runtime.
import { chromium } from 'playwright';
import fs from 'node:fs';
const names = new Set(JSON.parse(fs.readFileSync('long.json', 'utf8')).map((x) => x[0]));
for (const [, v] of Object.entries(JSON.parse(fs.readFileSync('photos.json', 'utf8')))) names.add(v.name);
const parts = new Set();
for (const n of names) { parts.add(n); for (const p of n.replace(/-/g, '-\u0001').split(/[\s\u0001]+/)) parts.add(p); }
const b = await chromium.launch(); const pg = await b.newPage();
await pg.setContent(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,700&display=swap"><span id="x" style="font: 700 10px Newsreader; letter-spacing: -0.01em; white-space: nowrap;"></span>`);
await pg.evaluate(async () => { document.getElementById('x').textContent = 'Mamardashvili'; await document.fonts.load('700 10px Newsreader'); await document.fonts.ready; });
console.log('font ok', await pg.evaluate(() => document.fonts.check('700 10px Newsreader')));
await pg.waitForTimeout(800);
const out = {};
for (const t of parts) out[t] = await pg.evaluate((t) => { const x = document.getElementById('x'); x.textContent = t; return x.getBoundingClientRect().width / 10 * 1.03; }, t);
await b.close();
fs.writeFileSync('name-widths.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, out['Mamardashvili'], out['Williams-'], out['B.Fernandes']);
