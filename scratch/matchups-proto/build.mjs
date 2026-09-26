// node build.mjs [dc] -> preview/*.html (local assets) or project/*.dc.html (canvas blobs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIGHT, DARK, setMode, resetCrests, USED } from './lib.mjs';
import { roundPage2 as roundPage, matchPage2 as matchPage } from './pages2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STYLE = fs.readFileSync(path.join(HERE, 'mu.css'), 'utf8');
const FONTS = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Hanken+Grotesk:wght@400;500;600;700&family=Sofia+Sans+Semi+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap';

export const BOARDS = [
  { file: 'Main.dc.html', title: 'Gameweek 5 · Final', w: 1440, page: 'r', make: () => roundPage({ state: 'final', w: 1440 }) },
  { file: 'RoundFinalDark.dc.html', title: 'Gameweek 5 · Final · Dark', w: 1440, page: 'r', make: () => roundPage({ state: 'final', dark: true, w: 1440 }) },
  { file: 'RoundLive.dc.html', title: 'Gameweek 5 · Live (Sun 13:00)', w: 1440, page: 'r', make: () => roundPage({ state: 'live', w: 1440 }) },
  { file: 'RoundUpcoming.dc.html', title: 'Gameweek 6 · Upcoming', w: 1440, page: 'r', make: () => roundPage({ state: 'upcoming', w: 1440 }) },
  { file: 'RoundFinalPhone.dc.html', title: 'Final · 390', w: 390, page: 'r', make: () => roundPage({ state: 'final', mobile: true, w: 390 }) },
  { file: 'RoundFinalPhoneDark.dc.html', title: 'Final · 390 · Dark', w: 390, page: 'r', make: () => roundPage({ state: 'final', mobile: true, dark: true, w: 390 }) },
  { file: 'RoundLivePhone.dc.html', title: 'Live · 390', w: 390, page: 'r', make: () => roundPage({ state: 'live', mobile: true, w: 390 }) },
  { file: 'RoundUpcomingPhone.dc.html', title: 'Upcoming · 390', w: 390, page: 'r', make: () => roundPage({ state: 'upcoming', mobile: true, w: 390 }) },
  { file: 'MatchFinal.dc.html', title: 'Matchup · Final · One Pitch', w: 1440, page: 'm', make: () => matchPage({ state: 'final', w: 1440 }) },
  { file: 'MatchFinalDark.dc.html', title: 'Matchup · Final · Dark', w: 1440, page: 'm', make: () => matchPage({ state: 'final', dark: true, w: 1440 }) },
  { file: 'MatchLive.dc.html', title: 'Matchup · Live (Sun 13:00)', w: 1440, page: 'm', make: () => matchPage({ state: 'live', w: 1440 }) },
  { file: 'MatchUpcoming.dc.html', title: 'Matchup · Gameweek 6 · Upcoming', w: 1440, page: 'm', make: () => matchPage({ state: 'upcoming', w: 1440 }) },
  { file: 'MatchFinalPhone.dc.html', title: 'Final · 390 · One Pitch', w: 390, page: 'm', make: () => matchPage({ state: 'final', mobile: true, w: 390 }) },
  { file: 'MatchFinalPhoneTheirs.dc.html', title: 'Final · 390 · One Club', w: 390, page: 'm', make: () => matchPage({ state: 'final', mobile: true, w: 390, variant: 'single' }) },
  { file: 'MatchFinalPhoneDark.dc.html', title: 'Final · 390 · Dark', w: 390, page: 'm', make: () => matchPage({ state: 'final', mobile: true, dark: true, w: 390 }) },
  { file: 'MatchLivePhone.dc.html', title: 'Live · 390', w: 390, page: 'm', make: () => matchPage({ state: 'live', mobile: true, w: 390 }) },
];

function doc(inner, w, h, title, mode) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
${mode === 'dc' ? '<script src="./support.js"></script>' : ''}
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="${FONTS.replace(/&/g, '&amp;')}">
<style>
${LIGHT}
${DARK}
:root { --font-serif: 'Newsreader', Georgia, serif; --font-sans: 'Hanken Grotesk', system-ui, sans-serif; --font-mono: 'JetBrains Mono', monospace; --font-label: 'Sofia Sans Semi Condensed', 'Hanken Grotesk', sans-serif; }
body { margin: 0; background: #d9d6cf; }
${STYLE}
</style>
</helmet>
${inner.replace('__H__', h)}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

const mode = process.argv[2] === 'dc' ? 'dc' : 'preview';
const hp = path.join(HERE, 'heights.json');
const heights = fs.existsSync(hp) ? JSON.parse(fs.readFileSync(hp, 'utf8')) : {};
const outDir = mode === 'dc' ? path.join(HERE, 'canvas', 'project') : path.join(HERE, 'preview');
fs.mkdirSync(outDir, { recursive: true });
setMode(mode);
for (const b of BOARDS) {
  resetCrests();
  const h = heights[b.file] ?? 2400;
  const out = mode === 'dc' ? path.join(outDir, b.file) : path.join(outDir, b.file.replace('.dc.html', '.html'));
  fs.writeFileSync(out, doc(b.make(), b.w, h, b.title, mode));
}
fs.writeFileSync(path.join(HERE, 'used.json'), JSON.stringify([...USED].sort()));
console.log('built', BOARDS.length, mode, 'assets used', USED.size);
