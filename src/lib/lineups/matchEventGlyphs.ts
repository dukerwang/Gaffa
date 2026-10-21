export type EventKind = 'goal' | 'assist' | 'ownGoal' | 'yellow' | 'red';

const INK = '#1B1915';
const OWN_GOAL = '#B3261E';

// A football: a centre pentagon, five seams, and five rim patches cut off by the outline.
const BALL_CENTER = 'M12 7.6L16.18 10.64L14.59 15.56L9.41 15.56L7.82 10.64z';
const BALL_SEAMS = 'M12 7.6V3.8M16.18 10.64L19.8 9.47M14.59 15.56L16.82 18.63M9.41 15.56L7.18 18.63M7.82 10.64L4.2 9.47';
const BALL_RIM =
  'M12 4L8.58 1.51L9.88-2.51L14.12-2.51L15.42 1.51z' +
  'M19.61 9.53L20.92 5.5L25.15 5.5L26.46 9.53L23.03 12.02z' +
  'M16.7 18.47L20.93 18.47L22.24 22.5L18.82 24.98L15.39 22.5z' +
  'M7.3 18.47L8.61 22.5L5.18 24.98L1.76 22.5L3.07 18.47z' +
  'M4.39 9.53L.97 12.02L-2.46 9.53L-1.15 5.5L3.08 5.5z';

const ball = (ink: string) =>
  '<defs><clipPath id="b"><circle cx="12" cy="12" r="10.2"/></clipPath></defs>' +
  '<circle cx="12" cy="12" r="10.2" fill="#fff"/>' +
  `<g clip-path="url(#b)"><path d="${BALL_RIM}" fill="${ink}"/></g>` +
  `<path d="${BALL_CENTER}" fill="${ink}"/>` +
  `<path d="${BALL_SEAMS}" stroke="${ink}" stroke-width="1" stroke-linecap="round" fill="none"/>` +
  `<circle cx="12" cy="12" r="10.2" fill="none" stroke="${ink}" stroke-width="1.2"/>`;

/** A boot on a white disc, so its dark shape still reads on the pitch. */
const BOOT =
  '<circle cx="12" cy="12" r="11.4" fill="#fff"/>' +
  '<g transform="translate(12 12) scale(.76) translate(-12.5 -13)">' +
  `<path d="M3 6.4C3 5.6 3.6 5 4.4 5h3.9c.8 0 1.4.6 1.4 1.4v3.1c0 .9.6 1.6 1.4 1.9l8.3 2.9c1.6.6 2.6 1.9 2.6 3.5v.6c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1z" fill="${INK}"/>` +
  '<path d="M3 15.4h19" stroke="#fff" stroke-width="1"/>' +
  `<path d="M5.4 18.6h2.6l-.4 2.4H5.8zM10.7 18.6h2.6l-.4 2.4h-1.8zM16 18.6h2.6l-.4 2.4h-1.8z" fill="${INK}"/>` +
  '<path d="M12.2 12.1l1.9-.9M14.6 13l1.7-.8" stroke="#fff" stroke-width="1" stroke-linecap="round"/>' +
  '</g>';

const card = (fill: string) => `<rect x="6" y="2.5" width="12" height="19" rx="2.4" fill="${fill}"/>`;

const SHAPES: Record<EventKind, string> = {
  goal: ball(INK),
  ownGoal: ball(OWN_GOAL),
  assist: BOOT,
  yellow: card('#F5C400'),
  red: card('#D7263D'),
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
