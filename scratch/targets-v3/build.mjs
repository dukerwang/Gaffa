import { writeFileSync } from 'node:fs';
import { TOKENS, FONTS } from './tokens.mjs';
import { CSS } from './css.mjs';
import { shell, page } from './page.mjs';
import { MODAL_CSS, MOBILE_MODAL_CSS, modal } from './modal.mjs';

/* Shadow tokens the modal needs, straight from globals.css. */
const SHADOWS = `
  :root { --shadow-xl: 0 16px 48px rgba(28,28,28,.16); }
  .dark { --shadow-xl: 0 16px 48px rgba(0,0,0,.55); }
  :root { --dur-fast:140ms; --ease-standard:cubic-bezier(.22,1,.36,1); }
`;

/* Below 768px the four columns crush each other, so a row becomes three lines:
   the target and its budget, the club and the stance, then the actions at a
   44px touch target. */
const MOBILE_CSS = `
  @media (max-width:768px) {
    .topbar { padding:0 var(--s4); gap:var(--s4); }
    .topLink { display:none; }
    .subnav { gap:var(--s4); padding:0 var(--s4); overflow-x:auto; }
    .page { padding:var(--s4) var(--s4) var(--s10); }

    .barTop { flex-wrap:wrap; gap:var(--s2); }
    .barName { width:100%; height:auto; }
    .barDiv { display:none; }
    .segs { order:3; width:100%; }
    .seg, .segOn { flex:1; justify-content:center; }
    .search { order:1; flex:1; width:auto; }
    .btnMd { order:2; }

    .row { grid-template-columns:minmax(0,1fr) auto; gap:7px var(--s3);
           align-items:start; padding:var(--s3) var(--s2); }
    /* display:contents so the gate and the figure place themselves separately:
       the money rides line one beside the name, the stance rides line two
       beside the club. */
    .terms { display:contents; }
    .target { grid-column:1; grid-row:1; }
    .fig     { grid-column:2; grid-row:1; justify-self:end; margin-left:0; }
    .askCol  { grid-column:1; grid-row:2; }
    .gate    { grid-column:2; grid-row:2; justify-self:end; align-self:center; }
    .scope   { padding-left:0; }
    .acts    { grid-column:1 / -1; grid-row:3; margin-top:var(--s1); }
    .acts .btn { flex:1; min-height:44px; }
    .rowLive { padding:var(--s3); }
  }
`;

function dc(css, body, [w, h], dark = false) {
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
${SHADOWS}${CSS}${css}
  </style>
</helmet>
<div class="screen {{themeClass}}">
${body}
</div>
</x-dc>
<script data-dc-script data-props='{"theme":{"editor":"enum","options":["light","dark"],"default":"${dark ? 'dark' : 'light'}","section":"Theme"},"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() {
    return { themeClass: (this.props.theme ?? '${dark ? 'dark' : 'light'}') === 'dark' ? 'dark' : '' };
  }
}
</script>
</body>
</html>
`;
}

const full = `${shell}\n${page}`;

writeFileSync('Main.dc.html',   dc('', full, [1280, 1080]));
writeFileSync('Dark.dc.html',   dc('', full, [1280, 1080], true));
writeFileSync('Modal.dc.html',  dc(MODAL_CSS, modal, [620, 1120]));
writeFileSync('Mobile.dc.html', dc(MOBILE_CSS, full, [390, 1400]));
writeFileSync('MobileSheet.dc.html', dc(MODAL_CSS + MOBILE_MODAL_CSS, modal, [390, 1000]));

console.log('wrote 5 artboards');
