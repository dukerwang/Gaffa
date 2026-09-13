/* Emits the Targets artboards. Shared CSS lives here once so the artboards
   cannot drift apart the way the last prototype's seven copies did.

   Two board layouts are drawn from the same data:
     Main.dc.html   sectioned rows — serif title over a 2px ink rule, flat rows
                    beneath, no boxes (UI_RULES 5)
     Table.dc.html  one flat table inside a bordered board (UI_RULES 6)

   A target is a SENTENCE, not an object — "Matchday Militia want Saliba, will
   pay cash, up to €62m" — which is why both layouts are rows. A card frames its subject as a thing you can
   take, which is a lie on another manager's player. */
import { writeFileSync } from 'node:fs';

/* ── Tokens, copied verbatim from src/app/globals.css ─────────────────── */
const TOKENS = `
    :root {
      --color-bg-primary:#F8F4EC; --color-bg-secondary:#EBE8E2; --color-bg-card:#FCFAF7;
      --color-bg-card-hover:#EEEBE5; --color-bg-card-alt:#F9F6F1; --color-bg-elevated:#EBE8E2;
      --color-bg-inset:#E2DFDA;
      --color-border:#C2BDB5; --color-border-subtle:#D9D5CF; --color-border-strong:#8C857A;
      --color-border-accent:rgba(12,109,62,0.40);
      --color-text-primary:#1B1915; --color-text-secondary:#49443B; --color-text-muted:#635D51;
      --color-topbar:#185B37;
      --color-accent:#0C6D3E; --color-accent-hover:#134F2E; --color-accent-dim:rgba(12,109,62,0.10);
      --color-accent-ink:#1F7144; --color-on-accent:#FFFFFF;
      --color-warning:#F0A726; --color-warning-text:#875A04; --color-gold:#805D00;
      --color-tint-accent:#E2EDE5;
      --color-pos-gk:#926500;  --color-pos-gk-on:#FFFFFF;  --color-pos-gk-line:#926500;
      --color-pos-cb:#0076B2;  --color-pos-cb-on:#FFFFFF;  --color-pos-cb-line:#0076B2;
      --color-pos-lb:#5667B9;  --color-pos-lb-on:#FFFFFF;  --color-pos-lb-line:#5667B9;
      --color-pos-am:#A34E71;  --color-pos-am-on:#FFFFFF;  --color-pos-am-line:#A34E71;
      --color-pos-st:#AD4C42;  --color-pos-st-on:#FFFFFF;  --color-pos-st-line:#AD4C42;
      --color-pos-cm:#915397;  --color-pos-cm-on:#FFFFFF;  --color-pos-cm-line:#915397;
      --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:20px; --s6:24px; --s8:32px;
      --s10:40px; --s12:48px;
      --t-10:10px; --t-11:11px; --t-12:12px; --t-13:13px; --t-15:15px; --t-17:17px;
      --t-20:20px; --t-25:25px; --t-32:32px;
      --r-shell:10px; --r-control:4px; --r-micro:2px; --r-round:50%; --r-pill:999px;
      --line:1px solid var(--color-border-subtle);
      --line-strong:1px solid var(--color-border);
      --font-serif:'Newsreader',Georgia,'Times New Roman',serif;
      --font-sans:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      --font-mono:'JetBrains Mono','Fira Code',ui-monospace,monospace;
      --font-condensed:'Archivo Narrow','Arial Narrow',sans-serif;
    }
    .dark {
      --color-bg-primary:#1B1F29; --color-bg-secondary:#242934; --color-bg-card:#272D39;
      --color-bg-card-hover:#313743; --color-bg-card-alt:#202530; --color-bg-elevated:#313743;
      --color-bg-inset:#131720;
      --color-border:#3F4552; --color-border-subtle:#2D333E; --color-border-strong:#707787;
      --color-border-accent:rgba(40,165,100,0.35);
      --color-text-primary:#EBE7E1; --color-text-secondary:#B5B0A7; --color-text-muted:#989389;
      --color-accent:#28A564; --color-accent-hover:#43C07A; --color-accent-dim:rgba(40,165,100,0.14);
      --color-accent-ink:#26A865; --color-on-accent:#1B1915;
      --color-warning:#F0A726; --color-warning-text:#BC8A3F; --color-gold:#B38E3B;
      --color-tint-accent:#26382C;
      --color-pos-gk-line:#B18331; --color-pos-cb-line:#4F8FCF; --color-pos-lb-line:#638AD3;
      --color-pos-am-line:#C5709A; --color-pos-st-line:#CD7167; --color-pos-cm-line:#A679C3;
      color:var(--color-text-primary);
    }`;

const CSS = `
    * { box-sizing:border-box; }
    body { margin:0; font-family:var(--font-sans); background:var(--color-bg-primary);
           color:var(--color-text-primary); -webkit-font-smoothing:antialiased; }
    a { color:var(--color-accent-ink); text-decoration:none; }
    a:hover { color:var(--color-accent); }
    button { font-family:inherit; cursor:pointer; }
    .screen { background:var(--color-bg-primary); min-height:100%; }

    /* TopBar + TransfersSubNav.module.css. The active marker is an ink
       underline, never the accent — the accent is money and actions. */
    .topbar { background:var(--color-topbar); height:44px; display:flex; align-items:center;
              padding:0 var(--s6); gap:var(--s5); }
    .wordmark { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
                color:#fff; letter-spacing:-0.01em; }
    .topLink { font-size:var(--t-12); font-weight:600; color:rgba(255,255,255,.72); }
    .topLink.on { color:#fff; }
    .subnav { display:flex; align-items:stretch; gap:var(--s5); padding:0 var(--s6);
              height:40px; border-bottom:1px solid var(--color-border); }
    .snItem { display:flex; align-items:center; gap:var(--s1); font-size:var(--t-12);
              font-weight:600; letter-spacing:0.01em; color:var(--color-text-muted);
              white-space:nowrap; }
    .snItem.on { color:var(--color-text-primary); font-weight:700;
                 box-shadow:inset 0 -2px 0 var(--color-text-primary); }
    /* Tabular, NOT mono: a section count changes when the market does, not
       while you look at it. TransfersSubNav.module.css says so in as many words. */
    .snCount { font-size:var(--t-10); font-weight:500;
               font-variant-numeric:tabular-nums lining-nums; color:var(--color-text-muted); }
    .snItem.on .snCount { color:var(--color-text-secondary); }

    /* listings.module.css .header/.stats — identical, because Listings and
       Targets are the same instrument pointed at opposite sides of the market. */
    .header { display:flex; justify-content:space-between; align-items:flex-end;
              gap:var(--s6); padding:var(--s4) var(--s6) var(--s3); flex-wrap:wrap; }
    .kicker { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-12);
              letter-spacing:0.16em; text-transform:uppercase; color:var(--color-text-muted); }
    .title { font-family:var(--font-serif); font-weight:800; font-size:var(--t-32);
             letter-spacing:-0.035em; line-height:1; margin:var(--s1) 0 0; }
    .stats { display:flex; gap:var(--s6); }
    .stat { text-align:right; }
    /* Settled figures: serif, tabular, compared down a column. Nothing in this
       masthead ticks — the clocks are on the listings next door. */
    .statValue { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
                 line-height:1; font-variant-numeric:tabular-nums lining-nums; }
    .statAccent { color:var(--color-accent-ink); }
    .statWarn { color:var(--color-warning-text); }
    .statLabel { font-family:var(--font-condensed); font-weight:500; font-size:var(--t-10);
                 letter-spacing:.05em; text-transform:uppercase; color:var(--color-text-muted);
                 margin-top:var(--s1); }

    .tools { padding:var(--s3) var(--s6); border-top:1px solid var(--color-border); }
    .searchRow { display:flex; gap:var(--s2); margin-bottom:var(--s2); flex-wrap:wrap; }
    .input { flex:1; min-width:200px; padding:var(--s2) var(--s3);
             border:1px solid var(--color-border-strong); border-radius:var(--r-control);
             background:var(--color-bg-card); font-family:var(--font-sans);
             font-size:var(--t-13); color:var(--color-text-muted); }
    .selects { display:contents; }
    .select { padding:var(--s2) var(--s3); border:1px solid var(--color-border-strong);
              border-radius:var(--r-control); background:var(--color-bg-card);
              font-size:var(--t-13); color:var(--color-text-secondary); }
    .cta { padding:var(--s2) var(--s3); border:1px solid var(--color-text-primary);
           border-radius:var(--r-control); background:var(--color-text-primary);
           color:var(--color-bg-primary); font-size:var(--t-13); font-weight:700;
           white-space:nowrap; }
    .facets { display:flex; gap:var(--s1); flex-wrap:wrap; }
    .facet { font-family:var(--font-condensed); font-size:var(--t-12); font-weight:700;
             letter-spacing:0.05em; text-transform:uppercase; padding:var(--s1) var(--s2);
             border-radius:var(--r-control); border:1px solid var(--color-border-subtle);
             background:var(--color-bg-card); white-space:nowrap; }
    .facetOn { color:var(--color-on-accent); }
    .facetCount { font-variant-numeric:tabular-nums lining-nums; font-weight:500;
                  opacity:.75; margin-left:var(--s1); }

    .board { padding:var(--s4) var(--s6) var(--s8); }

    /* ── Section: serif title over a 2px ink rule, flat rows beneath ─────
       _home/home.module.css .sect. Three headings, so you know why a row is
       in front of you before you read it. */
    .sect { display:flex; align-items:baseline; gap:var(--s3); padding-bottom:var(--s2);
            border-bottom:2px solid var(--color-text-primary); margin-bottom:var(--s2); }
    .sectT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
             letter-spacing:-0.02em; margin:0; }
    .sectHint { font-size:var(--t-12); color:var(--color-text-muted); }
    .sectMore { margin-left:auto; font-size:var(--t-12); font-weight:700;
                color:var(--color-accent-ink); }
    .sectGap { height:var(--s8); }

    /* ── The row ─────────────────────────────────────────────────────────
       club · what they want · terms · budget · what you can do. Column widths
       are shared by both layouts so the eye keeps its bearings between them. */
    .row { display:grid; grid-template-columns:180px minmax(0,1fr) 176px 84px 212px;
           align-items:center; gap:var(--s4); padding:var(--s3) var(--s2);
           border-bottom:var(--line); min-height:64px; }
    .rowLast { border-bottom:none; }
    /* Your own target, on a board of other clubs' — the accent as belonging,
       not action. */
    .rowMine { background:var(--color-accent-dim); }
    /* Both sides have spoken and the listing behind it is on a clock. Warm,
       the same wash a live lot takes next door. */
    .rowMatched { background:color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-primary)); }

    .who { display:flex; align-items:center; gap:var(--s3); min-width:0; }
    .crest { width:26px; height:26px; border-radius:var(--r-round); flex-shrink:0;
             background:var(--color-topbar); color:#fff; display:flex; align-items:center;
             justify-content:center; font-family:var(--font-condensed); font-weight:700;
             font-size:var(--t-10); }
    .clubName { font-size:var(--t-13); font-weight:600; white-space:nowrap;
                overflow:hidden; text-overflow:ellipsis; }

    .want { min-width:0; }
    /* .g-namerow: lift the chip; centred alone it sits ~2.4px low. */
    .nameRow { display:flex; align-items:center; gap:var(--s2); min-width:0; }
    .poschip { transform:translateY(-2.15px); display:inline-flex; align-items:center;
               justify-content:center; font-weight:700; font-size:var(--t-10);
               letter-spacing:0.04em; line-height:1; padding:2px 5px;
               border-radius:var(--r-micro); flex-shrink:0;
               background:var(--pos-field); color:var(--pos-ink);
               box-shadow:inset 0 0 0 1px var(--pos-line); }
    .wantName { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
                letter-spacing:-0.012em; line-height:1.1; white-space:nowrap;
                overflow:hidden; text-overflow:ellipsis; }
    .wantSub { font-size:var(--t-11); color:var(--color-text-muted); margin-top:2px;
               white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    /* Only the stacked layout shows this; on the wide row the columns carry it. */
    .stackOnly { display:none; }

    /* One chip stating what they're offering. Colour only where it means what
       it says elsewhere: the accent for cash. An absence is a dashed rule. */
    .gate { font-family:var(--font-condensed); font-size:var(--t-10); font-weight:700;
            letter-spacing:0.09em; text-transform:uppercase; padding:var(--s1) var(--s2);
            border-radius:var(--r-control); border:1px solid currentColor;
            white-space:nowrap; color:var(--color-text-secondary);
            display:inline-block; }
    .gateCash { color:var(--color-accent-ink); }
    .gateOpen { border-style:dashed; }
    .rowMine .gate, .rowMatched .gate { color:var(--color-text-primary); }

    .fig { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
           font-variant-numeric:tabular-nums lining-nums; text-align:right; }
    .figOff { color:var(--color-text-muted); font-weight:400; font-size:var(--t-13); }

    /* Two fixed tracks, so every secondary lines up down one column and every
       primary down the next, however many actions a row has. Labels stay short
       for the same reason ListingCard's do — Offer, Bid, List, Edit. */
    .act { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:var(--s1); }
    .btn { font-family:var(--font-condensed); font-size:var(--t-10); font-weight:700;
           letter-spacing:0.06em; text-transform:uppercase; padding:0 var(--s2);
           border-radius:var(--r-control); border:1px solid var(--color-border-strong);
           background:none; color:var(--color-text-primary); white-space:nowrap;
           height:34px; width:100%; }
    .btnPrimary { background:var(--color-accent); border-color:var(--color-accent);
                  color:var(--color-on-accent); }
    .btnQuiet { border-color:var(--color-border-subtle); color:var(--color-text-secondary); }

    /* Who can read a target. On your own rows this replaces the club name,
       which was your own club on every one of them; elsewhere it appears only
       when the answer isn't "the league", so a public board stays unmarked.
       One line, fixed width, no effect on row height. */
    .seen { display:flex; align-items:center; gap:var(--s2); min-width:0;
            color:var(--color-text-secondary); }
    .seenIcon { flex-shrink:0; display:flex; color:var(--color-text-muted); }
    .seenTx { font-size:var(--t-13); font-weight:600; white-space:nowrap;
              overflow:hidden; text-overflow:ellipsis; }
    .seenPrivate { color:var(--color-warning-text); }
    .seenPrivate .seenIcon { color:var(--color-warning-text); }

    /* The listing that answers a target, on the row that targeted him. Live
       money is mono, because a standing bid moves while you look at it. */
    .hit { display:flex; align-items:baseline; gap:var(--s2); margin-top:3px;
           font-size:var(--t-11); }
    .hitT { font-weight:700; color:var(--color-warning-text); }
    .hitBid { font-family:var(--font-mono); font-weight:700;
              color:var(--color-warning-text); font-variant-numeric:tabular-nums; }
    .hitClock { font-family:var(--font-mono); color:var(--color-text-muted);
                font-variant-numeric:tabular-nums; }

    /* ── Table layout only: one bounded board (UI_RULES 6) ──────────────── */
    .table { border:var(--line-strong); border-radius:var(--r-shell); overflow:hidden;
             background:var(--color-bg-card); }
    .colHead { display:grid; grid-template-columns:180px minmax(0,1fr) 176px 84px 212px;
               gap:var(--s4); padding:var(--s2) var(--s3);
               font-family:var(--font-condensed); font-size:var(--t-10); font-weight:700;
               letter-spacing:0.14em; text-transform:uppercase;
               color:var(--color-text-muted); background:var(--color-bg-elevated);
               border-bottom:var(--line-strong); }
    .table .row { padding:var(--s3); }
    .colRight { text-align:right; }`;

/* ── Chrome ───────────────────────────────────────────────────────────── */
const topbar = `  <div class="topbar">
    <span class="wordmark">Gaffa</span>
    <span class="topLink">Home</span><span class="topLink">Matchups</span>
    <span class="topLink on">Transfers</span><span class="topLink">Players</span>
    <span class="topLink">Standings</span>
  </div>`;

const subnav = `  <nav class="subnav">
    <span class="snItem">Market</span>
    <span class="snItem">Auctions <span class="snCount">3</span></span>
    <span class="snItem">Listings <span class="snCount">9</span></span>
    <span class="snItem on">Targets <span class="snCount">7</span></span>
    <span class="snItem">Free Agents <span class="snCount">412</span></span>
    <span class="snItem">Deals <span class="snCount">2</span></span>
  </nav>`;

const header = `  <header class="header">
    <div>
      <div class="kicker">Transfer Market &rarr; Targets</div>
      <h1 class="title">The Targets Board</h1>
    </div>
    <div class="stats">
      <div class="stat"><div class="statValue statAccent">&euro;164m</div>
        <div class="statLabel">Club Balance</div></div>
      <div class="stat"><div class="statValue statWarn">3</div>
        <div class="statLabel">Wanted from you</div></div>
      <div class="stat"><div class="statValue">4</div>
        <div class="statLabel">On the board</div></div>
      <div class="stat"><div class="statValue">3</div>
        <div class="statLabel">Yours</div></div>
    </div>
  </header>`;

const FACETS = [
  ['All', 10, 'var(--color-text-primary)'],
  ['Wanted from you', 3, 'var(--color-warning-text)'],
  ['Named', 5, 'var(--color-text-secondary)'],
  ['Roles', 5, 'var(--color-text-secondary)'],
  ['Will pay cash', 5, 'var(--color-accent-ink)'],
  ['Offering players', 4, 'var(--color-text-secondary)'],
  ['Takes loans', 1, 'var(--color-text-secondary)'],
  ['Yours', 3, 'var(--color-text-muted)'],
];

const facetBar = (activeIdx = 0) => `  <div class="tools">
    <div class="searchRow">
      <span class="input">Search targets by player, position or club&hellip;</span>
      <div class="selects">
        <span class="select">Any position</span>
        <span class="select">Any club</span>
        <span class="select">Newest first</span>
      </div>
      <button class="cta">Add Target</button>
    </div>
    <div class="facets">
${FACETS.map(([label, n, colour], i) => i === activeIdx
    ? `      <button class="facet facetOn" style="background:${colour};border-color:${colour}">${label} <span class="facetCount">${n}</span></button>`
    : `      <button class="facet" style="color:${colour}">${label} <span class="facetCount">${n}</span></button>`
  ).join('\n')}
    </div>
  </div>`;

/* ── Rows ─────────────────────────────────────────────────────────────── */
const POS = {
  GK: ['var(--color-pos-gk)', 'var(--color-pos-gk-on)', 'var(--color-pos-gk-line)'],
  CB: ['var(--color-pos-cb)', 'var(--color-pos-cb-on)', 'var(--color-pos-cb-line)'],
  LB: ['var(--color-pos-lb)', 'var(--color-pos-lb-on)', 'var(--color-pos-lb-line)'],
  AM: ['var(--color-pos-am)', 'var(--color-pos-am-on)', 'var(--color-pos-am-line)'],
  ST: ['var(--color-pos-st)', 'var(--color-pos-st-on)', 'var(--color-pos-st-line)'],
  CM: ['var(--color-pos-cm)', 'var(--color-pos-cm-on)', 'var(--color-pos-cm-line)'],
};
const posVars = (p) => {
  const [f, ink, line] = POS[p];
  return `--pos-field:${f};--pos-ink:${ink};--pos-line:${line}`;
};

const EYE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3 21 21"/><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.4 17.4 0 0 1-3.2 3.9M6.6 6.7A17.2 17.2 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.2-.9"/></svg>';

function row(o, last = false) {
  const cls = ['row', o.state, last ? 'rowLast' : ''].filter(Boolean).join(' ');
  const chip = `<span class="poschip" style="${posVars(o.pos)}">${o.pos}</span>`;
  const stackTerms = [o.stance, o.budget].filter(Boolean).join(' &middot; ');

  /* Column one. A target of your own always names its audience, because the
     club would be yours on every row. Anyone else's names the club, and only
     says who can read it when the answer is not the league. */
  const first = o.seen
    ? `<div class="seen${o.seenPrivate ? ' seenPrivate' : ''}" title="${o.seenTitle || ''}">
          <span class="seenIcon">${o.seenPrivate === 'you' ? EYE_OFF : EYE}</span>
          <span class="seenTx">${o.seen}</span>
        </div>`
    : `<div class="who"><span class="crest">${o.crest}</span><span class="clubName">${o.club}</span></div>`;

  /* Pad to two cells so the tracks line up whatever a row can offer. */
  const acts = o.actions || [];
  const cells = acts.length === 0 ? ''
    : (acts.length === 1 ? '<span></span>' : '') + acts.map(([label, kind]) =>
        `<button class="btn${kind ? ' ' + kind : ''}">${label}</button>`).join('');

  return `      <div class="${cls}">
        ${first}
        <div class="want">
          <div class="nameRow">${chip}<span class="wantName">${o.name}</span></div>
          <div class="wantSub">${[o.sub, o.expiry].filter(Boolean).join(' &middot; ')}</div>
          <div class="wantSub stackOnly">${stackTerms}</div>
${o.hit ? `          <div class="hit"><span class="hitT">${o.hit.title}</span><span class="hitBid">${o.hit.bid}</span><span class="hitClock">${o.hit.clock}</span></div>\n` : ''}        </div>
        <div>${o.stance ? `<span class="gate ${o.gate || ''}">${o.stance}</span>` : ''}</div>
        <div class="fig${o.budget ? '' : ' figOff'}">${o.budget || '&mdash;'}</div>
        <div class="act">${cells}</div>
      </div>`;
}

/* Sample content. You are Duke's Destroyers.
   Notes are a manager's own words or absent; nothing here is generated filler. */
/* Sample content. One rule decides which section a row lands in: can you
   answer it from your squad? If yes it sits under Wanted From You and carries
   buttons; if no it sits on the board and carries none. The section and the
   buttons never disagree.

   This squad has a spare left-back and a spare striker, and no spare
   centre-back or centre-mid — which is why Bot FC's two requests are
   answerable and Vardy Party's centre-back is not. */
const WANTED = [
  {
    crest: 'HU', club: 'Holloway Utd', pos: 'AM', name: 'C. Palmer',
    sub: 'Yours &middot; &euro;85m &middot; sent to you only',
    stance: 'Offering players', budget: '',
    actions: [['Offer'], ['List', 'btnPrimary']],
  },
  {
    crest: 'BF', club: 'Bot FC', pos: 'LB', name: 'Starting Left-Back',
    sub: 'Straight into the first eleven', stance: 'Will pay cash', gate: 'gateCash',
    budget: '&euro;25m',
    actions: [['Message', 'btnQuiet'], ['Offer', 'btnPrimary']],
  },
  {
    crest: 'BF', club: 'Bot FC', pos: 'ST', name: 'Striker Prospect',
    sub: 'Young, for the academy', stance: 'Offering players', budget: '',
    actions: [['Message', 'btnQuiet'], ['Offer', 'btnPrimary']],
  },
];

const BOARD = [
  {
    crest: 'MM', club: 'Matchday Militia', pos: 'CB', name: 'W. Saliba',
    sub: 'Vardy Party &middot; &euro;78m', stance: 'Will pay cash', gate: 'gateCash',
    budget: '&euro;62m',
  },
  {
    crest: 'VP', club: 'Vardy Party', pos: 'CB', name: 'Bench Centre-Back',
    sub: 'Depth and rotation', stance: 'Offering players', budget: '',
  },
  {
    crest: 'MM', club: 'Matchday Militia', pos: 'ST', name: 'A. Isak',
    sub: 'Holloway Utd &middot; &euro;92m', stance: 'Open to approaches', gate: 'gateOpen',
    budget: '',
  },
  {
    crest: 'HU', club: 'Holloway Utd', pos: 'CM', name: 'Star Centre-Mid',
    sub: 'A player the side is built around', stance: 'Will pay cash', gate: 'gateCash',
    budget: '&euro;70m',
  },
];

const MINE = [
  {
    seen: 'The league', seenTitle: 'Every club in the league can see this target',
    pos: 'CB', name: 'W. Saliba', sub: 'Vardy Party &middot; &euro;78m',
    stance: 'Will pay cash', gate: 'gateCash', budget: '&euro;62m', state: 'rowMatched',
    hit: { title: 'Vardy Party have listed him', bid: '&euro;58m', clock: '2d 04h' },
    actions: [['Edit', 'btnQuiet'], ['Bid', 'btnPrimary']],
  },
  {
    seen: 'Matchday Militia', seenPrivate: true,
    seenTitle: 'Only Matchday Militia can see this target',
    pos: 'GK', name: 'D. Raya', sub: '&euro;34m',
    stance: 'Would take him on loan', budget: '', expiry: '6 days left', state: 'rowMine',
    actions: [['Withdraw', 'btnQuiet'], ['Edit']],
  },
  {
    seen: 'You only', seenPrivate: 'you', seenTitle: 'Nobody else can see this target',
    pos: 'CM', name: 'Starting Centre-Mid', sub: 'Straight into the first eleven',
    stance: 'Will pay cash', gate: 'gateCash', budget: '', expiry: '21 days left',
    state: 'rowMine',
    actions: [['Withdraw', 'btnQuiet'], ['Edit']],
  },
];

const rows = (list) => list.map((r, i) => row(r, i === list.length - 1)).join('\n');

const section = (title, hint, list) => `    <div class="sect">
      <h2 class="sectT">${title}</h2>
      <span class="sectHint">${hint}</span>
    </div>
${rows(list)}`;

const sectioned = `  <div class="board">
${section('Wanted From You', 'Targets you can answer from your squad', WANTED)}
    <div class="sectGap"></div>
${section('The Board', 'What every other club is after', BOARD)}
    <div class="sectGap"></div>
${section('Your Targets', "Everything you're chasing", MINE)}
  </div>`;

const flatTable = `  <div class="board">
    <div class="table">
      <div class="colHead">
        <span>Who</span><span>Target</span><span>Terms</span>
        <span class="colRight">Budget</span><span></span>
      </div>
${rows([...WANTED, ...MINE, ...BOARD])}
    </div>
  </div>`;

/* ── Editor ───────────────────────────────────────────────────────────── */
const EDITOR_CSS = `
    .scrim { min-height:100%; display:flex; align-items:flex-start;
             justify-content:center; padding:var(--s6); background:var(--color-bg-secondary); }
    .modal { width:100%; max-width:520px; background:var(--color-bg-card);
             border:var(--line-strong); border-radius:var(--r-shell); overflow:hidden; }
    .modalHd { padding:var(--s4) var(--s5); border-bottom:var(--line); }
    .modalT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
              letter-spacing:-0.02em; margin:0; }
    .field { padding:var(--s4) var(--s5); border-bottom:var(--line); }
    .fieldL { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-10);
              letter-spacing:.14em; text-transform:uppercase; color:var(--color-text-muted);
              margin-bottom:var(--s2); }
    .fieldHint { font-size:var(--t-12); color:var(--color-text-muted); margin:var(--s2) 0 0;
                 line-height:1.4; }
    .seg { display:flex; border:1px solid var(--color-border-strong);
           border-radius:var(--r-control); overflow:hidden; }
    .segBtn { flex:1; padding:var(--s2) var(--s3); font-size:var(--t-13); font-weight:600;
              background:none; border:none; border-right:1px solid var(--color-border-strong);
              color:var(--color-text-secondary); min-height:38px; }
    .segBtn:last-child { border-right:none; }
    .segOn { background:var(--color-text-primary); color:var(--color-bg-primary);
             font-weight:700; }
    .posGrid { display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:var(--s1); }
    .posOpt { padding:var(--s2) 0; text-align:center; font-family:var(--font-condensed);
              font-weight:700; font-size:var(--t-12); letter-spacing:.04em;
              border:1px solid var(--color-border-subtle); border-radius:var(--r-control);
              background:var(--color-bg-card); color:var(--color-text-secondary);
              min-height:38px; }
    .posOptOn { background:var(--pos-field); color:var(--pos-ink);
                border-color:var(--pos-line); }
    /* The three visibilities as a ladder of exposure, each saying what
       actually happens rather than "public" / "private". */
    .optList { display:grid; gap:var(--s1); }
    .opt { display:flex; align-items:flex-start; gap:var(--s3); text-align:left;
           padding:var(--s3); border:1px solid var(--color-border-subtle);
           border-radius:var(--r-control); background:var(--color-bg-card);
           min-height:44px; }
    .optOn { border-color:var(--color-border-accent); background:var(--color-accent-dim); }
    .radio { width:16px; height:16px; border-radius:var(--r-round); flex-shrink:0;
             margin-top:2px; border:1px solid var(--color-border-strong);
             background:var(--color-bg-card); }
    .radioOn { border:5px solid var(--color-accent); background:var(--color-bg-card); }
    .optTx { min-width:0; }
    .optN { display:block; font-size:var(--t-13); font-weight:700;
            color:var(--color-text-primary); }
    .optH { display:block; font-size:var(--t-12); color:var(--color-text-muted);
            margin-top:2px; line-height:1.4; }
    .optOff { opacity:.45; }
    .roleN { font-size:var(--t-13); font-weight:700; min-width:76px; }
    .checks { display:grid; gap:var(--s2); }
    .check { display:flex; align-items:center; gap:var(--s3); font-size:var(--t-13);
             min-height:32px; }
    .box { width:18px; height:18px; border-radius:var(--r-micro); flex-shrink:0;
           border:1px solid var(--color-border-strong); background:var(--color-bg-card); }
    .boxOn { background:var(--color-accent); border-color:var(--color-accent);
             color:var(--color-on-accent); display:flex; align-items:center;
             justify-content:center; }
    .moneyIn { display:block; padding:var(--s2) var(--s3);
               border:1px solid var(--color-border-strong); border-radius:var(--r-control);
               background:var(--color-bg-card); font-family:var(--font-serif);
               font-weight:700; font-size:var(--t-17);
               font-variant-numeric:tabular-nums lining-nums; }
    .noteIn { display:block; min-height:60px; padding:var(--s2) var(--s3);
              border:1px solid var(--color-border-strong); border-radius:var(--r-control);
              background:var(--color-bg-card); font-family:var(--font-serif);
              font-size:var(--t-13); color:var(--color-text-muted); line-height:1.45; }
    .counter { font-family:var(--font-condensed); font-size:var(--t-10); font-weight:500;
               letter-spacing:.05em; text-transform:uppercase; color:var(--color-text-muted);
               text-align:right; margin-top:var(--s1); }
    .modalFt { display:flex; gap:var(--s2); justify-content:flex-end;
               padding:var(--s3) var(--s5); background:var(--color-bg-elevated); }
    .btnGhost { padding:var(--s2) var(--s4); border:1px solid var(--color-border-strong);
                border-radius:var(--r-control); background:none;
                color:var(--color-text-primary); font-size:var(--t-13); font-weight:600;
                min-height:38px; }
    .btnGo { padding:var(--s2) var(--s4); border:1px solid var(--color-accent);
             border-radius:var(--r-control); background:var(--color-accent);
             color:var(--color-on-accent); font-size:var(--t-13); font-weight:700;
             min-height:38px; }`;

const tick = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>';

const opt = (on, name, hint, off = false) => `        <button class="opt${on ? ' optOn' : ''}${off ? ' optOff' : ''}">
          <span class="radio${on ? ' radioOn' : ''}"></span>
          <span class="optTx"><span class="optN">${name}</span><span class="optH">${hint}</span></span>
        </button>`;

const editor = `<div class="scrim">
  <div class="modal">
    <div class="modalHd"><h2 class="modalT">Add a Target</h2></div>

    <div class="field">
      <div class="fieldL">What you're after</div>
      <div class="seg">
        <button class="segBtn segOn">A Specific Player</button>
        <button class="segBtn">A Position</button>
      </div>
    </div>

    <div class="field">
      <div class="fieldL">Player</div>
      <span class="moneyIn">C. Palmer &nbsp;<span style="font-family:var(--font-sans);font-size:var(--t-12);font-weight:400;color:var(--color-text-muted)">AM &middot; Chelsea &middot; Holloway Utd own him</span></span>
    </div>

    <div class="field">
      <div class="fieldL">Who gets told</div>
      <div class="optList">
${opt(false, 'Only You', 'Nobody sees this and nobody is told. You still get an alert when he becomes gettable.')}
${opt(true, 'Only Holloway Utd', "Only the club that owns him is told. Nobody else sees it.")}
${opt(false, 'Visible to the League', "Your club is named on the board beside him, and Holloway Utd are told.")}
      </div>
    </div>

    <div class="field">
      <div class="fieldL">What you'd give</div>
      <div class="checks">
        <label class="check"><span class="box boxOn">${tick}</span>Pay Cash</label>
        <label class="check"><span class="box"></span>Offer Players</label>
        <label class="check"><span class="box"></span>Take Him on Loan</label>
      </div>
    </div>

    <div class="field">
      <div class="fieldL">Budget</div>
      <span class="moneyIn">&euro;70m</span>
      <p class="fieldHint">Optional. Other clubs read it as a starting point, not a limit.</p>
    </div>

    <div class="field">
      <div class="fieldL">Note</div>
      <span class="noteIn">Optional. What you'd move to get him, or when you need him by.</span>
      <div class="counter">140 left</div>
    </div>

    <div class="modalFt">
      <button class="btnGhost">Cancel</button>
      <button class="btnGo">Post Target</button>
    </div>
  </div>
</div>`;

/* A role target has no owner, so the middle rung has nobody to tell. */
const editorRole = `<div class="scrim">
  <div class="modal">
    <div class="modalHd"><h2 class="modalT">Add a Target</h2></div>

    <div class="field">
      <div class="fieldL">What you're after</div>
      <div class="seg">
        <button class="segBtn">A Specific Player</button>
        <button class="segBtn segOn">A Position</button>
      </div>
    </div>

    <div class="field">
      <div class="fieldL">Position</div>
      <div class="posGrid">
${['GK','CB','LB','RB','LWB','RWB','DM','CM','AM','LW','RW','ST'].map((x) => x === 'LB'
    ? `        <button class="posOpt posOptOn" style="${posVars('LB')}">LB</button>`
    : `        <button class="posOpt">${x}</button>`).join('\n')}
      </div>
    </div>

    <div class="field">
      <div class="fieldL">Level</div>
      <div class="optList">
${opt(false, 'Star', 'A player the side is built around')}
${opt(true, 'Starter', 'Straight into the first eleven')}
${opt(false, 'Bench', 'Depth and rotation')}
${opt(false, 'Prospect', 'Young, for the academy')}
      </div>
      <p class="fieldHint">Say whether you want a first-choice player or squad depth.</p>
    </div>

    <div class="field">
      <div class="fieldL">Who gets told</div>
      <div class="optList">
${opt(false, 'Only You', 'Nobody sees this. You still get an alert when a left-back becomes gettable.')}
${opt(true, 'Visible to the League', "Your club is named on the board beside it.")}
      </div>
      <p class="fieldHint">A position has no owner, so you can't approach anybody privately. Name a player to get that option.</p>
    </div>

    <div class="modalFt">
      <button class="btnGhost">Cancel</button>
      <button class="btnGo">Post Target</button>
    </div>
  </div>
</div>`;

/* ── Mobile ───────────────────────────────────────────────────────────── */
const MOBILE_CSS = `
    @media (max-width: 900px) {
      .header { padding:var(--s4) var(--s4) var(--s3); align-items:flex-start;
                flex-direction:column; gap:var(--s4); }
      .title { font-size:var(--t-25); }
      .stats { gap:var(--s5); width:100%; }
      .stat { text-align:left; }
      .tools { padding:var(--s3) var(--s4); }
      .searchRow { display:grid; grid-template-columns:repeat(3, minmax(0,1fr));
                   gap:var(--s2); }
      .input { grid-column:1 / -1; min-width:0; }
      .cta   { grid-column:1 / -1; }
      .input, .select, .cta { min-height:44px; display:flex; align-items:center; }
      .select { justify-content:center; text-align:center; }
      .cta { justify-content:center; }
      .facets { overflow-x:auto; flex-wrap:nowrap; padding-bottom:var(--s1); }
      .board { padding:var(--s4) var(--s4) var(--s8); }
      .sect { flex-direction:column; align-items:flex-start; gap:2px; }
      /* The five columns crush each other below the full width, so the row
         stacks instead: club above the target, terms folded into the sub-line,
         actions on their own line. */
      .colHead { display:none; }
      .row { grid-template-columns:minmax(0,1fr); gap:var(--s2); padding:var(--s3) 0; }
      .row > div:nth-child(3), .row > div:nth-child(4) { display:none; }
      .stackOnly { display:block; }
      .act { justify-content:stretch; }
      .btn { flex:1; min-height:44px; }
    }`;

/* ── The Listings side of the join ────────────────────────────────────── */
const LISTING_CSS = `
    .lcard { background:var(--color-bg-card); border:1px solid var(--color-border-subtle);
             border-radius:var(--r-shell); overflow:hidden; display:flex;
             flex-direction:column; --card-ink:var(--color-text-muted); }
    .ltop { display:flex; gap:var(--s3); padding:var(--s3); }
    .portrait { width:66px; height:78px; flex-shrink:0; border-radius:var(--r-control);
                background:var(--color-bg-inset); border:1px solid var(--color-border-subtle);
                display:flex; align-items:flex-end; justify-content:center; overflow:hidden; }
    .sil { width:42px; height:50px; border-radius:21px 21px 4px 4px;
           background:var(--color-border); opacity:.5; }
    .lid { flex:1; min-width:0; }
    .lmeta { font-size:var(--t-11); color:var(--card-ink); margin-top:var(--s1); }
    .lterms { display:flex; align-items:center; gap:var(--s2); padding:var(--s2) var(--s3);
              border-top:1px solid var(--color-border-subtle); }
    .lfig { margin-left:auto; font-family:var(--font-serif); font-weight:700;
            font-size:var(--t-15); font-variant-numeric:tabular-nums lining-nums; }
    /* The demand line a listing gains: who is asking. The single most useful
       thing this feature produces for a seller. */
    .demand { padding:var(--s2) var(--s3); border-top:1px solid var(--color-border-subtle);
              background:var(--color-bg-card-alt); font-size:var(--t-12);
              font-weight:700; color:var(--color-text-primary); }
    .demandS { display:block; font-size:var(--t-11); font-weight:400;
               color:var(--card-ink); margin-top:2px; }
    .lact { display:flex; margin-top:auto; border-top:1px solid var(--color-border-subtle);
            background:var(--color-bg-elevated); }
    .lbtn { flex:1; text-align:center; padding:var(--s2) var(--s1);
            font-family:var(--font-condensed); font-size:var(--t-10); font-weight:700;
            letter-spacing:0.06em; text-transform:uppercase;
            color:var(--color-text-secondary); background:none; border:none;
            border-right:1px solid var(--color-border-subtle); }
    .lbtn:last-child { border-right:none; }
    .lbtnGo { background:var(--color-accent); color:var(--color-on-accent); }
    .lgrid { display:grid; grid-template-columns:repeat(2, minmax(0,290px));
             gap:var(--s3); padding:var(--s6); }`;

const listingSide = `<div class="screen">
  <div class="lgrid">
    <article class="lcard">
      <div class="ltop">
        <div class="portrait"><div class="sil"></div></div>
        <div class="lid">
          <div class="nameRow"><span class="poschip" style="${posVars('CB')}">CB</span><span class="wantName">W. Saliba</span></div>
          <div class="lmeta">&euro;78m &middot; Vardy Party</div>
        </div>
        <div class="crest">VP</div>
      </div>
      <div class="lterms">
        <span class="gate gateCash">For sale &middot; &euro;70m</span>
        <span class="lfig">&euro;55m</span>
      </div>
      <div class="demand">Matchday Militia want him
        <span class="demandS">They'll pay cash, up to &euro;62m</span></div>
      <div class="lact">
        <button class="lbtn">Offer</button>
        <button class="lbtn lbtnGo">Bid</button>
      </div>
    </article>

    <article class="lcard">
      <div class="ltop">
        <div class="portrait"><div class="sil"></div></div>
        <div class="lid">
          <div class="nameRow"><span class="poschip" style="${posVars('LB')}">LB</span><span class="wantName">M. Kerkez</span></div>
          <div class="lmeta">&euro;41m &middot; Yours</div>
        </div>
        <div class="crest">DD</div>
      </div>
      <div class="lterms">
        <span class="gate gateOpen">Open to approaches</span>
      </div>
      <div class="demand">3 clubs are looking for a left-back
        <span class="demandS">One will pay cash, two are offering players</span></div>
      <div class="lact">
        <button class="lbtn lbtnGo">No offers yet</button>
        <button class="lbtn">Edit listing</button>
      </div>
    </article>
  </div>
</div>`;

/* ── File assembly ────────────────────────────────────────────────────── */
const FONTS = `  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700;6..72,800&family=Hanken+Grotesk:wght@400;500;600;700&family=Archivo+Narrow:wght@500;700&family=JetBrains+Mono:wght@400;700&display=swap">`;

function dc(body, extraCss = '') {
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
${CSS}${extraCss}
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
}

const screen = (inner, dark = false) => `<div class="screen${dark ? ' dark' : ''}">
${topbar}
${subnav}
${header}
${facetBar(0)}
${inner}
</div>`;

writeFileSync('Main.dc.html', dc(screen(sectioned)));
writeFileSync('Table.dc.html', dc(screen(flatTable)));
writeFileSync('Dark.dc.html', dc(screen(sectioned, true)));
writeFileSync('Editor.dc.html', dc(editor, EDITOR_CSS));
writeFileSync('EditorRole.dc.html', dc(editorRole, EDITOR_CSS));
writeFileSync('Mobile.dc.html', dc(screen(sectioned), MOBILE_CSS));
writeFileSync('Listings.dc.html', dc(listingSide, LISTING_CSS));
console.log('wrote 7 artboards');
