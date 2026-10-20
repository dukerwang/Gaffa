// Renders the share card locally through the production renderer, to time it and look at it.
//   bash run_sharp.sh "<query>" <out.png>
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { resolveSharedXI } from '../src/lib/lineups/sharedXI';
import { loadCardAssets } from '../src/lib/lineups/lineupCard';
import { renderCardPng } from '../src/lib/lineups/renderCard';

const [query, out] = process.argv.slice(2);
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const fonts = [
  { name: 'Newsreader', data: readFileSync('src/assets/fonts/Newsreader-Bold.ttf'), weight: 700 as const, style: 'normal' as const },
  { name: 'Wordmark', data: readFileSync('src/assets/fonts/Newsreader-Bold-Opsz14.ttf'), weight: 700 as const, style: 'normal' as const },
  { name: 'Label', data: readFileSync('src/assets/fonts/SofiaSansSemiCondensed-Bold.ttf'), weight: 700 as const, style: 'normal' as const },
];

const t0 = Date.now();
const xi = await resolveSharedXI(sb as never, Object.fromEntries(new URLSearchParams(query).entries()));
const assets = await loadCardAssets(xi, 'https://www.gaffa.live');
const t1 = Date.now();
const png = await renderCardPng(xi, assets, fonts);
const t2 = Date.now();
writeFileSync(out, png);
const meta = await sharp(png).metadata();
console.log(`data ${t1 - t0}ms render ${t2 - t1}ms ${meta.width}x${meta.height} ${png.length}B`);
