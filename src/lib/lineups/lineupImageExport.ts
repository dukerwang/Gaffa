import type { Formation, GranularPosition, Player } from '@/types';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { portraitInitials, portraitSources } from '@/lib/players/photo';
import { customPortraitCrop } from '@/lib/players/portraitCrop';
import { clubBadgePath } from '@/lib/clubs/registry';

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
 * null. Player photos go through /api/players/photo-proxy, which re-serves the
 * same bytes same-origin. Club crests are already same-origin.
 */
function loadImage(url: string, timeoutMs = 2500, proxy = true): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = proxy ? `/api/players/photo-proxy?url=${encodeURIComponent(url)}` : url;
  });
}

/** Canvas cannot read `var(--token)`, so resolve the real value from the live stylesheet. */
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// The card is a poster people post elsewhere, so its chips and portrait ground
// use the light theme's colours whatever theme the page is in.
const CARD = '#FCFAF7';
const INK = '#1B1915';

interface NodeAssets {
  photo: HTMLImageElement | null;
  /** True when the 220x280 fallback source loaded instead of the 500x500 one. */
  alt: boolean;
  crest: HTMLImageElement | null;
}

/**
 * Generates a 1080x1350 PNG of the lineup, drawn like the on-page board: the
 * green shelf on top, the banded pitch below, and each player as the app's own
 * portrait (same crop maths as <Portrait>) over a white name chip.
 */
export async function exportLineupToBlob(data: LineupExportData): Promise<Blob | null> {
  if (!('document' in globalThis)) return null;
  await document.fonts?.ready;

  const serif = token('--font-serif', 'Georgia, serif');
  const label = token('--font-label', 'sans-serif');
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
  ctx.font = `700 24px ${label}`;
  ctx.fillText(`${data.formation}  ·  GAFFA LINEUP BUILDER`, pad, 156);

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

  const assets = new Map<string, NodeAssets>();
  await Promise.all(
    data.slots.map(async (slot) => {
      const player = slot.player;
      if (!player) return;
      const sources = player.photo_url ? portraitSources(player.photo_url, player.photo_version) : [];
      let photo: HTMLImageElement | null = null;
      let alt = false;
      for (let i = 0; i < sources.length && !photo; i++) {
        photo = await loadImage(sources[i]);
        alt = i > 0;
      }
      const badge = clubBadgePath(player.pl_team);
      const crest = badge ? await loadImage(badge, 2500, false) : null;
      assets.set(player.id, { photo, alt, crest });
    }),
  );

  const top = fY + 20;
  const usable = fH - 40;
  const rowH = usable / rows.length;
  // 66x78 is the app's lot-size portrait; shrink it on 6-row formations so rows never overlap.
  const scale = Math.min(1.35, Math.max(0.9, (rowH - 84) / 78));
  rows.forEach((zone, r) => {
    const inRow = zoned.get(zone) ?? [];
    const cy = top + rowH * r + rowH / 2;
    inRow.forEach((slot, c) => {
      const cx = fX + (fW / (inRow.length + 1)) * (c + 1);
      const maxChip = Math.min(240, fW / (inRow.length + 1) - 8);
      drawNode(ctx, slot, cx, cy, assets.get(slot.player?.id ?? ''), scale, serif, label, maxChip);
    });
  });

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `700 20px ${label}`;
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
  assets: NodeAssets | undefined,
  k: number,
  serif: string,
  label: string,
  maxChip: number,
) {
  const fw = 66 * k;
  const fh = 78 * k;
  const badgeH = 26;
  const chipH = 34;
  const total = badgeH + 6 + fh + 8 + chipH;
  const top = y - total / 2;
  const fx = x - fw / 2;
  const fy = top + badgeH + 6;

  const color = token(`--color-pos-${slot.pos.toLowerCase()}`, '#7B56B9');
  ctx.font = `700 17px ${label}`;
  const bw = Math.max(ctx.measureText(slot.pos).width + 20, 44);
  ctx.fillStyle = color;
  roundRect(ctx, x - bw / 2, top, bw, badgeH, 5);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(slot.pos, x, top + badgeH / 2 + 1);

  const player = slot.player;
  if (!player) {
    roundRect(ctx, fx, fy, fw, fh, 6 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `700 44px ${label}`;
    ctx.fillText('+', x, fy + fh / 2 + 2);
    return;
  }

  // The app's <Portrait>: neutral radial ground, the cut-out zoomed and pushed
  // down inside the frame, the same per-player head-solve, clipped to the frame.
  ctx.save();
  roundRect(ctx, fx, fy, fw, fh, 6 * k);
  ctx.clip();
  const ground = ctx.createRadialGradient(x, fy + fh * 0.256, 0, x, fy + fh * 0.256, fw * 0.8);
  ground.addColorStop(0, '#F6F3EC');
  ground.addColorStop(0.67, '#E6E2DA');
  ground.addColorStop(1, '#DAD5CA');
  ctx.fillStyle = ground;
  ctx.fillRect(fx, fy, fw, fh);
  const photo = assets?.photo;
  if (photo) {
    const custom = assets?.alt
      ? null
      : customPortraitCrop('md', player.portrait_head_top_pct, player.portrait_head_width_pct);
    const zoom = (assets?.alt ? 142 : (custom?.zoomPct ?? 156.25)) / 100;
    const insetPx = (custom?.insetPx ?? -2) * k;
    const iw = fw * zoom;
    const ih = iw * (photo.naturalHeight / photo.naturalWidth);
    ctx.drawImage(photo, x - iw / 2, fy + insetPx, iw, ih);
  } else {
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.round(30 * k)}px ${serif}`;
    ctx.fillText(portraitInitials(player.name), x, fy + fh / 2 + 2);
  }
  ctx.restore();
  roundRect(ctx, fx, fy, fw, fh, 6 * k);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();

  if (assets?.crest) {
    const cr = 11 * k;
    const cx = fx + 2 * k + cr;
    const cy = fy + fh - 2 * k - cr;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = CARD;
    ctx.fill();
    const ci = cr * 1.35;
    ctx.drawImage(assets.crest, cx - ci / 2, cy - ci / 2, ci, ci);
  }

  const name = getPlayerDisplayName(player.name, 'smart');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let nameSize = 22;
  ctx.font = `700 ${nameSize}px ${serif}`;
  while (nameSize > 16 && ctx.measureText(name).width + 22 > maxChip) {
    nameSize -= 1;
    ctx.font = `700 ${nameSize}px ${serif}`;
  }
  const cw = Math.min(Math.max(ctx.measureText(name).width + 22, 96), maxChip);
  const chipY = fy + fh + 8;
  ctx.fillStyle = CARD;
  roundRect(ctx, x - cw / 2, chipY, cw, chipH, 6);
  ctx.fill();
  ctx.fillStyle = INK;
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
