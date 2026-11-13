// node build.mjs <name> — inlines base.css, the shared draw, crests and trophies
// into src/<name>.html and writes it to the brainstorm screen dir.
import { readFileSync, writeFileSync } from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const [name, outDir] = process.argv.slice(2);
const { crests, trophies } = JSON.parse(readFileSync(here + 'assets.json', 'utf8'));
let html = readFileSync(`${here}${name}.html`, 'utf8');
html = html.replace('{{css}}', readFileSync(here + 'base.css', 'utf8'));
html = html.replaceAll('{{draw}}', readFileSync(here + 'draw.html', 'utf8'));
html = html.replace(/\{\{inc:([^}]+)\}\}/g, (_, k) => readFileSync(`${here}${k}.html`, "utf8"));
let uid = 0;
html = html.replace(/\{\{c:([^}]+)\}\}/g, (_, k) => {
  const svg = crests[k];
  if (!svg) throw new Error('no crest ' + k);
  const id = `u${uid++}`;
  return svg.replace(/cc\d+/g, id);
});
html = html.replace(/\{\{t:([^}]+)\}\}/g, (_, k) => {
  const svg = trophies[k];
  if (!svg) throw new Error('no trophy ' + k);
  return svg;
});
writeFileSync(`${outDir}/${name}.html`, html);
console.log('wrote', name, html.length);
