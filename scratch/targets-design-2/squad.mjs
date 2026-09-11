import { posVars } from './tokens.mjs';
import { MY_SQUAD, TARGETS, clubName, ROLE_NOUN, demandByPosition } from './data2.mjs';

/* ══════════════════════════════════════════════════════════════
   SQUAD-FIRST — the board about your players, not theirs.

   The shipped board is a list of other clubs' adverts, and the
   reader has to hold his own roster in his head to know whether
   any of it matters. This inverts the key: your squad is the
   page, and demand hangs off each man. Every row is already an
   action you can take, because every row is a player you own.

   Your own targets move to a rail, where they behave like a
   watchlist rather than competing with the market for the
   middle of the page.
   ══════════════════════════════════════════════════════════════ */

export const SQUAD_CSS = `
  .wrap { display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:var(--s8);
          padding:var(--s6) var(--s8) var(--s10); align-items:start; }
  .head { margin-bottom:var(--s5); }

  .sect { display:flex; align-items:baseline; gap:var(--s3); padding-bottom:var(--s2);
          border-bottom:2px solid var(--color-text-primary); margin-bottom:var(--s1); }
  .sectT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
           letter-spacing:-0.02em; margin:0; color:var(--color-text-primary); }
  .sectHint { margin-left:auto; font-size:var(--t-12); color:var(--color-text-muted); }

  /* A player of mine, with the market for him attached. */
  .man { display:grid; grid-template-columns:220px minmax(0,1fr) 150px;
         gap:var(--s5); align-items:center; padding:var(--s4) var(--s2);
         border-bottom:1px solid var(--color-border-subtle); }
  .manWanted { background:var(--color-accent-dim); }
  .manQuiet .who, .manQuiet .val { opacity:.62; }

  .who { min-width:0; }
  .manName { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
             letter-spacing:-0.012em; color:var(--color-text-primary); }
  .manVal { font-size:var(--t-11); color:var(--color-text-muted); margin-top:2px; }

  /* The market for him, as a sentence rather than a row of cells. */
  .market { font-size:var(--t-13); color:var(--color-text-secondary); line-height:1.45; }
  .market strong { color:var(--color-text-primary); font-weight:700; }
  .fig { font-family:var(--font-serif); font-weight:700; color:var(--color-accent-ink);
         font-variant-numeric:tabular-nums lining-nums; }
  .quiet { font-size:var(--t-12); color:var(--color-text-muted); }
  /* Not a chip, not a badge — a whole clause, because "nobody wants him" is
     genuinely the useful thing to know about most of a squad. */
  .noneLine { display:flex; align-items:center; gap:var(--s2); }
  .noneDash { width:18px; height:1px; background:var(--color-border); flex-shrink:0; }

  .manActs { display:flex; gap:var(--s1); justify-content:flex-end; }
  .btn { font-family:var(--font-condensed); font-size:var(--t-10); font-weight:700;
         letter-spacing:.06em; text-transform:uppercase; padding:0 var(--s3); height:32px;
         border-radius:var(--r-control); border:1px solid var(--color-border-strong);
         background:none; color:var(--color-text-primary); white-space:nowrap; }
  .btnGo { background:var(--color-accent); border-color:var(--color-accent);
           color:var(--color-on-accent); }
  .btnGhost { border-color:var(--color-border-subtle); color:var(--color-text-muted); }

  /* ── Rail: what I'm chasing, and where the league is short ── */
  .rail { position:sticky; top:var(--s4); display:grid; gap:var(--s6); }
  .railBlock { }
  .railHead { display:flex; align-items:baseline; gap:var(--s2); padding-bottom:var(--s2);
              border-bottom:1px solid var(--color-border); margin-bottom:var(--s2); }
  .railT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
           letter-spacing:-0.02em; margin:0; color:var(--color-text-primary); }
  .railN { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-11);
           color:var(--color-text-muted); font-variant-numeric:tabular-nums; }
  .railAdd { margin-left:auto; font-family:var(--font-condensed); font-weight:700;
             font-size:var(--t-11); letter-spacing:.06em; text-transform:uppercase;
             color:var(--color-accent-ink); }

  .chase { display:flex; align-items:center; gap:var(--s2); padding:var(--s2) 0;
           border-bottom:1px solid var(--color-border-subtle); }
  .chaseMain { flex:1; min-width:0; }
  .chaseName { font-size:var(--t-13); font-weight:600; color:var(--color-text-primary);
               white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .chaseSub { font-size:var(--t-10); color:var(--color-text-muted); margin-top:1px; }
  .chaseHot { color:var(--color-warning-text); font-weight:700; }
  .chaseFig { font-family:var(--font-serif); font-weight:700; font-size:var(--t-13);
              font-variant-numeric:tabular-nums; color:var(--color-text-primary); }

  /* Where the league is short, as a bar chart of positions — the map's
     information, compressed into a rail. */
  .short { display:grid; gap:5px; }
  .shortRow { display:grid; grid-template-columns:34px minmax(0,1fr) 20px; gap:var(--s2);
              align-items:center; font-size:var(--t-11); }
  .shortPos { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-11);
              letter-spacing:.06em; color:var(--pl); }
  .bar { height:8px; border-radius:var(--r-micro); background:var(--pf); opacity:.85; }
  .barTrack { height:8px; border-radius:var(--r-micro); background:var(--color-bg-inset); }
  .shortN { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-10);
            color:var(--color-text-muted); text-align:right;
            font-variant-numeric:tabular-nums; }
  .shortMine { box-shadow:inset 0 0 0 1.5px var(--color-accent); border-radius:var(--r-micro); }
`;

const TONE = { cash:'will pay cash', players:'are offering players', loan:'would take him on loan', open:'are open to approaches' };

function marketFor(p) {
  const rows = TARGETS.filter((t) => !t.mine && t.kind === 'named' && t.want === p.name);
  const roleRows = TARGETS.filter((t) => !t.mine && t.kind === 'role' && t.pos === p.pos);

  if (rows.length) {
    const t = rows[0];
    return `<strong>${clubName(t.club)}</strong> want him &mdash; they ${TONE[t.tone]}${t.budget ? `, up to <span class="fig">&euro;${t.budget}m</span>` : ''}.`;
  }
  if (roleRows.length) {
    const n = new Set(roleRows.map((r) => r.club)).size;
    const budgets = roleRows.map((r) => r.budget).filter(Boolean);
    return `<span class="quiet">${n === 1 ? 'One club is' : `${n} clubs are`} looking for ${roleRows[0].pos === 'ST' ? 'a striker' : 'a ' + ROLE_NOUN[p.pos]}${budgets.length ? `, up to <span class="fig">&euro;${Math.max(...budgets)}m</span>` : ''}.</span>`;
  }
  return `<span class="noneLine quiet"><span class="noneDash"></span>Nobody is asking.</span>`;
}

export function squadBoard() {
  const men = MY_SQUAD.map((p) => {
    const named = TARGETS.some((t) => !t.mine && t.kind === 'named' && t.want === p.name);
    const role = TARGETS.some((t) => !t.mine && t.kind === 'role' && t.pos === p.pos);
    const cls = ['man', named ? 'manWanted' : role ? '' : 'manQuiet'].filter(Boolean).join(' ');
    const acts = named
      ? '<button class="btn">Offer</button><button class="btn btnGo">List</button>'
      : role
        ? '<button class="btn">Offer</button>'
        : '<button class="btn btnGhost">List</button>';
    return `      <div class="${cls}">
        <div class="who">
          <div class="namerow" style="${posVars(p.pos)}"><span class="poschip">${p.pos}</span><span class="manName">${p.name}</span></div>
          <div class="manVal">Valued &euro;${p.value}m${p.surplus ? ' &middot; surplus to your first eleven' : ''}</div>
        </div>
        <div class="market">${marketFor(p)}</div>
        <div class="manActs">${acts}</div>
      </div>`;
  }).join('\n');

  const mine = TARGETS.filter((t) => t.mine).map((t) => `      <div class="chase">
        <span class="poschip" style="${posVars(t.pos)}">${t.pos}</span>
        <div class="chaseMain">
          <div class="chaseName">${t.kind === 'named' ? t.want : `${t.want} ${ROLE_NOUN[t.pos]}`}</div>
          <div class="chaseSub">${t.matched ? '<span class="chaseHot">Listed now &middot; €58m &middot; 2d 04h</span>' : t.vis === 'private' ? 'Only you' : t.vis === 'direct' ? `Only ${clubName(t.owner)}` : 'The league'}</div>
        </div>
        <div class="chaseFig">${t.budget ? `&euro;${t.budget}m` : ''}</div>
      </div>`).join('\n');

  const demand = demandByPosition();
  const top = Object.entries(demand).filter(([, d]) => d.n > 0).sort((a, b) => b[1].n - a[1].n);
  const max = Math.max(...top.map(([, d]) => d.n));
  const mySurplus = MY_SQUAD.filter((p) => p.surplus).map((p) => p.pos);
  const shortRows = top.map(([p, d]) => `        <div class="shortRow" style="${posVars(p)}">
          <span class="shortPos">${p}</span>
          <div class="barTrack${mySurplus.includes(p) ? ' shortMine' : ''}"><div class="bar" style="width:${Math.round((d.n / max) * 100)}%"></div></div>
          <span class="shortN">${d.n}</span>
        </div>`).join('\n');

  return `  <div class="wrap">
    <div>
      <div class="head">
        <h1 class="pageTitle">The Targets Board</h1>
        <div class="pageSub">Your squad, with the market for each man beside him. Green rows are players somebody has named.</div>
      </div>
      <div class="sect">
        <h2 class="sectT">Your Squad</h2>
        <span class="sectHint">2 of 6 have somebody asking</span>
      </div>
${men}
    </div>

    <div class="rail">
      <div class="railBlock">
        <div class="railHead">
          <h3 class="railT">Your Targets</h3>
          <span class="railN">3</span>
          <span class="railAdd">+ Add</span>
        </div>
${mine}
      </div>
      <div class="railBlock">
        <div class="railHead">
          <h3 class="railT">League Demand</h3>
        </div>
        <div class="short">
${shortRows}
        </div>
        <div class="chaseSub" style="margin-top:10px">Ringed bars are positions where you have a spare.</div>
      </div>
    </div>
  </div>`;
}
