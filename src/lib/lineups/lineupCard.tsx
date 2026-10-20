/* eslint-disable @next/next/no-img-element -- rendered by next/og (Satori), not the DOM */
import type { GranularPosition, Player } from '@/types';
import { getPlayerDisplayName } from '@/lib/players/displayName';
import { portraitInitials, portraitSources } from '@/lib/players/photo';
import { customPortraitCrop } from '@/lib/players/portraitCrop';
import { resolveClub } from '@/lib/clubs/registry';
import type { SharedXI } from './sharedXI';
import { getZone, ZONE_ORDER, type PitchZone } from './pitchZones';

/**
 * The Lineup Builder's share card, rendered on the server by next/og: the green
 * shelf with the title, the banded pitch, each player as the app's portrait over
 * a white name chip, and the topbar's wordmark at the foot. The page's link
 * preview and Save Image both use it, so there is one picture of an XI.
 *
 * Laid out at 1080x1350 in design units; `k` scales every length, so k = 2 is a
 * sharp 2160x2700 render of the same card.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;

// The light theme's tokens, fixed: the card is a poster people post elsewhere.
const TOPBAR = '#185B37';
const PITCH = '#417655';
const PITCH_BAND = '#386A4B';
const CARD = '#FCFAF7';
const INK = '#1B1915';
const POS_COLOR: Record<GranularPosition, string> = {
  GK: '#926500', CB: '#0076B2', LB: '#5667B9', RB: '#5667B9', LWB: '#008295', RWB: '#008295',
  DM: '#7B56B9', CM: '#915397', AM: '#A34E71', LW: '#00866F', RW: '#00866F', ST: '#AD4C42',
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
      const sources = player.photo_url ? portraitSources(player.photo_url, player.photo_version) : [];
      for (let i = 0; i < sources.length; i++) {
        const img = await fetchImage(sources[i], { headers: { Referer: 'https://www.premierleague.com/' } });
        if (img) {
          photos.set(player.id, { ...img, alt: i > 0 });
          break;
        }
      }
    }),
  );
  await Promise.all(
    [...slugs].map(async (slug) => {
      const img = await fetchImage(`${origin}/team-logos/${slug}.png`);
      if (img) crests.set(slug, img);
    }),
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
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" stroke={color} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round">
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
      <path fill={color} stroke="none" d="M 61 82 H 67 L 66 90 L 67.5 106 L 64 111 L 60.5 106 L 62 90 Z" />
    </svg>
  );
}

function PlayerNode({
  pos,
  player,
  assets,
  x,
  y,
  s,
  maxChip,
  k,
}: {
  pos: GranularPosition;
  player: Player | null;
  assets: CardAssets;
  x: number;
  y: number;
  s: number;
  maxChip: number;
  k: number;
}) {
  const u = (n: number) => n * k;
  const fw = 66 * s;
  const fh = 78 * s;
  const badgeH = 26;
  const chipH = 34;
  const total = badgeH + 6 + fh + 8 + chipH;
  const name = player ? getPlayerDisplayName(player.name, 'smart') : '';
  // Newsreader Bold runs about 0.6em a character with capitals; shrink to fit the chip, never below 16.
  const nameSize = Math.max(16, Math.min(22, (maxChip - 24) / (Math.max(name.length, 1) * 0.6)));
  const photo = player ? assets.photos.get(player.id) : undefined;
  const crestSlug = player ? resolveClub(player.pl_team)?.slug : undefined;
  const crest = crestSlug ? assets.crests.get(crestSlug) : undefined;

  let photoEl = null;
  if (player && photo) {
    const custom = photo.alt ? null : customPortraitCrop('md', player.portrait_head_top_pct, player.portrait_head_width_pct);
    const zoom = (photo.alt ? 142 : (custom?.zoomPct ?? 156.25)) / 100;
    const iw = fw * zoom;
    const ih = iw * (photo.h / photo.w);
    photoEl = (
      <img alt=""
        src={photo.src}
        width={u(iw)}
        height={u(ih)}
        style={{ position: 'absolute', left: u((fw - iw) / 2), top: u((custom?.insetPx ?? -2) * s) }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: u(x - maxChip / 2),
        top: u(y - total / 2),
        width: u(maxChip),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: u(badgeH),
          minWidth: u(44),
          padding: `0 ${u(10)}px`,
          borderRadius: u(5),
          background: POS_COLOR[pos],
          color: '#FFFFFF',
          fontFamily: 'Label',
          fontSize: u(17),
        }}
      >
        {pos}
      </div>
      {player ? (
        <div style={{ display: 'flex', position: 'relative', marginTop: u(6), width: u(fw), height: u(fh) }}>
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: u(fw),
              height: u(fh),
              overflow: 'hidden',
              borderRadius: u(6 * s),
              border: `${u(3)}px solid rgba(255,255,255,0.9)`,
              backgroundImage: 'radial-gradient(circle at 50% 26%, #F6F3EC 0%, #E6E2DA 67%, #DAD5CA 100%)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {photoEl ?? (
              <div style={{ display: 'flex', fontFamily: 'Newsreader', fontSize: u(30 * s), color: INK }}>
                {portraitInitials(player.name)}
              </div>
            )}
          </div>
          {crest && (
            <div
              style={{
                position: 'absolute',
                left: u(2 * s),
                bottom: u(2 * s),
                width: u(22 * s),
                height: u(22 * s),
                borderRadius: u(11 * s),
                background: CARD,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img alt="" src={crest.src} {...contain(crest.w, crest.h, u(15 * s))} />
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: u(6),
            width: u(fw),
            height: u(fh),
            borderRadius: u(6 * s),
            border: `${u(3)}px dashed rgba(255,255,255,0.75)`,
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.9)',
            fontFamily: 'Label',
            fontSize: u(44),
          }}
        >
          +
        </div>
      )}
      {player && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: u(8),
            height: u(chipH),
            minWidth: u(96),
            maxWidth: u(maxChip),
            padding: `0 ${u(11)}px`,
            borderRadius: u(6),
            background: CARD,
            color: INK,
            fontFamily: 'Newsreader',
            fontSize: u(nameSize),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
      )}
    </div>
  );
}

export function LineupCard({ xi, assets, k = 1 }: { xi: SharedXI; assets: CardAssets; k?: number }) {
  const u = (n: number) => n * k;
  const pad = 48;
  const shelfH = 210;
  const crest = xi.club ? assets.crests.get(xi.club.slug) : undefined;
  const crestBox = 96;
  const titleRoom = CARD_W - pad * 2 - (crest ? crestBox + 24 : 0);
  const subtitle = [
    xi.formation,
    xi.club ? xi.club.name.toUpperCase() : null,
    xi.matchweek ? `MATCHWEEK ${xi.matchweek}` : null,
    'GAFFA LINEUP BUILDER',
  ]
    .filter(Boolean)
    .join('  ·  ');

  // The pitch, and the field markings inset within it.
  const px = pad;
  const py = shelfH - 24;
  const pw = CARD_W - pad * 2;
  const ph = CARD_H - py - 64;
  const inset = 26;
  const fX = px + inset;
  const fY = py + inset;
  const fW = pw - inset * 2;
  const fH = ph - inset * 2;
  const line = `${u(3)}px solid rgba(255,255,255,0.4)`;
  const boxW = fW * 0.58;
  const boxH = fH * 0.18;

  const zoned = new Map<PitchZone, SharedXI['slots']>();
  for (const z of ZONE_ORDER) zoned.set(z, []);
  for (const slot of xi.slots) zoned.get(getZone(slot.pos, xi.formation))?.push(slot);
  const rows = ZONE_ORDER.filter((z) => (zoned.get(z)?.length ?? 0) > 0);
  const top = fY + 20;
  const rowH = (fH - 40) / rows.length;
  // 66x78 is the app's lot-size portrait; shrink it on 6-row formations so rows never overlap.
  const s = Math.min(1.35, Math.max(0.9, (rowH - 84) / 78));

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: u(CARD_W),
        height: u(CARD_H),
        background: TOPBAR,
        fontFamily: 'Label',
      }}
    >
      {Array.from({ length: Math.ceil(CARD_W / 36) }, (_, i) =>
        i % 2 === 1 ? (
          <div key={i} style={{ position: 'absolute', left: u(i * 36), top: 0, width: u(36), height: u(shelfH), background: 'rgba(255,255,255,0.05)' }} />
        ) : null,
      )}

      <div
        style={{
          position: 'absolute',
          left: u(pad),
          top: u(46),
          width: u(titleRoom),
          display: 'flex',
          fontFamily: 'Newsreader',
          fontSize: u(64),
          lineHeight: 1,
          letterSpacing: u(-1.2),
          color: '#FFFFFF',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {xi.title}
      </div>
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
      {crest && (
        <div style={{ position: 'absolute', right: u(pad), top: u(52), width: u(crestBox), height: u(crestBox), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img alt="" src={crest.src} {...contain(crest.w, crest.h, u(crestBox))} />
        </div>
      )}

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
          <div key={i} style={{ width: u(pw), height: u(60), flexShrink: 0, background: i % 2 === 0 ? PITCH : PITCH_BAND }} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: u(fX), top: u(fY), width: u(fW), height: u(fH), border: line, display: 'flex' }} />
      <div style={{ position: 'absolute', left: u(fX), top: u(fY + fH / 2 - 1.5), width: u(fW), height: u(3), background: 'rgba(255,255,255,0.4)', display: 'flex' }} />
      <div style={{ position: 'absolute', left: u(fX + fW / 2 - 70), top: u(fY + fH / 2 - 70), width: u(140), height: u(140), borderRadius: u(70), border: line, display: 'flex' }} />
      <div style={{ position: 'absolute', left: u(fX + (fW - boxW) / 2), top: u(fY), width: u(boxW), height: u(boxH), border: line, display: 'flex' }} />
      <div style={{ position: 'absolute', left: u(fX + (fW - boxW) / 2), top: u(fY + fH - boxH), width: u(boxW), height: u(boxH), border: line, display: 'flex' }} />

      {rows.flatMap((zone, r) => {
        const inRow = zoned.get(zone) ?? [];
        const cy = top + rowH * r + rowH / 2;
        return inRow.map((slot, c) => {
          const cx = fX + (fW / (inRow.length + 1)) * (c + 1);
          const maxChip = Math.min(240, fW / (inRow.length + 1) - 8);
          return (
            <PlayerNode
              key={`${zone}-${c}`}
              pos={slot.pos}
              player={slot.player}
              assets={assets}
              x={cx}
              y={cy}
              s={s}
              maxChip={maxChip}
              k={k}
            />
          );
        });
      })}

      {/* The topbar's lockup: mark, then GAFFA.LIVE in the bold serif at the topbar's tracking. */}
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
        <div style={{ display: 'flex', fontFamily: 'Wordmark', fontSize: u(22), letterSpacing: u(22 * 0.12), color: '#FFFFFF' }}>
          GAFFA.LIVE
        </div>
      </div>
    </div>
  );
}
