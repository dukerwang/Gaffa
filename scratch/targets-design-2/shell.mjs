/* Topbar + sub-nav only. Each direction owns everything below it, because the
   masthead and the filter bar are part of what is being reconsidered. */
export const SHELL_CSS = `
  .topbar { background:var(--color-topbar); height:44px; display:flex; align-items:center;
            padding:0 var(--s6); gap:var(--s5); }
  .wordmark { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
              color:#fff; letter-spacing:-0.01em; }
  .topLink { font-size:var(--t-12); font-weight:600; color:rgba(255,255,255,.72); }
  .topLink.on { color:#fff; }
  .subnav { display:flex; align-items:stretch; gap:var(--s5); padding:0 var(--s6);
            height:40px; border-bottom:1px solid var(--color-border); }
  .snItem { display:flex; align-items:center; gap:var(--s1); font-size:var(--t-12);
            font-weight:600; color:var(--color-text-muted); white-space:nowrap; }
  .snItem.on { color:var(--color-text-primary); font-weight:700;
               box-shadow:inset 0 -2px 0 var(--color-text-primary); }
  .snCount { font-size:var(--t-10); font-weight:500;
             font-variant-numeric:tabular-nums lining-nums; color:var(--color-text-muted); }
  .snItem.on .snCount { color:var(--color-text-secondary); }

  .crest { width:24px; height:24px; border-radius:var(--r-round); flex-shrink:0;
           background:var(--color-topbar); color:#fff; display:inline-flex;
           align-items:center; justify-content:center; font-family:var(--font-condensed);
           font-weight:700; font-size:9px; letter-spacing:.02em; }
  .poschip { display:inline-flex; align-items:center; justify-content:center;
             font-weight:700; font-size:var(--t-10); letter-spacing:0.04em; line-height:1;
             padding:2px 5px; border-radius:var(--r-micro); flex-shrink:0;
             background:var(--pf); color:var(--pi); box-shadow:inset 0 0 0 1px var(--pl); }
  .namerow { display:flex; align-items:center; gap:var(--s2); min-width:0; }
  .namerow > .poschip { transform:translateY(-2.25px); }

  .pageTitle { font-family:var(--font-serif); font-weight:800; font-size:var(--t-32);
               letter-spacing:-0.035em; line-height:1; margin:0;
               color:var(--color-text-primary); }
  .pageSub { font-size:var(--t-13); color:var(--color-text-muted); margin-top:var(--s2); }
  .label { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-10);
           letter-spacing:.14em; text-transform:uppercase; color:var(--color-text-muted); }
`;

export const shell = `  <div class="topbar">
    <span class="wordmark">Gaffa</span>
    <span class="topLink">Home</span><span class="topLink">Matchups</span>
    <span class="topLink on">Transfers</span><span class="topLink">Players</span>
    <span class="topLink">Standings</span>
  </div>
  <nav class="subnav">
    <span class="snItem">Market</span>
    <span class="snItem">Auctions <span class="snCount">3</span></span>
    <span class="snItem">Listings <span class="snCount">9</span></span>
    <span class="snItem on">Targets <span class="snCount">14</span></span>
    <span class="snItem">Free Agents <span class="snCount">412</span></span>
    <span class="snItem">Deals <span class="snCount">2</span></span>
  </nav>`;
