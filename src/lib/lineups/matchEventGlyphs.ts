export type EventKind = 'goal' | 'assist' | 'ownGoal' | 'yellow' | 'red';

// Gaffa's light-theme tokens, fixed: the share card is a poster and the marks must match it.
const INK = '#1B1915';
const CREAM = '#FCFAF7';
const GREEN = '#0C6D3E';
const OWN_GOAL = '#AE3C36';

// A football: a centre pentagon, five seams, and five rim patches cut off by the outline.
const BALL_CENTER = 'M12 7.6L16.18 10.64L14.59 15.56L9.41 15.56L7.82 10.64z';
const BALL_SEAMS = 'M12 7.6V3.8M16.18 10.64L19.8 9.47M14.59 15.56L16.82 18.63M9.41 15.56L7.18 18.63M7.82 10.64L4.2 9.47';
const BALL_RIM =
  'M12 4L8.58 1.51L9.88-2.51L14.12-2.51L15.42 1.51z' +
  'M19.61 9.53L20.92 5.5L25.15 5.5L26.46 9.53L23.03 12.02z' +
  'M16.7 18.47L20.93 18.47L22.24 22.5L18.82 24.98L15.39 22.5z' +
  'M7.3 18.47L8.61 22.5L5.18 24.98L1.76 22.5L3.07 18.47z' +
  'M4.39 9.53L.97 12.02L-2.46 9.53L-1.15 5.5L3.08 5.5z';

/** An ivory ball with soft shading inside a cream ring, the way the club crest sits on a portrait. */
const ball = (patch: string) =>
  '<defs>' +
  '<radialGradient id="s" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".62" stop-color="#F1ECE2"/><stop offset="1" stop-color="#D3CCBD"/></radialGradient>' +
  '<clipPath id="b"><circle cx="12" cy="12" r="10.6"/></clipPath>' +
  '</defs>' +
  `<circle cx="12" cy="12" r="11.6" fill="${CREAM}"/>` +
  '<circle cx="12" cy="12" r="10.6" fill="url(#s)"/>' +
  `<g clip-path="url(#b)"><path d="${BALL_RIM}" fill="${patch}"/></g>` +
  `<path d="${BALL_CENTER}" fill="${patch}"/>` +
  `<path d="${BALL_SEAMS}" stroke="${patch}" stroke-width="1" stroke-linecap="round" fill="none"/>` +
  `<circle cx="12" cy="12" r="10.6" fill="none" stroke="${INK}" stroke-opacity=".22" stroke-width=".8"/>`;

/** An assist: a ball played along a curved pass, on a Gaffa-green disc in the same cream ring. */
const ASSIST =
  '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14854F"/><stop offset="1" stop-color="#0A5B33"/></linearGradient></defs>' +
  `<circle cx="12" cy="12" r="11.6" fill="${CREAM}"/>` +
  '<circle cx="12" cy="12" r="10.4" fill="url(#a)"/>' +
  `<circle cx="7.6" cy="16.2" r="2.5" fill="${CREAM}"/>` +
  `<circle cx="7.6" cy="16.2" r="1" fill="${GREEN}"/>` +
  `<path d="M10.4 14C11.4 10.8 13.4 9 16.2 8.4" stroke="${CREAM}" stroke-width="1.7" stroke-linecap="round" fill="none"/>` +
  `<path d="M15.2 5.6L19.8 8L15.6 11z" fill="${CREAM}" stroke="${CREAM}" stroke-width="1" stroke-linejoin="round"/>`;

/** A card: a shaded slip, slightly tilted, on a cream plate. */
const card = (top: string, bottom: string) =>
  `<defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>` +
  `<rect x="5.6" y="2" width="12.8" height="20" rx="2.6" fill="${CREAM}"/>` +
  '<rect x="6.8" y="3.2" width="10.4" height="17.6" rx="1.8" fill="url(#k)" transform="rotate(8 12 12)"/>';

const SHAPES: Record<EventKind, string> = {
  goal: ball(INK),
  ownGoal: ball(OWN_GOAL),
  assist: ASSIST,
  yellow: card('#F7CB2A', '#E8A917'),
  red: card('#D9453D', '#B3302A'),
};

/**
 * One event's mark as an SVG data URL, drawn on a 24-unit canvas. Both the
 * Lineup Builder and its share card draw it as an image, because Satori can't
 * serialise the child shapes of an inline <svg>, and one source keeps the two
 * identical.
 */
export function eventGlyphUrl(kind: EventKind): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${SHAPES[kind]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
