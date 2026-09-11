import { posVars } from './tokens.mjs';

const EYE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3 21 21"/><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.4 17.4 0 0 1-3.2 3.9M6.6 6.7A17.2 17.2 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 4.2-.9"/></svg>';
const SEARCH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

const chip = (p) => `<span class="posMark"><span class="poschip" style="${posVars(p)}">${p}</span></span>`;

const btn = (label, variant) =>
  `<button class="btn btn${variant}">${label}</button>`;

const gate = (label, tone) =>
  `<span class="gate${tone === 'cash' ? ' gateCash' : tone === 'open' ? ' gateOpen' : ''}">${label}</span>`;

function row(r) {
  const col2 = r.audience
    ? `<div class="askCol">
             <div class="audience${r.audience.closed ? ' audClosed' : ''}">
               <span class="audIcon">${r.audience.hidden ? EYE_OFF : EYE}</span>${r.audience.text}
             </div>
           </div>`
    : `<div class="askCol">
             <div class="club"><span class="crest">${r.crest}</span><span class="clubName">${r.club}</span></div>
             ${r.scope ? `<div class="scope${r.scopeWarn ? ' scopeWarn' : ''}">${r.scope}</div>` : ''}
           </div>`;

  return `        <div class="row${r.live ? ' rowLive' : ''}">
          <div class="target">
            <div class="tName">${chip(r.pos)}${r.clickable ? `<button class="tBtn">${r.name}</button>` : r.name}</div>
            <div class="tMeta">${r.meta}</div>
${r.live ? `            <div class="live"><span class="liveDot"></span><span class="liveL">Listed by ${r.live.by}</span> <span class="liveV">${r.live.bid}</span> <span class="liveClock">${r.live.clock} left</span></div>\n` : ''}          </div>
          ${col2}
          <div class="terms">${gate(r.stance, r.tone)}<span class="fig${r.budget ? '' : ' figOff'}">${r.budget || '&mdash;'}</span></div>
          <div class="acts">${(r.acts || []).map(([l, v]) => btn(l, v)).join('')}</div>
        </div>`;
}

/* You are Duke's Destroyers. A spare left-back (Kerkez) and a striker prospect
   (Nwaneri); no spare centre-back and no spare centre-mid. */
const WANTED = [
  { pos:'AM', name:'C. Palmer', clickable:true,
    meta:'Chelsea &middot; &euro;85m &middot; <span class="tMine">On your squad</span>',
    crest:'HU', club:'Holloway Utd', scope:'Direct inquiry', scopeWarn:true,
    stance:'Offering players', tone:'players', budget:'&euro;90m',
    acts:[['Offer','Secondary'],['List','Primary']] },
  { pos:'LB', name:'Starting Left-Back',
    meta:'First-choice starter &middot; <span class="tMine">You have M. Kerkez</span>',
    crest:'BF', club:'Bot FC',
    stance:'Will pay cash', tone:'cash', budget:'&euro;25m',
    acts:[['Message','Ghost'],['Offer','Primary']] },
  { pos:'ST', name:'Striker Prospect',
    meta:'Under 23, for the academy &middot; <span class="tMine">You have E. Nwaneri</span>',
    crest:'RB', club:'Redbridge',
    stance:'Offering players', tone:'players', budget:null,
    acts:[['Message','Ghost'],['Offer','Primary']] },
];

const BOARD = [
  { pos:'CB', name:'W. Saliba', clickable:true, meta:'Arsenal &middot; &euro;78m &middot; Vardy Party',
    crest:'MM', club:'Matchday Militia', stance:'Will pay cash', tone:'cash', budget:'&euro;62m' },
  { pos:'CB', name:'Bench Centre-Back', meta:'Depth and rotation',
    crest:'VP', club:'Vardy Party', stance:'Offering players', tone:'players', budget:null },
  { pos:'ST', name:'A. Isak', clickable:true, meta:'Newcastle &middot; &euro;92m &middot; Holloway Utd',
    crest:'KM', club:'Kingsmead', stance:'Open to talks', tone:'open', budget:null },
  { pos:'CM', name:'Star Centre-Mid', meta:'A player the side is built around',
    crest:'HU', club:'Holloway Utd', stance:'Will pay cash', tone:'cash', budget:'&euro;70m' },
];

const MINE = [
  { pos:'CB', name:'W. Saliba', clickable:true, meta:'Arsenal &middot; &euro;78m &middot; Vardy Party',
    audience:{ text:'The League' },
    live:{ by:'Vardy Party', bid:'&euro;58m', clock:'2d 04h' },
    stance:'Will pay cash', tone:'cash', budget:'&euro;62m',
    acts:[['Edit','Ghost'],['Bid in Auction','Primary']] },
  { pos:'GK', name:'D. Raya', clickable:true, meta:'Arsenal &middot; &euro;34m &middot; Matchday Militia &middot; 6 days left',
    audience:{ text:'Matchday Militia only', closed:true },
    stance:'Wants loan', tone:'loan', budget:null,
    acts:[['Edit','Ghost'],['Withdraw','Secondary']] },
  { pos:'CM', name:'Starting Centre-Mid', meta:'First-choice starter &middot; 21 days left',
    audience:{ text:'Private note', closed:true, hidden:true },
    stance:'Will pay cash', tone:'cash', budget:null,
    acts:[['Edit','Ghost'],['Withdraw','Secondary']] },
];

const section = (title, n, hint, rows, first = false) => `      <div class="sect${first ? ' sectFirst' : ''}">
        <h2 class="sectT">${title}</h2>
        <span class="sectN">${n}</span>
        <span class="sectHint">${hint}</span>
      </div>
${rows.map(row).join('\n')}`;

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
    <span class="snItem on">Targets <span class="snCount">10</span></span>
    <span class="snItem">Free Agents <span class="snCount">412</span></span>
    <span class="snItem">Deals <span class="snCount">2</span></span>
  </nav>`;

export const page = `  <div class="page">
    <div class="bar">
      <div class="barTop">
        <h1 class="barName">Targets</h1>
        <span class="barDiv"></span>
        <div class="segs">
          <button class="segOn">All <span class="segN">10</span></button>
          <button class="seg">Wanted <span class="segN">3</span></button>
          <button class="seg">The Board <span class="segN">4</span></button>
          <button class="seg">Yours <span class="segN">3</span></button>
        </div>
        <span class="spacer"></span>
        <span class="search">${SEARCH}Search targets, positions, clubs</span>
        <button class="btn btnMd btnPrimary">Add Target</button>
      </div>
      <div class="barRead">
        <span class="readV">&euro;164m</span> Club Balance
        <span class="readDot">&middot;</span>
        <span class="readV readWarn">3</span> <span class="readWarn">inquiries on your squad</span>
        <span class="readDot">&middot;</span>
        <span class="readV">1</span> live auction match
      </div>
    </div>

${section('Wanted From You', 3, 'Targets you can answer from your squad', WANTED, true)}
${section('The Board', 4, 'What every other club is after', BOARD)}
${section('Your Targets', 3, "Everything you're chasing", MINE)}
  </div>`;
