import type { Formation, GranularPosition, Player } from '@/types';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { portraitInitials, portraitSources } from '@/lib/players/photo';

export interface LineupExportSlot {
  slotIndex: number;
  pos: GranularPosition;
  player: Player | null;
}

export interface LineupExportData {
  title: string;
  formation: Formation;
  slots: LineupExportSlot[];
}

type PitchZone = 'ATT' | 'AMZ' | 'CMZ' | 'DMZ' | 'WBZ' | 'DEF' | 'GK';
const ZONE_ORDER: PitchZone[] = ['ATT', 'AMZ', 'CMZ', 'DMZ', 'WBZ', 'DEF', 'GK'];

function getZone(pos: GranularPosition, formation?: Formation): PitchZone {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'DM') return 'DMZ';
  if (pos === 'AM') return 'AMZ';
  if (pos === 'LWB' || pos === 'RWB') {
    if (formation?.startsWith('3-')) return 'CMZ';
    return 'WBZ';
  }
  if (pos === 'CM') return 'CMZ';
  return 'ATT';
}

/**
 * Loads an image with a timeout. Resolves to null on failure.
 *
 * PL's photo CDN sends no CORS headers, so drawing its images straight onto
 * the export canvas taints it and canvas.toBlob() below silently returns
 * null — this routes through /api/players/photo-proxy, which re-serves the
 * same bytes same-origin, so no crossOrigin mode is needed here at all.
 */
function loadImage(url: string, timeoutMs = 1500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();

    const timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.src = `/api/players/photo-proxy?url=${encodeURIComponent(url)}`;
  });
}

/** Canvas cannot read `var(--token)`, so resolve the real value from the live stylesheet. */
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// The card is a poster people post elsewhere, so its chips use the light
// theme's ink and card colours whatever theme the page is in.
const CARD = '#FCFAF7';
const INK = '#1B1915';

/**
 * Generates a 1080x1350 PNG of the lineup, drawn like the on-page board: the
 * green shelf on top, the banded pitch below, a white chip under each player.
 */
export async function exportLineupToBlob(data: LineupExportData): Promise<Blob | null> {
  if (!('document' in globalThis)) return null;
  await document.fonts?.ready;

  const serif = token('--font-serif', 'Georgia, serif');
  const condensed = token('--font-condensed', 'sans-serif');
  const topbar = token('--color-topbar', '#185B37');
  const pitch = token('--color-pitch', '#417655');
  const pitchBand = token('--color-pitch-band', '#386A4B');

  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = topbar;
  ctx.fillRect(0, 0, width, height);

  // Shelf: the dashboard's alternating stripes, then the title.
  const shelfH = 210;
  for (let x = 0, i = 0; x < width; x += 36, i++) {
    ctx.fillStyle = i % 2 === 0 ? topbar : 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, 0, 36, shelfH);
  }
  const pad = 48;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 64px ${serif}`;
  ctx.fillText(fitText(ctx, data.title.trim() || 'Starting XI', width - pad * 2), pad, 108);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `700 24px ${condensed}`;
  ctx.fillText(`${data.formation}  ·  LINEUP BUILDER`, pad, 156);

  // Pitch card
  const px = pad;
  const py = shelfH - 24;
  const pw = width - pad * 2;
  const ph = height - py - 64;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 20);
  ctx.clip();
  for (let y = py, i = 0; y < py + ph; y += 60, i++) {
    ctx.fillStyle = i % 2 === 0 ? pitch : pitchBand;
    ctx.fillRect(px, y, pw, 60);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 3;
  const inset = 26;
  const fX = px + inset;
  const fY = py + inset;
  const fW = pw - inset * 2;
  const fH = ph - inset * 2;
  ctx.strokeRect(fX, fY, fW, fH);
  const midY = fY + fH / 2;
  ctx.beginPath();
  ctx.moveTo(fX, midY);
  ctx.lineTo(fX + fW, midY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(fX + fW / 2, midY, 70, 0, Math.PI * 2);
  ctx.stroke();
  const boxW = fW * 0.58;
  const boxH = fH * 0.18;
  ctx.strokeRect(fX + (fW - boxW) / 2, fY, boxW, boxH);
  ctx.strokeRect(fX + (fW - boxW) / 2, fY + fH - boxH, boxW, boxH);
  ctx.restore();

  const zoned = new Map<PitchZone, LineupExportSlot[]>();
  for (const z of ZONE_ORDER) zoned.set(z, []);
  for (const s of data.slots) zoned.get(getZone(s.pos, data.formation))?.push(s);
  const rows = ZONE_ORDER.filter((z) => (zoned.get(z)?.length ?? 0) > 0);

  const photos = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    data.slots.map(async (slot) => {
      const src = slot.player?.photo_url
        ? portraitSources(slot.player.photo_url, slot.player.photo_version)
        : [];
      if (slot.player && src.length > 0) {
        let img: HTMLImageElement | null = null;
        for (const url of src) {
          img = await loadImage(url, 2500);
          if (img) break;
        }
        photos.set(slot.player.id, img);
      }
    }),
  );

  const top = fY + 20;
  const usable = fH - 40;
  const rowH = usable / rows.length;
  rows.forEach((zone, r) => {
    const inRow = zoned.get(zone) ?? [];
    const cy = top + rowH * r + rowH / 2;
    inRow.forEach((slot, c) => {
      const cx = fX + (fW / (inRow.length + 1)) * (c + 1);
      drawNode(ctx, slot, cx, cy, photos.get(slot.player?.id ?? ''), serif, condensed, Math.min(240, fW / (inRow.length + 1) - 8));
    });
  });

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `700 20px ${condensed}`;
  ctx.textAlign = 'center';
  ctx.fillText('GAFFA.LIVE', width / 2, height - 26);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  slot: LineupExportSlot,
  x: number,
  y: number,
  img: HTMLImageElement | null | undefined,
  serif: string,
  condensed: string,
  maxChip: number,
) {
  const r = 46;
  const badgeH = 26;
  const chipH = 34;
  const total = badgeH + 6 + r * 2 + 8 + chipH;
  const top = y - total / 2;
  const cy = top + badgeH + 6 + r;

  const color = token(`--color-pos-${slot.pos.toLowerCase()}`, '#7B56B9');
  ctx.font = `700 17px ${condensed}`;
  const bw = Math.max(ctx.measureText(slot.pos).width + 20, 44);
  ctx.fillStyle = color;
  roundRect(ctx, x - bw / 2, top, bw, badgeH, 5);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(slot.pos, x, top + badgeH / 2 + 1);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  if (slot.player) {
    ctx.fillStyle = '#E4E0D8';
    ctx.fill();
    ctx.clip();
    if (img) {
      const side = r * 2;
      // Cut-outs are taller than wide: fill the circle from the top so heads are not cropped.
      const scale = Math.max(side / img.naturalWidth, side / img.naturalHeight);
      ctx.drawImage(img, x - r, cy - r, img.naturalWidth * scale, img.naturalHeight * scale);
    } else {
      ctx.fillStyle = INK;
      ctx.font = `700 34px ${serif}`;
      ctx.fillText(portraitInitials(slot.player.name), x, cy + 2);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 44px ${condensed}`;
    ctx.fillText('+', x, cy + 2);
    return;
  }

  const name = getPlayerDisplayName(slot.player.name, 'smart');
  ctx.font = `700 22px ${serif}`;
  const cw = Math.min(Math.max(ctx.measureText(name).width + 22, 96), maxChip);
  const chipY = cy + r + 8;
  ctx.fillStyle = CARD;
  roundRect(ctx, x - cw / 2, chipY, cw, chipH, 6);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(fitText(ctx, name, cw - 16), x, chipY + chipH / 2 + 1);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
