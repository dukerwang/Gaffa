import satori from 'satori';
import sharp from 'sharp';
import { CARD_H, CARD_SCALE, CARD_W, LineupCard, NodeTile, cardNodes, nodeTileBox, type CardAssets } from './lineupCard';
import type { SharedXI } from './sharedXI';

export type CardFont = { name: string; data: Buffer; weight: 700; style: 'normal' };

const TILE_MARGIN = 16;

/**
 * Renders the share card as a 2160x2700 PNG.
 *
 * Satori lays the card out as SVG, and every rounded or clipped box in it
 * becomes a <mask> (the card has about 265, plus a filter per portrait shadow).
 * A rasteriser draws each mask and filter on a buffer the size of the whole
 * canvas, so one 2x pass over the full card took 25s (resvg or librsvg alike)
 * against 1.5s at 1x. So the card is drawn in pieces: the background (shelf,
 * title, pitch, wordmark) once, and each player's node on its own small tile,
 * where a mask costs a few thousand pixels rather than six million. sharp
 * rasterises them at 2x and lays the tiles on the background. Same picture,
 * about 2s.
 */
export async function renderCardPng(xi: SharedXI, assets: CardAssets, fonts: CardFont[]): Promise<Buffer> {
  const density = 72 * CARD_SCALE; // sharp renders SVG at 72 dpi; 144 doubles every length
  const { S, nodes } = cardNodes(xi);

  const [background, ...tiles] = await Promise.all([
    satori(<LineupCard xi={xi} assets={assets} withPlayers={false} />, { width: CARD_W, height: CARD_H, fonts }).then(
      (svg) => sharp(Buffer.from(svg), { density }).png().toBuffer(),
    ),
    ...nodes.map(async (node) => {
      const box = nodeTileBox(node, S, TILE_MARGIN);
      const svg = await satori(<NodeTile node={node} S={S} assets={assets} margin={TILE_MARGIN} />, {
        width: box.width,
        height: box.height,
        fonts,
      });
      const input = await sharp(Buffer.from(svg), { density }).png().toBuffer();
      return { input, left: Math.round(box.left * CARD_SCALE), top: Math.round(box.top * CARD_SCALE) };
    }),
  ]);

  return sharp(background).composite(tiles).png({ compressionLevel: 8 }).toBuffer();
}
