import { writeFileSync } from 'node:fs';
import { TOKENS, FONTS } from './tokens.mjs';
import { CHROME_CSS, chrome } from './chrome.mjs';
import { MATCHBOARD_CSS, matchboard } from './boards.mjs';
import { SENTENCE_CSS, sentence, LEDGER_CSS, ledger } from './boards2.mjs';

const BASE = `
  * { box-sizing:border-box; }
  body { margin:0; font-family:var(--font-sans); background:var(--color-bg-primary);
         color:var(--color-text-primary); -webkit-font-smoothing:antialiased; }
  a { color:var(--color-accent-ink); text-decoration:none; }
  a:hover { color:var(--color-accent); }
  button { font-family:inherit; cursor:pointer; }
  .screen { background:var(--color-bg-primary); min-height:100%; }
`;

/* The theme tweak is a genuine lever — every colour decision in this app has to
   hold in both palettes, and flipping one artboard beats drawing two. One hole
   swaps a class; every colour below it stays literal so the board paints while
   the page is still streaming. */
const LOGIC = `<script data-dc-script data-props='{"theme":{"editor":"enum","options":["light","dark"],"default":"light","section":"Theme"}}'>
class Component extends DCLogic {
  renderVals() {
    return { themeClass: (this.props.theme ?? 'light') === 'dark' ? 'dark' : '' };
  }
}
</script>`;

function dc(css, body, { dark = false, preview } = {}) {
  const props = preview
    ? `data-props='{"theme":{"editor":"enum","options":["light","dark"],"default":"${dark ? 'dark' : 'light'}","section":"Theme"},"$preview":{"width":${preview[0]},"height":${preview[1]}}}'`
    : null;
  const logic = props
    ? LOGIC.replace(/data-props='[^']*'/, props)
    : LOGIC.replace('"default":"light"', `"default":"${dark ? 'dark' : 'light'}"`);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${FONTS}
  <style>${TOKENS}
${BASE}${CHROME_CSS}${css}
  </style>
</helmet>
<div class="screen {{themeClass}}">
${chrome}
${body}
</div>
</x-dc>
${logic}
</body>
</html>
`;
}

/* ── Mobile: the five columns crush each other long before 390px, so the row
   stacks — club above the target, terms folded under it, actions on their own
   line at a 44px target. */
const MOBILE_CSS = `
  .topbar { padding:0 var(--s4); gap:var(--s4); }
  .topLink { display:none; }
  .subnav { gap:var(--s4); padding:0 var(--s4); overflow-x:auto; }
  .header { padding:var(--s4) var(--s4) var(--s3); flex-direction:column;
            align-items:flex-start; gap:var(--s4); }
  .title { font-size:var(--t-25); }
  .stats { gap:var(--s5); width:100%; flex-wrap:wrap; }
  .stat { text-align:left; }
  .tools { padding:var(--s3) var(--s4); }
  .searchRow { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:var(--s2); }
  .input { grid-column:1 / -1; min-width:0; }
  .cta { grid-column:1 / -1; }
  .input, .select, .cta { min-height:44px; display:flex; align-items:center;
                          justify-content:center; }
  .input { justify-content:flex-start; }
  .facets { flex-wrap:nowrap; overflow-x:auto; padding-bottom:var(--s1); }
  .board { padding:var(--s4) var(--s4) var(--s8); }
  .sect { flex-wrap:wrap; }
  .sectHint { margin-left:0; flex-basis:100%; }
  .row { grid-template-columns:minmax(0,1fr); gap:var(--s2); padding:var(--s3) 0;
         min-height:0; }
  .terms { text-align:left; display:flex; align-items:baseline; gap:var(--s2); }
  .termsFig { font-size:var(--t-17); margin-top:0; }
  .btn { min-height:44px; height:auto; }
`;

writeFileSync('Main.dc.html', dc(MATCHBOARD_CSS, matchboard, { preview: [1280, 1000] }));
writeFileSync('Dark.dc.html', dc(MATCHBOARD_CSS, matchboard, { dark: true, preview: [1280, 1000] }));
writeFileSync('Sentence.dc.html', dc(SENTENCE_CSS, sentence, { preview: [1280, 780] }));
writeFileSync('Ledger.dc.html', dc(LEDGER_CSS, ledger, { preview: [1280, 780] }));
writeFileSync('Mobile.dc.html', dc(MATCHBOARD_CSS + MOBILE_CSS, matchboard, { preview: [390, 1500] }));

console.log('wrote 5 artboards');
