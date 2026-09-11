import { writeFileSync } from 'node:fs';
import { TOKENS, FONTS } from './tokens.mjs';
import { SHELL_CSS, shell } from './shell.mjs';
import { MAP_CSS, mapBoard } from './map.mjs';
import { SQUAD_CSS, squadBoard } from './squad.mjs';
import { GRID_CSS, gridBoard } from './grid.mjs';
import { STACK_CSS, stackBoard } from './stack.mjs';

const BASE = `
  * { box-sizing:border-box; }
  body { margin:0; font-family:var(--font-sans); background:var(--color-bg-primary);
         color:var(--color-text-primary); -webkit-font-smoothing:antialiased; }
  a { color:var(--color-accent-ink); text-decoration:none; }
  a:hover { color:var(--color-accent); }
  button { font-family:inherit; cursor:pointer; }
  .screen { background:var(--color-bg-primary); min-height:100%; }
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
${BASE}${SHELL_CSS}${css}
  </style>
</helmet>
<div class="screen {{themeClass}}">
${shell}
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

writeFileSync('Main.dc.html',   dc(MAP_CSS,   mapBoard(),   [1400, 940]));
writeFileSync('Dark.dc.html',   dc(MAP_CSS,   mapBoard(),   [1400, 940], true));
writeFileSync('Squad.dc.html',  dc(SQUAD_CSS, squadBoard(), [1400, 800]));
writeFileSync('Matrix.dc.html', dc(GRID_CSS,  gridBoard(),  [1400, 1020]));
writeFileSync('Stack.dc.html',  dc(STACK_CSS, stackBoard(), [1120, 1360]));

console.log('wrote 5 artboards');
