/* The Targets page.

   HEADER. A working bar, not the 2.0 masthead. Duke on that pattern,
   2026-09-10: "it seems a ton of pages in gaffa have this generic html header
   and then a bunch of numbers on the right. gaffa should feel like a real app,
   not some html page." So the page names itself at control scale inside the
   bar, the counts ride on the segments, and the totals sit in a divided strip
   along the bar's foot. Every control is 34px, so they sit on one line. Values
   lifted from activity/transactions.module.css.

   GRAMMAR. Flat rows on hairlines under a serif title and a 2px ink rule
   (UI_RULES 5). The bar is the one bounded object — border, never shadow
   (rule 7).

   HIERARCHY. The target leads. A transfer starts with who somebody wants, not
   with which club is asking, so the player or the role takes column one and
   the inquiring club follows it. */

export const CSS = `
  * { box-sizing:border-box; }
  body { margin:0; font-family:var(--font-sans); background:var(--color-bg-primary);
         color:var(--color-text-primary); -webkit-font-smoothing:antialiased; }
  button { font-family:inherit; cursor:pointer; }
  a { color:var(--color-accent-ink); text-decoration:none; }
  .screen { background:var(--color-bg-primary); min-height:100%; }
  .page { max-width:1180px; margin:0 auto; padding:var(--s6) var(--s6) var(--s12); }

  /* ── Chrome above the page ──────────────────────────── */
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

  /* ── The working bar ────────────────────────────────── */
  .bar { border:1px solid var(--color-border); border-radius:var(--r-shell);
         background:var(--color-bg-card); overflow:hidden; }
  .barTop { display:flex; align-items:center; gap:var(--s3); padding:var(--s2) var(--s3); }

  /* A name at control scale, not a heading. */
  .barName { flex:none; display:inline-flex; align-items:center; height:34px; margin:0;
             font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
             letter-spacing:-0.02em; line-height:1; color:var(--color-text-primary); }
  .barDiv { flex:none; width:1px; height:20px; background:var(--color-border-subtle);
            margin:0 2px; }

  .segs { display:inline-flex; box-sizing:border-box; height:34px; padding:3px; gap:3px;
          background:var(--color-bg-elevated); border:1px solid var(--color-border-subtle);
          border-radius:var(--r-control); }
  .seg, .segOn { display:inline-flex; align-items:baseline; gap:6px; white-space:nowrap;
                 box-sizing:border-box; height:26px; padding:6px var(--s3); line-height:14px;
                 border:1px solid transparent; border-radius:var(--r-control);
                 font-family:var(--font-sans); font-size:var(--t-12); font-weight:600;
                 background:none; color:var(--color-text-secondary); }
  .segOn { background:var(--color-text-primary); color:var(--color-bg-primary); }
  /* A count belongs to its filter, so it inherits the segment's ink. */
  .segN { font-family:var(--font-condensed); font-size:var(--t-11); font-weight:500;
          letter-spacing:.03em; font-variant-numeric:tabular-nums lining-nums; opacity:.62; }

  .spacer { flex:1; }

  .search { display:inline-flex; align-items:center; gap:7px; flex:none; width:212px;
            box-sizing:border-box; height:34px; padding:0 var(--s3);
            border:1px solid var(--color-border); border-radius:var(--r-control);
            background:var(--color-bg-card); color:var(--color-text-muted);
            font-size:var(--t-12); }

  /* Button primitive, size="sm"/"md" — src/components/ui/Button.module.css. */
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:var(--s2);
         border-radius:var(--r-control); font-family:var(--font-condensed); font-weight:600;
         letter-spacing:.02em; white-space:nowrap; border:1px solid transparent;
         font-size:var(--t-12); line-height:1.25; min-height:28px; padding:var(--s1) var(--s3); }
  .btnMd { font-size:var(--t-13); line-height:1.3; min-height:34px; padding:var(--s2) var(--s4); }
  .btnPrimary { background:var(--color-accent); color:var(--color-text-inverse);
                border-color:var(--color-accent); }
  .btnSecondary { background:var(--color-bg-card); color:var(--color-text-primary);
                  border-color:var(--color-border); }
  .btnGhost { background:none; color:var(--color-text-secondary); border-color:transparent; }

  /* The page's shape, divided off rather than floated in space. */
  .barRead { display:flex; align-items:baseline; gap:7px; flex-wrap:wrap;
             padding:var(--s2) 13px; border-top:1px solid var(--color-border-subtle);
             background:var(--color-bg-card-alt); font-size:var(--t-12);
             color:var(--color-text-muted); line-height:1.5; }
  .readV { font-family:var(--font-serif); font-size:var(--t-13); font-weight:700;
           letter-spacing:-0.01em; color:var(--color-text-primary);
           font-variant-numeric:tabular-nums lining-nums; }
  .readWarn { color:var(--color-warning-text); }
  .readDot { color:var(--color-border); }

  /* ── Sections ───────────────────────────────────────── */
  .sect { display:flex; align-items:baseline; gap:var(--s3); padding-bottom:var(--s2);
          border-bottom:2px solid var(--color-text-primary); margin:var(--s8) 0 0; }
  .sectFirst { margin-top:var(--s6); }
  .sectT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
           letter-spacing:-0.02em; margin:0; color:var(--color-text-primary); }
  .sectN { font-family:var(--font-condensed); font-size:var(--t-11); font-weight:500;
           letter-spacing:.06em; color:var(--color-text-muted);
           font-variant-numeric:tabular-nums lining-nums; }
  .sectHint { margin-left:auto; font-size:var(--t-12); color:var(--color-text-muted); }

  /* ── Rows ───────────────────────────────────────────── */
  .row { display:grid; grid-template-columns:minmax(0,1fr) 180px 220px 160px;
         align-items:center; gap:var(--s4); padding:13px var(--s2);
         border-bottom:1px solid var(--color-border-subtle); }

  .target { min-width:0; }
  .tName { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
           line-height:1.25; letter-spacing:-0.012em; color:var(--color-text-primary); }
  /* The name carries the serif line; the button is only a target. */
  .tBtn { appearance:none; border:0; padding:0; background:none; font:inherit; color:inherit;
          cursor:pointer; text-align:left; }
  /* The badge sits on the sentence's baseline, so the position reads as part of
     the name. Inline, so it cannot use .g-namerow — that device wants a flex row. */
  .posMark { display:inline-flex; vertical-align:baseline; position:relative; top:-1px;
             margin:0 7px 0 0; }
  .poschip { display:inline-flex; align-items:center; justify-content:center; font-weight:700;
             font-size:var(--t-10); letter-spacing:.04em; line-height:1; padding:2px 5px;
             border-radius:var(--r-micro); background:var(--pf); color:var(--pi);
             box-shadow:inset 0 0 0 1px var(--pl); }
  .tMeta { font-size:var(--t-12); color:var(--color-text-muted); margin-top:var(--s1);
           line-height:1.4; }
  .tMine { color:var(--color-accent-ink); font-weight:600; }

  /* ── Column 2: who is asking ────────────────────────── */
  .club { display:flex; align-items:center; gap:var(--s2); min-width:0; }
  .crest { width:22px; height:22px; border-radius:var(--r-round); flex-shrink:0;
           background:var(--color-topbar); color:#fff; display:inline-flex;
           align-items:center; justify-content:center; font-family:var(--font-condensed);
           font-weight:700; font-size:9px; }
  .clubName { font-size:var(--t-13); font-weight:600; color:var(--color-text-primary);
              white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .scope { font-size:var(--t-11); color:var(--color-text-muted); margin-top:2px;
           padding-left:30px; }
  .scopeWarn { color:var(--color-warning-text); }
  /* On your own rows the audience replaces your club name, which would read the
     same on every one of them. */
  .audience { display:flex; align-items:center; gap:7px; font-size:var(--t-13);
              font-weight:600; color:var(--color-text-secondary); }
  .audIcon { display:flex; flex-shrink:0; color:var(--color-text-muted); }
  .audClosed { color:var(--color-warning-text); }
  .audClosed .audIcon { color:var(--color-warning-text); }

  /* ── Column 3: terms ────────────────────────────────── */
  .terms { display:flex; align-items:center; gap:var(--s3); min-width:0; }
  .gate { font-family:var(--font-condensed); font-size:var(--t-10); font-weight:700;
          letter-spacing:.09em; text-transform:uppercase; padding:3px var(--s2);
          border-radius:var(--r-control); border:1px solid var(--color-border-strong);
          color:var(--color-text-secondary); white-space:nowrap; }
  .gateCash { border-color:var(--color-accent-ink); color:var(--color-accent-ink); }
  .gateOpen { border-style:dashed; color:var(--color-text-muted); }
  .fig { margin-left:auto; font-family:var(--font-serif); font-weight:700;
         font-size:var(--t-17); font-variant-numeric:tabular-nums lining-nums;
         color:var(--color-text-primary); white-space:nowrap; }
  .figOff { color:var(--color-text-muted); font-weight:400; font-size:var(--t-15); }

  /* ── Column 4: actions ──────────────────────────────── */
  /* Flex, not a two-slot grid: a row with one action shows one button, and a row
     with none shows nothing rather than a reserved void. */
  .acts { display:flex; gap:var(--s2); justify-content:flex-end; }

  /* ── The live match ─────────────────────────────────── */
  /* A player you targeted has reached the market and a clock is running on him.
     Border plus tint, not tint alone — a wash by itself disappears for anyone
     who cannot separate it from the ground, and this is the one row on the page
     that expires. */
  .rowLive { background:var(--color-tint-accent); border:1px solid var(--color-border-accent);
             border-radius:var(--r-control); padding:13px var(--s3); margin:var(--s1) 0; }
  .live { display:inline-flex; align-items:center; gap:7px; margin-top:7px;
          font-size:var(--t-12); color:var(--color-text-primary); }
  .liveDot { width:7px; height:7px; border-radius:var(--r-round);
             background:var(--color-live); flex-shrink:0; }
  .liveL { font-weight:600; }
  /* Mono for the standing bid and the clock: both move while you look at them. */
  .liveV { font-family:var(--font-mono); font-weight:700; font-size:var(--t-12);
           font-variant-numeric:tabular-nums; color:var(--color-text-primary); }
  .liveClock { font-family:var(--font-mono); font-size:var(--t-11);
               font-variant-numeric:tabular-nums; color:var(--color-warning-text); }

  .empty { padding:var(--s10) var(--s2); text-align:center; font-size:var(--t-13);
           color:var(--color-text-muted); }
`;
