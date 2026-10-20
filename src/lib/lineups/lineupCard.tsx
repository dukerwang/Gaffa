/* eslint-disable @next/next/no-img-element -- rendered by Satori, not the DOM */
import type { GranularPosition, Player } from '@/types';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { portraitInitials, portraitSources } from '@/lib/players/photo';
import { customPortraitCrop } from '@/lib/players/portraitCrop';
import { resolveClub } from '@/lib/clubs/registry';
import type { SharedXI } from './sharedXI';
import { getZone, ZONE_ORDER, type PitchZone } from './pitchZones';

/**
 * The Lineup Builder's share card, laid out by Satori on the server: the green
 * shelf with the title, the banded pitch, each player as the app's portrait over
 * a white name chip, and the topbar's wordmark at the foot. The page's link
 * preview and Save Image both use it, so there is one picture of an XI.
 *
 * Laid out at 1080x1350 in design units and rasterised at CARD_SCALE by
 * renderCard.tsx, which assembles it from parts (see `part` on LineupCard).
 */

export const CARD_W = 1080;
export const CARD_H = 1350;
/** The card is laid out at CARD_W x CARD_H and rasterised at this scale (see renderCard.tsx). */
export const CARD_SCALE = 2;

// The light theme's tokens, fixed: the card is a poster people post elsewhere.
const TOPBAR = '#185B37';
const PITCH = '#417655';
const PITCH_BAND = '#386A4B';
const CARD = '#FCFAF7';
const INK = '#1B1915';
const POS_COLOR: Record<GranularPosition, string> = {
  GK: '#926500',
  CB: '#0076B2',
  LB: '#5667B9',
  RB: '#5667B9',
  LWB: '#008295',
  RWB: '#008295',
  DM: '#7B56B9',
  CM: '#915397',
  AM: '#A34E71',
  LW: '#00866F',
  RW: '#00866F',
  ST: '#AD4C42',
};

export interface CardAssets {
  /** Player id to portrait: a data URL with its pixel size, and whether it is the 220x280 fallback cut. */
  photos: Map<string, { src: string; w: number; h: number; alt: boolean }>;
  /** Club slug to crest data URL with its pixel size. */
  crests: Map<string, { src: string; w: number; h: number }>;
}

function pngSize(buf: ArrayBuffer): { w: number; h: number } {
  const v = new DataView(buf);
  // PNG: 8-byte signature, then the IHDR chunk with width and height at 16 and 20.
  return v.byteLength > 24 ? { w: v.getUint32(16), h: v.getUint32(20) } : { w: 1, h: 1 };
}

async function fetchImage(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    const type = res.headers.get('content-type') ?? 'image/png';
    return { src: `data:${type};base64,${Buffer.from(buf).toString('base64')}`, ...pngSize(buf) };
  } catch {
    return null;
  }
}

/**
 * Fetches every portrait and crest the card draws, as data URLs. Portraits come
 * straight from PL's CDN, which wants a premierleague.com Referer; crests are
 * this site's own static files.
 */
export async function loadCardAssets(xi: SharedXI, origin: string): Promise<CardAssets> {
  const photos: CardAssets['photos'] = new Map();
  const crests: CardAssets['crests'] = new Map();
  const slugs = new Set<string>(xi.club ? [xi.club.slug] : []);
  await Promise.all(
    xi.slots.map(async ({ player }) => {
      if (!player) return;
      const slug = resolveClub(player.pl_team)?.slug;
      if (slug) slugs.add(slug);
      const sources = player.photo_url
        ? portraitSources(player.photo_url, player.photo_version)
        : [];
      for (let i = 0; i < sources.length; i++) {
        const img = await fetchImage(sources[i], {
          headers: { Referer: 'https://www.premierleague.com/' },
        });
        if (img) {
          photos.set(player.id, { ...img, alt: i > 0 });
          break;
        }
      }
    })
  );
  await Promise.all(
    [...slugs].map(async (slug) => {
      const img = await fetchImage(`${origin}/team-logos/${slug}.png`);
      if (img) crests.set(slug, img);
    })
  );
  return { photos, crests };
}

function contain(w: number, h: number, box: number) {
  const s = box / Math.max(w, h);
  return { width: w * s, height: h * s };
}

/** The Gaffa mark, the same paths as <Icon name="gaffa">; keep the two in step. */
function GaffaMark({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      stroke={color}
      strokeWidth={4.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="64" cy="64" r="56" />
      <g transform="translate(35.2, 82.8) scale(0.06)">
        <path
          fill={color}
          stroke="none"
          d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm200-500 54-18 16-54q-32-48-77-82.5T574-786l-54 38v56l160 112Zm-400 0 160-112v-56l-54-38q-54 17-99 51.5T210-652l16 54 54 18Zm-42 308 46-4 30-54-58-174-56-20-40 30q0 65 18 118.5T238-272Zm242 112q26 0 51-4t49-12l28-60-26-44H378l-26 44 28 60q24 8 49 12t51 4Zm-90-200h180l56-160-146-102-144 102 54 160Zm332 88q42-50 60-103.5T800-494l-40-28-56 18-58 174 30 54 46 4Z"
        />
      </g>
      <path d="M 24.8 104 C 34 88, 42 82, 50 82 M 103.2 104 C 94 88, 86 82, 78 82" />
      <path d="M 50 82 L 44 94 H 49 L 64 116 L 79 94 H 84 L 78 82" />
      <path d="M 54 82 L 64 96 L 74 82" />
      <path
        fill={color}
        stroke="none"
        d="M 61 82 H 67 L 66 90 L 67.5 106 L 64 111 L 60.5 106 L 62 90 Z"
      />
    </svg>
  );
}

/** Left/right pairs share a hue, so their badges also clip the outer corner (PositionBadge.module.css). */
const BADGE_SIDE: Partial<Record<GranularPosition, 'l' | 'r'>> = {
  LB: 'l',
  LWB: 'l',
  LW: 'l',
  RB: 'r',
  RWB: 'r',
  RW: 'r',
};

/**
 * One player: the position badge above his head, the lot-size portrait at the
 * board's 0.88 scale (the site's crop, lit ground, cut-out shadow and corner
 * crest), then a white chip with his name. Badge above the head is how Duke
 * wants the card (2026-10-20), so it stays there rather than inside the chip as
 * on the site's pitch. Every length is the site's CSS px times `S`, the card's
 * zoom on the board, so the parts stay in proportion.
 */
// A node's parts in the site's CSS px (multiply by S): PositionBadge sm (10px type,
// 2px padding above and below), a gap, the md portrait at the board's 0.88 (66x78),
// the room the scaled portrait still takes below it plus .starterButton's 2px, then
// .nodeChip (1px border, 3px padding, the name at 11px x 1.15, 3px padding, 1px border).
const BADGE_H = 10 + 4;
const BADGE_GAP = 4;
const PORTRAIT_GAP = 78 * 0.12 + 2;
const CHIP_H = 1 + 3 + 11 * 1.15 + 3 + 1;

/** A node's width (.nodeWrap at its widest) and height, at zoom S. */
function nodeBox(S: number) {
  return { nodeW: 114 * S, total: (BADGE_H + BADGE_GAP + 78 * 0.88 + PORTRAIT_GAP + CHIP_H) * S };
}

function PlayerNode({
  pos,
  player,
  assets,
  x,
  y,
  S,
  k,
}: {
  pos: GranularPosition;
  player: Player | null;
  assets: CardAssets;
  x: number;
  y: number;
  S: number;
  k: number;
}) {
  const u = (n: number) => n * k;
  const { nodeW, total } = nodeBox(S);
  const P = 0.88 * S; // .portraitWrap .g-portrait-md { transform: scale(0.88) }
  const fw = 66 * P;
  const fh = 78 * P;
  const badgeFont = 10 * S;
  const badgeH = BADGE_H * S;
  const badgeGap = BADGE_GAP * S;
  const gap = PORTRAIT_GAP * S;
  const name = player ? getPlayerDisplayName(player, 'smart', 11) : '';
  const photo = player ? assets.photos.get(player.id) : undefined;
  const crestSlug = player ? resolveClub(player.pl_team)?.slug : undefined;
  const crest = crestSlug ? assets.crests.get(crestSlug) : undefined;
  const side = BADGE_SIDE[pos];
  // The badge's own shape, drawn as a polygon so a left or right badge can lose
  // its outer top corner (5px across, 42% down) as PositionBadge does. It sits
  // on the banded pitch, so the cut has to be real transparency: Satori's
  // clip-path also clipped the text, and a painted triangle would show.
  const badgeW = (10 + pos.length * 6.1) * S; // 5px padding a side, Sofia Sans Semi Condensed Bold caps at 10px
  const cut = 5 * S;
  const points =
    side === 'l'
      ? `0,${badgeH * 0.42} ${cut},0 ${badgeW},0 ${badgeW},${badgeH} 0,${badgeH}`
      : side === 'r'
        ? `0,0 ${badgeW - cut},0 ${badgeW},${badgeH * 0.42} ${badgeW},${badgeH} 0,${badgeH}`
        : `0,0 ${badgeW},0 ${badgeW},${badgeH} 0,${badgeH}`;
  const badge = (
    <div style={{ display: 'flex', position: 'relative', width: u(badgeW), height: u(badgeH) }}>
      <svg
        width={u(badgeW)}
        height={u(badgeH)}
        viewBox={`0 0 ${badgeW} ${badgeH}`}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <polygon points={points} fill={POS_COLOR[pos]} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: u(badgeW),
          height: u(badgeH),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontFamily: 'Label',
          fontSize: u(badgeFont),
          letterSpacing: u(badgeFont * 0.04),
          lineHeight: 1,
        }}
      >
        {pos}
      </div>
    </div>
  );

  let portrait = null;
  if (player) {
    let img = null;
    if (photo) {
      const custom = photo.alt
        ? null
        : customPortraitCrop('md', player.portrait_head_top_pct, player.portrait_head_width_pct);
      const zoom = (photo.alt ? 142 : (custom?.zoomPct ?? 156.25)) / 100;
      const iw = fw * zoom;
      const ih = iw * (photo.h / photo.w);
      img = (
        <img
          alt=""
          src={photo.src}
          width={u(iw)}
          height={u(ih)}
          style={{
            position: 'absolute',
            left: u((fw - iw) / 2),
            top: u((custom?.insetPx ?? -2) * P),
            // .g-portrait-img's drop shadow, which gives the cut-out its depth.
            filter: `drop-shadow(0 ${u(9 * P)}px ${u(11 * P)}px rgba(40, 30, 16, 0.32))`,
          }}
        />
      );
    }
    portrait = (
      <div style={{ display: 'flex', position: 'relative', width: u(fw), height: u(fh) }}>
        <div
          style={{
            display: 'flex',
            position: 'relative',
            width: u(fw),
            height: u(fh),
            overflow: 'hidden',
            borderRadius: u(4 * P),
            boxShadow: `inset 0 0 0 ${u(1 * P)}px #D9D5CF`,
            backgroundImage:
              'radial-gradient(75.6% 57.6% at 50% 25.6%, #F4F3F1 0%, #E2DFDA 67%, #D2CEC7 100%)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {img ?? (
            <div
              style={{
                display: 'flex',
                fontFamily: 'Newsreader',
                fontSize: u(26 * P),
                letterSpacing: u(-0.78 * P),
                color: '#635D51',
              }}
            >
              {portraitInitials(player.name)}
            </div>
          )}
        </div>
        {crest && (
          // .g-portrait-crest: off the frame's lower-left corner, outside its clip.
          <div
            style={{
              position: 'absolute',
              left: u(-7 * P),
              bottom: u(-7 * P),
              width: u(22 * P),
              height: u(22 * P),
              borderRadius: u(11 * P),
              background: CARD,
              boxShadow: `0 ${u(1 * P)}px ${u(3 * P)}px rgba(58, 44, 26, 0.28)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img alt="" src={crest.src} {...contain(crest.w, crest.h, u(22 * P * 0.64))} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: u(x - nodeW / 2),
        top: u(y - total / 2),
        width: u(nodeW),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {player ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: u(nodeW),
          }}
        >
          <div style={{ display: 'flex', marginBottom: u(badgeGap) }}>{badge}</div>
          {portrait}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: u(gap),
              width: u(nodeW),
              padding: `${u(3 * S)}px ${u(4 * S)}px`,
              background: CARD,
              border: `${u(1 * S)}px solid #FFFFFF`,
              borderRadius: u(4 * S),
              boxShadow: `0 ${u(2 * S)}px ${u(4 * S)}px rgba(0, 0, 0, 0.15)`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                width: '100%',
                fontFamily: 'Newsreader',
                fontSize: u(11 * S),
                lineHeight: 1.15,
                color: INK,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {name}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: u(nodeW),
          }}
        >
          <div style={{ display: 'flex', marginBottom: u(badgeGap) }}>{badge}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: u(fw),
              height: u(fh),
              borderRadius: u(4 * P),
              border: `${u(1.5 * S)}px dashed rgba(255,255,255,0.75)`,
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.9)',
              fontFamily: 'Label',
              fontSize: u(22 * S),
            }}
          >
            +
          </div>
        </div>
      )}
    </div>
  );
}

/** Where each player's node sits on the card: its centre, at zoom S. */
export interface CardNode {
  pos: GranularPosition;
  player: Player | null;
  x: number;
  y: number;
}

/** The card's player layout, the one definition both the card and the tile renderer read. */
export function cardNodes(xi: SharedXI): { S: number; nodes: CardNode[] } {
  const { fX, fY, fW, fH } = pitchFrame();
  const zoned = new Map<PitchZone, SharedXI['slots']>();
  for (const z of ZONE_ORDER) zoned.set(z, []);
  for (const slot of xi.slots) zoned.get(getZone(slot.pos, xi.formation))?.push(slot);
  const rows = ZONE_ORDER.filter((z) => (zoned.get(z)?.length ?? 0) > 0);
  const top = fY + 20;
  const rowH = (fH - 40) / rows.length;
  // The card's zoom on the site's board: as large as the busiest row allows across
  // (a node is 114px wide on the site) and the rows allow down.
  const widest = Math.max(...rows.map((z) => zoned.get(z)?.length ?? 0));
  const S = Math.min(2, (fW / widest - 14) / 114, (rowH * 0.84) / nodeBox(1).total);
  const nodes = rows.flatMap((zone, r) => {
    const inRow = zoned.get(zone) ?? [];
    return inRow.map((slot, c) => ({
      pos: slot.pos,
      player: slot.player,
      x: fX + (fW / (inRow.length + 1)) * (c + 1),
      y: top + rowH * r + rowH / 2,
    }));
  });
  return { S, nodes };
}

const PAD = 48;
export const SHELF_H = 210;

/** The pitch's box, and the field markings' box inset within it. */
function pitchFrame() {
  const px = PAD;
  const py = SHELF_H - 24;
  const pw = CARD_W - PAD * 2;
  const ph = CARD_H - py - 64;
  const inset = 26;
  return { px, py, pw, ph, fX: px + inset, fY: py + inset, fW: pw - inset * 2, fH: ph - inset * 2 };
}

/**
 * One player's node alone, on a transparent tile `margin` wider than the node on
 * every side (room for the crest's overhang and the chip's shadow). The image
 * route rasterises each tile on its own small canvas and lays it on the card:
 * see /share/xi/image for why.
 */
export function NodeTile({
  node,
  S,
  assets,
  margin,
}: {
  node: CardNode;
  S: number;
  assets: CardAssets;
  margin: number;
}) {
  const { nodeW, total } = nodeBox(S);
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: nodeW + margin * 2,
        height: total + margin * 2,
      }}
    >
      <PlayerNode
        pos={node.pos}
        player={node.player}
        assets={assets}
        x={margin + nodeW / 2}
        y={margin + total / 2}
        S={S}
        k={1}
      />
    </div>
  );
}

/** A node's tile box on the card, for compositing NodeTile at (left, top). */
export function nodeTileBox(node: CardNode, S: number, margin: number) {
  const { nodeW, total } = nodeBox(S);
  return {
    left: node.x - nodeW / 2 - margin,
    top: node.y - total / 2 - margin,
    width: nodeW + margin * 2,
    height: total + margin * 2,
  };
}

export function LineupCard({
  xi,
  assets,
  k = 1,
  part = 'full',
}: {
  xi: SharedXI;
  assets: CardAssets;
  k?: number;
  /**
   * `full` is the whole card. The image route draws it in pieces (see
   * renderCard.tsx): `base` is what every card shares (the shelf's stripes, the
   * pitch and its markings, the wordmark), rendered once into a checked-in PNG;
   * `header` is this card's title, subtitle and crest alone, on a transparent
   * strip the height of the shelf.
   */
  part?: 'full' | 'base' | 'header';
}) {
  const withBase = part !== 'header';
  const withHeader = part !== 'base';
  const withPlayers = part === 'full';
  const u = (n: number) => n * k;
  const pad = PAD;
  const shelfH = SHELF_H;
  const crest = xi.club ? assets.crests.get(xi.club.slug) : undefined;
  const crestBox = 96;
  const titleRoom = CARD_W - pad * 2 - (crest ? crestBox + 24 : 0);
  // Newsreader Bold runs up to about 0.56em a character; shrink a long title to fit.
  const titleFont = Math.max(40, Math.min(64, titleRoom / (Math.max(xi.title.length, 1) * 0.56)));
  const subtitle = [
    xi.formation,
    xi.club ? xi.club.name.toUpperCase() : null,
    xi.matchweek ? `MATCHWEEK ${xi.matchweek}` : null,
    'GAFFA LINEUP BUILDER',
  ]
    .filter(Boolean)
    .join('  ·  ');

  // The pitch, and the field markings inset within it.
  const { px, py, pw, ph, fX, fY, fW, fH } = pitchFrame();
  const line = `${u(3)}px solid rgba(255,255,255,0.4)`;
  const boxW = fW * 0.58;
  const boxH = fH * 0.18;

  const { S, nodes } = cardNodes(xi);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: u(CARD_W),
        height: u(part === 'header' ? SHELF_H : CARD_H),
        ...(withBase ? { background: TOPBAR } : {}),
        fontFamily: 'Label',
      }}
    >
      {withBase &&
        Array.from({ length: Math.ceil(CARD_W / 36) }, (_, i) =>
          i % 2 === 1 ? (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: u(i * 36),
                top: 0,
                width: u(36),
                height: u(shelfH),
                background: 'rgba(255,255,255,0.05)',
              }}
            />
          ) : null
        )}

      {withHeader && (
        <div
          style={{
            position: 'absolute',
            left: u(pad),
            top: u(46),
            width: u(titleRoom),
            display: 'flex',
            fontFamily: 'Newsreader',
            fontSize: u(titleFont),
            lineHeight: 1,
            letterSpacing: u(-titleFont * 0.02),
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {xi.title}
        </div>
      )}
      {withHeader && (
        <div
          style={{
            position: 'absolute',
            left: u(pad),
            top: u(134),
            width: u(titleRoom),
            display: 'flex',
            fontSize: u(24),
            color: 'rgba(255,255,255,0.7)',
            whiteSpace: 'pre',
            overflow: 'hidden',
          }}
        >
          {subtitle}
        </div>
      )}
      {withHeader && crest && (
        <div
          style={{
            position: 'absolute',
            right: u(pad),
            top: u(52),
            width: u(crestBox),
            height: u(crestBox),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img alt="" src={crest.src} {...contain(crest.w, crest.h, u(crestBox))} />
        </div>
      )}

      {withBase && (
        <div
          style={{
            position: 'absolute',
            left: u(px),
            top: u(py),
            width: u(pw),
            height: u(ph),
            borderRadius: u(20),
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {Array.from({ length: Math.ceil(ph / 60) }, (_, i) => (
            <div
              key={i}
              style={{
                width: u(pw),
                height: u(60),
                flexShrink: 0,
                background: i % 2 === 0 ? PITCH : PITCH_BAND,
              }}
            />
          ))}
        </div>
      )}
      {withBase && (
        <div
          style={{
            position: 'absolute',
            left: u(fX),
            top: u(fY),
            width: u(fW),
            height: u(fH),
            border: line,
            display: 'flex',
          }}
        />
      )}
      {withBase && (
        <div
          style={{
            position: 'absolute',
            left: u(fX),
            top: u(fY + fH / 2 - 1.5),
            width: u(fW),
            height: u(3),
            background: 'rgba(255,255,255,0.4)',
            display: 'flex',
          }}
        />
      )}
      {withBase && (
        <div
          style={{
            position: 'absolute',
            left: u(fX + fW / 2 - 70),
            top: u(fY + fH / 2 - 70),
            width: u(140),
            height: u(140),
            borderRadius: u(70),
            border: line,
            display: 'flex',
          }}
        />
      )}
      {withBase && (
        <div
          style={{
            position: 'absolute',
            left: u(fX + (fW - boxW) / 2),
            top: u(fY),
            width: u(boxW),
            height: u(boxH),
            border: line,
            display: 'flex',
          }}
        />
      )}
      {withBase && (
        <div
          style={{
            position: 'absolute',
            left: u(fX + (fW - boxW) / 2),
            top: u(fY + fH - boxH),
            width: u(boxW),
            height: u(boxH),
            border: line,
            display: 'flex',
          }}
        />
      )}

      {withPlayers &&
        nodes.map((n, i) => (
          <PlayerNode
            key={i}
            pos={n.pos}
            player={n.player}
            assets={assets}
            x={n.x}
            y={n.y}
            S={S}
            k={k}
          />
        ))}

      {/* The topbar's lockup: mark, then GAFFA.LIVE in the bold serif at the topbar's tracking. */}
      {withBase && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: u(16),
            width: u(CARD_W),
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.85,
          }}
        >
          <div style={{ display: 'flex', marginRight: u(10), marginTop: u(-3) }}>
            <GaffaMark size={u(30)} color="#FFFFFF" />
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Wordmark',
              fontSize: u(22),
              letterSpacing: u(22 * 0.12),
              color: '#FFFFFF',
            }}
          >
            GAFFA.LIVE
          </div>
        </div>
      )}
    </div>
  );
}
