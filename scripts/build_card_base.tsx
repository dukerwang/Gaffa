/**
 * Renders the Lineup Builder share card's shared base (shelf stripes, pitch,
 * markings, wordmark) at 2x into src/assets/card-base@2x.png.
 *
 * The image route lays each card's header and players on this file instead of
 * drawing the base per request, which was most of the render time (see
 * src/lib/lineups/renderCard.tsx). Rerun after changing anything the `base` part
 * of LineupCard draws, and commit the PNG:
 *
 *   node_modules/esbuild/bin/esbuild scripts/build_card_base.tsx --bundle --platform=node --format=esm \
 *     --jsx=automatic --tsconfig=tsconfig.json --external:sharp --external:satori --outfile=scratch/_base.mjs \
 *     && node scratch/_base.mjs && rm scratch/_base.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CARD_BASE_FILE, renderCardBase, type CardFont } from '../src/lib/lineups/renderCard';

const font = (file: string, name: string): CardFont => ({
  name,
  data: readFileSync(`src/assets/fonts/${file}`),
  weight: 700,
  style: 'normal',
});
const fonts = [
  font('Newsreader-Bold.ttf', 'Newsreader'),
  font('Newsreader-Bold-Opsz14.ttf', 'Wordmark'),
  font('SofiaSansSemiCondensed-Bold.ttf', 'Label'),
];

const png = await renderCardBase(fonts);
writeFileSync(CARD_BASE_FILE, png);
console.log(`wrote ${CARD_BASE_FILE} (${png.length} bytes)`);
