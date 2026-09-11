import { posVars } from './tokens.mjs';
import { SECTIONS } from './data.mjs';

const money = (n) => (n == null ? null : `&euro;${n}m`);
const chip = (p, cls = 'poschip') => `<span class="${cls}" style="${posVars(p)}">${p}</span>`;

const EYE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3 21 21"/><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.4 17.4 0 0 1-3.2 3.9M6.6 6.7A17.2 17.2 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.2-.9"/></svg>';

/* ══════════════════════════════════════════════════════════════
   2. SENTENCE — the board as running type.

   A target IS a sentence somebody said. This direction stops
   chopping it into cells and lets it read: club, verb, player,
   terms, in one line, with the money set in the serif inline
   where it falls naturally. Furniture drops to almost nothing —
   no chips in the terms column, no boxes, no column rules.

   The trade is real and worth stating: you can no longer compare
   budgets down a column, because there is no column. On a board
   of ten rows that is probably fine; on forty it would not be.
   ══════════════════════════════════════════════════════════════ */
export const SENTENCE_CSS = `
  .board { padding:var(--s6) var(--s8) var(--s10); }
  .sect { display:flex; align-items:baseline; gap:var(--s3); padding-bottom:var(--s2);
          border-bottom:2px solid var(--color-text-primary); margin-bottom:var(--s2); }
  .sectT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
           letter-spacing:-0.02em; margin:0; color:var(--color-text-primary); }
  .sectN { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-12);
           font-variant-numeric:tabular-nums lining-nums; color:var(--color-text-muted); }
  .sectGap { height:var(--s8); }

  .line { display:flex; align-items:center; gap:var(--s4); padding:var(--s4) var(--s2);
          border-bottom:1px solid var(--color-border-subtle); }
  .lineLast { border-bottom:none; }
  .lineMine { background:var(--color-accent-dim); }
  .lineMatched { background:color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-primary)); }

  .sentence { flex:1; min-width:0; font-size:var(--t-15); line-height:1.45;
              color:var(--color-text-secondary); text-wrap:pretty; }
  .club { font-weight:700; color:var(--color-text-primary); }
  /* The player's name is the subject of the sentence, so it takes the display
     face at reading size rather than being shrunk into a cell. */
  .subject { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
             letter-spacing:-0.015em; color:var(--color-text-primary); }
  .fig { font-family:var(--font-serif); font-weight:700;
         font-variant-numeric:tabular-nums lining-nums; color:var(--color-text-primary); }
  .figCash { color:var(--color-accent-ink); }
  .aside { color:var(--color-text-muted); font-size:var(--t-13); }
  .answer { color:var(--color-accent-ink); font-weight:600; }

  .hitline { margin-top:var(--s1); font-size:var(--t-12); color:var(--color-warning-text); }
  .hitBid { font-family:var(--font-mono); font-weight:700;
            font-variant-numeric:tabular-nums; }
  .hitClock { font-family:var(--font-mono); color:var(--color-text-muted);
              font-variant-numeric:tabular-nums; }

  .lineActs { display:flex; gap:var(--s1); flex-shrink:0; }
  .lbtn { font-family:var(--font-condensed); font-size:var(--t-11); font-weight:700;
          letter-spacing:0.05em; text-transform:uppercase; padding:0 var(--s3);
          border-radius:var(--r-control); border:1px solid var(--color-border-subtle);
          background:none; color:var(--color-text-secondary); white-space:nowrap;
          height:32px; }
  .lbtnPrimary { background:var(--color-accent); border-color:var(--color-accent);
                 color:var(--color-on-accent); }
  .lbtnQuiet { color:var(--color-text-muted); }
  .seenTag { display:inline-flex; align-items:center; gap:5px; font-size:var(--t-11);
             font-weight:600; color:var(--color-warning-text); }
  .seenTagOpen { color:var(--color-text-muted); }
`;

/** The verb phrase differs by kind: you want a MAN, you look for a ROLE. */
function phrase(r) {
  const named = /^[A-Z]\. /.test(r.name);
  const subject = `<span class="subject">${r.name}</span>`;
  return named ? `want ${subject}` : `are looking for a ${subject}`;
}

function termsPhrase(r) {
  const fig = money(r.budget);
  if (r.tone === 'cash') return fig ? `will pay cash, up to <span class="fig figCash">${fig}</span>` : 'will pay cash';
  if (r.tone === 'players') return 'are offering players';
  if (r.tone === 'loan') return 'would take him on loan';
  return 'are open to approaches';
}

function sentenceRow(r, last) {
  const cls = ['line', r.state === 'matched' ? 'lineMatched' : r.state === 'mine' ? 'lineMine' : '', last ? 'lineLast' : '']
    .filter(Boolean).join(' ');

  const lead = r.seen
    ? `<span class="seenTag${r.seenKind === 'open' ? ' seenTagOpen' : ''}">${r.seenKind === 'private' ? EYE_OFF : EYE}${r.seen}</span> &mdash; you `
    : `<span class="club">${r.club}</span> `;

  const tail = [
    r.direct ? 'sent to you only' : null,
    r.expiry,
  ].filter(Boolean).join(' &middot; ');

  const acts = (r.acts || []).map(([label, kind]) =>
    `<button class="lbtn${kind ? ' lbtn' + kind[0].toUpperCase() + kind.slice(1) : ''}">${label}</button>`
  ).join('');

  return `      <div class="${cls}">
        ${r.seen ? '' : `<span class="crest">${r.crest}</span>`}
        <div class="sentence">
          ${chip(r.pos)} ${lead}${phrase(r)} &mdash; ${termsPhrase(r)}.
          ${r.sub ? `<span class="aside">${r.sub}${tail ? ' &middot; ' + tail : ''}</span>` : ''}
${r.answer ? `          <span class="answer">You have ${r.answer.name}.</span>\n` : ''}${r.hit ? `          <div class="hitline">${r.hit.title} &mdash; <span class="hitBid">${r.hit.bid}</span> <span class="hitClock">${r.hit.clock}</span></div>\n` : ''}        </div>
        <div class="lineActs">${acts}</div>
      </div>`;
}

export const sentence = `  <div class="board">
${SECTIONS.map(([title, , list], i) => `    <div class="sect">
      <h2 class="sectT">${title}</h2>
      <span class="sectN">${list.length}</span>
    </div>
${list.map((r, j) => sentenceRow(r, j === list.length - 1)).join('\n')}${i < 2 ? '\n    <div class="sectGap"></div>' : ''}`).join('\n')}
  </div>`;

/* ══════════════════════════════════════════════════════════════
   3. LEDGER — the board as a transfer ledger.

   The densest of the three: 52px rows, real column heads, and no
   filled chips anywhere. The position renders as coloured LETTERS
   rather than a coloured tile, which is the single biggest change
   — twelve filled tiles down a page is a lot of paint, and the
   hue reads perfectly well as ink at 11px bold.

   Actions sit as text rather than buttons, on the reasoning that
   a target is inert: nothing on this board settles anything, and
   drawing eight filled buttons implies otherwise.
   ══════════════════════════════════════════════════════════════ */
export const LEDGER_CSS = `
  .board { padding:var(--s5) var(--s6) var(--s10); }
  .sect { display:flex; align-items:baseline; gap:var(--s3); padding-bottom:var(--s2);
          border-bottom:2px solid var(--color-text-primary); }
  .sectT { font-family:var(--font-serif); font-weight:700; font-size:var(--t-20);
           letter-spacing:-0.02em; margin:0; color:var(--color-text-primary); }
  .sectN { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-12);
           font-variant-numeric:tabular-nums lining-nums; color:var(--color-text-muted); }
  .sectGap { height:var(--s6); }

  .cols { display:grid; grid-template-columns:34px 176px minmax(0,1fr) 150px 92px 150px;
          gap:var(--s4); padding:var(--s2) var(--s2);
          font-family:var(--font-condensed); font-size:var(--t-10); font-weight:700;
          letter-spacing:0.14em; text-transform:uppercase; color:var(--color-text-muted);
          border-bottom:1px solid var(--color-border); }
  .lrow { display:grid; grid-template-columns:34px 176px minmax(0,1fr) 150px 92px 150px;
          gap:var(--s4); align-items:center; padding:var(--s2) var(--s2); min-height:52px;
          border-bottom:1px solid var(--color-border-subtle); }
  .lrowLast { border-bottom:none; }
  .lrowMine { background:var(--color-accent-dim); }
  .lrowMatched { background:color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-primary)); }

  /* Position as coloured ink, not a filled tile. */
  .posInk { font-family:var(--font-condensed); font-weight:700; font-size:var(--t-12);
            letter-spacing:0.06em; color:var(--pl); }
  .lclub { font-size:var(--t-13); font-weight:600; color:var(--color-text-primary);
           white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
           display:flex; align-items:center; gap:var(--s2); }
  .lname { font-family:var(--font-serif); font-weight:700; font-size:var(--t-15);
           letter-spacing:-0.01em; color:var(--color-text-primary);
           white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .lsub { font-size:var(--t-11); color:var(--color-text-muted); }
  .lterms { font-family:var(--font-condensed); font-size:var(--t-12); font-weight:600;
            letter-spacing:0.04em; color:var(--color-text-secondary); white-space:nowrap; }
  .ltermsCash { color:var(--color-accent-ink); }
  .lfig { font-family:var(--font-serif); font-weight:700; font-size:var(--t-15);
          text-align:right; font-variant-numeric:tabular-nums lining-nums;
          color:var(--color-text-primary); }
  .lfigOff { color:var(--color-text-muted); font-weight:400; }
  .lacts { display:flex; gap:var(--s3); justify-content:flex-end; }
  .link { font-family:var(--font-condensed); font-size:var(--t-12); font-weight:700;
          letter-spacing:0.05em; color:var(--color-text-primary); background:none;
          border:none; border-bottom:1.5px solid var(--color-border-strong); padding:0 0 1px; }
  .linkGo { color:var(--color-accent-ink); border-bottom-color:var(--color-accent-ink); }
  .linkQuiet { color:var(--color-text-muted); border-bottom-color:var(--color-border-subtle); }
  .lanswer { color:var(--color-accent-ink); font-weight:600; font-size:var(--t-11); }
  .lhit { font-size:var(--t-11); color:var(--color-warning-text); }
  .lhitBid { font-family:var(--font-mono); font-weight:700; font-variant-numeric:tabular-nums; }
`;

function ledgerRow(r, last) {
  const cls = ['lrow', r.state === 'matched' ? 'lrowMatched' : r.state === 'mine' ? 'lrowMine' : '', last ? 'lrowLast' : '']
    .filter(Boolean).join(' ');
  const fig = money(r.budget);
  const acts = (r.acts || []).map(([label, kind]) =>
    `<button class="link${kind === 'primary' ? ' linkGo' : kind === 'quiet' ? ' linkQuiet' : ''}">${label}</button>`
  ).join('');
  const sub = [r.sub, r.direct ? 'sent to you only' : null, r.expiry].filter(Boolean).join(' &middot; ');
  return `      <div class="${cls}">
        <span class="posInk" style="${posVars(r.pos)}">${r.pos}</span>
        <div class="lclub">${r.seen
          ? `<span class="lsub">${r.seenKind === 'private' ? EYE_OFF : EYE}</span>${r.seen}`
          : `<span class="crest">${r.crest}</span>${r.club}`}</div>
        <div>
          <div class="lname">${r.name}</div>
          <div class="lsub">${sub}${r.answer ? ` &middot; <span class="lanswer">you have ${r.answer.name}</span>` : ''}${r.hit ? ` &middot; <span class="lhit">${r.hit.title}, <span class="lhitBid">${r.hit.bid}</span> ${r.hit.clock}</span>` : ''}</div>
        </div>
        <div class="lterms${r.tone === 'cash' ? ' ltermsCash' : ''}">${r.stance}</div>
        <div class="lfig${fig ? '' : ' lfigOff'}">${fig || '&mdash;'}</div>
        <div class="lacts">${acts}</div>
      </div>`;
}

export const ledger = `  <div class="board">
${SECTIONS.map(([title, , list], i) => `    <div class="sect">
      <h2 class="sectT">${title}</h2>
      <span class="sectN">${list.length}</span>
    </div>
    <div class="cols">
      <span></span><span>Club</span><span>Target</span><span>Terms</span>
      <span style="text-align:right">Budget</span><span></span>
    </div>
${list.map((r, j) => ledgerRow(r, j === list.length - 1)).join('\n')}${i < 2 ? '\n    <div class="sectGap"></div>' : ''}`).join('\n')}
  </div>`;
