import { posVars } from './tokens.mjs';
import { demandByPosition, clubName, MY_SURPLUS, ROLE_NOUN, POSITIONS } from './data2.mjs';

/* ══════════════════════════════════════════════════════════════
   DEMAND MAP — the market as a pitch.

   A list can tell you what nine clubs are asking for. It cannot
   tell you WHERE the league is short, and that is the question
   that decides whether your spare left-back is worth anything
   this week. Gaffa already thinks in twelve tactical positions
   and already owns a pitch; this puts demand on it.

   Node size and fill are the number of clubs asking. The accent
   ring means you hold somebody who plays there — the whole page
   in one glance is "everyone needs centre-backs and you have
   nothing; three clubs need a left-back and you have Kerkez."
   ══════════════════════════════════════════════════════════════ */

/* Tactical coordinates, attacking upward. Percentages of the pitch box. */
const SPOT = {
  GK:[50,90], CB:[50,75], LB:[15,73], RB:[85,73], LWB:[13,56], RWB:[87,56],
  DM:[50,60], CM:[50,45], AM:[50,30], LW:[16,29], RW:[84,29], ST:[50,13],
};

export const MAP_CSS = `
  .wrap { display:grid; grid-template-columns:640px minmax(0,1fr); gap:var(--s8);
          padding:var(--s6) var(--s8) var(--s10); align-items:start; }
  .head { display:flex; align-items:flex-end; justify-content:space-between;
          gap:var(--s6); margin-bottom:var(--s5); }

  /* The pitch. Green is the ground here, not a control — the one place in the
     app where a field colour means a field. */
  .pitch { position:relative; width:640px; height:640px; border-radius:var(--r-shell);
           background:
             linear-gradient(180deg, rgba(12,109,62,.10), rgba(12,109,62,.16));
           border:1px solid var(--color-border); overflow:hidden; }
  .dark .pitch { background:linear-gradient(180deg, rgba(40,165,100,.09), rgba(40,165,100,.15)); }
  .mark { position:absolute; border:1px solid var(--color-border-accent); opacity:.5; }
  .halfway { left:0; right:0; top:50%; height:0; border-width:1px 0 0; }
  .circle { left:50%; top:50%; width:132px; height:132px; margin:-66px 0 0 -66px;
            border-radius:var(--r-round); }
  .boxTop { left:50%; top:0; width:300px; height:104px; margin-left:-150px;
            border-width:0 1px 1px; }
  .boxBot { left:50%; bottom:0; width:300px; height:104px; margin-left:-150px;
            border-width:1px 1px 0; }

  .node { position:absolute; transform:translate(-50%,-50%); display:flex;
          flex-direction:column; align-items:center; gap:3px; }
  .disc { display:flex; flex-direction:column; align-items:center; justify-content:center;
          border-radius:var(--r-round); background:var(--color-bg-card);
          box-shadow:inset 0 0 0 2px var(--pl); color:var(--color-text-primary); }
  /* Demand is the fill: the more clubs asking, the more solid the disc. */
  .d1 { width:46px; height:46px; background:color-mix(in srgb, var(--pf) 16%, var(--color-bg-card)); }
  .d2 { width:58px; height:58px; background:color-mix(in srgb, var(--pf) 34%, var(--color-bg-card)); }
  .d3 { width:70px; height:70px; background:var(--pf); color:var(--pi); box-shadow:none; }
  .d0 { width:30px; height:30px; background:none;
        box-shadow:inset 0 0 0 1.5px var(--color-border); opacity:.55; }
  .discN { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
           line-height:1; font-variant-numeric:tabular-nums lining-nums; }
  .d1 .discN { font-size:var(--t-17); }
  .discBudget { font-family:var(--font-condensed); font-weight:600; font-size:9px;
                letter-spacing:.04em; opacity:.85; margin-top:1px; }
  .nodeLabel { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-11);
               letter-spacing:.08em; color:var(--color-text-secondary); }
  .d0 + .nodeLabel { color:var(--color-text-muted); opacity:.7; }

  /* You hold somebody who plays here. Accent as belonging, never as a button. */
  .yours { position:absolute; inset:-7px; border-radius:var(--r-round);
           border:2px solid var(--color-accent); }
  .yoursTag { position:absolute; left:50%; bottom:-9px; transform:translateX(-50%);
              background:var(--color-accent); color:var(--color-on-accent);
              font-family:var(--font-condensed); font-weight:700; font-size:9px;
              letter-spacing:.08em; text-transform:uppercase; padding:1px 5px;
              border-radius:var(--r-control); white-space:nowrap; }
  .sel .disc { box-shadow:0 0 0 3px var(--color-text-primary); }

  .legend { display:flex; gap:var(--s5); margin-top:var(--s4); align-items:center;
            font-size:var(--t-11); color:var(--color-text-muted); }
  .legKey { display:flex; align-items:center; gap:var(--s2); }
  .legDot { width:14px; height:14px; border-radius:var(--r-round);
            background:var(--color-text-muted); opacity:.3; }
  .legDot.mid { opacity:.55; } .legDot.hot { opacity:1; }
  .legRing { width:14px; height:14px; border-radius:var(--r-round);
             border:2px solid var(--color-accent); }

  /* ── Detail rail ── */
  .rail { position:sticky; top:var(--s4); }
  .railHead { padding-bottom:var(--s3); border-bottom:2px solid var(--color-text-primary);
              margin-bottom:var(--s3); }
  .railT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-25);
           letter-spacing:-0.025em; margin:var(--s1) 0 0; color:var(--color-text-primary); }
  .railMeta { font-size:var(--t-12); color:var(--color-text-muted); margin-top:var(--s2); }

  .offer { display:flex; align-items:center; gap:var(--s3); padding:var(--s3);
           background:var(--color-tint-accent); border-radius:var(--r-control);
           margin-bottom:var(--s4); }
  .offerTx { flex:1; min-width:0; font-size:var(--t-13); color:var(--color-text-primary); }
  .offerTx strong { font-family:var(--font-serif); font-size:var(--t-15); }
  .go { font-family:var(--font-condensed); font-size:var(--t-11); font-weight:700;
        letter-spacing:.06em; text-transform:uppercase; padding:0 var(--s3); height:34px;
        border-radius:var(--r-control); border:1px solid var(--color-accent);
        background:var(--color-accent); color:var(--color-on-accent); white-space:nowrap; }

  .bidder { display:flex; align-items:center; gap:var(--s3); padding:var(--s3) 0;
            border-bottom:1px solid var(--color-border-subtle); }
  .bidderMain { flex:1; min-width:0; }
  .bidderClub { font-size:var(--t-13); font-weight:600; color:var(--color-text-primary); }
  .bidderWant { font-size:var(--t-11); color:var(--color-text-muted); margin-top:2px; }
  .bidderFig { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
               font-variant-numeric:tabular-nums lining-nums;
               color:var(--color-text-primary); }
  .bidderFig.cash { color:var(--color-accent-ink); }
  .bidderFig.none { font-family:var(--font-condensed); font-size:var(--t-11);
                    font-weight:600; letter-spacing:.04em; text-transform:uppercase;
                    color:var(--color-text-muted); }
`;

const TONE = { cash:'will pay cash', players:'offering players', loan:'would take a loan', open:'open to approaches' };

export function mapBoard() {
  const demand = demandByPosition();
  const selected = 'LB';
  const sel = demand[selected];

  const nodes = POSITIONS.map((p) => {
    const d = demand[p];
    const [x, y] = SPOT[p];
    const tier = d.n === 0 ? 'd0' : d.n === 1 ? 'd1' : d.n === 2 ? 'd2' : 'd3';
    const maxB = d.budgets.length ? Math.max(...d.budgets) : null;
    const yours = MY_SURPLUS.includes(p);
    return `      <div class="node${p === selected ? ' sel' : ''}" style="left:${x}%;top:${y}%;${posVars(p)}">
        <div class="disc ${tier}">
${d.n ? `          <span class="discN">${d.n}</span>${maxB ? `<span class="discBudget">&euro;${maxB}m</span>` : ''}\n` : ''}          ${yours ? '<span class="yours"></span><span class="yoursTag">You have one</span>' : ''}
        </div>
        <span class="nodeLabel">${p}</span>
      </div>`;
  }).join('\n');

  const bidders = sel.rows.map((t) => `      <div class="bidder">
        <span class="crest">${t.club}</span>
        <div class="bidderMain">
          <div class="bidderClub">${clubName(t.club)}</div>
          <div class="bidderWant">${t.kind === 'named' ? `wants ${t.want}` : `${t.want.toLowerCase()} ${ROLE_NOUN[t.pos]}`} &middot; ${TONE[t.tone]}</div>
        </div>
        <div class="bidderFig ${t.budget ? (t.tone === 'cash' ? 'cash' : '') : 'none'}">${t.budget ? `&euro;${t.budget}m` : 'no budget'}</div>
      </div>`).join('\n');

  const range = sel.budgets.length
    ? `&euro;${Math.min(...sel.budgets)}m&ndash;&euro;${Math.max(...sel.budgets)}m on the table`
    : 'no budgets stated';

  return `  <div class="wrap">
    <div>
      <div class="head">
        <div>
          <h1 class="pageTitle">The Targets Board</h1>
          <div class="pageSub">14 live targets across 8 clubs. Positions ringed in green are ones where you hold a spare.</div>
        </div>
      </div>
      <div class="pitch">
        <div class="mark halfway"></div>
        <div class="mark circle"></div>
        <div class="mark boxTop"></div>
        <div class="mark boxBot"></div>
${nodes}
      </div>
      <div class="legend">
        <span class="legKey"><span class="legDot"></span>1 club</span>
        <span class="legKey"><span class="legDot mid"></span>2 clubs</span>
        <span class="legKey"><span class="legDot hot"></span>3+ clubs</span>
        <span class="legKey"><span class="legRing"></span>you hold one</span>
        <span style="margin-left:auto">Each figure is the biggest budget any club stated at that position.</span>
      </div>
    </div>

    <div class="rail">
      <div class="railHead">
        <h2 class="railT">Left-Back</h2>
        <div class="railMeta">Three clubs. ${range}.</div>
      </div>
      <div class="offer">
        <span class="poschip" style="${posVars('LB')}">LB</span>
        <div class="offerTx">You have <strong>M. Kerkez</strong> &mdash; valued &euro;41m, and out of your first eleven.</div>
        <button class="go">Offer him</button>
      </div>
${bidders}
    </div>
  </div>`;
}
