/* The page furniture around the board — topbar, sub-nav, masthead, tools.
   Identical in all three directions on purpose: the thing being chosen is the
   BOARD, and changing the chrome underneath it would rig the comparison.

   Ported from the real components: TransfersSubNav.module.css,
   listings.module.css (.header/.stats/.tools/.facet). */

export const CHROME_CSS = `
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
  /* Tabular, never mono: a section count changes when the market does, not
     while you look at it. */
  .snCount { font-size:var(--t-10); font-weight:500;
             font-variant-numeric:tabular-nums lining-nums; color:var(--color-text-muted); }
  .snItem.on .snCount { color:var(--color-text-secondary); }

  .header { display:flex; justify-content:space-between; align-items:flex-end;
            gap:var(--s6); padding:var(--s5) var(--s6) var(--s4); flex-wrap:wrap; }
  .crumb { font-family:var(--font-condensed); font-weight:600; font-size:var(--t-11);
           letter-spacing:0.14em; text-transform:uppercase; color:var(--color-text-muted); }
  .title { font-family:var(--font-serif); font-weight:800; font-size:var(--t-32);
           letter-spacing:-0.035em; line-height:1; margin:var(--s1) 0 0;
           color:var(--color-text-primary); }
  .stats { display:flex; gap:var(--s6); }
  .stat { text-align:right; }
  .statValue { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
               line-height:1; font-variant-numeric:tabular-nums lining-nums;
               color:var(--color-text-primary); }
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
  .facetCount { font-variant-numeric:tabular-nums lining-nums; font-weight:500;
                opacity:.75; margin-left:var(--s1); }

  /* The crest disc stands in for <CrestBadge>. */
  .crest { width:26px; height:26px; border-radius:var(--r-round); flex-shrink:0;
           background:var(--color-topbar); color:#fff; display:flex; align-items:center;
           justify-content:center; font-family:var(--font-condensed); font-weight:700;
           font-size:var(--t-10); letter-spacing:.02em; }

  /* One rule paints all twelve positions; the hue arrives as inline props. */
  .poschip { display:inline-flex; align-items:center; justify-content:center;
             font-weight:700; font-size:var(--t-10); letter-spacing:0.04em; line-height:1;
             padding:2px 5px; border-radius:var(--r-micro); flex-shrink:0;
             background:var(--pf); color:var(--pi); box-shadow:inset 0 0 0 1px var(--pl); }
  /* .g-namerow: a chip beside a name sits ~2.25px low when only centred. */
  .namerow { display:flex; align-items:center; gap:var(--s2); min-width:0; }
  .namerow > .poschip { transform:translateY(-2.25px); }
`;

const FACETS = [
  ['All', 10, 'var(--color-text-primary)', true],
  ['Wanted from you', 3, 'var(--color-warning-text)', false],
  ['Named', 5, 'var(--color-text-secondary)', false],
  ['Roles', 5, 'var(--color-text-secondary)', false],
  ['Will pay cash', 5, 'var(--color-accent-ink)', false],
  ['Offering players', 4, 'var(--color-text-secondary)', false],
  ['Takes loans', 1, 'var(--color-text-secondary)', false],
  ['Yours', 3, 'var(--color-text-muted)', false],
];

export const chrome = `  <div class="topbar">
    <span class="wordmark">Gaffa</span>
    <span class="topLink">Home</span><span class="topLink">Matchups</span>
    <span class="topLink on">Transfers</span><span class="topLink">Players</span>
    <span class="topLink">Standings</span>
  </div>
  <nav class="subnav">
    <span class="snItem">Market</span>
    <span class="snItem">Auctions <span class="snCount">3</span></span>
    <span class="snItem">Listings <span class="snCount">9</span></span>
    <span class="snItem on">Targets <span class="snCount">7</span></span>
    <span class="snItem">Free Agents <span class="snCount">412</span></span>
    <span class="snItem">Deals <span class="snCount">2</span></span>
  </nav>
  <header class="header">
    <div>
      <div class="crumb">Transfer Market &rarr; Targets</div>
      <h1 class="title">The Targets Board</h1>
    </div>
    <div class="stats">
      <div class="stat"><div class="statValue statAccent">&euro;164m</div>
        <div class="statLabel">Club Balance</div></div>
      <div class="stat"><div class="statValue statWarn">3</div>
        <div class="statLabel">Wanted from you</div></div>
      <div class="stat"><div class="statValue">7</div>
        <div class="statLabel">On the board</div></div>
      <div class="stat"><div class="statValue">3</div>
        <div class="statLabel">Yours</div></div>
    </div>
  </header>
  <div class="tools">
    <div class="searchRow">
      <span class="input">Search targets by player, position or club&hellip;</span>
      <span class="select">Any position</span>
      <span class="select">Any club</span>
      <span class="select">Newest first</span>
      <button class="cta">+ Add Target</button>
    </div>
    <div class="facets">
${FACETS.map(([label, n, colour, on]) => on
    ? `      <button class="facet" style="background:${colour};border-color:${colour};color:var(--color-on-accent)">${label} <span class="facetCount">${n}</span></button>`
    : `      <button class="facet" style="color:${colour}">${label} <span class="facetCount">${n}</span></button>`
  ).join('\n')}
    </div>
  </div>`;
