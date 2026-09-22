// A type board: the same slice of Targets UI set in each candidate for the
// label/button face. Emits project/TypeOptions.dc.html and preview/TypeOptions.html.
import fs from 'node:fs';
import path from 'node:path';

const REPO = '/Users/dukewang/Fantasy Futbol';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const css = fs.readFileSync(`${REPO}/src/app/globals.css`, 'utf8');
function block(sel) {
  const i = css.indexOf(sel); const open = css.indexOf('{', i); let d = 0, j = open;
  for (; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}') { d--; if (!d) break; } }
  return css.slice(i, j + 1);
}
const LIGHT = block(':root,\n.g-theme-light {');

const W = 1440;
const OPTIONS = [
  { id: 'now', name: 'Archivo Narrow', role: 'Current app', note: 'Condensed grotesque for labels and buttons, beside Hanken Grotesk for body.', ui: "'Hanken Grotesk'", lab: "'Archivo Narrow'", labW: 'normal', labCase: 'none' },
  { id: 'two', name: 'Hanken Grotesk only', role: 'Two fonts', note: 'Body, buttons and labels all in Hanken. Labels get their voice from caps and tracking. This is what Targets C uses.', ui: "'Hanken Grotesk'", lab: "'Hanken Grotesk'", labW: 'normal' },
  { id: 'sofia', name: 'Sofia Sans Semi Condensed', role: 'Third font', note: 'A softer, rounder condensed face. Narrow like Archivo, but its curves sit closer to Hanken and Newsreader.', ui: "'Hanken Grotesk'", lab: "'Sofia Sans Semi Condensed'", labW: 'normal' },
  { id: 'barlow', name: 'Barlow Semi Condensed', role: 'Third font', note: 'Squared, sign-like letters in the spirit of stadium and kit lettering, without being a costume.', ui: "'Barlow Semi Condensed'", lab: "'Barlow Semi Condensed'", labW: 'normal', uiIsLab: false },
  { id: 'mona', name: 'Mona Sans at two widths', role: 'Replaces Hanken and Archivo', note: 'One variable family: normal width for body, narrowed for labels and buttons. Two fonts in the app, but condensed labels stay.', ui: "'Mona Sans'", lab: "'Mona Sans'", labW: '84%' },
  { id: 'instrument', name: 'Instrument Sans at two widths', role: 'Replaces Hanken and Archivo', note: 'The same idea with a more precise, slightly technical voice. Narrowest width for labels.', ui: "'Instrument Sans'", lab: "'Instrument Sans'", labW: '78%' },
];
// Barlow keeps Hanken for body; only labels and buttons change.
OPTIONS.find((o) => o.id === 'barlow').ui = "'Hanken Grotesk'";

const plus = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>';

const row = (o) => `
<section class="opt" style="--ui: ${o.ui}, sans-serif; --lab: ${o.lab}, sans-serif; --labW: ${o.labW};">
  <div class="optHead">
    <h2 class="optName">${o.name}</h2>
    <span class="optRole">${o.role}</span>
    <p class="optNote">${o.note}</p>
  </div>
  <div class="optBody">
    <div class="line">
      <nav class="sub"><a>Market</a><a>Auctions <span>1</span></a><a>Listings <span>3</span></a><a class="on">Targets <span>9</span></a><a>Free Agency <span>14</span></a></nav>
      <div class="btns"><button class="btn go">${plus}Add Target</button><button class="btn quiet">List</button><button class="btn go">Offer</button><button class="btn light">Bid €59m</button></div>
    </div>
    <div class="line">
      <div class="heads"><span>Wanted By</span><span>Target</span><span>Terms</span><span>Budget</span><span>Market</span></div>
      <div class="states"><span class="plate">Not Listed</span><span class="live"><i></i>At Auction</span><span class="spine"><b class="tag">CB</b><span class="n">2</span></span></div>
    </div>
    <div class="line">
      <div class="ib"><p class="ibHead">tottenyang FC want Rice</p><p class="ibTerms">Will pay cash · up to <b>€95m</b></p><p class="ibMeta">Only you can see this · 20 · Academy · Gvardiol, Colwill +3</p></div>
    </div>
  </div>
</section>`;

const STYLE = `
.screen { box-sizing: border-box; width: ${W}px; background: var(--color-bg-primary); color: var(--color-text-primary); padding: 48px 56px 56px; font-family: 'Hanken Grotesk', sans-serif; -webkit-font-smoothing: antialiased; }
.screen * { box-sizing: border-box; }
.screen p, .screen h1, .screen h2 { margin: 0; }
.title { font-family: 'Newsreader', serif; font-weight: 700; font-size: 36px; letter-spacing: -0.03em; margin-bottom: 28px; }
.opt { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 40px; padding: 28px 0; border-top: 1px solid var(--color-border); }
.opt:first-of-type { border-top: 2px solid var(--color-text-primary); }
.optName { font-family: var(--lab); font-stretch: var(--labW); font-weight: 700; font-size: 22px; letter-spacing: -0.01em; line-height: 1.15; }
.optRole { display: block; margin-top: 6px; font-family: 'Hanken Grotesk', sans-serif; font-weight: 600; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--color-accent-ink); }
.optNote { margin-top: 10px; font-size: 13px; line-height: 1.5; color: var(--color-text-secondary); max-width: 290px; }
.optBody { display: flex; flex-direction: column; gap: 18px; font-family: var(--ui); }
.line { display: flex; align-items: center; gap: 36px; }
.sub { display: flex; gap: 20px; height: 36px; align-items: center; }
.sub a { font-size: 12px; font-weight: 600; color: var(--color-text-muted); white-space: nowrap; }
.sub a span { font-size: 10px; font-weight: 500; }
.sub a.on { color: var(--color-text-primary); font-weight: 700; box-shadow: inset 0 -2px 0 var(--color-text-primary); padding: 10px 0; }
.btns { display: flex; gap: 8px; margin-left: auto; }
.btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 8px; border: 0; font-family: var(--lab); font-stretch: var(--labW); font-weight: 600; font-size: 15px; white-space: nowrap; }
.go { background: var(--color-accent); color: var(--color-on-accent); }
.quiet { background: transparent; color: var(--color-text-primary); box-shadow: inset 0 0 0 1px var(--color-border); }
.light { background: #0d1117; color: #fff; }
.heads { display: grid; grid-template-columns: repeat(5, auto); gap: 32px; padding-bottom: 8px; border-bottom: 1px solid var(--color-border); font-family: var(--lab); font-stretch: var(--labW); font-weight: 600; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-muted); }
.states { display: flex; align-items: center; gap: 14px; margin-left: auto; }
.plate { height: 26px; display: inline-flex; align-items: center; padding: 0 12px; border-radius: 4px; background: #1b2230; color: #fff; font-family: var(--lab); font-stretch: var(--labW); font-weight: 600; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
.live { display: inline-flex; align-items: center; gap: 6px; font-family: var(--lab); font-stretch: var(--labW); font-weight: 600; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--color-live); }
.live i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.spine { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px 0 5px; border-radius: 6px; box-shadow: inset 0 0 0 1px var(--color-border); }
.tag { font-family: var(--lab); font-stretch: var(--labW); font-size: 10px; font-weight: 700; letter-spacing: .04em; padding: 3px 5px; border-radius: 2px; background: var(--color-pos-cb); color: #fff; }
.n { font-family: 'Newsreader', serif; font-weight: 700; font-size: 15px; }
.ib { display: flex; flex-direction: column; gap: 3px; }
.ibHead { font-family: 'Newsreader', serif; font-weight: 600; font-size: 18px; letter-spacing: -0.01em; }
.ibTerms { font-size: 13px; color: var(--color-text-secondary); }
.ibTerms b { font-family: 'Newsreader', serif; color: var(--color-accent-ink); }
.ibMeta { font-size: 12px; color: var(--color-text-muted); }
`;

const FONTS = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,600;6..72,700&family=Hanken+Grotesk:wght@400;500;600;700&family=Archivo+Narrow:wght@500;600;700&family=Sofia+Sans+Semi+Condensed:wght@500;600;700&family=Barlow+Semi+Condensed:wght@500;600;700&family=Mona+Sans:wdth,wght@75..125,400..800&family=Instrument+Sans:wdth,wght@75..100,400..700&display=swap';

function doc(mode, h) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Type Options</title>
${mode === 'dc' ? '<script src="./support.js"></script>' : ''}
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="${FONTS.replace(/&/g, '&amp;')}">
<style>
${LIGHT}
body { margin: 0; }
${STYLE}
</style>
</helmet>
<div class="screen" style="width: ${W}px; height: ${h}px;">
  <h1 class="title">Label and Button Face</h1>
  ${OPTIONS.map(row).join('')}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${W},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}
const h = Number(process.argv[2] || 1500);
fs.writeFileSync(path.join(HERE, 'project', 'TypeOptions.dc.html'), doc('dc', h));
fs.writeFileSync(path.join(HERE, 'preview', 'TypeOptions.html'), doc('preview', h));
console.log('type board', h);
