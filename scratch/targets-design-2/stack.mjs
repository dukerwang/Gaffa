import { posVars } from './tokens.mjs';
import { TARGETS, clubName, ROLE_NOUN } from './data2.mjs';

/* ══════════════════════════════════════════════════════════════
   STACK — grouped by what is WANTED, not by who wants it.

   The shipped board's unit is the advert, so a player two clubs
   are chasing appears twice and neither row knows about the
   other. Here the unit is the thing being chased: one entry per
   player or position, with its suitors underneath and its
   budgets as a range. Seventeen adverts collapse to nine
   entries, sorted by heat, and a bidding war is visible as a
   bidding war rather than as two rows that happen to rhyme.

   Anything of yours sorts to the top, because that is the only
   part you can act on today.
   ══════════════════════════════════════════════════════════════ */

export const STACK_CSS = `
  .wrap { padding:var(--s6) var(--s8) var(--s10); max-width:1000px; }
  .head { margin-bottom:var(--s6); }

  .entry { padding:var(--s4) 0; border-bottom:1px solid var(--color-border-subtle);
           display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--s5);
           align-items:start; }
  .entryTop { padding-top:var(--s5); }

  .subject { display:flex; align-items:center; gap:var(--s3); min-width:0; }
  /* The heat number IS the hierarchy: how many clubs want this. Serif, large,
     and the first thing your eye lands on down the left edge. */
  .heat { font-family:var(--font-serif); font-weight:800; font-size:var(--t-32);
          line-height:.9; letter-spacing:-0.04em; width:44px; flex-shrink:0;
          text-align:right; color:var(--color-text-primary);
          font-variant-numeric:tabular-nums lining-nums; }
  .heat1 { color:var(--color-text-muted); font-weight:400; }
  .subjMain { min-width:0; }
  .subjName { font-family:var(--font-serif); font-weight:700; font-size:var(--t-25);
              letter-spacing:-0.025em; line-height:1.1; color:var(--color-text-primary); }
  .subjMeta { font-size:var(--t-12); color:var(--color-text-muted); margin-top:3px; }

  /* Yours: the accent as belonging. Paired with a bolder name so the state
     survives a colour-blind reader and a hover. */
  .yours { background:var(--color-accent-dim); margin:0 calc(var(--s4) * -1);
           padding-left:var(--s4); padding-right:var(--s4); }
  .flag { display:inline-flex; align-items:center; gap:5px;
          font-family:var(--font-condensed); font-weight:700; font-size:var(--t-10);
          letter-spacing:.08em; text-transform:uppercase; color:var(--color-accent-ink); }

  .suitors { display:flex; flex-wrap:wrap; gap:var(--s2); margin-top:var(--s3);
             margin-left:calc(44px + var(--s3)); }
  .suitor { display:inline-flex; align-items:center; gap:6px; padding:4px var(--s2) 4px 4px;
            border-radius:var(--r-pill); background:var(--color-bg-card);
            border:1px solid var(--color-border-subtle); font-size:var(--t-12);
            color:var(--color-text-secondary); white-space:nowrap; }
  .suitorFig { font-family:var(--font-serif); font-weight:700;
               font-variant-numeric:tabular-nums; color:var(--color-accent-ink); }
  .suitorNone { color:var(--color-text-muted); font-size:var(--t-11); }

  .side { text-align:right; display:grid; gap:var(--s2); justify-items:end; }
  .range { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
           font-variant-numeric:tabular-nums lining-nums; color:var(--color-text-primary);
           white-space:nowrap; }
  .rangeL { font-family:var(--font-condensed); font-weight:600; font-size:var(--t-10);
            letter-spacing:.10em; text-transform:uppercase; color:var(--color-text-muted); }
  .acts { display:flex; gap:var(--s1); }
  .btn { font-family:var(--font-condensed); font-size:var(--t-10); font-weight:700;
         letter-spacing:.06em; text-transform:uppercase; padding:0 var(--s3); height:32px;
         border-radius:var(--r-control); border:1px solid var(--color-border-strong);
         background:none; color:var(--color-text-primary); white-space:nowrap; }
  .btnGo { background:var(--color-accent); border-color:var(--color-accent);
           color:var(--color-on-accent); }
  .btnQuiet { border-color:var(--color-border-subtle); color:var(--color-text-muted); }
  .hot { font-size:var(--t-11); color:var(--color-warning-text); font-weight:700; }
  .hotBid { font-family:var(--font-mono); font-variant-numeric:tabular-nums; }
  .divider { display:flex; align-items:baseline; gap:var(--s3); margin:var(--s8) 0 0;
             padding-bottom:var(--s2); border-bottom:2px solid var(--color-text-primary); }
  .dividerT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
              letter-spacing:-0.02em; margin:0; color:var(--color-text-primary); }
  .dividerH { margin-left:auto; font-size:var(--t-12); color:var(--color-text-muted); }
`;

const TONE = { cash:'cash', players:'players', loan:'loan', open:'open' };

/** Collapse seventeen adverts into one entry per thing wanted. */
function group() {
  const map = new Map();
  for (const t of TARGETS) {
    if (t.mine) continue;
    const key = t.kind === 'named' ? `p:${t.want}` : `r:${t.pos}`;
    if (!map.has(key)) {
      map.set(key, {
        kind: t.kind, pos: t.pos, name: t.want, owner: t.owner, value: t.value,
        suitors: [],
      });
    }
    map.get(key).suitors.push(t);
  }
  return [...map.values()].sort((a, b) => b.suitors.length - a.suitors.length);
}

const MINE_PLAYERS = ['C. Palmer', 'M. Kerkez'];

function entry(g, top = false) {
  const n = g.suitors.length;
  const budgets = g.suitors.map((s) => s.budget).filter(Boolean);
  const isMine = g.kind === 'named' && MINE_PLAYERS.includes(g.name);

  const title = g.kind === 'named' ? g.name
    : `${g.suitors[0].want} ${ROLE_NOUN[g.pos]}`.replace(/^./, (c) => c.toUpperCase());

  const meta = g.kind === 'named'
    ? (isMine ? `Yours &middot; valued &euro;${g.value}m` : `${clubName(g.owner)} &middot; &euro;${g.value}m`)
    : g.suitors.map((s) => s.want.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).join(' / ') + ' level';

  const suitors = g.suitors.map((s) => `        <span class="suitor"><span class="crest">${s.club}</span>${clubName(s.club)}${s.budget ? ` <span class="suitorFig">&euro;${s.budget}m</span>` : ` <span class="suitorNone">${TONE[s.tone]}</span>`}</span>`).join('\n');

  const range = budgets.length === 0 ? null
    : budgets.length === 1 || Math.min(...budgets) === Math.max(...budgets)
      ? `&euro;${budgets[0]}m`
      : `&euro;${Math.min(...budgets)}m&ndash;&euro;${Math.max(...budgets)}m`;

  const acts = isMine
    ? '<button class="btn">Offer</button><button class="btn btnGo">List him</button>'
    : g.pos === 'LB' || g.pos === 'ST'
      ? '<button class="btn btnQuiet">Message</button><button class="btn btnGo">Offer</button>'
      : '';

  return `      <div class="entry${isMine ? ' yours' : ''}${top ? ' entryTop' : ''}">
        <div>
          <div class="subject">
            <span class="heat${n === 1 ? ' heat1' : ''}">${n}</span>
            <div class="subjMain">
              <div class="namerow" style="${posVars(g.pos)}"><span class="poschip">${g.pos}</span><span class="subjName">${title}</span></div>
              <div class="subjMeta">${meta}${isMine ? ' &middot; <span class="flag">They came to you</span>' : ''}</div>
            </div>
          </div>
          <div class="suitors">
${suitors}
          </div>
        </div>
        <div class="side">
${range ? `          <div><div class="rangeL">${budgets.length > 1 ? 'Budgets' : 'Budget'}</div><div class="range">${range}</div></div>\n` : ''}${acts ? `          <div class="acts">${acts}</div>\n` : ''}        </div>
      </div>`;
}

export function stackBoard() {
  const groups = group();
  const mine = groups.filter((g) => g.kind === 'named' && MINE_PLAYERS.includes(g.name));
  const rest = groups.filter((g) => !(g.kind === 'named' && MINE_PLAYERS.includes(g.name)));

  return `  <div class="wrap">
    <div class="head">
      <h1 class="pageTitle">The Targets Board</h1>
      <div class="pageSub">17 targets, gathered into 9 things people actually want. Read the figure on the left as how many clubs chase that one.</div>
    </div>

    <div class="divider">
      <h2 class="dividerT">Approaches</h2>
      <span class="dividerH">Players of yours somebody has named</span>
    </div>
${mine.map((g, i) => entry(g, i === 0)).join('\n')}

    <div class="divider">
      <h2 class="dividerT">Open Demand</h2>
      <span class="dividerH">Most wanted first</span>
    </div>
${rest.map((g, i) => entry(g, i === 0)).join('\n')}
  </div>`;
}
