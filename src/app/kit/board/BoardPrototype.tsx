'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Button,
  HoldButton,
  Icon,
  IconButton,
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

/* A Move is where supply meets demand, drawn as two faces joined by a link and
   one price bar: what the buyer can pay against what the player costs. It is the
   same picture whether a club wants one of yours or a player you want is listed. */
interface Move {
  id: string;
  /** Who is asking. A role asks for a position and level; a named ask has neither. */
  demand: { who: MgrKey; pos?: string; level?: Level };
  /** What answers it. A stack when several of yours could. */
  supply: { players: Person[]; more?: number; owner?: MgrKey };
  budget: number;
  /** Where the price falls on the bar: one tick per player. */
  ticks: number[];
  stance: Stance[];
  /** Only the club that owns the player can see it. */
  direct?: boolean;
  actions: ('List' | 'Offer' | 'Bid')[];
}

const MOVES: Move[] = [
  { id: 'm1', demand: { who: 'totten' }, supply: { players: [P.rice] }, budget: 95, ticks: [120], stance: ['cash'], direct: true, actions: ['List', 'Offer'] },
  { id: 'm2', demand: { who: 'chelsz', pos: 'CB', level: 'starter' }, supply: { players: [P.saliba, P.gvardiol, P.colwill], more: 2 }, budget: 65, ticks: [85, 60, 38], stance: ['cash', 'players'], actions: ['Offer'] },
  { id: 'm3', demand: { who: 'hayden' }, supply: { players: [P.doku] }, budget: 50, ticks: [45], stance: ['players'], actions: ['Offer'] },
  { id: 'm4', demand: { who: 'me', pos: 'LB', level: 'starter' }, supply: { players: [P.hall], owner: 'chelsz' }, budget: 40, ticks: [24], stance: ['cash'], actions: ['Offer', 'Bid'] },
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
  /** Other clubs that have named him as a target. */
  rivals: MgrKey[];
}

const BOARD_LISTED: Listed[] = [
  { id: 'b1', who: P.gabriel, owner: 'pizza', price: 58, left: 0.52, clock: '2d 04h', rivals: ['tea', 'xabi'] },
  { id: 'b2', who: P.saka, owner: 'hayden', price: 120, left: 0.84, clock: '3d 11h', rivals: ['totten'] },
  { id: 'b3', who: P.hall, owner: 'chelsz', price: 24, left: 0.12, clock: '8h', rivals: ['me'] },
  { id: 'b4', who: P.colwill, owner: 'xabi', price: 38, left: null, clock: null, rivals: [] },
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
  { id: 'w1', from: 'totten', pos: 'CM', level: 'starter', budget: 80, stance: ['cash'] },
  { id: 'w2', from: 'hayden', pos: 'RW', level: 'star', budget: 120, stance: ['cash', 'loan'] },
  { id: 'w3', from: 'xabi', pos: 'GK', level: 'starter', budget: 30, stance: ['cash'] },
  { id: 'w4', from: 'tea', pos: 'RB', level: 'prospect', budget: 15, stance: ['cash'] },
];

/** Who owns a player the league can target; free agents have no owner. */
const OWNER_OF: Record<string, MgrKey> = { gabriel: 'pizza', haaland: 'hayden', wirtz: 'tea', saka: 'hayden', hall: 'chelsz', colwill: 'xabi' };

/** Positions where your squad is thin, read from the squad rather than asked for. */
const GAPS: { pos: string; have: Person[] }[] = [
  { pos: 'RB', have: [] },
  { pos: 'LW', have: [P.doku] },
  { pos: 'CM', have: [] },
];

/** The players in your squad, for the hub. */
const MINE = new Set(['havertz', 'doku', 'rice']);

/** Everything the market knows about one player, whichever mechanism it came through. */
interface Market {
  p: Person;
  mine: boolean;
  free: boolean;
  /** The other club that owns him. */
  owner?: MgrKey;
  listing?: { price: number; left: number | null; clock: string | null };
  /** Clubs that have named him as a target (for your own player: who is interested). */
  rivals: MgrKey[];
  lead?: MgrKey;
  /** Clubs asking for your player, with what they can pay. */
  asks: { who: MgrKey; budget: number; direct?: boolean }[];
  target?: Target;
  offer?: Sent;
}

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const posVar = (pos: string) => `var(--color-pos-${pos.toLowerCase()})`;
const posStyle = (pos: string) => ({ '--pos': posVar(pos), '--pos-line': `var(--color-pos-${pos.toLowerCase()}-line)` }) as CSSProperties;

type Sheet =
  | null
  | { kind: 'who' }
  | { kind: 'target'; who: Person | null; pos?: string; editing?: Target }
  | { kind: 'listing'; who: Person }
  | { kind: 'hub'; who: Person }
  | {
      kind: 'offer';
      mode: 'offer' | 'bid';
      /** One player, or several of yours that could answer the same ask. */
      players: Person[];
      counterpart?: MgrKey;
      /** What the buyer can pay: theirs when you sell, yours when you buy. */
      budget?: number;
      stance: Stance[];
      buying: boolean;
      /** Where to start when buying: the ask, or ask plus one for a bid. */
      amount?: number;
    };

/** An offer you have sent, kept where you sent it from. */
interface Sent {
  amount: number;
  to: MgrKey;
  who: Person;
}

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

/** What the buyer can pay (the fill) against what each player costs (the ticks). */
function PriceBar({ budget, ticks }: { budget: number; ticks: number[] }) {
  const max = Math.max(budget, ...ticks) * 1.1;
  return (
    <span className={styles.bar} aria-hidden="true">
      <i className={styles.barFill} style={{ width: `${(budget / max) * 100}%` }} />
      {ticks.map((t) => (
        <i key={t} className={`${styles.barTick} ${t > budget ? styles.barOver : ''}`} style={{ left: `${(t / max) * 100}%` }} />
      ))}
    </span>
  );
}

function MoveCard({
  m,
  i,
  sent,
  onAct,
  onOpen,
  onWithdraw,
}: {
  m: Move;
  i: number;
  sent?: Sent;
  onAct: (a: string) => void;
  onOpen: (p: Person) => void;
  onWithdraw: (p: Person) => void;
}) {
  const first = m.supply.players[0];
  const stack = m.supply.players.length > 1;
  const ground = MGR[m.demand.who].crest.primaryColor;
  return (
    <article className={styles.move} style={{ '--i': i } as CSSProperties}>
      <div className={styles.pair}>
        <div className={`${styles.side} ${styles.sideDemand}`} style={{ '--ground': ground } as CSSProperties}>
          <Mgr k={m.demand.who} size={56} />
          {m.direct && (
            <span className={styles.chipTL}>
              <Icon name="lock" size={12} />
            </span>
          )}
          <span className={styles.chipTR}>
            <Stances list={m.stance} />
          </span>
          {m.demand.pos && (
            <span className={styles.sideWhat}>
              <PositionBadge position={m.demand.pos} size="sm" />
              <Level level={m.demand.level!} />
            </span>
          )}
        </div>
        <span className={styles.link} aria-hidden="true">
          <Icon name="repeat" size={16} />
        </span>
        <div
          className={`${styles.side} ${styles.sideSupply} ${stack ? '' : styles.sideOpen}`}
          style={posStyle(first.pos)}
          role={stack ? undefined : 'button'}
          tabIndex={stack ? undefined : 0}
          aria-label={stack ? undefined : first.name}
          onClick={stack ? undefined : () => onOpen(first)}
          onKeyDown={stack ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(first); } }}
        >
          {stack ? (
            <>
              {m.supply.players.map((p, j) => (
                <span key={p.id} className={styles.stackFace} style={{ left: `${j * 30 - 4}px`, zIndex: 3 - j }}>
                  <Cutout p={p} />
                </span>
              ))}
              <span className={styles.stackMore}>+{m.supply.more}</span>
            </>
          ) : (
            <Cutout p={first} />
          )}
          {m.supply.owner && (
            <span className={styles.matchCrest} style={{ left: 8, bottom: 8, width: 26, height: 26 }}>
              <Mgr k={m.supply.owner} size={20} />
            </span>
          )}
        </div>
      </div>
      <span className={`g-namerow ${styles.moveName}`}>
        <PositionBadge position={first.pos} size="sm" />
        <span className={styles.clip}>{stack ? `${first.name.split(' ').pop()} +${(m.supply.more ?? 0) + m.supply.players.length - 1}` : first.name}</span>
      </span>
      <div className={styles.moveBar}>
        <PriceBar budget={m.budget} ticks={sent ? [sent.amount] : m.ticks} />
        <span className={styles.barNums}>
          <b className={styles.numBudget}>€{m.budget}m</b>
          {(!stack || sent) && <b className={styles.numPrice}>€{sent ? sent.amount : m.ticks[0]}m</b>}
        </span>
      </div>
      {sent ? (
        <div className={styles.moveActions}>
          <span className={styles.moveSent}>
            <Mgr k="me" size={22} />
            <Icon name="chevron-right" size={14} />
            <Mgr k={sent.to} size={22} />
            <span className={styles.pendingClock}>
              <Icon name="activity" size={14} />
            </span>
          </span>
          <HoldButton size="sm" onConfirm={() => onWithdraw(sent.who)}>
            Withdraw
          </HoldButton>
        </div>
      ) : (
        <div className={styles.moveActions}>
          {m.actions.map((a, j) => (
            <Button key={a} variant={j === m.actions.length - 1 ? 'primary' : 'secondary'} size="sm" fullWidth onClick={() => onAct(a)}>
              {a}
            </Button>
          ))}
        </div>
      )}
    </article>
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
  const [data, setData] = useState<'full' | 'new'>('full');
  const [targets, setTargets] = useState<Target[]>(TARGETS);
  const [fresh, setFresh] = useState<string | null>(null);
  const [offers, setOffers] = useState<Record<string, Sent>>({});
  const serial = useRef(0);
  const tilesRef = useRef<HTMLDivElement>(null);
  const isNew = data === 'new';

  const applyData = (d: 'full' | 'new') => {
    setData(d);
    setTargets(d === 'new' ? [] : TARGETS);
  };

  /** One tap: a target with sensible defaults, undoable, refined later by tapping its tile. */
  const addTarget = (who: Person | null, pos: string) => {
    const id = `n${++serial.current}`;
    const t: Target = who
      ? { id, who, pos: who.pos, budget: who.value, stance: ['cash'], audience: 'you', owner: OWNER_OF[who.id], state: { kind: 'quiet' } }
      : { id, who: null, pos, level: 'starter', budget: 40, stance: ['cash'], audience: 'league', state: { kind: 'quiet' } };
    setTargets((l) => [t, ...l]);
    setFresh(id);
    tilesRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    window.setTimeout(() => setFresh((f) => (f === id ? null : f)), 1800);
    toast(who ? who.name : `${pos} Starter`, {
      description: `€${t.budget}m`,
      action: { label: 'Undo', onClick: () => setTargets((l) => l.filter((x) => x.id !== id)) },
    });
  };
  const targetOf = (personId: string) => targets.find((t) => t.who?.id === personId);

  const marketOf = (p: Person): Market => {
    const row = BOARD_LISTED.find((r) => r.who.id === p.id);
    const mine = MINE.has(p.id);
    const own = LISTINGS.find((l) => l.who.id === p.id);
    return {
      p,
      mine,
      free: p.id === 'kroupi',
      owner: mine ? undefined : (row?.owner ?? OWNER_OF[p.id]),
      listing: row ? { price: row.price, left: row.left, clock: row.clock } : own ? { price: own.price, left: own.left, clock: own.clock } : undefined,
      rivals: row ? row.rivals : (own?.interest ?? []),
      lead: own?.lead,
      asks: MOVES.filter((m) => m.demand.who !== 'me' && m.supply.players.length === 1 && m.supply.players[0].id === p.id).map((m) => ({ who: m.demand.who, budget: m.budget, direct: m.direct })),
      target: targetOf(p.id),
      offer: offers[p.id],
    };
  };

  /** Offer and Bid on a Your Move card open the same prefilled sheet; List goes to the listing. */
  const openOffer = (m: Move, action: string) => {
    if (action === 'List') return setSheet({ kind: 'listing', who: m.supply.players[0] });
    const buying = m.demand.who === 'me';
    setSheet({
      kind: 'offer',
      mode: action === 'Bid' ? 'bid' : 'offer',
      players: m.supply.players,
      counterpart: buying ? m.supply.owner : m.demand.who,
      budget: m.budget,
      stance: m.stance,
      buying,
      amount: buying ? m.ticks[0] + (action === 'Bid' ? 1 : 0) : undefined,
    });
  };

  const send = (mode: 'offer' | 'bid', p: Person, amount: number, to?: MgrKey) => {
    setSheet(null);
    if (mode === 'bid') return toast.success('Bid placed', { description: `${p.name} · €${amount}m` });
    if (to) setOffers((o) => ({ ...o, [p.id]: { amount, to, who: p } }));
    toast.success('Offer sent', { description: `${p.name} · €${amount}m` });
  };

  const withdraw = (p: Person) => {
    setOffers((o) => Object.fromEntries(Object.entries(o).filter(([id]) => id !== p.id)));
    toast('Offer withdrawn', { description: p.name });
  };

  const toggleTarget = (p: Person) => {
    const t = targetOf(p.id);
    if (!t) return addTarget(p, p.pos);
    setTargets((l) => l.filter((x) => x.id !== t.id));
    toast('Target removed', { description: p.name, action: { label: 'Undo', onClick: () => setTargets((l) => [t, ...l]) } });
  };
  const gaps = GAPS.filter((g) => !targets.some((t) => !t.who && t.pos === g.pos)).slice(0, isNew ? 3 : 2);

  const applyTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
  };

  const listed = BOARD_LISTED.filter((r) => !pos || r.who.pos === pos);
  const wanted = BOARD_WANTED.filter((r) => !pos || r.pos === pos);
  const supplyAt = (p: string) => BOARD_LISTED.filter((r) => r.who.pos === p).length;
  const demandAt = (p: string) => BOARD_WANTED.filter((r) => r.pos === p).length;

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
        <SegmentedControl
          size="sm"
          ariaLabel="Squad"
          value={data}
          onChange={applyData}
          options={[
            { value: 'full', label: 'Full' },
            { value: 'new', label: 'New' },
          ]}
        />
      </div>

      <div className={styles.fab}>
        <Button variant="primary" onClick={() => setSheet({ kind: 'who' })}>
          <span className={styles.btnIn}><Icon name="plus" size={16} />Add</span>
        </Button>
      </div>

      <div className={styles.page}>
        {/* The anchor field: the green shelf, with what is waiting on you resting on its edge. */}
        <div className={`${styles.top} ${isNew ? styles.topQuiet : ''}`}>
          <div className={styles.shelfBg} aria-hidden="true" />
          <div className={styles.shelfIn}>
            <div className={styles.mast}>
              <h1 className={styles.title}>The Board</h1>
              <span className={styles.balance}>
                <Mgr k="me" size={26} />
                <b><NumberRoll value={204} format={(n) => `€${n}m`} /></b>
              </span>
            </div>

            {!isNew && (
              <>
            <div className={styles.askHead}>
              <h2 className={styles.askT}>Your Move</h2>
              <span className={styles.askCount}>{MOVES.length}</span>
            </div>
            <div className={styles.asks}>
              {MOVES.map((m, i) => (
                <MoveCard
                  key={m.id}
                  m={m}
                  i={i}
                  sent={m.supply.players.map((p) => offers[p.id]).find(Boolean)}
                  onAct={(a) => openOffer(m, a)}
                  onOpen={(p) => setSheet({ kind: 'hub', who: p })}
                  onWithdraw={withdraw}
                />
              ))}
            </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.cols}>
          <section className={styles.targets} aria-labelledby="h-targets">
            <div className={styles.head}>
              <h2 id="h-targets" className={styles.headT}>Your Targets</h2>
              <div className={styles.headEnd}>
                <Pips on={targets.length} total={10} />
              </div>
            </div>
            <div className={styles.tiles} ref={tilesRef}>
              {targets.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.tile} ${t.state.kind === 'match' ? styles.tileMatch : ''} ${fresh === t.id ? styles.tileNew : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  onClick={() => setSheet(t.who ? { kind: 'hub', who: t.who } : { kind: 'target', who: null, pos: t.pos, editing: t })}
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
                    ) : t.who && offers[t.who.id] ? (
                      <span className={`${styles.liveStrip} ${styles.offerStrip}`}>
                        <Icon name="arrow-up" size={14} />
                        <b>€{offers[t.who.id].amount}m</b>
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
              {gaps.map((g, i) => (
                <button
                  key={g.pos}
                  type="button"
                  className={`${styles.tile} ${styles.gap}`}
                  style={{ '--i': targets.length + i } as CSSProperties}
                  onClick={() => addTarget(null, g.pos)}
                  aria-label={`Target a ${g.pos}`}
                >
                  <span className={styles.gapPlinth} style={posStyle(g.pos)}>
                    <span className={styles.gapPos}>{g.pos}</span>
                    {/* The squad at this position: who you have, and the empty place. */}
                    <span className={styles.gapDepth}>
                      {g.have.map((p) => (
                        <span key={p.id} className={styles.gapFace}>
                          <Portrait photoUrl={String(p.code)} name={p.name} club={null} size="xxs" headTopPct={null} headWidthPct={null} photoVersion={null} />
                        </span>
                      ))}
                      <span className={styles.gapSlot}>
                        <Icon name="plus" size={16} />
                      </span>
                    </span>
                  </span>
                  <span className={`g-namerow ${styles.tileName}`}>
                    <PositionBadge position={g.pos} size="sm" />
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
                const sup = supplyAt(p);
                const dem = demandAt(p);
                return (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.posChip} ${pos === p ? styles.posChipOn : ''}`}
                    style={posStyle(p)}
                    disabled={sup + dem === 0}
                    aria-pressed={pos === p}
                    aria-label={`${p}, ${sup} listed, ${dem} wanted`}
                    onClick={() => setPos(pos === p ? null : p)}
                  >
                    {p}
                    {/* Supply and demand at this position, as two bars. */}
                    <span className={styles.depth} aria-hidden="true">
                      <i style={{ height: 4 + sup * 6 }} />
                      <i className={styles.depthWant} style={{ height: 4 + dem * 6 }} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className={styles.rows}>
              {view === 'listed' &&
                listed.map((r) => (
                  <div key={r.id} className={styles.lrow}>
                    <button type="button" className={styles.rowHit} aria-label={r.who.name} onClick={() => setSheet({ kind: 'hub', who: r.who })} />
                    <Portrait photoUrl={String(r.who.code)} name={r.who.name} club={r.who.club} size="sm" headTopPct={null} headWidthPct={null} photoVersion={null} />
                    <span className={styles.lBody}>
                      <span className={`g-namerow ${styles.lName}`}>
                        <PositionBadge position={r.who.pos} size="sm" />
                        <span className={styles.clip}>{r.who.name}</span>
                      </span>
                      <span className={styles.lSub}>
                        <Mgr k={r.owner} size={16} />
                        {MGR[r.owner].short}
                        {r.rivals.length > 0 && <CrestStack keys={r.rivals} size={20} />}
                      </span>
                    </span>
                    <span className={styles.lEnd}>
                      <Money n={r.price} />
                      {r.clock ? <span className={`${styles.clock} ${r.left! < 0.2 ? styles.clockUrgent : ''}`}>{r.clock}</span> : <span className={styles.offersOnly}>Offers</span>}
                      {offers[r.who.id] && (
                        <span className={styles.offerPill}>
                          <Icon name="arrow-up" size={12} />€{offers[r.who.id].amount}m
                        </span>
                      )}
                    </span>
                    <span className={styles.star}>
                      <IconButton
                        label={targetOf(r.who.id) ? 'Edit Target' : 'Target'}
                        variant="ghost"
                        size="md"
                        aria-pressed={!!targetOf(r.who.id)}
                        className={targetOf(r.who.id) ? styles.starOn : ''}
                        icon={<Icon name="star" size={18} fill={targetOf(r.who.id) ? 'currentColor' : 'none'} />}
                        onClick={() => {
                          const t = targetOf(r.who.id);
                          if (t) setSheet({ kind: 'target', who: t.who, pos: t.pos, editing: t });
                          else addTarget(r.who, r.who.pos);
                        }}
                      />
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

          {!isNew && (
          <section className={styles.listings} aria-labelledby="h-listings">
            <div className={styles.head}>
              <h2 id="h-listings" className={styles.headT}>Your Listings</h2>
            </div>
            <div className={styles.rows}>
              {LISTINGS.map((l) => (
                <button key={l.id} type="button" className={styles.lrow} onClick={() => setSheet({ kind: 'hub', who: l.who })}>
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
          )}
        </div>
      </div>

      <Sheets
        sheet={sheet}
        onClose={() => setSheet(null)}
        go={setSheet}
        targeted={(id) => targetOf(id)}
        market={marketOf}
        onStar={toggleTarget}
        onSend={send}
        onWithdraw={withdraw}
        onTarget={(p) => {
          setSheet(null);
          addTarget(p, p.pos);
        }}
        onRole={(pos) => {
          setSheet(null);
          addTarget(null, pos);
        }}
      />
    </div>
  );
}

/* ---------- the sheets ---------- */

function Sheets({
  sheet,
  onClose,
  go,
  targeted,
  market,
  onStar,
  onSend,
  onWithdraw,
  onTarget,
  onRole,
}: {
  sheet: Sheet;
  onClose: () => void;
  go: (s: Sheet) => void;
  targeted: (personId: string) => Target | undefined;
  market: (p: Person) => Market;
  onStar: (p: Person) => void;
  onSend: (mode: 'offer' | 'bid', p: Person, amount: number, to?: MgrKey) => void;
  onWithdraw: (p: Person) => void;
  onTarget: (p: Person) => void;
  onRole: (pos: string) => void;
}) {
  if (!sheet) return null;
  if (sheet.kind === 'who') return <WhoSheet onClose={onClose} go={go} targeted={targeted} onTarget={onTarget} onRole={onRole} />;
  if (sheet.kind === 'target') return <TargetSheet key={sheet.editing?.id ?? sheet.who?.id ?? sheet.pos ?? 'new'} sheet={sheet} onClose={onClose} />;
  if (sheet.kind === 'listing') return <ListingSheet key={sheet.who.id} who={sheet.who} onClose={onClose} />;
  if (sheet.kind === 'offer') return <OfferSheet key={sheet.players.map((p) => p.id).join()} s={sheet} onClose={onClose} onSend={onSend} />;
  return <HubSheet m={market(sheet.who)} onClose={onClose} go={go} onStar={onStar} onWithdraw={onWithdraw} />;
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

function WhoSheet({
  onClose,
  go,
  targeted,
  onTarget,
  onRole,
}: {
  onClose: () => void;
  go: (s: Sheet) => void;
  targeted: (personId: string) => Target | undefined;
  onTarget: (p: Person) => void;
  onRole: (pos: string) => void;
}) {
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

  /** `mark` says what a tap does: add at once (plus), open (chevron) or already added (tick). */
  const row = (p: Person, end: ReactNode, mark: 'add' | 'open' | 'done', onPick: () => void) => (
    <button key={p.id} type="button" className={styles.pick} onClick={onPick}>
      <Portrait photoUrl={String(p.code)} name={p.name} club={p.club} size="sm" headTopPct={null} headWidthPct={null} photoVersion={null} />
      <span className={`g-namerow ${styles.pickName}`}>
        <PositionBadge position={p.pos} size="sm" />
        <span className={styles.clip}>{p.name}</span>
      </span>
      <span className={styles.pickEnd}>
        {end}
        <Money n={p.value} className={styles.pickValue} />
        <span className={`${styles.pickMark} ${mark === 'add' ? styles.markAdd : mark === 'done' ? styles.markDone : ''}`}>
          <Icon name={mark === 'add' ? 'plus' : mark === 'done' ? 'check' : 'chevron-right'} size={16} />
        </span>
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
        <PosPicker value="" onChange={onRole} />
        <div className={styles.pickList}>
          {squad.filter(match).map((p) => row(p, <Mgr k="me" size={20} />, 'open', () => go({ kind: 'listing', who: p })))}
          {others.filter((o) => match(o.p)).map((o) => {
            const t = targeted(o.p.id);
            return row(o.p, <Mgr k={o.owner} size={20} />, t ? 'done' : 'add', () => (t ? go({ kind: 'target', who: t.who, pos: t.pos, editing: t }) : onTarget(o.p)));
          })}
          {free.filter(match).map((p) => {
            const t = targeted(p.id);
            return row(p, <span className={styles.freeTag}>Free</span>, t ? 'done' : 'add', () => (t ? go({ kind: 'target', who: t.who, pos: t.pos, editing: t }) : onTarget(p)));
          })}
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

/** The player as the hub: every way into him, as one picture, with the actions that fit his state. */
function HubSheet({
  m,
  onClose,
  go,
  onStar,
  onWithdraw,
}: {
  m: Market;
  onClose: () => void;
  go: (s: Sheet) => void;
  onStar: (p: Person) => void;
  onWithdraw: (p: Person) => void;
}) {
  const { p } = m;
  const price = m.listing?.price ?? p.value;
  const bidAmount = m.free ? Math.round(p.value * 0.6) : (m.listing?.price ?? 0) + 1;
  const canBid = m.free || !!m.listing?.clock;
  const offerAmount = m.listing?.price ?? p.value;

  const offerSheet = (mode: 'offer' | 'bid'): Sheet => ({
    kind: 'offer',
    mode,
    players: [p],
    counterpart: m.owner,
    budget: m.target?.budget,
    stance: m.target?.stance ?? ['cash'],
    buying: true,
    amount: mode === 'bid' ? bidAmount : offerAmount,
  });

  const footer = m.mine ? (
    <div className={styles.footer}>
      {m.offer && (
        <HoldButton size="sm" onConfirm={() => onWithdraw(p)}>
          Withdraw
        </HoldButton>
      )}
      <Button variant="primary" onClick={() => go({ kind: 'listing', who: p })}>
        {m.listing ? 'Edit Listing' : 'List'}
      </Button>
    </div>
  ) : (
    <div className={styles.footer}>
      {m.offer ? (
        <HoldButton size="sm" onConfirm={() => onWithdraw(p)}>
          Withdraw
        </HoldButton>
      ) : (
        !m.free && (
          <Button variant={canBid ? 'secondary' : 'primary'} onClick={() => go(offerSheet('offer'))}>
            Offer €{offerAmount}m
          </Button>
        )
      )}
      {canBid && (
        <Button variant="primary" onClick={() => go(offerSheet('bid'))}>
          Bid €{bidAmount}m
        </Button>
      )}
    </div>
  );

  return (
    <ResponsiveModal open onClose={onClose} title={p.name} padded footer={footer}>
      <div className={styles.form}>
        <div className={styles.hubHead}>
          <div className={styles.plateImg} style={posStyle(p.pos)}>
            <Cutout p={p} />
          </div>
          <div className={styles.plateBody}>
            <span className={`g-namerow ${styles.plateName}`}>
              <PositionBadge position={p.pos} size="sm" />
              {m.owner && <Mgr k={m.owner} size={22} />}
              {m.free && <span className={styles.freeTag}>Free</span>}
            </span>
            <span className={styles.plateSub}>
              <ClubBadge club={p.club} size={16} />
              {p.club}
            </span>
            {!m.listing && <Money n={p.value} className={styles.plateValue} />}
          </div>
          {!m.mine && (
            <span className={styles.hubStar}>
              <IconButton
                label={m.target ? 'Remove Target' : 'Target'}
                variant="ghost"
                aria-pressed={!!m.target}
                className={m.target ? styles.starOn : ''}
                icon={<Icon name="star" size={20} fill={m.target ? 'currentColor' : 'none'} />}
                onClick={() => onStar(p)}
              />
            </span>
          )}
        </div>

        {m.listing && (
          <div className={styles.listedFoot}>
            <Money n={m.listing.price} className={styles.bigMoney} />
            {m.listing.clock ? (
              <span className={styles.listedClock}>
                <span className={`${styles.clock} ${m.listing.left! < 0.2 ? styles.clockUrgent : ''}`}>{m.listing.clock}</span>
                <TimeBar left={m.listing.left} />
              </span>
            ) : (
              <span className={styles.offersOnly}>Offers</span>
            )}
          </div>
        )}

        {/* Who else is after him: the same star as the target button, then their crests. */}
        {m.rivals.some((k) => k !== 'me') && (
          <div className={styles.hubRow}>
            <Icon name="star" size={16} />
            <CrestStack keys={m.rivals.filter((k) => k !== 'me')} size={28} lead={m.lead} />
          </div>
        )}

        {/* Clubs asking for your player: their crest, and what they can pay against what he is worth. */}
        {m.asks.map((a) => (
          <div key={a.who} className={styles.stake}>
            <Mgr k={a.who} size={28} />
            <div className={styles.stakeBar}>
              <PriceBar budget={a.budget} ticks={[p.value]} />
              <span className={styles.barNums}>
                <b className={styles.numBudget}>€{a.budget}m</b>
                <b className={styles.numPrice}>€{p.value}m</b>
              </span>
            </div>
            {a.direct && <Icon name="lock" size={14} />}
          </div>
        ))}

        {/* Your own target: what you can pay against what he costs, and the way to change it. */}
        {m.target && (
          <div className={styles.stake}>
            <Mgr k="me" size={28} />
            <div className={styles.stakeBar}>
              <PriceBar budget={m.target.budget} ticks={[price]} />
              <span className={styles.barNums}>
                <b className={styles.numBudget}>€{m.target.budget}m</b>
                <b className={styles.numPrice}>€{price}m</b>
              </span>
            </div>
            <Stances list={m.target.stance} />
            <IconButton
              label="Edit Target"
              variant="ghost"
              icon={<Icon name="settings" size={18} />}
              onClick={() => go({ kind: 'target', who: p, pos: p.pos, editing: m.target })}
            />
          </div>
        )}

        {/* Your offer, still standing: you, then him, then the amount. */}
        {m.offer && (
          <div className={styles.pending}>
            <Mgr k="me" size={26} />
            <Icon name="chevron-right" size={14} />
            <Mgr k={m.offer.to} size={26} />
            <b className={styles.money}>€{m.offer.amount}m</b>
            <span className={styles.pendingClock}>
              <Icon name="activity" size={14} />
            </span>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}

/** Offer or Bid, already filled in: the amount, the terms and, when several of yours could answer, the player. One confirm sends it. */
function OfferSheet({
  s,
  onClose,
  onSend,
}: {
  s: Extract<Sheet, { kind: 'offer' }>;
  onClose: () => void;
  onSend: (mode: 'offer' | 'bid', p: Person, amount: number, to?: MgrKey) => void;
}) {
  const startFor = (p: Person) => (s.buying ? (s.amount ?? p.value) : Math.min(p.value, s.budget ?? p.value));
  // Several of yours could answer: start on the dearest one the buyer can afford.
  const best =
    s.players.length > 1 && s.budget !== undefined
      ? ([...s.players].filter((p) => p.value <= s.budget!).sort((a, b) => b.value - a.value)[0] ?? [...s.players].sort((a, b) => a.value - b.value)[0])
      : s.players[0];
  const [pickId, setPickId] = useState(best.id);
  const p = s.players.find((x) => x.id === pickId) ?? best;
  const [amount, setAmount] = useState(startFor(best));
  const [stance, setStance] = useState<Stance[]>(s.stance);
  const word = s.mode === 'bid' ? 'Bid' : 'Offer';

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title={word}
      padded
      footer={
        <div className={styles.footer}>
          <Button variant="primary" onClick={() => onSend(s.mode, p, amount, s.counterpart)}>
            {s.mode === 'bid' ? 'Bid' : 'Send'} €{amount}m
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        <div className={styles.hubHead}>
          <div className={styles.plateImg} style={posStyle(p.pos)}>
            <Cutout p={p} />
          </div>
          <div className={styles.plateBody}>
            <span className={`g-namerow ${styles.plateName}`}>
              <PositionBadge position={p.pos} size="sm" />
              <span>{p.name}</span>
            </span>
            {s.counterpart && (
              <span className={styles.offerLink}>
                <Mgr k="me" size={26} />
                <Icon name="chevron-right" size={14} />
                <Mgr k={s.counterpart} size={26} />
              </span>
            )}
          </div>
        </div>

        {s.players.length > 1 && (
          <div className={styles.choices} role="radiogroup" aria-label="Player">
            {s.players.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === p.id}
                aria-label={c.name}
                className={`${styles.choice} ${c.id === p.id ? styles.choiceOn : ''}`}
                onClick={() => {
                  setPickId(c.id);
                  setAmount(startFor(c));
                }}
              >
                <span className={styles.choiceFace} style={posStyle(c.pos)}>
                  <Cutout p={c} />
                </span>
                <b className={styles.choiceValue}>€{c.value}m</b>
              </button>
            ))}
          </div>
        )}

        <MoneyStepper fullWidth label={word} value={amount} onChange={setAmount} min={1} max={300} step={1} />

        {/* What the buyer can pay against the amount: the tick turns red past it. */}
        {s.budget !== undefined && (
          <div className={styles.moveBar}>
            <PriceBar budget={s.budget} ticks={[amount]} />
            <span className={styles.barNums}>
              <b className={styles.numBudget}>€{s.budget}m</b>
              <b className={styles.numPrice}>€{amount}m</b>
            </span>
          </div>
        )}

        {s.mode === 'offer' && <StanceChips value={stance} onChange={setStance} />}
      </div>
    </ResponsiveModal>
  );
}
