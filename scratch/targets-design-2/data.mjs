/* One squad's view of the board, shared by all three directions so the
   comparison is about the treatment and not about the content.

   You are Duke's Destroyers. You have a spare left-back (Kerkez) and a
   striker prospect (Nwaneri), and no spare centre-back or centre-mid —
   which is exactly why Bot FC's and Redbridge's requests are answerable
   and Vardy Party's centre-back is not. */

export const WANTED = [
  { crest:'HU', club:'Holloway Utd', pos:'AM', name:'C. Palmer',
    sub:'Yours · €85m', direct:true,
    stance:'Offering players', tone:'players', budget:null,
    answer:null,
    acts:[['Offer',''],['List','primary']] },
  { crest:'BF', club:'Bot FC', pos:'LB', name:'Starting Left-Back',
    sub:'Straight into the first eleven',
    stance:'Will pay cash', tone:'cash', budget:25,
    answer:{ name:'M. Kerkez', pos:'LB' },
    acts:[['Message','quiet'],['Offer','primary']] },
  { crest:'RB', club:'Redbridge', pos:'ST', name:'Striker Prospect',
    sub:'Young, for the academy',
    stance:'Offering players', tone:'players', budget:null,
    answer:{ name:'E. Nwaneri', pos:'ST' },
    acts:[['Message','quiet'],['Offer','primary']] },
];

export const BOARD = [
  { crest:'MM', club:'Matchday Militia', pos:'CB', name:'W. Saliba',
    sub:'Vardy Party · €78m', stance:'Will pay cash', tone:'cash', budget:62 },
  { crest:'VP', club:'Vardy Party', pos:'CB', name:'Bench Centre-Back',
    sub:'Depth and rotation', stance:'Offering players', tone:'players', budget:null },
  { crest:'KM', club:'Kingsmead', pos:'ST', name:'A. Isak',
    sub:'Holloway Utd · €92m', stance:'Open to approaches', tone:'open', budget:null },
  { crest:'HU', club:'Holloway Utd', pos:'CM', name:'Star Centre-Mid',
    sub:'A player the side is built around', stance:'Will pay cash', tone:'cash', budget:70 },
];

export const MINE = [
  { seen:'The league', seenKind:'open', pos:'CB', name:'W. Saliba',
    sub:'Vardy Party · €78m', stance:'Will pay cash', tone:'cash', budget:62,
    state:'matched',
    hit:{ title:'Vardy Party have listed him', bid:'€58m', clock:'2d 04h' },
    acts:[['Edit','quiet'],['Bid','primary']] },
  { seen:'Matchday Militia', seenKind:'direct', pos:'GK', name:'D. Raya',
    sub:'Matchday Militia · €34m', stance:'Would take him on loan', tone:'loan',
    budget:null, expiry:'6 days left', state:'mine',
    acts:[['Withdraw','quiet'],['Edit','']] },
  { seen:'You only', seenKind:'private', pos:'CM', name:'Starting Centre-Mid',
    sub:'Straight into the first eleven', stance:'Will pay cash', tone:'cash',
    budget:null, expiry:'21 days left', state:'mine',
    acts:[['Withdraw','quiet'],['Edit','']] },
];

export const SECTIONS = [
  ['Wanted From You', 'Targets you can answer from your squad', WANTED],
  ['The Board',       'What every other club is after',         BOARD],
  ['Your Targets',    "Everything you're chasing",              MINE],
];
