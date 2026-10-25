'use client';

import { useState } from 'react';
import {
  Button,
  Checkbox,
  HoldButton,
  Icon,
  MoneyStepper,
  ResponsiveModal,
  SegmentedControl,
  Select,
  toast,
} from '@/components/ui';
import Portrait from '@/components/players/Portrait';
import PositionBadge from '@/components/players/PositionBadge';
import CrestBadge from '@/components/crest/CrestBadge';
import styles from './board.module.css';

/* Prototype only. Every name, price and clock here is invented; no route is
   called. It is drawn from the kit and the app's tokens so that what is
   approved is what ships, with nothing to port. */

const photo = (code: number) => `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code}.png`;

interface Person {
  id: string;
  name: string;
  pos: string;
  club: string;
  value: number;
  photo?: string;
}

const PEOPLE: Record<string, Person> = {
  rice: { id: 'rice', name: 'Declan Rice', pos: 'DM', club: 'Arsenal', value: 120, photo: photo(204480) },
  gabriel: { id: 'gabriel', name: 'Gabriel', pos: 'CB', club: 'Arsenal', value: 100, photo: photo(226597) },
  haaland: { id: 'haaland', name: 'Erling Haaland', pos: 'ST', club: 'Man City', value: 220, photo: photo(223094) },
  wirtz: { id: 'wirtz', name: 'Florian Wirtz', pos: 'AM', club: 'Liverpool', value: 100, photo: photo(494595) },
  havertz: { id: 'havertz', name: 'Kai Havertz', pos: 'ST', club: 'Arsenal', value: 55 },
  ndiaye: { id: 'ndiaye', name: 'Iliman Ndiaye', pos: 'LW', club: 'Everton', value: 45 },
  kroupi: { id: 'kroupi', name: 'Eli Junior Kroupi', pos: 'ST', club: 'Bournemouth', value: 12 },
};

type Audience = 'you' | 'club' | 'league';
const AUDIENCE_LABEL: Record<Audience, string> = { you: 'Only you', club: "Only Pizzaking's Club", league: 'The league' };

interface Target {
  id: string;
  who: Person | null;
  role?: string;
  pos: string;
  terms: string;
  audience: Audience;
  state: { kind: 'auction'; bid: number; ends: string } | { kind: 'match'; text: string } | { kind: 'quiet' };
  note?: string;
}

const TARGETS: Target[] = [
  { id: 't1', who: PEOPLE.gabriel, pos: 'CB', terms: 'Will pay cash · up to €110m', audience: 'club', state: { kind: 'auction', bid: 58, ends: '2d 04h' }, note: "Pizzaking's Club listed him" },
  { id: 't2', who: PEOPLE.haaland, pos: 'ST', terms: 'Will pay cash · up to €230m', audience: 'you', state: { kind: 'quiet' }, note: 'Tea FC want him too' },
  { id: 't3', who: PEOPLE.wirtz, pos: 'AM', terms: 'Offering players', audience: 'league', state: { kind: 'quiet' }, note: 'ChelsZ FC want him too' },
  { id: 't4', who: null, role: 'Starting Left-Back', pos: 'LB', terms: 'Will pay cash · up to €40m', audience: 'league', state: { kind: 'match', text: 'ChelsZ FC listed Hall' } },
];

interface Want {
  id: string;
  club: string;
  line: string;
  terms: string;
  yours: { text: string; count?: number } | { person: Person; text: string };
  actions: [string, string];
}

const WANTED: Want[] = [
  { id: 'w1', club: 'tottenyang FC', line: 'want Declan Rice', terms: 'Will pay cash · up to €95m', yours: { person: PEOPLE.rice, text: 'Only you can see this' }, actions: ['List', 'Offer'] },
  { id: 'w2', club: 'ChelsZ FC', line: 'want a starting centre-back', terms: 'Will pay cash · up to €35m', yours: { text: 'Gvardiol, Colwill +3', count: 5 }, actions: ['Message', 'Offer'] },
  { id: 'w3', club: 'Tea FC', line: 'want a striker prospect', terms: 'Offering players', yours: { person: PEOPLE.kroupi, text: '20 · Academy' }, actions: ['Message', 'Offer'] },
];

const LISTINGS = [
  { id: 'l1', who: PEOPLE.havertz, interest: 'ChelsZ FC lead · 2 bids', price: 36, sub: 'High bid', ends: '1d 06h' },
  { id: 'l2', who: PEOPLE.ndiaye, interest: 'Hayden FC want him', price: 45, sub: 'Offers only', ends: null },
];

const BOARD_LISTED = [
  { id: 'b1', who: PEOPLE.rice, owner: 'Hayden FC', price: 120, sub: 'Asking', ends: '3d 11h' },
  { id: 'b2', who: PEOPLE.gabriel, owner: "Pizzaking's Club", price: 58, sub: 'High bid', ends: '2d 04h' },
  { id: 'b3', who: PEOPLE.kroupi, owner: 'Tea FC', price: 12, sub: 'Offers only', ends: null },
];
const BOARD_WANTED = [
  { id: 'bw1', club: 'tottenyang FC', line: 'want a defensive midfielder', terms: 'Will pay cash · up to €80m', pos: 'DM' },
  { id: 'bw2', club: 'Hayden FC', line: 'want Iliman Ndiaye', terms: 'Offering players', pos: 'LW' },
  { id: 'bw3', club: 'Not Too Xabi', line: 'want a starting striker', terms: 'Will pay cash · up to €120m', pos: 'ST' },
];

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

type Sheet =
  | null
  | { kind: 'who' }
  | { kind: 'named'; who: Person; editing?: Target }
  | { kind: 'role'; editing?: Target }
  | { kind: 'listing'; who: Person }
  | { kind: 'listed'; who: Person; owner: string; price: number };

const crest = (name: string, size = 22) => <CrestBadge config={null} teamName={name} size={size} interactive={false} />;

function Face({ p, size = 'xs' }: { p: Person; size?: 'xs' | 'xxs' }) {
  return <Portrait photoUrl={p.photo ?? null} name={p.name} club={null} size={size} headTopPct={null} headWidthPct={null} photoVersion={null} />;
}

function Heading({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className={styles.sect}>
      <h2 className={styles.sectT}>{title}</h2>
      {hint && <span className={styles.sectHint}>{hint}</span>}
      {right && <span className={styles.sectRight}>{right}</span>}
    </div>
  );
}

function AudienceLine({ a }: { a: Audience }) {
  return (
    <span className={styles.audience}>
      <Icon name={a === 'league' ? 'users' : 'lock'} size={12} />
      {AUDIENCE_LABEL[a]}
    </span>
  );
}

export default function BoardPrototype() {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [view, setView] = useState<'listed' | 'wanted'>('listed');
  const [position, setPosition] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const applyTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
  };

  const listed = BOARD_LISTED.filter((r) => !position || r.who.pos === position);
  const wanted = BOARD_WANTED.filter((r) => !position || r.pos === position);
  const countFor = (pos: string) =>
    (view === 'listed' ? BOARD_LISTED.filter((r) => r.who.pos === pos) : BOARD_WANTED.filter((r) => r.pos === pos)).length;

  return (
    <div className={styles.page}>
      <div className={styles.proto}>
        <span>Prototype · invented data</span>
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

      <header className={styles.mast}>
        <h1 className={styles.title}>The Board</h1>
        <div className={styles.stats}>
          <div className={styles.stat}><b className={styles.figAccent}>€204m</b><span>Club Balance</span></div>
          <div className={styles.stat}><b>3</b><span>Wanted from you</span></div>
          <div className={styles.stat}><b>4 of 10</b><span>Targets</span></div>
          <div className={styles.stat}><b>2</b><span>Listed</span></div>
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.main}>
          <section className={styles.toAnswer}>
            <Heading title="Wanted From You" hint="You could answer these" />
            <div className={styles.panel}>
              {WANTED.map((w) => (
                <article key={w.id} className={styles.want}>
                  <div className={styles.wantTop}>
                    <span className={styles.wantCrest}>{crest(w.club, 28)}</span>
                    <div className={styles.wantText}>
                      <h3 className={styles.wantLine}>{w.club} {w.line}</h3>
                      <p className={styles.terms}>{w.terms}</p>
                    </div>
                  </div>
                  <div className={styles.wantYours}>
                    {'person' in w.yours ? (
                      <>
                        <Face p={w.yours.person} size="xxs" />
                        <span className={styles.yoursName}>{w.yours.person.name}<PositionBadge position={w.yours.person.pos} size="sm" /></span>
                        <span className={styles.yoursSub}>{w.yours.text}</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.haveCount}>{w.yours.count}</span>
                        <span className={styles.yoursName}>You have {w.yours.count}</span>
                        <span className={styles.yoursSub}>{w.yours.text}</span>
                      </>
                    )}
                  </div>
                  <div className={styles.wantActions}>
                    <Button variant="secondary" fullWidth onClick={() => toast(`${w.actions[0]} sent`)}>{w.actions[0]}</Button>
                    <Button variant="primary" fullWidth onClick={() => toast('Offer opened')}>{w.actions[1]}</Button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <Heading title="Your Targets" hint="4 of 10" right={<Button size="sm" variant="primary" onClick={() => setSheet({ kind: 'who' })}>Add</Button>} />
            <div className={styles.panel}>
              {TARGETS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={styles.row}
                  onClick={() => setSheet(t.who ? { kind: 'named', who: t.who, editing: t } : { kind: 'role', editing: t })}
                >
                  {t.who ? <Face p={t.who} /> : <span className={styles.posTile} style={{ '--pos': `var(--color-pos-${t.pos.toLowerCase()})` } as React.CSSProperties}>{t.pos}</span>}
                  <span className={styles.rowBody}>
                    <span className={styles.rowName}>
                      {t.who?.name ?? t.role}
                      <PositionBadge position={t.pos} size="sm" />
                    </span>
                    <span className={styles.rowSub}>{t.terms}</span>
                    <span className={styles.rowMeta}>
                      <AudienceLine a={t.audience} />
                      {t.state.kind === 'quiet' && t.note && <span>{t.note}</span>}
                      {t.state.kind === 'match' && <span className={styles.matchText}>{t.state.text}</span>}
                    </span>
                  </span>
                  {/* A target nobody has listed has nothing to say on the right. */}
                  {t.state.kind === 'auction' && (
                    <span className={styles.rowEnd}>
                      <span className={styles.atAuction}>At auction</span>
                      <b className={styles.money}>€{t.state.bid}m</b>
                      <span className={styles.clock}>{t.state.ends}</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section>
            <Heading title="Your Listings" hint="2 live" right={<Button size="sm" variant="primary" onClick={() => setSheet({ kind: 'listing', who: PEOPLE.havertz })}>Add</Button>} />
            <div className={styles.panel}>
              {LISTINGS.map((l) => (
                <button key={l.id} type="button" className={styles.row} onClick={() => setSheet({ kind: 'listing', who: l.who })}>
                  <Face p={l.who} />
                  <span className={styles.rowBody}>
                    <span className={styles.rowName}>{l.who.name}<PositionBadge position={l.who.pos} size="sm" /></span>
                    <span className={styles.rowSub}>{l.interest}</span>
                  </span>
                  <span className={styles.rowEnd}>
                    <b className={styles.money}>€{l.price}m</b>
                    <span className={styles.quiet}>{l.sub}</span>
                    {l.ends && <span className={styles.clock}>{l.ends}</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <Heading
              title="The Board"
              right={
                <SegmentedControl
                  variant="ink"
                  size="sm"
                  ariaLabel="Board view"
                  value={view}
                  onChange={(v) => { setView(v); setPosition(''); }}
                  options={[
                    { value: 'listed', label: 'Listed' },
                    { value: 'wanted', label: 'Wanted' },
                  ]}
                />
              }
            />
            <div className={styles.filter}>
              <Select
                size="sm"
                ariaLabel="Position"
                value={position}
                onChange={setPosition}
                items={[
                  { value: '', label: 'All Positions', trailing: String(view === 'listed' ? BOARD_LISTED.length : BOARD_WANTED.length) },
                  ...POSITIONS.map((p) => ({ value: p, label: p, trailing: String(countFor(p)), disabled: countFor(p) === 0 })),
                ]}
              />
            </div>
            <div className={styles.panel}>
              {view === 'listed' ? (
                listed.length ? listed.map((r) => (
                  <div key={r.id} className={`${styles.row} ${styles.listedRow}`}>
                    <button type="button" className={styles.rowHit} aria-label={`${r.who.name}, €${r.price}m`} onClick={() => setSheet({ kind: 'listed', who: r.who, owner: r.owner, price: r.price })} />
                    <Face p={r.who} />
                    <span className={styles.rowBody}>
                      <span className={styles.rowName}>{r.who.name}<PositionBadge position={r.who.pos} size="sm" /></span>
                      <span className={styles.rowSub}>{crest(r.owner, 16)}{r.owner}</span>
                    </span>
                    <span className={styles.rowEnd}>
                      <b className={styles.money}>€{r.price}m</b>
                      <span className={styles.quiet}>{r.sub}</span>
                      {r.ends && <span className={styles.clock}>{r.ends}</span>}
                    </span>
                    <span className={styles.rowActions}>
                      <Button size="sm" variant="secondary">Offer</Button>
                      <Button size="sm" variant="primary">Bid</Button>
                    </span>
                  </div>
                )) : <p className={styles.empty}>Nothing listed at {position}.</p>
              ) : (
                wanted.length ? wanted.map((r) => (
                  <div key={r.id} className={styles.row}>
                    <span className={styles.wantCrest}>{crest(r.club, 28)}</span>
                    <span className={styles.rowBody}>
                      <span className={styles.rowName}>{r.club} {r.line}</span>
                      <span className={styles.rowSub}>{r.terms}</span>
                    </span>
                    <PositionBadge position={r.pos} size="sm" />
                  </div>
                )) : <p className={styles.empty}>Nobody wants a {position}.</p>
              )}
            </div>
          </section>
        </main>
      </div>

      <Composer sheet={sheet} onClose={() => setSheet(null)} onPick={setSheet} />
    </div>
  );
}

/* --- The composer: one sheet for every kind of post --- */

function Composer({ sheet, onClose, onPick }: { sheet: Sheet; onClose: () => void; onPick: (s: Sheet) => void }) {
  const [audience, setAudience] = useState<Audience>('club');
  const [budget, setBudget] = useState(40);
  const [cash, setCash] = useState(true);
  const [players, setPlayers] = useState(false);
  const [loan, setLoan] = useState(false);
  const [note, setNote] = useState('');
  const [floor, setFloor] = useState<'sixty' | 'none' | 'offers'>('sixty');
  const [role, setRole] = useState('starter');
  const [pos, setPos] = useState('LB');
  const [query, setQuery] = useState('');

  interface Option { value: string; label: string; keywords?: string; person: Person; mine?: boolean }
  const groups: { label: string; options: Option[] }[] = [
    { label: 'Your Squad', options: [PEOPLE.havertz, PEOPLE.ndiaye].map((p) => ({ value: p.id, label: p.name, keywords: p.club, person: p, mine: true })) },
    { label: 'Other Clubs', options: [PEOPLE.rice, PEOPLE.gabriel, PEOPLE.haaland, PEOPLE.wirtz].map((p) => ({ value: p.id, label: p.name, keywords: p.club, person: p })) },
    { label: 'Free Agents', options: [{ value: PEOPLE.kroupi.id, label: PEOPLE.kroupi.name, keywords: 'free agent', person: PEOPLE.kroupi }] },
  ];

  const terms = (
    <div className={styles.termsRow}>
      <span className={styles.fieldLabel}>What you would give or take</span>
      <div className={styles.checks}>
        <Checkbox checked={cash} onChange={setCash} label="Cash" />
        <Checkbox checked={players} onChange={setPlayers} label="Players" />
        <Checkbox checked={loan} onChange={setLoan} label="Loan" />
      </div>
    </div>
  );

  const plate = (p: Person, sub: string) => (
    <div className={styles.plate}>
      <Face p={p} />
      <span className={styles.plateBody}>
        <span className={styles.rowName}>{p.name}<PositionBadge position={p.pos} size="sm" /></span>
        <span className={styles.rowSub}>{sub}</span>
      </span>
    </div>
  );

  if (!sheet) return null;

  if (sheet.kind === 'who') {
    const q = query.trim().toLowerCase();
    const shown = groups
      .map((g) => ({ ...g, options: g.options.filter((o) => !q || `${o.label} ${o.keywords ?? ''}`.toLowerCase().includes(q)) }))
      .filter((g) => g.options.length > 0);
    return (
      <ResponsiveModal open onClose={onClose} title="Add" padded>
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Who</span>
            <input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the league’s players" autoFocus />
          </label>
          <div className={styles.whoList}>
            {shown.map((g) => (
              <div key={g.label} className={styles.whoGroup}>
                <span className={styles.fieldLabel}>{g.label}</span>
                {g.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={styles.pickBtn}
                    onClick={() => onPick(o.mine ? { kind: 'listing', who: o.person } : { kind: 'named', who: o.person })}
                  >
                    <Face p={o.person} size="xxs" />
                    <span className={styles.rowName}>{o.label}<PositionBadge position={o.person.pos} size="sm" /></span>
                    <span className={styles.pickValue}>{o.person.club} · €{o.person.value}m</span>
                  </button>
                ))}
              </div>
            ))}
            {shown.length === 0 && <p className={styles.empty}>Nobody matches “{query}”.</p>}
          </div>
          <Button variant="ghost" onClick={() => onPick({ kind: 'role' })}>A Position Instead</Button>
        </div>
      </ResponsiveModal>
    );
  }

  if (sheet.kind === 'listed') {
    return (
      <ResponsiveModal
        open
        onClose={onClose}
        title={sheet.who.name}
        padded
        footer={
          <div className={styles.footer}>
            <Button variant="secondary" onClick={() => { toast('Offer opened'); onClose(); }}>Offer</Button>
            <Button variant="primary" onClick={() => { toast('Bid opened'); onClose(); }}>Bid €{sheet.price + 1}m</Button>
          </div>
        }
      >
        <div className={styles.form}>
          {plate(sheet.who, `${sheet.owner} · Value €${sheet.who.value}m`)}
          <div className={styles.rowSub}><b className={styles.money}>€{sheet.price}m</b><span className={styles.quiet}>Asking</span></div>
        </div>
      </ResponsiveModal>
    );
  }

  const isNamed = sheet.kind === 'named';
  const editing = sheet.kind !== 'listing' ? sheet.editing : undefined;

  return (
    <ResponsiveModal
      open
      onClose={onClose}
      title={sheet.kind === 'listing' ? 'List a Player' : editing ? 'Edit Target' : 'Add Target'}
      padded
      footer={
        <div className={styles.footer}>
          {editing && <HoldButton size="sm" onConfirm={() => { toast('Target withdrawn'); onClose(); }}>Withdraw Target</HoldButton>}
          <Button
            variant="primary"
            onClick={() => { toast(sheet.kind === 'listing' ? 'Listed' : 'Target added'); onClose(); }}
          >
            {sheet.kind === 'listing' ? `List ${sheet.who.name.split(' ').pop()}` : editing ? 'Save Target' : 'Add Target'}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>
        {sheet.kind === 'role' ? (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Position</span>
              <Select size="md" fullWidth ariaLabel="Position" value={pos} onChange={setPos} items={POSITIONS.map((p) => ({ value: p, label: p }))} />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Level</span>
              <SegmentedControl
                fullWidth
                ariaLabel="Role level"
                value={role}
                onChange={setRole}
                options={[
                  { value: 'star', label: 'Star' },
                  { value: 'starter', label: 'Starter' },
                  { value: 'bench', label: 'Bench' },
                  { value: 'prospect', label: 'Prospect' },
                ]}
              />
            </div>
          </>
        ) : (
          plate(sheet.who, `${sheet.who.club} · €${sheet.who.value}m`)
        )}

        {sheet.kind === 'listing' ? (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Auction Floor</span>
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
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Who Sees It</span>
            <SegmentedControl
              fullWidth
              ariaLabel="Who sees this target"
              value={audience}
              onChange={setAudience}
              options={
                isNamed
                  ? [
                      { value: 'you', label: 'Only You' },
                      { value: 'club', label: 'Only Pizzaking’s' },
                      { value: 'league', label: 'The League' },
                    ]
                  : [
                      { value: 'league', label: 'The League' },
                      { value: 'you', label: 'Only You' },
                    ]
              }
            />
            <p className={styles.consequence}>
              {audience === 'you' && 'Nobody sees this and nobody is told.'}
              {audience === 'club' && 'Only the club that owns him is told. It counts against your 10, not the league’s 5.'}
              {audience === 'league' && 'Every club can see it, and clubs that own a match are told. 3 of 5 visible.'}
            </p>
          </div>
        )}

        <MoneyStepper
          fullWidth
          label={sheet.kind === 'listing' ? 'Asking Price' : 'Budget'}
          value={budget}
          onChange={setBudget}
          min={1}
          max={250}
          step={1}
          hint={sheet.kind === 'listing' ? 'Optional · Value €' + sheet.who.value + 'm' : 'Club Balance €204m'}
        />

        {terms}

        {sheet.kind !== 'listing' && (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Note</span>
            <input className={styles.input} maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            <span className={styles.count}>{note.length} of 140</span>
          </label>
        )}
      </div>
    </ResponsiveModal>
  );
}
