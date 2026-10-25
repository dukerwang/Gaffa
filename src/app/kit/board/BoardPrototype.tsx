'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  Button,
  HoldButton,
  Icon,
  MoneyStepper,
  NumberRoll,
  ResponsiveModal,
  SegmentedControl,
  toast,
} from '@/components/ui';
import Portrait from '@/components/players/Portrait';
import PositionBadge from '@/components/players/PositionBadge';
import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import RatedPortrait from '@/app/(dashboard)/dashboard/RatedPortrait';
import { clubBadgePath } from '@/lib/clubs/registry';
import styles from './board.module.css';

/* Prototype only. Every name, price and clock here is invented; no route is
   called, and nothing is read. Players, portraits and badges are real so the
   page is judged on real imagery.

   Meaning is carried by pictures, not captions:
   - who wants what: a club crest beside a portrait or a position tile
   - how you would pay: three small glyphs
   - who can see a target: a lock, one crest, or many
   - how senior a role target is: four dots
   - where a target stands: the bottom edge of its tile (budget, live strip)
     and a ring when a match exists
   - how long a listing has left: a bar along its foot */

/* ---------- invented data ---------- */

interface Person {
  id: string;
  name: string;
  pos: string;
  club: string;
  value: number;
  code: number;
}

const P: Record<string, Person> = {
  rice: { id: 'rice', name: 'Declan Rice', pos: 'DM', club: 'Arsenal', value: 120, code: 204480 },
  gabriel: { id: 'gabriel', name: 'Gabriel', pos: 'CB', club: 'Arsenal', value: 100, code: 226597 },
  haaland: { id: 'haaland', name: 'Erling Haaland', pos: 'ST', club: 'Man City', value: 220, code: 223094 },
  wirtz: { id: 'wirtz', name: 'Florian Wirtz', pos: 'AM', club: 'Liverpool', value: 100, code: 494595 },
  havertz: { id: 'havertz', name: 'Kai Havertz', pos: 'ST', club: 'Arsenal', value: 55, code: 219847 },
  doku: { id: 'doku', name: 'Jérémy Doku', pos: 'LW', club: 'Man City', value: 45, code: 248875 },
  kroupi: { id: 'kroupi', name: 'Junior Kroupi', pos: 'ST', club: 'Bournemouth', value: 12, code: 560262 },
  gvardiol: { id: 'gvardiol', name: 'Joško Gvardiol', pos: 'CB', club: 'Man City', value: 60, code: 477424 },
  colwill: { id: 'colwill', name: 'Levi Colwill', pos: 'CB', club: 'Chelsea', value: 38, code: 460028 },
  saliba: { id: 'saliba', name: 'William Saliba', pos: 'CB', club: 'Arsenal', value: 85, code: 462424 },
  hall: { id: 'hall', name: 'Lewis Hall', pos: 'LB', club: 'Newcastle', value: 24, code: 487838 },
  saka: { id: 'saka', name: 'Bukayo Saka', pos: 'RW', club: 'Arsenal', value: 130, code: 223340 },
};

const mkCrest = (shape: string, division: string, primary: string, secondary: string, icon: string): CrestConfig => ({
  shape,
  division,
  primaryColor: primary,
  secondaryColor: secondary,
  borderColor: secondary,
  icon,
  iconColor: '#FFFFFF',
  showText: false,
  textColor: '#FFFFFF',
});

type MgrKey = 'me' | 'pizza' | 'hayden' | 'chelsz' | 'tea' | 'totten' | 'xabi';
const MGR: Record<MgrKey, { name: string; short: string; crest: CrestConfig }> = {
  me: { name: 'Duke’s XI', short: 'You', crest: mkCrest('classic', 'solid', '#0C6D3E', '#F4EFE4', 'football') },
  pizza: { name: 'Pizzaking’s Club', short: 'Pizzaking’s', crest: mkCrest('heraldic', 'quartered', '#B8322A', '#F0B429', 'crown') },
  hayden: { name: 'Hayden FC', short: 'Hayden', crest: mkCrest('circle', 'sash', '#1F4E9C', '#FFFFFF', 'eagle') },
  chelsz: { name: 'ChelsZ FC', short: 'ChelsZ', crest: mkCrest('classic', 'vertical-half', '#1E5BB8', '#E8EEF9', 'lion') },
  tea: { name: 'Tea FC', short: 'Tea', crest: mkCrest('arch', 'solid', '#6B3F23', '#F2E3C6', 'star') },
  totten: { name: 'tottenyang FC', short: 'tottenyang', crest: mkCrest('escutcheon', 'horizontal-half', '#14264F', '#E7ECF5', 'lightning') },
  xabi: { name: 'Not Too Xabi', short: 'Xabi', crest: mkCrest('hexagon', 'chevron', '#C4262E', '#1B1B1B', 'football') },
};

type Stance = 'cash' | 'players' | 'loan';
type Audience = 'you' | 'club' | 'league';
type Level = 'star' | 'starter' | 'bench' | 'prospect';
const LEVEL_DOTS: Record<Level, number> = { star: 4, starter: 3, bench: 2, prospect: 1 };
const LEVEL_NAME: Record<Level, string> = { star: 'Star', starter: 'Starter', bench: 'Bench', prospect: 'Prospect' };

interface Target {
  id: string;
  who: Person | null;
  pos: string;
  level?: Level;
  budget: number;
  stance: Stance[];
  audience: Audience;
  /** The club that owns a named target, when he has one. */
  owner?: MgrKey;
  state:
    | { kind: 'quiet' }
    | { kind: 'auction'; bid: number; left: string }
    | { kind: 'match'; who: Person; owner: MgrKey };
}

const TARGETS: Target[] = [
  { id: 't1', who: P.gabriel, pos: 'CB', budget: 110, stance: ['cash'], audience: 'club', owner: 'pizza', state: { kind: 'auction', bid: 58, left: '2d 04h' } },
  { id: 't2', who: P.haaland, pos: 'ST', budget: 230, stance: ['cash', 'players'], audience: 'you', owner: 'hayden', state: { kind: 'quiet' } },
  { id: 't3', who: P.wirtz, pos: 'AM', budget: 90, stance: ['players', 'loan'], audience: 'league', owner: 'tea', state: { kind: 'quiet' } },
  { id: 't4', who: null, pos: 'LB', level: 'starter', budget: 40, stance: ['cash'], audience: 'league', state: { kind: 'match', who: P.hall, owner: 'chelsz' } },
  { id: 't5', who: null, pos: 'ST', level: 'prospect', budget: 15, stance: ['cash', 'loan'], audience: 'you', state: { kind: 'quiet' } },
];

interface Ask {
  id: string;
  from: MgrKey;
  budget: number;
  stance: Stance[];
  direct?: boolean;
  /** Named: the one player of yours they want. Role: what you have to answer it. */
  named?: Person;
  role?: { pos: string; level: Level; have: Person[]; more: number };
}

const ASKS: Ask[] = [
  { id: 'a1', from: 'totten', budget: 95, stance: ['cash'], direct: true, named: P.rice },
  { id: 'a2', from: 'chelsz', budget: 35, stance: ['cash', 'players'], role: { pos: 'CB', level: 'starter', have: [P.saliba, P.gvardiol, P.colwill], more: 2 } },
  { id: 'a3', from: 'tea', budget: 20, stance: ['players'], named: P.kroupi },
];

interface Listing {
  id: string;
  who: Person;
  price: number;
  /** Fraction of the clock still to run; null for a listing with no auction. */
  left: number | null;
  clock: string | null;
  interest: MgrKey[];
  lead?: MgrKey;
}

const LISTINGS: Listing[] = [
  { id: 'l1', who: P.havertz, price: 36, left: 0.72, clock: '1d 06h', interest: ['chelsz', 'tea'], lead: 'chelsz' },
  { id: 'l2', who: P.doku, price: 45, left: null, clock: null, interest: ['hayden'] },
];

interface Listed {
  id: string;
  who: Person;
  owner: MgrKey;
  price: number;
  left: number | null;
  clock: string | null;
}

const BOARD_LISTED: Listed[] = [
  { id: 'b1', who: P.gabriel, owner: 'pizza', price: 58, left: 0.52, clock: '2d 04h' },
  { id: 'b2', who: P.saka, owner: 'hayden', price: 120, left: 0.84, clock: '3d 11h' },
  { id: 'b3', who: P.hall, owner: 'chelsz', price: 24, left: 0.12, clock: '8h' },
  { id: 'b4', who: P.colwill, owner: 'xabi', price: 38, left: null, clock: null },
];

interface Wanted {
  id: string;
  from: MgrKey;
  who?: Person;
  pos: string;
  level?: Level;
  budget: number;
  stance: Stance[];
}

const BOARD_WANTED: Wanted[] = [
  { id: 'w1', from: 'totten', pos: 'DM', level: 'starter', budget: 80, stance: ['cash'] },
  { id: 'w2', from: 'hayden', who: P.doku, pos: 'LW', budget: 50, stance: ['players'] },
  { id: 'w3', from: 'xabi', pos: 'ST', level: 'star', budget: 120, stance: ['cash', 'loan'] },
  { id: 'w4', from: 'tea', pos: 'CB', level: 'prospect', budget: 15, stance: ['cash'] },
];

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const posVar = (pos: string) => `var(--color-pos-${pos.toLowerCase()})`;
const posStyle = (pos: string) => ({ '--pos': posVar(pos), '--pos-line': `var(--color-pos-${pos.toLowerCase()}-line)` }) as CSSProperties;

type Sheet =
  | null
  | { kind: 'who' }
  | { kind: 'target'; who: Person | null; pos?: string; editing?: Target }
  | { kind: 'listing'; who: Person }
  | { kind: 'listed'; item: Listed };

/* ---------- small pictures ---------- */

function Mgr({ k, size = 24 }: { k: MgrKey; size?: number }) {
  return <CrestBadge config={MGR[k].crest} teamName={MGR[k].name} size={size} interactive={false} />;
}

function ClubBadge({ club, size = 14 }: { club: string; size?: number }) {
  const src = clubBadgePath(club);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} className={styles.clubBadge} />;
}

/** Crests lapping over one another; the first one is on top. */
function CrestStack({ keys, size = 22, lead }: { keys: MgrKey[]; size?: number; lead?: MgrKey }) {
  return (
    <span className={styles.crestStack} aria-hidden="true">
      {keys.map((k, i) => (
        <span
          key={k}
          className={`${styles.stackItem} ${k === lead ? styles.stackLead : ''}`}
          style={{ zIndex: keys.length - i, width: size, height: size }}
        >
          <Mgr k={k} size={size - 4} />
        </span>
      ))}
    </span>
  );
}

const GLYPH: Record<Stance, ReactNode> = {
  cash: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" />
      <path d="M10.3 5.9a3 3 0 1 0 0 4.2M5.3 7.3h4M5.3 8.8h4" />
    </svg>
  ),
  players: <Icon name="repeat" size={14} />,
  loan: (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" />
      <path d="M8 4.6V8l2.4 1.5" />
    </svg>
  ),
};
const STANCE_NAME: Record<Stance, string> = { cash: 'Cash', players: 'Players', loan: 'Loan' };

function Stances({ list }: { list: Stance[] }) {
  return (
    <span className={styles.stances} role="img" aria-label={list.map((s) => STANCE_NAME[s]).join(', ')}>
      {list.map((s) => (
        <span key={s}>{GLYPH[s]}</span>
      ))}
    </span>
  );
}

function Level({ level }: { level: Level }) {
  const n = LEVEL_DOTS[level];
  return (
    <span className={styles.level} role="img" aria-label={LEVEL_NAME[level]}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i < n ? styles.levelOn : ''} />
      ))}
    </span>
  );
}

/** Who can see a target, as a picture: a lock, a single crest, or the league. */
function Eye({ a, owner }: { a: Audience; owner?: MgrKey }) {
  if (a === 'club' && owner) return <Mgr k={owner} size={16} />;
  return <Icon name={a === 'you' ? 'lock' : 'users'} size={13} />;
}
const EYE_NAME: Record<Audience, string> = { you: 'Only you', club: 'One club', league: 'The league' };

const Money = ({ n, className }: { n: number; className?: string }) => <b className={`${styles.money} ${className ?? ''}`}>€{n}m</b>;

function Cutout({ p }: { p: Person }) {
  return <RatedPortrait photoUrl={String(p.code)} photoVersion={null} name={p.name} />;
}

function Pips({ on, total }: { on: number; total: number }) {
  return (
    <span className={styles.pips} role="img" aria-label={`${on} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < on ? styles.pipOn : ''} />
      ))}
    </span>
  );
}

function TimeBar({ left }: { left: number | null }) {
  if (left === null) return null;
  return <span className={`${styles.timeBar} ${left < 0.2 ? styles.timeUrgent : ''}`} style={{ '--p': left } as CSSProperties} aria-hidden="true" />;
}

/* ---------- the page ---------- */

export default function BoardPrototype() {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [view, setView] = useState<'listed' | 'wanted'>('listed');
  const [pos, setPos] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const applyTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
  };

  const listed = BOARD_LISTED.filter((r) => !pos || r.who.pos === pos);
  const wanted = BOARD_WANTED.filter((r) => !pos || r.pos === pos);
  const countFor = (p: string) => (view === 'listed' ? BOARD_LISTED.filter((r) => r.who.pos === p) : BOARD_WANTED.filter((r) => r.pos === p)).length;

  return (
    <div className={styles.root}>
      <div className={styles.themeSwitch}>
        <SegmentedControl
          size="sm"
          ariaLabel="Theme"
          value={theme}
          onChange={applyTheme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </div>

      <div className={styles.page}>
        {/* The anchor field: the green shelf, with what is waiting on you resting on its edge. */}
        <div className={styles.top}>
          <div className={styles.shelfBg} aria-hidden="true" />
          <div className={styles.shelfIn}>
            <div className={styles.mast}>
              <h1 className={styles.title}>The Board</h1>
              <span className={styles.balance}>
                <Mgr k="me" size={26} />
                <b><NumberRoll value={204} format={(n) => `€${n}m`} /></b>
              </span>
            </div>

            <div className={styles.askHead}>
              <h2 className={styles.askT}>Wanted From You</h2>
              <span className={styles.askCount}>{ASKS.length}</span>
            </div>
            <div className={styles.asks}>
              {ASKS.map((a, i) => (
                <article key={a.id} className={styles.ask} style={{ '--i': i } as CSSProperties}>
                  <div className={styles.askMain}>
                    <div className={styles.askPlinth} style={posStyle(a.named?.pos ?? a.role!.pos)}>
                      {a.named ? (
                        <Cutout p={a.named} />
                      ) : (
                        <>
                          {a.role!.have.map((p, j) => (
                            <span key={p.id} className={styles.stackFace} style={{ left: `${j * 26 - 6}px`, zIndex: 3 - j }}>
                              <Cutout p={p} />
                            </span>
                          ))}
                          <span className={styles.stackMore}>+{a.role!.more}</span>
                        </>
                      )}
                      {a.direct && (
                        <span className={styles.plinthMark}>
                          <Icon name="lock" size={12} />
                        </span>
                      )}
                    </div>
                    <div className={styles.askBody}>
                      <span className={styles.askFrom}>
                        <Mgr k={a.from} size={30} />
                        <span className={styles.askName}>{MGR[a.from].name}</span>
                      </span>
                      <span className={styles.askWhat}>
                        {a.named ? (
                          <span className={styles.nameRow}>
                            <PositionBadge position={a.named.pos} size="sm" />
                            <span className={styles.clip}>{a.named.name}</span>
                          </span>
                        ) : (
                          <span className={styles.nameRow}>
                            <PositionBadge position={a.role!.pos} size="sm" />
                            <Level level={a.role!.level} />
                          </span>
                        )}
                      </span>
                      <span className={styles.askTerms}>
                        <Money n={a.budget} />
                        <Stances list={a.stance} />
                      </span>
                    </div>
                  </div>
                  <div className={styles.askActions}>
                    {a.named && <Button variant="secondary" size="sm" fullWidth onClick={() => toast('Listed')}>List</Button>}
                    <Button variant="primary" size="sm" fullWidth onClick={() => toast('Offer opened')}>Offer</Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.cols}>
          <section className={styles.targets} aria-labelledby="h-targets">
            <div className={styles.head}>
              <h2 id="h-targets" className={styles.headT}>Your Targets</h2>
              <div className={styles.headEnd}>
                <Pips on={TARGETS.length} total={10} />
                <Button size="sm" variant="primary" onClick={() => setSheet({ kind: 'who' })}>
                  <span className={styles.btnIn}><Icon name="plus" size={14} />Add</span>
                </Button>
              </div>
            </div>
            <div className={styles.tiles}>
              {TARGETS.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.tile} ${t.state.kind === 'match' ? styles.tileMatch : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  onClick={() => setSheet({ kind: 'target', who: t.who, pos: t.pos, editing: t })}
                  aria-label={t.who ? t.who.name : `${t.pos} ${LEVEL_NAME[t.level!]}`}
                >
                  <span className={styles.plinth} style={posStyle(t.pos)}>
                    {t.who ? <Cutout p={t.who} /> : <span className={styles.bigPos}>{t.pos}</span>}
                    <span className={styles.chipTL} title={EYE_NAME[t.audience]}>
                      <Eye a={t.audience} owner={t.owner} />
                    </span>
                    <span className={styles.chipTR}>
                      <Stances list={t.stance} />
                    </span>
                    {t.state.kind === 'auction' ? (
                      <span className={styles.liveStrip}>
                        <i className={styles.liveDot} />
                        <b>€{t.state.bid}m</b>
                        <span>{t.state.left}</span>
                      </span>
                    ) : (
                      <span className={styles.budget}>€{t.budget}m</span>
                    )}
                    {t.state.kind === 'match' && (
                      <span className={styles.matchChip}>
                        <span className={styles.matchFace}>
                          <Cutout p={t.state.who} />
                        </span>
                        <span className={styles.matchCrest}>
                          <Mgr k={t.state.owner} size={16} />
                        </span>
                      </span>
                    )}
                  </span>
                  <span className={`g-namerow ${styles.tileName}`}>
                    <PositionBadge position={t.pos} size="sm" />
                    {t.who ? <span>{t.who.name}</span> : <Level level={t.level!} />}
                  </span>
                  <span className={styles.cap}>
                    {t.who ? (
                      <>
                        <ClubBadge club={t.who.club} />
                        {t.who.club}
                      </>
                    ) : (
                      LEVEL_NAME[t.level!]
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.board} aria-labelledby="h-board">
            <div className={styles.head}>
              <h2 id="h-board" className={styles.headT}>The Board</h2>
              <div className={styles.headEnd}>
                <SegmentedControl
                  variant="ink"
                  size="sm"
                  ariaLabel="Board view"
                  value={view}
                  onChange={(v) => {
                    setView(v);
                    setPos(null);
                  }}
                  options={[
                    { value: 'listed', label: 'Listed' },
                    { value: 'wanted', label: 'Wanted' },
                  ]}
                />
              </div>
            </div>

            <div className={styles.rail} role="group" aria-label="Position">
              {POSITIONS.map((p) => {
                const n = countFor(p);
                return (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.posChip} ${pos === p ? styles.posChipOn : ''}`}
                    style={posStyle(p)}
                    disabled={n === 0}
                    aria-pressed={pos === p}
                    onClick={() => setPos(pos === p ? null : p)}
                  >
                    {p}
                    <b>{n}</b>
                  </button>
                );
              })}
            </div>

            <div className={styles.rows}>
              {view === 'listed' &&
                listed.map((r) => (
                  <div key={r.id} className={styles.lrow}>
                    <button type="button" className={styles.rowHit} aria-label={r.who.name} onClick={() => setSheet({ kind: 'listed', item: r })} />
                    <Portrait photoUrl={String(r.who.code)} name={r.who.name} club={r.who.club} size="sm" headTopPct={null} headWidthPct={null} photoVersion={null} />
                    <span className={styles.lBody}>
                      <span className={`g-namerow ${styles.lName}`}>
                        <PositionBadge position={r.who.pos} size="sm" />
                        <span className={styles.clip}>{r.who.name}</span>
                      </span>
                      <span className={styles.lSub}>
                        <Mgr k={r.owner} size={16} />
                        {MGR[r.owner].short}
                      </span>
                    </span>
                    <span className={styles.lEnd}>
                      <Money n={r.price} />
                      {r.clock ? <span className={`${styles.clock} ${r.left! < 0.2 ? styles.clockUrgent : ''}`}>{r.clock}</span> : <span className={styles.offersOnly}>Offers</span>}
                    </span>
                    <span className={styles.lActions}>
                      <Button size="sm" variant="secondary">Offer</Button>
                      {r.clock && <Button size="sm" variant="primary">Bid</Button>}
                    </span>
                    <TimeBar left={r.left} />
                  </div>
                ))}

              {view === 'wanted' &&
                wanted.map((r) => (
                  <div key={r.id} className={styles.wrow}>
                    <Mgr k={r.from} size={34} />
                    <Icon name="chevron-right" size={14} className={styles.wArrow} />
                    {r.who ? (
                      <Portrait photoUrl={String(r.who.code)} name={r.who.name} club={null} size="sm" headTopPct={null} headWidthPct={null} photoVersion={null} />
                    ) : (
                      <span className={styles.posTile} style={posStyle(r.pos)}>{r.pos}</span>
                    )}
                    <span className={styles.lBody}>
                      <span className={`g-namerow ${styles.lName}`}>
                        <PositionBadge position={r.pos} size="sm" />
                        {r.who ? <span className={styles.clip}>{r.who.name}</span> : <Level level={r.level!} />}
                      </span>
                      <span className={styles.lSub}>{MGR[r.from].short}</span>
                    </span>
                    <span className={styles.lEnd}>
                      <Money n={r.budget} />
                      <Stances list={r.stance} />
                    </span>
                  </div>
                ))}

              {((view === 'listed' && listed.length === 0) || (view === 'wanted' && wanted.length === 0)) && (
                <p className={styles.empty}>
                  <PositionBadge position={pos} size="md" />
                </p>
              )}
            </div>
          </section>

          <section className={styles.listings} aria-labelledby="h-listings">
            <div className={styles.head}>
              <h2 id="h-listings" className={styles.headT}>Your Listings</h2>
              <div className={styles.headEnd}>
                <Button size="sm" variant="primary" onClick={() => setSheet({ kind: 'listing', who: P.havertz })}>
                  <span className={styles.btnIn}><Icon name="plus" size={14} />Add</span>
                </Button>
              </div>
            </div>
            <div className={styles.rows}>
              {LISTINGS.map((l) => (
                <button key={l.id} type="button" className={styles.lrow} onClick={() => setSheet({ kind: 'listing', who: l.who })}>
                  <Portrait photoUrl={String(l.who.code)} name={l.who.name} club={l.who.club} size="sm" headTopPct={null} headWidthPct={null} photoVersion={null} />
                  <span className={styles.lBody}>
                    <span className={`g-namerow ${styles.lName}`}>
                      <PositionBadge position={l.who.pos} size="sm" />
                      <span className={styles.clip}>{l.who.name}</span>
                    </span>
                    <CrestStack keys={l.interest} lead={l.lead} size={24} />
                  </span>
                  <span className={styles.lEnd}>
                    <Money n={l.price} />
                    {l.clock ? <span className={`${styles.clock} ${(l.left ?? 1) < 0.2 ? styles.clockUrgent : ''}`}>{l.clock}</span> : <span className={styles.offersOnly}>Offers</span>}
                  </span>
                  <TimeBar left={l.left} />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <Sheets sheet={sheet} onClose={() => setSheet(null)} go={setSheet} />
    </div>
  );
}

/* ---------- the sheets ---------- */

function Sheets({ sheet, onClose, go }: { sheet: Sheet; onClose: () => void; go: (s: Sheet) => void }) {
  if (!sheet) return null;
  if (sheet.kind === 'who') return <WhoSheet onClose={onClose} go={go} />;
  if (sheet.kind === 'target') return <TargetSheet key={sheet.editing?.id ?? sheet.who?.id ?? sheet.pos ?? 'new'} sheet={sheet} onClose={onClose} />;
  if (sheet.kind === 'listing') return <ListingSheet key={sheet.who.id} who={sheet.who} onClose={onClose} />;
  return <ListedSheet item={sheet.item} onClose={onClose} />;
}

function Plate({ p, owner, children }: { p: Person; owner?: MgrKey; children?: ReactNode }) {
  return (
    <div className={styles.plate}>
      <div className={styles.plateImg} style={posStyle(p.pos)}>
        <Cutout p={p} />
      </div>
      <div className={styles.plateBody}>
        <span className={`g-namerow ${styles.plateName}`}>
          <PositionBadge position={p.pos} size="sm" />
          <span>{p.name}</span>
        </span>
        <span className={styles.plateSub}>
          <ClubBadge club={p.club} size={16} />
          {p.club}
          {owner && <Mgr k={owner} size={18} />}
        </span>
        <Money n={p.value} className={styles.plateValue} />
        {children}
      </div>
    </div>
  );
}

function PosPicker({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  return (
    <div className={styles.rail} role="radiogroup" aria-label="Position">
      {POSITIONS.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          className={`${styles.posChip} ${value === p ? styles.posChipOn : ''}`}
          style={posStyle(p)}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function WhoSheet({ onClose, go }: { onClose: () => void; go: (s: Sheet) => void }) {
  const [q, setQ] = useState('');
  const squad = [P.havertz, P.doku];
  const others: { p: Person; owner: MgrKey }[] = [
    { p: P.gabriel, owner: 'pizza' },
    { p: P.haaland, owner: 'hayden' },
    { p: P.wirtz, owner: 'tea' },
    { p: P.saka, owner: 'hayden' },
  ];
  const free = [P.kroupi];
  const match = (p: Person) => !q.trim() || `${p.name} ${p.club}`.toLowerCase().includes(q.trim().toLowerCase());

  const row = (p: Person, end: ReactNode, onPick: () => void) => (
    <button key={p.id} type="button" className={styles.pick} onClick={onPick}>
      <Portrait photoUrl={String(p.code)} name={p.name} club={p.club} size="sm" headTopPct={null} headWidthPct={null} photoVersion={null} />
      <span className={`g-namerow ${styles.pickName}`}>
        <PositionBadge position={p.pos} size="sm" />
        <span className={styles.clip}>{p.name}</span>
      </span>
      <span className={styles.pickEnd}>
        {end}
        <Money n={p.value} className={styles.pickValue} />
      </span>
    </button>
  );

  return (
    <ResponsiveModal open onClose={onClose} title="Add" padded>
      <div className={styles.form}>
        <label className={styles.search}>
          <Icon name="search" size={16} />
          <input className={styles.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Players" autoFocus aria-label="Search players" />
        </label>
        <PosPicker value="" onChange={(p) => go({ kind: 'target', who: null, pos: p })} />
        <div className={styles.pickList}>
          {squad.filter(match).map((p) => row(p, <Mgr k="me" size={20} />, () => go({ kind: 'listing', who: p })))}
          {others.filter((o) => match(o.p)).map((o) => row(o.p, <Mgr k={o.owner} size={20} />, () => go({ kind: 'target', who: o.p })))}
          {free.filter(match).map((p) => row(p, <span className={styles.freeTag}>Free</span>, () => go({ kind: 'target', who: p })))}
        </div>
      </div>
    </ResponsiveModal>
  );
}

function StanceChips({ value, onChange }: { value: Stance[]; onChange: (v: Stance[]) => void }) {
  return (
    <div className={styles.stanceChips} role="group" aria-label="Terms">
      {(['cash', 'players', 'loan'] as Stance[]).map((s) => {
        const on = value.includes(s);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            className={`${styles.stanceChip} ${on ? styles.stanceOn : ''}`}
            onClick={() => onChange(on ? value.filter((x) => x !== s) : [...value, s])}
          >
            {GLYPH[s]}
            {STANCE_NAME[s]}
          </button>
        );
      })}
    </div>
  );
}

function AudiencePicker({ value, onChange, owner }: { value: Audience; onChange: (a: Audience) => void; owner?: MgrKey }) {
  const all: MgrKey[] = ['pizza', 'hayden', 'chelsz', 'tea', 'totten', 'xabi'];
  const options: { v: Audience; label: string; icon: ReactNode }[] = [
    { v: 'you', label: 'You', icon: <Icon name="lock" size={18} /> },
    ...(owner ? [{ v: 'club' as Audience, label: MGR[owner].short, icon: <Mgr k={owner} size={22} /> }] : []),
    { v: 'league', label: 'League', icon: <Icon name="users" size={18} /> },
  ];
  return (
    <div className={styles.aud}>
      <div className={styles.audTiles} role="radiogroup" aria-label="Who sees it" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v} className={`${styles.audTile} ${value === o.v ? styles.audOn : ''}`} onClick={() => onChange(o.v)}>
            <span className={styles.audIcon}>{o.icon}</span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      {/* The audience, drawn: nobody, one crest, or everyone. */}
      {value === 'league' && (
        <div className={styles.audSeen} aria-hidden="true">
          <CrestStack keys={all} size={24} />
          <Pips on={3} total={5} />
        </div>
      )}
    </div>
  );
}

function TargetSheet({ sheet, onClose }: { sheet: Extract<Sheet, { kind: 'target' }>; onClose: () => void }) {
  const { who, editing } = sheet;
  const isRole = !who;
  const free = !!who && who.id === 'kroupi';
  const owner = editing?.owner ?? (who && !free ? ({ gabriel: 'pizza', haaland: 'hayden', wirtz: 'tea' } as Record<string, MgrKey>)[who.id] : undefined);

  const [audience, setAudience] = useState<Audience>(editing?.audience ?? (isRole ? 'league' : 'you'));
  const [budget, setBudget] = useState(editing?.budget ?? (who ? Math.round(who.value * 0.8) : 40));
  const [stance, setStance] = useState<Stance[]>(editing?.stance ?? ['cash']);
  const [level, setLevel] = useState<Level>(editing?.level ?? 'starter');
  const [pos, setPos] = useState(editing?.pos ?? sheet.pos ?? 'LB');
  const [note, setNote] = useState('');

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title={editing ? 'Edit Target' : 'Add Target'}
      padded
      footer={
        <div className={styles.footer}>
          {editing && (
            <HoldButton size="sm" onConfirm={() => { toast('Withdrawn'); onClose(); }}>
              Withdraw
            </HoldButton>
          )}
          {free && <Button variant="secondary" onClick={() => { toast('Bid opened'); onClose(); }}>Bid</Button>}
          <Button variant="primary" onClick={() => { toast(editing ? 'Saved' : 'Added'); onClose(); }}>
            {editing ? 'Save' : 'Add Target'}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        {who ? (
          <Plate p={who} owner={owner} />
        ) : (
          <>
            <PosPicker value={pos} onChange={setPos} />
            <SegmentedControl
              fullWidth
              ariaLabel="Level"
              value={level}
              onChange={setLevel}
              options={(['star', 'starter', 'bench', 'prospect'] as Level[]).map((l) => ({ value: l, label: LEVEL_NAME[l] }))}
            />
          </>
        )}

        {!free && <AudiencePicker value={audience} onChange={setAudience} owner={isRole ? undefined : owner} />}

        <MoneyStepper
          fullWidth
          label="Budget"
          value={budget}
          onChange={setBudget}
          min={1}
          max={250}
          step={1}
          hint={
            <span className={styles.hintBal}>
              <Mgr k="me" size={16} />€204m
            </span>
          }
        />
        <StanceChips value={stance} onChange={setStance} />
        <label className={styles.noteField}>
          <input className={styles.input} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" aria-label="Note" />
          {note.length > 110 && <span className={styles.count}>{140 - note.length}</span>}
        </label>
      </div>
    </ResponsiveModal>
  );
}

function ListingSheet({ who, onClose }: { who: Person; onClose: () => void }) {
  const [floor, setFloor] = useState<'sixty' | 'none' | 'offers'>('sixty');
  const [ask, setAsk] = useState(who.value);
  const [stance, setStance] = useState<Stance[]>(['cash', 'players']);
  const wantsHim: MgrKey[] = who.id === 'doku' ? ['hayden'] : ['chelsz', 'tea'];

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title="List a Player"
      padded
      footer={
        <div className={styles.footer}>
          <Button variant="primary" onClick={() => { toast('Listed'); onClose(); }}>
            List {who.name.split(' ').pop()}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        <Plate p={who}>
          <CrestStack keys={wantsHim} size={26} />
        </Plate>
        <SegmentedControl
          fullWidth
          ariaLabel="Auction floor"
          value={floor}
          onChange={setFloor}
          options={[
            { value: 'sixty', label: '60% of Value' },
            { value: 'none', label: 'No Auction' },
            { value: 'offers', label: 'Offers Only' },
          ]}
        />
        <MoneyStepper fullWidth label="Asking Price" value={ask} onChange={setAsk} min={1} max={300} step={1} />
        <StanceChips value={stance} onChange={setStance} />
      </div>
    </ResponsiveModal>
  );
}

function ListedSheet({ item, onClose }: { item: Listed; onClose: () => void }) {
  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title={item.who.name}
      padded
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" onClick={() => { toast('Offer opened'); onClose(); }}>Offer</Button>
          {item.clock && (
            <Button variant="primary" onClick={() => { toast('Bid opened'); onClose(); }}>
              Bid €{item.price + 1}m
            </Button>
          )}
        </div>
      }
    >
      <div className={styles.form}>
        <Plate p={item.who} owner={item.owner} />
        <div className={styles.listedFoot}>
          <Money n={item.price} className={styles.bigMoney} />
          {item.clock && (
            <span className={styles.listedClock}>
              <span className={`${styles.clock} ${item.left! < 0.2 ? styles.clockUrgent : ''}`}>{item.clock}</span>
              <TimeBar left={item.left} />
            </span>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
