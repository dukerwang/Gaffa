/* A fuller league than the first pass used — 15 live targets across 8 clubs, so
   a map or a matrix has something real to show. You are Duke's Destroyers.

   Your surplus: a spare left-back (Kerkez) and a striker prospect (Nwaneri).
   No spare centre-back, no spare centre-mid. */

export const ME = "Duke's Destroyers";

export const CLUBS = [
  { id:'DD', name:"Duke's Destroyers", me:true },
  { id:'MM', name:'Matchday Militia' },
  { id:'HU', name:'Holloway Utd' },
  { id:'VP', name:'Vardy Party' },
  { id:'KM', name:'Kingsmead' },
  { id:'BF', name:'Bot FC' },
  { id:'RB', name:'Redbridge' },
  { id:'SG', name:'Southgate FC' },
];

/* kind: 'named' | 'role'. want: player name or role title. */
export const TARGETS = [
  { club:'HU', pos:'AM',  kind:'named', want:'C. Palmer',   owner:'DD', value:85, tone:'players', budget:null, vis:'direct' },
  { club:'BF', pos:'LB',  kind:'role',  want:'Starter',     tone:'cash',    budget:25 },
  { club:'RB', pos:'ST',  kind:'role',  want:'Prospect',    tone:'players', budget:null },
  { club:'MM', pos:'CB',  kind:'named', want:'W. Saliba',   owner:'VP', value:78, tone:'cash', budget:62 },
  { club:'VP', pos:'CB',  kind:'role',  want:'Bench',       tone:'players', budget:null },
  { club:'KM', pos:'ST',  kind:'named', want:'A. Isak',     owner:'HU', value:92, tone:'open', budget:null },
  { club:'HU', pos:'CM',  kind:'role',  want:'Star',        tone:'cash',    budget:70 },
  { club:'SG', pos:'LB',  kind:'role',  want:'Starter',     tone:'cash',    budget:40 },
  { club:'MM', pos:'LB',  kind:'named', want:'M. Kerkez',   owner:'DD', value:41, tone:'cash', budget:60 },
  { club:'KM', pos:'CB',  kind:'role',  want:'Starter',     tone:'cash',    budget:55 },
  { club:'BF', pos:'RWB', kind:'role',  want:'Bench',       tone:'loan',    budget:null },
  { club:'SG', pos:'DM',  kind:'role',  want:'Starter',     tone:'players', budget:null },
  { club:'VP', pos:'CM',  kind:'role',  want:'Bench',       tone:'cash',    budget:18 },
  { club:'RB', pos:'RW',  kind:'named', want:'B. Saka',     owner:'KM', value:88, tone:'open', budget:null },
  { club:'DD', pos:'GK',  kind:'named', want:'D. Raya',     owner:'MM', value:34, tone:'loan', budget:null, vis:'direct', mine:true },
  { club:'DD', pos:'CB',  kind:'named', want:'W. Saliba',   owner:'VP', value:78, tone:'cash', budget:62, vis:'public', mine:true, matched:true },
  { club:'DD', pos:'CM',  kind:'role',  want:'Starter',     tone:'cash',    budget:null, vis:'private', mine:true },
];

/* My roster, with who wants each man. The join the shipped board never shows. */
export const MY_SQUAD = [
  { name:'C. Palmer',  pos:'AM',  value:85, wantedBy:['HU'] },
  { name:'M. Kerkez',  pos:'LB',  value:41, wantedBy:['MM'], surplus:true },
  { name:'E. Nwaneri', pos:'ST',  value:22, wantedBy:[],     surplus:true },
  { name:'J. Timber',  pos:'RB',  value:48, wantedBy:[] },
  { name:'D. Rice',    pos:'DM',  value:76, wantedBy:[] },
  { name:'N. Semenyo', pos:'RW',  value:52, wantedBy:[] },
];

export const POSITIONS = ['GK','CB','LB','RB','LWB','RWB','DM','CM','AM','LW','RW','ST'];

/** Demand per position, excluding your own targets. */
export function demandByPosition() {
  const m = Object.fromEntries(POSITIONS.map((p) => [p, { n:0, clubs:[], budgets:[], rows:[] }]));
  for (const t of TARGETS) {
    if (t.mine) continue;
    const d = m[t.pos];
    d.n += 1;
    if (!d.clubs.includes(t.club)) d.clubs.push(t.club);
    if (t.budget) d.budgets.push(t.budget);
    d.rows.push(t);
  }
  return m;
}

export const clubName = (id) => CLUBS.find((c) => c.id === id)?.name ?? id;

/** Positions where I hold a player I could actually give up. */
export const MY_SURPLUS = MY_SQUAD.filter((p) => p.surplus).map((p) => p.pos);

export const ROLE_NOUN = {
  GK:'goalkeeper', CB:'centre-back', LB:'left-back', RB:'right-back',
  LWB:'left wing-back', RWB:'right wing-back', DM:'defensive mid', CM:'centre-mid',
  AM:'attacking mid', LW:'left winger', RW:'right winger', ST:'striker',
};
