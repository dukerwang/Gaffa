import { posVars } from './tokens.mjs';
import { SECTIONS } from './data.mjs';

const money = (n) => (n == null ? null : `&euro;${n}m`);

const EYE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3 21 21"/><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.4 17.4 0 0 1-3.2 3.9M6.6 6.7A17.2 17.2 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.2-.9"/></svg>';
const ARROW = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M12 5l7 7-7 7"/></svg>';

const chip = (p, cls = 'poschip') =>
  `<span class="${cls}" style="${posVars(p)}">${p}</span>`;

const who = (r) => r.seen
  ? `<div class="seen ${r.seenKind}"><span class="seenIcon">${r.seenKind === 'private' ? EYE_OFF : EYE}</span><span class="seenTx">${r.seen}</span></div>`
  : `<div class="whoBox"><span class="crest">${r.crest}</span><span class="clubName">${r.club}</span></div>`;

const acts = (r, btn = 'btn') => {
  const list = r.acts || [];
  if (list.length === 0) return '';
  return list.map(([label, kind]) =>
    `<button class="${btn}${kind ? ' ' + btn + kind[0].toUpperCase() + kind.slice(1) : ''}">${label}</button>`
  ).join('');
};

/* ══════════════════════════════════════════════════════════════
   1. MATCHBOARD — the deliverable candidate.

   Two changes carry it. First, terms and budget are ONE column
   read as a figure with its label above, the way the masthead
   stats already read — which removes the column of em-dashes the
   five-column version printed on every target with no budget
   stated. Second, an answerable row NAMES THE PLAYER OF YOURS
   THAT ANSWERS IT. The app already computes that set to decide
   which section a row belongs in; printing it turns the row from
   an advertisement into half a deal, and it is the one thing on
   this page nobody else's transfer board can tell you.
   ══════════════════════════════════════════════════════════════ */
export const MATCHBOARD_CSS = `
  .board { padding:var(--s5) var(--s6) var(--s10); }
  .sect { display:flex; align-items:baseline; gap:var(--s3); padding-bottom:var(--s2);
          border-bottom:2px solid var(--color-text-primary); margin-bottom:var(--s1); }
  .sectT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
           letter-spacing:-0.02em; margin:0; color:var(--color-text-primary); }
  /* The count gives the heading a job beyond announcing itself. */
  .sectN { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-12);
           font-variant-numeric:tabular-nums lining-nums; color:var(--color-text-muted); }
  .sectHint { margin-left:auto; font-size:var(--t-12); color:var(--color-text-muted); }
  .sectGap { height:var(--s8); }

  .row { display:grid; grid-template-columns:184px minmax(0,1fr) 168px 208px;
         align-items:center; gap:var(--s4); padding:var(--s3) var(--s2);
         border-bottom:1px solid var(--color-border-subtle); min-height:72px; }
  .rowLast { border-bottom:none; }
  .rowMine { background:var(--color-accent-dim); }
  .rowMatched { background:color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-primary)); }

  .whoBox { display:flex; align-items:center; gap:var(--s3); min-width:0; }
  .clubName { font-size:var(--t-13); font-weight:600; color:var(--color-text-primary);
              white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .seen { display:flex; align-items:center; gap:var(--s2); min-width:0;
          color:var(--color-text-secondary); }
  .seenIcon { flex-shrink:0; display:flex; color:var(--color-text-muted); }
  .seenTx { font-size:var(--t-13); font-weight:600; white-space:nowrap;
            overflow:hidden; text-overflow:ellipsis; }
  .seen.direct, .seen.private { color:var(--color-warning-text); }
  .seen.direct .seenIcon, .seen.private .seenIcon { color:var(--color-warning-text); }

  .want { min-width:0; }
  .wantName { font-family:var(--font-serif); font-weight:700; font-size:var(--t-17);
              letter-spacing:-0.012em; line-height:1.1; color:var(--color-text-primary);
              white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .wantSub { font-size:var(--t-11); color:var(--color-text-muted); margin-top:3px;
             white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  /* The answer line. Accent as BELONGING — this is your player — never as a
     control; nothing here is pressable because it is green. */
  .answer { display:flex; align-items:center; gap:var(--s1); margin-top:5px;
            font-size:var(--t-11); color:var(--color-accent-ink); font-weight:600; }
  .answer .mini { transform:translateY(-1.5px); }
  .answerArrow { display:flex; opacity:.7; }

  .hit { display:flex; align-items:baseline; gap:var(--s2); margin-top:4px;
         font-size:var(--t-11); }
  .hitT { font-weight:700; color:var(--color-warning-text); }
  /* Mono only here: a standing bid is the one number on this page that moves
     while you look at it. */
  .hitBid { font-family:var(--font-mono); font-weight:700; color:var(--color-warning-text);
            font-variant-numeric:tabular-nums; }
  .hitClock { font-family:var(--font-mono); color:var(--color-text-muted);
              font-variant-numeric:tabular-nums; }

  /* Terms as a figure with its label, right-aligned so budgets compare down a
     column. No budget simply means no figure — never an em-dash placeholder. */
  .terms { text-align:right; }
  .termsL { font-family:var(--font-condensed); font-weight:600; font-size:var(--t-10);
            letter-spacing:.10em; text-transform:uppercase; color:var(--color-text-muted);
            white-space:nowrap; }
  .termsCash .termsL { color:var(--color-accent-ink); }
  .termsFig { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
              line-height:1.05; margin-top:2px; color:var(--color-text-primary);
              font-variant-numeric:tabular-nums lining-nums; }
  .rowMine .termsL, .rowMatched .termsL { color:var(--color-text-secondary); }

  .act { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:var(--s1); }
  .btn { font-family:var(--font-condensed); font-size:var(--t-10); font-weight:700;
         letter-spacing:0.06em; text-transform:uppercase; padding:0 var(--s2);
         border-radius:var(--r-control); border:1px solid var(--color-border-strong);
         background:none; color:var(--color-text-primary); white-space:nowrap;
         height:34px; width:100%; }
  .btnPrimary { background:var(--color-accent); border-color:var(--color-accent);
                color:var(--color-on-accent); }
  .btnQuiet { border-color:var(--color-border-subtle); color:var(--color-text-secondary); }
  .mini { display:inline-flex; align-items:center; justify-content:center; font-weight:700;
          font-size:9px; letter-spacing:0.04em; line-height:1; padding:2px 4px;
          border-radius:var(--r-micro); background:var(--pf); color:var(--pi);
          box-shadow:inset 0 0 0 1px var(--pl); }
`;

function matchRow(r, last) {
  const cls = ['row', r.state === 'matched' ? 'rowMatched' : r.state === 'mine' ? 'rowMine' : '', last ? 'rowLast' : '']
    .filter(Boolean).join(' ');
  const sub = [r.sub, r.direct ? 'sent to you only' : null, r.expiry].filter(Boolean).join(' &middot; ');
  const fig = money(r.budget);
  return `      <div class="${cls}">
        ${who(r)}
        <div class="want">
          <div class="namerow">${chip(r.pos)}<span class="wantName">${r.name}</span></div>
          ${sub ? `<div class="wantSub">${sub}</div>` : ''}
${r.answer ? `          <div class="answer"><span class="answerArrow">${ARROW}</span>You have <strong>${r.answer.name}</strong> ${chip(r.answer.pos, 'mini')}</div>\n` : ''}${r.hit ? `          <div class="hit"><span class="hitT">${r.hit.title}</span><span class="hitBid">${r.hit.bid}</span><span class="hitClock">${r.hit.clock}</span></div>\n` : ''}        </div>
        <div class="terms${r.tone === 'cash' ? ' termsCash' : ''}">
          <div class="termsL">${r.stance}</div>
${fig ? `          <div class="termsFig">${fig}</div>\n` : ''}        </div>
        <div class="act">${r.acts && r.acts.length === 1 ? '<span></span>' : ''}${acts(r)}</div>
      </div>`;
}

export const matchboard = `  <div class="board">
${SECTIONS.map(([title, hint, list], i) => `    <div class="sect">
      <h2 class="sectT">${title}</h2>
      <span class="sectN">${list.length}</span>
      <span class="sectHint">${hint}</span>
    </div>
${list.map((r, j) => matchRow(r, j === list.length - 1)).join('\n')}${i < 2 ? '\n    <div class="sectGap"></div>' : ''}`).join('\n')}
  </div>`;
