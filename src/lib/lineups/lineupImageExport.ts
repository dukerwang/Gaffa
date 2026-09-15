import type { Formation, GranularPosition, Player } from '@/types';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { portraitInitials, portraitSources } from '@/lib/players/photo';
import { POS_COLOR } from '@/lib/positions/spine';

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
 * Loads an image with a timeout and CORS support. Resolves to null on failure.
 */
function loadImage(url: string, timeoutMs = 1500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

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

    img.src = url;
  });
}

/**
 * Generates a high-resolution 1080x1350 PNG Blob of the lineup pitch card.
 */
export async function exportLineupToBlob(data: LineupExportData): Promise<Blob | null> {
  if (!('document' in globalThis)) return null;

  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = '#0f2418';
  ctx.fillRect(0, 0, width, height);

  // Header card container
  const pad = 40;
  const headerHeight = 130;

  // Header Title & Branding
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const displayTitle = data.title.trim() || 'Starting XI';
  ctx.fillText(displayTitle, pad + 20, pad + 45);

  ctx.fillStyle = '#89d49f';
  ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`GAFFA LINEUP BUILDER · ${data.formation}`, pad + 20, pad + 85);

  // Pitch bounding box
  const pitchX = pad;
  const pitchY = pad + headerHeight;
  const pitchW = width - pad * 2;
  const pitchH = height - pitchY - 70; // 70px footer

  // Draw Pitch Grass
  const grassGrad = ctx.createLinearGradient(pitchX, pitchY, pitchX, pitchY + pitchH);
  grassGrad.addColorStop(0, '#1a683e');
  grassGrad.addColorStop(1, '#114a2a');
  ctx.fillStyle = grassGrad;
  roundRect(ctx, pitchX, pitchY, pitchW, pitchH, 24);
  ctx.fill();

  // Pitch clip for markings
  ctx.save();
  roundRect(ctx, pitchX, pitchY, pitchW, pitchH, 24);
  ctx.clip();

  // Pitch Lines (white with opacity)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 3;

  // Touchlines
  const inset = 30;
  const fX = pitchX + inset;
  const fY = pitchY + inset;
  const fW = pitchW - inset * 2;
  const fH = pitchH - inset * 2;
  ctx.strokeRect(fX, fY, fW, fH);

  // Halfway line & center circle
  const midY = fY + fH / 2;
  ctx.beginPath();
  ctx.moveTo(fX, midY);
  ctx.lineTo(fX + fW, midY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fX + fW / 2, midY, 90, 0, Math.PI * 2);
  ctx.stroke();

  // Top Penalty Box (attacking end)
  const penW = fW * 0.52;
  const penH = 150;
  const penX = fX + (fW - penW) / 2;
  ctx.strokeRect(penX, fY, penW, penH);

  // Top 6-yard box
  const sixW = fW * 0.26;
  const sixH = 55;
  const sixX = fX + (fW - sixW) / 2;
  ctx.strokeRect(sixX, fY, sixW, sixH);

  // Bottom Penalty Box (defending end)
  ctx.strokeRect(penX, fY + fH - penH, penW, penH);
  // Bottom 6-yard box
  ctx.strokeRect(sixX, fY + fH - sixH, sixW, sixH);

  ctx.restore();

  // Partition slots into zones
  interface ZonedExportSlots {
    ATT: LineupExportSlot[];
    AMZ: LineupExportSlot[];
    CMZ: LineupExportSlot[];
    DMZ: LineupExportSlot[];
    WBZ: LineupExportSlot[];
    DEF: LineupExportSlot[];
    GK: LineupExportSlot[];
  }

  const zonedSlots: ZonedExportSlots = {
    ATT: [],
    AMZ: [],
    CMZ: [],
    DMZ: [],
    WBZ: [],
    DEF: [],
    GK: [],
  };
  for (const s of data.slots) {
    zonedSlots[getZone(s.pos, data.formation)].push(s);
  }

  // Active zones that have at least one slot
  const activeZones = ZONE_ORDER.filter((z) => zonedSlots[z].length > 0);
  const totalRows = activeZones.length;

  // Pre-fetch player photos
  const photoCache = new Map<string, HTMLImageElement | null>();
  await Promise.all(
    data.slots.map(async (slot) => {
      if (slot.player?.photo_url) {
        const sources = portraitSources(slot.player.photo_url, slot.player.photo_version);
        // Try the first source
        if (sources[0]) {
          const img = await loadImage(sources[0], 1200);
          photoCache.set(slot.player.id, img);
        }
      }
    })
  );

  // Calculate row positions along pitch
  const usableHeight = fH - 120;
  const rowSpacing = usableHeight / (totalRows > 1 ? totalRows - 1 : 1);

  activeZones.forEach((zone, rowIndex) => {
    const slotsInRow = zonedSlots[zone];
    const rowY = fY + 60 + rowIndex * rowSpacing;
    const count = slotsInRow.length;
    const colSpacing = fW / (count + 1);

    slotsInRow.forEach((slot, colIndex) => {
      const nodeX = fX + colSpacing * (colIndex + 1);
      const nodeY = rowY;

      drawPitchNode(ctx, slot, nodeX, nodeY, photoCache.get(slot.player?.id ?? ''));
    });
  });

  // Footer Watermark
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('gaffa.live · Premier League Fantasy Football', width / 2, height - 35);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function drawPitchNode(
  ctx: CanvasRenderingContext2D,
  slot: LineupExportSlot,
  x: number,
  y: number,
  loadedImg?: HTMLImageElement | null
) {
  const radius = 46;

  // Outer circle shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = slot.player ? '#1a2230' : 'rgba(15, 36, 24, 0.7)';
  ctx.fill();
  ctx.restore();

  // Circle Border
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = slot.player ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 3;
  if (!slot.player) {
    ctx.setLineDash([6, 6]);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Avatar or Fallback Initials
  if (slot.player) {
    if (loadedImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
      ctx.clip();
      // Draw centered image
      ctx.drawImage(loadedImg, x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    } else {
      // Fallback Initials
      const initials = portraitInitials(slot.player.name);
      ctx.fillStyle = '#f0ede6';
      ctx.font = '600 32px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, x, y + 2);
    }
  } else {
    // Plus icon for empty slot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', x, y);
  }

  // Position Badge on top-right edge
  const badgeColor = POS_COLOR[slot.pos] || '#7B56B9';
  const badgeW = 38;
  const badgeH = 22;
  const badgeX = x + radius - 24;
  const badgeY = y - radius + 4;

  ctx.fillStyle = badgeColor;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(slot.pos, badgeX + badgeW / 2, badgeY + badgeH / 2);

  // Player Name Plate below node
  const nameY = y + radius + 18;
  if (slot.player) {
    const name = getPlayerDisplayName(slot.player, 'initial_last');

    // Text label
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textMetrics = ctx.measureText(name);
    const boxW = Math.max(textMetrics.width + 24, 80);
    const boxH = 28;

    ctx.fillStyle = 'rgba(10, 20, 15, 0.85)';
    roundRect(ctx, x - boxW / 2, nameY - boxH / 2, boxW, boxH, 14);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x, nameY);
  } else {
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slot.pos, x, nameY);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
