import { posVars } from './tokens.mjs';
import { TARGETS, CLUBS, POSITIONS, clubName, ROLE_NOUN, MY_SURPLUS } from './data2.mjs';

/* ══════════════════════════════════════════════════════════════
   MATRIX — every club against every position, on one screen.

   The densest answer, and the only one that shows the whole
   market at once: eight clubs, twelve positions, ninety-six
   cells, no scrolling and no filters. You read it the way you
   read a league table — down a column for one club's whole
   shopping list, across a row for who is competing with you.

   A filled cell names a man; a hollow one is a role. Your own
   row and column are ruled off rather than tinted, because a
   tint on a crossing row and column makes a plus sign nobody
   asked for.
   ══════════════════════════════════════════════════════════════ */

export const GRID_CSS = `
  .wrap { padding:var(--s6) var(--s8) var(--s10); }
  .head { display:flex; align-items:flex-end; justify-content:space-between;
          gap:var(--s6); margin-bottom:var(--s5); }
  .heat { display:flex; gap:var(--s5); align-items:center; font-size:var(--t-11);
          color:var(--color-text-muted); }
  .heatKey { display:flex; align-items:center; gap:6px; }

  .matrix { display:grid; grid-template-columns:56px repeat(8, minmax(0,1fr)) 68px;
            border:1px solid var(--color-border); border-radius:var(--r-shell);
            overflow:hidden; background:var(--color-bg-card); }

  .ch { padding:var(--s3) var(--s2); background:var(--color-bg-elevated);
        border-bottom:1px solid var(--color-border);
        font-family:var(--font-condensed); font-weight:700; font-size:var(--t-10);
        letter-spacing:.10em; text-transform:uppercase; color:var(--color-text-muted);
        text-align:center; white-space:nowrap; }
  .chMe { color:var(--color-text-primary); box-shadow:inset 0 3px 0 var(--color-text-primary); }
  .chEnd { text-align:right; }

  .rh { display:flex; align-items:center; gap:var(--s2); padding:0 var(--s2);
        border-right:1px solid var(--color-border); background:var(--color-bg-card-alt);
        font-family:var(--font-condensed); font-weight:700; font-size:var(--t-12);
        letter-spacing:.06em; color:var(--pl); }
  .cell { height:46px; display:flex; align-items:center; justify-content:center;
          border-bottom:1px solid var(--color-border-subtle);
          border-right:1px solid var(--color-border-subtle); }
  .cellMe { border-right:1px solid var(--color-border);
            border-left:1px solid var(--color-border); }
  .rowEnd { display:flex; align-items:center; justify-content:flex-end; padding:0 var(--s3);
            border-bottom:1px solid var(--color-border-subtle);
            font-family:var(--font-serif); font-weight:700; font-size:var(--t-15);
            font-variant-numeric:tabular-nums lining-nums; color:var(--color-text-primary); }
  .rowEndOff { color:var(--color-text-muted); font-weight:400; font-size:var(--t-13); }
  .lastRow .cell, .lastRow .rowEnd, .lastRow .rh { border-bottom:none; }

  /* A named target is a filled tile carrying the man's initial; a role target is
     a hollow one carrying the level. Shape, not just colour, so the two kinds
     survive a grayscale print and a colour-blind reader. */
  .mk { width:30px; height:30px; border-radius:var(--r-control); display:flex;
        align-items:center; justify-content:center; font-family:var(--font-condensed);
        font-weight:700; font-size:var(--t-11); letter-spacing:.02em; }
  .mkNamed { background:var(--pf); color:var(--pi); }
  .mkRole { box-shadow:inset 0 0 0 1.5px var(--pl); color:var(--pl); }
  /* Yours. Ink ring, because the accent already means "you" on the row header. */
  .mkMine { box-shadow:inset 0 0 0 2px var(--color-accent); color:var(--color-accent-ink);
            background:var(--color-accent-dim); }
  .surplus { width:6px; height:6px; border-radius:var(--r-round);
             background:var(--color-accent); }

  .rowTotals { background:var(--color-bg-elevated); }
  .rowTotals .cell, .rowTotals .rowEnd { border-bottom:none;
      font-family:var(--font-condensed); font-weight:700; font-size:var(--t-12);
      color:var(--color-text-secondary); }

  .below { display:grid; grid-template-columns:minmax(0,1fr) 400px; gap:var(--s8);
           margin-top:var(--s6); align-items:start; }
  .readT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
           margin:0 0 var(--s2); color:var(--color-text-primary); }
  .readP { font-size:var(--t-13); line-height:1.55; color:var(--color-text-secondary);
           max-width:60ch; }
  .readP strong { color:var(--color-text-primary); }
  .keyList { display:grid; gap:var(--s2); font-size:var(--t-12);
             color:var(--color-text-secondary); }
  .keyRow { display:flex; align-items:center; gap:var(--s3); }
`;

const other = CLUBS;

export function gridBoard() {
  const cellFor = (pos, club) => {
    const t = TARGETS.find((x) => x.pos === pos && x.club === club);
    if (!t) return '';
    const mine = t.mine;
    const label = t.kind === 'named' ? t.want.replace(/^([A-Z])\. .*/, '$1') : t.want[0];
    const cls = mine ? 'mkMine' : t.kind === 'named' ? 'mkNamed' : 'mkRole';
    return `<span class="mk ${cls}" style="${posVars(pos)}" title="${clubName(club)} — ${t.kind === 'named' ? t.want : t.want + ' ' + ROLE_NOUN[pos]}">${label}</span>`;
  };

  const rows = POSITIONS.map((pos, i) => {
    const n = TARGETS.filter((t) => t.pos === pos && !t.mine).length;
    const last = i === POSITIONS.length - 1;
    return `      <div class="rh${last ? ' lastRowCell' : ''}" style="${posVars(pos)}">${pos}${MY_SURPLUS.includes(pos) ? '<span class="surplus"></span>' : ''}</div>
${other.map((c) => `      <div class="cell${c.me ? ' cellMe' : ''}">${cellFor(pos, c.id)}</div>`).join('\n')}
      <div class="rowEnd${n ? '' : ' rowEndOff'}">${n || '·'}</div>`;
  }).join('\n');

  const colTotals = other.map((c) => {
    const n = TARGETS.filter((t) => t.club === c.id).length;
    return `      <div class="cell${c.me ? ' cellMe' : ''}">${n || '·'}</div>`;
  }).join('\n');

  return `  <div class="wrap">
    <div class="head">
      <div>
        <h1 class="pageTitle">The Targets Board</h1>
        <div class="pageSub">Eight clubs, twelve positions. Read down a column for one club&rsquo;s shopping list, across a row for who you bid against.</div>
      </div>
      <div class="heat">
        <span class="heatKey"><span class="mk mkNamed" style="${posVars('CB')};width:18px;height:18px;font-size:9px"></span>they named a player</span>
        <span class="heatKey"><span class="mk mkRole" style="${posVars('CB')};width:18px;height:18px;font-size:9px"></span>they want a role</span>
        <span class="heatKey"><span class="surplus"></span>you have a spare</span>
      </div>
    </div>

    <div class="matrix">
      <div class="ch"></div>
${other.map((c) => `      <div class="ch${c.me ? ' chMe' : ''}">${c.me ? 'You' : c.id}</div>`).join('\n')}
      <div class="ch chEnd">Total</div>
${rows}
      <div class="rh rowTotals"></div>
${colTotals}
      <div class="rowEnd rowTotals">17</div>
    </div>

    <div class="below">
      <div>
        <h3 class="readT">How to Read It</h3>
        <p class="readP">Three clubs chase a <strong>centre-back</strong> and three a <strong>left-back</strong>, and you hold a spare left-back and no spare centre-back. Read across the LB row to see exactly who you&rsquo;d sell to, and that <strong>Matchday Militia</strong> named Kerkez instead of asking for the position &mdash; which makes them the most serious of the three.</p>
        <p class="readP" style="margin-top:12px">Read down <strong>Kingsmead&rsquo;s</strong> column: a centre-back and a striker. They&rsquo;re rebuilding a spine, not shopping.</p>
      </div>
      <div class="keyList">
        <div class="keyRow"><span class="label" style="width:78px">Rows</span>The twelve tactical positions, in spine order.</div>
        <div class="keyRow"><span class="label" style="width:78px">Columns</span>Every club, yours ruled off in the middle.</div>
        <div class="keyRow"><span class="label" style="width:78px">Letters</span>On a named target you see the man&rsquo;s initial; on a role, its level &mdash; S for starter, B for bench, P for prospect.</div>
      </div>
    </div>
  </div>`;
}
