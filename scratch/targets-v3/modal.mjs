import { posVars } from './tokens.mjs';

/* Add a Target — the ResponsiveModal primitive (520px desktop panel, bottom
   drawer under 640px). Elevation declared once: shadow, no border. */

export const MODAL_CSS = `
  .scrim { min-height:100%; display:flex; align-items:flex-start; justify-content:center;
           padding:var(--s6); background:var(--color-bg-secondary); }
  .panel { background:var(--color-bg-primary); border-radius:var(--r-shell); overflow:hidden;
           box-shadow:var(--shadow-xl); width:100%; max-width:520px; }
  .mHead { display:flex; align-items:center; gap:var(--s3); padding:var(--s3) var(--s5);
           border-bottom:1px solid var(--color-border); background:var(--color-bg-card); }
  .mTitle { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
            letter-spacing:-0.02em; color:var(--color-text-primary); margin:0; }
  .mBody { padding:0; }
  .field { padding:var(--s4) var(--s5); border-bottom:1px solid var(--color-border-subtle); }
  .fLabel { display:block; font-family:var(--font-condensed); font-weight:700;
            font-size:var(--t-10); letter-spacing:.14em; text-transform:uppercase;
            color:var(--color-text-muted); margin-bottom:var(--s2); }
  .fHint { font-size:var(--t-12); color:var(--color-text-muted); margin:var(--s2) 0 0;
           line-height:1.45; }

  .mSegs { display:flex; height:34px; padding:3px; gap:3px; background:var(--color-bg-elevated);
           border:1px solid var(--color-border-subtle); border-radius:var(--r-control); }
  .mSeg, .mSegOn { flex:1; display:inline-flex; align-items:center; justify-content:center;
                   height:26px; border:1px solid transparent; border-radius:var(--r-control);
                   font-family:var(--font-sans); font-size:var(--t-12); font-weight:600;
                   background:none; color:var(--color-text-secondary); }
  .mSegOn { background:var(--color-text-primary); color:var(--color-bg-primary); }

  .picker { display:flex; align-items:center; gap:7px; height:34px; padding:0 var(--s3);
            border:1px solid var(--color-border); border-radius:var(--r-control);
            background:var(--color-bg-card); font-size:var(--t-12);
            color:var(--color-text-muted); }
  .picked { display:flex; align-items:center; gap:var(--s2); margin-top:var(--s2);
            padding:var(--s2) var(--s3); background:var(--color-bg-card-alt);
            border-radius:var(--r-control); }
  .pickedName { font-family:var(--font-serif); font-weight:700; font-size:var(--t-15);
                color:var(--color-text-primary); }
  .pickedMeta { font-size:var(--t-11); color:var(--color-text-muted); margin-left:auto; }

  .posGrid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:var(--s1); }
  .posOpt { height:34px; display:flex; align-items:center; justify-content:center;
            font-family:var(--font-condensed); font-weight:700; font-size:var(--t-12);
            letter-spacing:.04em; border:1px solid var(--color-border-subtle);
            border-radius:var(--r-control); background:var(--color-bg-card);
            color:var(--color-text-secondary); }
  .posOptOn { background:var(--pf); color:var(--pi); border-color:var(--pl); }

  .levels { display:flex; gap:var(--s1); margin-top:var(--s2); }
  .level { flex:1; height:34px; display:flex; align-items:center; justify-content:center;
           font-family:var(--font-sans); font-size:var(--t-12); font-weight:600;
           border:1px solid var(--color-border-subtle); border-radius:var(--r-control);
           background:var(--color-bg-card); color:var(--color-text-secondary); }
  .levelOn { border-color:var(--color-border-strong); color:var(--color-text-primary);
             background:var(--color-bg-elevated); }

  /* The audience ladder: three rungs in order of exposure, each saying what
     happens rather than "public" or "private". */
  .ladder { display:grid; gap:var(--s1); }
  .rung { display:flex; align-items:flex-start; gap:var(--s3); text-align:left;
          padding:var(--s3); border:1px solid var(--color-border-subtle);
          border-radius:var(--r-control); background:var(--color-bg-card); min-height:44px; }
  .rungOn { border-color:var(--color-border-accent); background:var(--color-accent-dim); }
  .radio { width:16px; height:16px; border-radius:var(--r-round); flex-shrink:0; margin-top:2px;
           border:1px solid var(--color-border-strong); background:var(--color-bg-card); }
  .radioOn { border:5px solid var(--color-accent); }
  .rungN { display:block; font-size:var(--t-13); font-weight:700;
           color:var(--color-text-primary); }
  .rungH { display:block; font-size:var(--t-12); color:var(--color-text-muted); margin-top:2px;
           line-height:1.45; }

  .pills { display:flex; gap:var(--s2); flex-wrap:wrap; }
  .pill { display:inline-flex; align-items:center; gap:7px; height:34px; padding:0 var(--s3);
          border:1px solid var(--color-border-subtle); border-radius:var(--r-control);
          background:var(--color-bg-card); font-size:var(--t-13); font-weight:600;
          color:var(--color-text-secondary); }
  .pillOn { border-color:var(--color-accent); color:var(--color-accent-ink);
            background:var(--color-accent-dim); }
  .box { width:15px; height:15px; border-radius:var(--r-micro); flex-shrink:0;
         border:1px solid var(--color-border-strong); display:flex; align-items:center;
         justify-content:center; color:transparent; }
  .boxOn { background:var(--color-accent); border-color:var(--color-accent);
           color:var(--color-text-inverse); }

  .money { display:flex; align-items:center; height:38px; padding:0 var(--s3);
           border:1px solid var(--color-border); border-radius:var(--r-control);
           background:var(--color-bg-card); font-family:var(--font-serif); font-weight:700;
           font-size:var(--t-17); font-variant-numeric:tabular-nums lining-nums;
           color:var(--color-text-primary); }
  .note { display:block; min-height:58px; padding:var(--s2) var(--s3);
          border:1px solid var(--color-border); border-radius:var(--r-control);
          background:var(--color-bg-card); font-family:var(--font-serif);
          font-size:var(--t-13); color:var(--color-text-muted); line-height:1.45; }
  .counter { font-family:var(--font-condensed); font-size:var(--t-10); font-weight:500;
             letter-spacing:.05em; text-transform:uppercase; color:var(--color-text-muted);
             text-align:right; margin-top:var(--s1); }

  .mFoot { display:flex; gap:var(--s2); justify-content:flex-end; padding:var(--s3) var(--s5);
           background:var(--color-bg-card); border-top:1px solid var(--color-border); }
`;

const TICK = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>';
const SEARCH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

const rung = (on, name, hint) => `          <button class="rung${on ? ' rungOn' : ''}">
            <span class="radio${on ? ' radioOn' : ''}"></span>
            <span><span class="rungN">${name}</span><span class="rungH">${hint}</span></span>
          </button>`;

export const modal = `  <div class="scrim">
    <div class="panel">
      <div class="mHead"><h2 class="mTitle">Add a Target</h2></div>
      <div class="mBody">

        <div class="field">
          <span class="fLabel">What you&rsquo;re after</span>
          <div class="mSegs">
            <button class="mSegOn">A Specific Player</button>
            <button class="mSeg">A Tactical Position</button>
          </div>
        </div>

        <div class="field">
          <span class="fLabel">Player</span>
          <span class="picker">${SEARCH}Search by player, club or manager&hellip;</span>
          <div class="picked">
            <span class="poschip" style="${posVars('AM')}">AM</span>
            <span class="pickedName">C. Palmer</span>
            <span class="pickedMeta">Chelsea &middot; &euro;85m &middot; Holloway Utd own him</span>
          </div>
        </div>

        <div class="field">
          <span class="fLabel">Who gets told</span>
          <div class="ladder">
${rung(false, 'Only You', 'Nobody sees this and nobody is told. You still get an alert when he reaches the market.')}
${rung(true, 'Only Holloway Utd', 'A discreet approach. Only the club that owns him is told, and nobody else sees it.')}
${rung(false, 'Visible to the League', 'Your club is named on the board beside him, and Holloway Utd are told.')}
          </div>
        </div>

        <div class="field">
          <span class="fLabel">What you&rsquo;d give</span>
          <div class="pills">
            <span class="pill pillOn"><span class="box boxOn">${TICK}</span>Pay Cash</span>
            <span class="pill"><span class="box"></span>Offer Players</span>
            <span class="pill"><span class="box"></span>Take on Loan</span>
          </div>
          <p class="fHint">Tick everything you&rsquo;d consider, or nothing at all. Both read as open to whatever somebody brings you.</p>
        </div>

        <div class="field">
          <span class="fLabel">Budget</span>
          <span class="money">&euro;90m</span>
          <p class="fHint">Optional. Other clubs read it as a starting point, not a limit. Your Club Balance is &euro;164m.</p>
        </div>

        <div class="field">
          <span class="fLabel">Note</span>
          <span class="note">Optional. What you&rsquo;d move to get him, or when you need him by.</span>
          <div class="counter">140 left</div>
        </div>
      </div>
      <div class="mFoot">
        <button class="btn btnMd btnSecondary">Cancel</button>
        <button class="btn btnMd btnPrimary">Post Target</button>
      </div>
    </div>
  </div>`;

/* The same dialog as a bottom drawer, which is what the primitive becomes
   under 640px: rounded top corners only, full width, safe-area foot. */
export const MOBILE_MODAL_CSS = `
  @media (max-width:640px) {
    .scrim { align-items:flex-end; padding:0; }
    .panel { max-width:none; border-radius:var(--r-shell) var(--r-shell) 0 0;
             max-height:92dvh; }
    .mFoot { padding-bottom:calc(var(--s3) + env(safe-area-inset-bottom)); }
    .mFoot .btn { flex:1; min-height:44px; }
    .posOpt, .level, .pill, .picker, .money { min-height:44px; }
  }
`;
