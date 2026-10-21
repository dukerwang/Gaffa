import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import {
  CARD_H,
  CARD_SCALE,
  CARD_W,
  LineupCard,
  NodeTile,
  SHELF_H,
  cardNodes,
  nodeTileBox,
  type CardAssets,
} from './lineupCard';
import type { SharedXI } from './sharedXI';

export type CardFont = { name: string; data: Buffer; weight: 700; style: 'normal' };

const TILE_MARGIN = 16;
const DENSITY = 72 * CARD_SCALE; // sharp reads SVG at 72 dpi; 144 doubles every length

/** The pre-rendered base every card shares, checked in by scripts/build_card_base.tsx. */
export const CARD_BASE_FILE = 'src/assets/card-base@2x.png';

/** An XI with nobody in it, for drawing the parts of the card that don't depend on one. */
const EMPTY_XI: SharedXI = { title: '', formation: '4-3-3', slots: [], club: null, matchweek: null, performances: {} };
const NO_ASSETS: CardAssets = { photos: new Map(), crests: new Map() };

/** Renders the shared base (shelf stripes, pitch, markings, wordmark) at 2x. Slow: about 6s on one core. */
export async function renderCardBase(fonts: CardFont[]): Promise<Buffer> {
  const svg = await satori(<LineupCard xi={EMPTY_XI} assets={NO_ASSETS} part="base" />, { width: CARD_W, height: CARD_H, fonts });
  return sharp(Buffer.from(svg), { density: DENSITY }).png().toBuffer();
}

let base: Promise<Buffer> | null = null;
function loadBase(fonts: CardFont[]): Promise<Buffer> {
  // Fall back to drawing it if the file is missing, which is slow but still right.
  base ??= readFile(join(process.cwd(), CARD_BASE_FILE)).catch(() => renderCardBase(fonts));
  return base;
}

/**
 * Renders the share card as a 2160x2700 PNG (the 1080x1350 layout at 2x).
 *
 * Satori lays the card out as SVG, and every rounded or clipped box becomes a
 * <mask> (about 265 on a card, plus a filter per portrait shadow). A rasteriser
 * draws each mask and filter on a buffer the size of its whole canvas, so one 2x
 * pass over the full card took 25s, and 11s on Vercel's single core even after
 * the players were split out. So the card is assembled from pieces:
 *
 *   - the base every card shares, pre-rendered once into CARD_BASE_FILE;
 *   - this card's header (title, subtitle, crest) on a strip the shelf's height;
 *   - each player's node on its own small tile, where a mask covers a few
 *     hundred thousand pixels rather than six million.
 *
 * sharp rasterises the pieces and lays them on the base. Same picture.
 */
export async function renderCardPng(xi: SharedXI, assets: CardAssets, fonts: CardFont[]): Promise<Buffer> {
  const { S, nodes } = cardNodes(xi);
  const raster = (svg: string) => sharp(Buffer.from(svg), { density: DENSITY }).png().toBuffer();

  const [background, header, ...tiles] = await Promise.all([
    loadBase(fonts),
    satori(<LineupCard xi={xi} assets={assets} part="header" />, { width: CARD_W, height: SHELF_H, fonts }).then(raster),
    ...nodes.map(async (node) => {
      const box = nodeTileBox(node, S, TILE_MARGIN);
      const svg = await satori(<NodeTile node={node} S={S} assets={assets} margin={TILE_MARGIN} />, {
        width: box.width,
        height: box.height,
        fonts,
      });
      return { input: await raster(svg), left: Math.round(box.left * CARD_SCALE), top: Math.round(box.top * CARD_SCALE) };
    }),
  ]);

  return sharp(background)
    .composite([{ input: header, left: 0, top: 0 }, ...tiles])
    .png({ compressionLevel: 6 })
    .toBuffer();
}
