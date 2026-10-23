'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Disclosure,
  HoldButton,
  Icon,
  IconButton,
  Kbd,
  Menu,
  MoneyStepper,
  NumberRoll,
  ResponsiveModal,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Tooltip,
  toast,
} from '@/components/ui';
import Portrait from '@/components/players/Portrait';
import PositionBadge from '@/components/players/PositionBadge';
import { useTheme } from '@/context/ThemeContext';
import TopRatedPrototypes from './TopRatedPrototypes';
import styles from './kit.module.css';

const photo = (code: number) =>
  `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code}.png`;

const PLAYERS = [
  { id: 'saka', name: 'Bukayo Saka', club: 'Arsenal', slug: 'arsenal', pos: 'RW', photo: photo(223340), value: 110 },
  { id: 'palmer', name: 'Cole Palmer', club: 'Chelsea', slug: 'chelsea', pos: 'AM', photo: photo(244851), value: 100 },
  { id: 'haaland', name: 'Erling Haaland', club: 'Man City', slug: 'man-city', pos: 'ST', photo: photo(223094), value: 220 },
  { id: 'wirtz', name: 'Florian Wirtz', club: 'Liverpool', slug: 'liverpool', pos: 'AM', photo: photo(494595), value: 100 },
  { id: 'saliba', name: 'William Saliba', club: 'Arsenal', slug: 'arsenal', pos: 'CB', photo: photo(462424), value: 100 },
  { id: 'rice', name: 'Declan Rice', club: 'Arsenal', slug: 'arsenal', pos: 'DM', photo: photo(204480), value: 120 },
] as const;

const CLUBS = [
  ['arsenal', 'Arsenal'],
  ['chelsea', 'Chelsea'],
  ['liverpool', 'Liverpool'],
  ['man-city', 'Man City'],
  ['man-utd', 'Man Utd'],
  ['newcastle', 'Newcastle'],
  ['spurs', 'Spurs'],
  ['aston-villa', 'Aston Villa'],
] as const;

const crest = (slug: string, size = 20) => (
  <img src={`/team-logos/${slug}.png`} alt="" width={size} height={size} className={styles.crest} />
);

export default function KitClient() {
  const { theme, setTheme } = useTheme();
  const [slowMo, setSlowMo] = useState(false);

  // Slow every running CSS transition and animation to a fifth of its speed,
  // for inspecting motion frame by frame. JS timers are untouched, so an exit
  // that unmounts on a timer will cut short in slow motion.
  useEffect(() => {
    if (!slowMo) return;
    let frame = 0;
    const tick = () => {
      document.getAnimations().forEach((a) => {
        if (a.playbackRate !== 0.2) a.playbackRate = 0.2;
      });
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      document.getAnimations().forEach((a) => (a.playbackRate = 1));
    };
  }, [slowMo]);

  return (
    <div className={styles.page}>
      <header className={styles.shelf}>
        <div className={styles.shelfInner}>
          <span className={styles.mark} aria-hidden="true">
            <Icon name="gaffa" size={30} strokeWidth={1.75} />
          </span>
          <div className={styles.shelfTitle}>
            <h1 className={styles.shelfH}>Gaffa Kit</h1>
          </div>
        </div>
      </header>

      <div className={styles.plate}>
        <SegmentedControl
          ariaLabel="Theme"
          size="sm"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <span className={styles.plateRule} aria-hidden="true" />
        <Switch size="sm" checked={slowMo} onChange={setSlowMo} label="Slow Motion" />
      </div>

      <TopRatedPrototypes />

      <main className={styles.grid}>
        <BiddingBoard />
        <ButtonsBoard />
        <ControlsBoard />
        <PickersBoard />
        <TabsBoard />
        <ToastsBoard />
        <LiveBoard />
        <SheetBoard />
        <SkeletonBoard />
        <DisclosureBoard />
      </main>

    </div>
  );
}

function Board({
  title,
  instrument,
  wide,
  children,
}: {
  title: string;
  instrument?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={[styles.board, wide ? styles.boardWide : ''].join(' ')}>
      <header className={styles.boardHead}>
        <h2 className={styles.boardTitle}>{title}</h2>
        {instrument && <div className={styles.instrument}>{instrument}</div>}
      </header>
      <div className={styles.boardBody}>{children}</div>
    </section>
  );
}

/* --- Bidding: MoneyStepper, NumberRoll, HoldButton, toast --- */

function BiddingBoard() {
  const saka = PLAYERS[0];
  const [balance, setBalance] = useState(148);
  const [bid, setBid] = useState(66);
  const [placing, setPlacing] = useState(false);
  const minimum = 66;

  const place = () => {
    setPlacing(true);
    window.setTimeout(() => {
      setPlacing(false);
      setBalance((b) => b - bid);
      toast.success('Bid placed', {
        description: `${saka.name} · €${bid}m`,
        action: { label: 'Withdraw', onClick: () => setBalance((b) => b + bid) },
      });
    }, 900);
  };

  return (
    <Board
      title="Bidding"
      wide
      instrument={
        <span className={styles.balance}>
          <span className={styles.balanceLabel}>Club Balance</span>
          <span className={styles.balanceFigure}>
            <NumberRoll value={balance} format={(n) => `€${n}m`} />
          </span>
        </span>
      }
    >
      <div className={styles.bidLayout}>
        <div className={styles.lot}>
          <Portrait photoUrl={saka.photo} name={saka.name} club={saka.club} size="lg" />
          <div className={styles.lotText}>
            <span className="g-namerow">
              <PositionBadge position={saka.pos} />
              <span className={styles.lotName}>{saka.name}</span>
            </span>
            <span className={styles.lotMeta}>
              {crest(saka.slug, 16)} {saka.club} · Value €{saka.value}m
            </span>
          </div>
        </div>

        <MoneyStepper
          label="Your Bid"
          value={bid}
          onChange={setBid}
          min={minimum}
          max={Math.max(minimum, balance)}
          hint={`Minimum €${minimum}m. Hold + to run.`}
        />

        <div className={styles.bidActions}>
          <Button variant="primary" size="lg" fullWidth loading={placing} disabled={bid > balance} onClick={place}>
            Place Bid
          </Button>
          <HoldButton fullWidth confirmedLabel="Released" onConfirm={() => toast('Saka released', { description: 'Severance €22m.' })}>
            Hold to Release
          </HoldButton>
        </div>
      </div>
    </Board>
  );
}

/* --- Buttons --- */

function ButtonsBoard() {
  const [loading, setLoading] = useState(false);
  return (
    <Board title="Buttons" instrument={<Switch size="sm" checked={loading} onChange={setLoading} label="Loading" />}>
      <div className={styles.row}>
        <Button variant="primary" loading={loading}>
          Save Lineup
        </Button>
        <Button variant="secondary" loading={loading}>
          Manage Squad
        </Button>
        <Button variant="ghost" loading={loading}>
          Cancel
        </Button>
        <Button variant="danger" loading={loading}>
          Release
        </Button>
      </div>
      <div className={styles.row}>
        <Button variant="secondary" size="sm" leadIcon={<Icon name="plus" size={14} strokeWidth={2.25} />}>
          Add Target
        </Button>
        <Button variant="secondary" size="lg" tailIcon={<Icon name="chevron-right" size={16} strokeWidth={2} />}>
          Free Agents
        </Button>
      </div>
      <div className={styles.toolbar} role="toolbar" aria-label="Player Actions">
        <IconButton label="Search Players" icon={<Icon name="search" size={18} />} />
        <IconButton label="Share Lineup" icon={<Icon name="share" size={18} />} />
        <IconButton label="Copy Link" icon={<Icon name="copy" size={18} />} />
        <IconButton label="Notifications" icon={<Icon name="bell" size={18} />} />
        <IconButton label="Delete Draft" variant="danger" icon={<Icon name="trash" size={18} />} />
      </div>
      <p className={styles.note}>
        Hover one icon, then sweep along the row: after the first tooltip the rest open instantly.
      </p>
    </Board>
  );
}

/* --- Controls: Switch, Checkbox, SegmentedControl --- */

function ControlsBoard() {
  const [push, setPush] = useState(true);
  const [autodraft, setAutodraft] = useState(false);
  const [positions, setPositions] = useState<string[]>(['CB', 'DM']);
  const [period, setPeriod] = useState<'mw' | 'season' | 'form'>('mw');
  const all = ['CB', 'DM', 'AM', 'ST'];

  const toggle = (p: string) =>
    setPositions((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  return (
    <Board
      title="Controls"
      instrument={
        <SegmentedControl
          ariaLabel="Period"
          size="sm"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'mw', label: 'Matchweek' },
            { value: 'season', label: 'Season' },
            { value: 'form', label: 'Form' },
          ]}
        />
      }
    >
      <div className={styles.stack}>
        <Switch checked={push} onChange={setPush} label="Push Notifications" description="Outbid alerts and lineup reminders." />
        <Switch checked={autodraft} onChange={setAutodraft} label="Autodraft" description="Draft the best available player when your clock runs out." />
      </div>
      <div className={styles.checks}>
        <Checkbox
          checked={positions.length === all.length}
          indeterminate={positions.length > 0 && positions.length < all.length}
          onChange={(c) => setPositions(c ? all : [])}
          label="All Positions"
        />
        <div className={styles.checkGrid}>
          {all.map((p) => (
            <Checkbox key={p} checked={positions.includes(p)} onChange={() => toggle(p)} label={<PositionBadge position={p} size="sm" />} />
          ))}
        </div>
      </div>
    </Board>
  );
}

/* --- Pickers: Select, Menu, Tooltip --- */

function PickersBoard() {
  const [club, setClub] = useState<string | null>('arsenal');
  const [formation, setFormation] = useState<string | null>('4-3-3');

  return (
    <Board title="Pickers">
      <div className={styles.fields}>
        <Select
          label="Club"
          fullWidth
          value={club}
          onChange={setClub}
          items={CLUBS.map(([slug, name]) => ({ value: slug, label: name, leading: crest(slug) }))}
        />
        <Select
          label="Formation"
          fullWidth
          value={formation}
          onChange={setFormation}
          items={[
            { value: '4-3-3', label: '4-3-3', description: 'Two wingers, a lone striker' },
            { value: '4-2-3-1', label: '4-2-3-1', description: 'Double pivot behind an AM' },
            { value: '3-4-3', label: '3-4-3', description: 'Wing-backs carry the width' },
            { value: '5-3-2', label: '5-3-2', description: 'Two up top', disabled: true },
          ]}
        />
      </div>

      <ul className={styles.rows}>
        {PLAYERS.slice(1, 4).map((p) => (
          <li key={p.id} className={styles.playerRow}>
            <Portrait photoUrl={p.photo} name={p.name} club={p.club} size="sm" />
            <span className={styles.playerText}>
              <span className="g-namerow">
                <PositionBadge position={p.pos} size="sm" />
                <span className={styles.playerName}>{p.name}</span>
              </span>
              <span className={styles.playerMeta}>{p.club}</span>
            </span>
            <Tooltip content="Market Value">
              <span className={styles.playerValue} tabIndex={0}>
                €{p.value}m
              </span>
            </Tooltip>
            <Menu
              label={`${p.name} Actions`}
              items={[
                { label: 'View Player', icon: <Icon name="external-link" size={15} />, onSelect: () => toast(`Opened ${p.name}`) },
                { label: 'List for Sale', icon: <Icon name="trending" size={15} />, onSelect: () => toast(`${p.name} listed`) },
                { label: 'Offer a Loan', icon: <Icon name="repeat" size={15} />, onSelect: () => toast('Loan offer drafted') },
                'separator',
                { label: 'Release', icon: <Icon name="trash" size={15} />, danger: true, onSelect: () => toast.error(`${p.name} not released`, { description: 'Releases need a hold to confirm.' }) },
              ]}
            />
          </li>
        ))}
      </ul>
    </Board>
  );
}

/* --- Tabs --- */

function TabsBoard() {
  const [tab, setTab] = useState<'squad' | 'academy' | 'ir' | 'retained'>('squad');
  const lists = {
    squad: PLAYERS.slice(0, 4),
    academy: PLAYERS.slice(3, 5),
    ir: PLAYERS.slice(5, 6),
    retained: [],
  } as const;
  const shown = lists[tab];

  return (
    <Board title="Tabs">
      <Tabs
        ariaLabel="Squad Sections"
        idBase="kit-squad"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'squad', label: 'Active Squad', count: 4 },
          { value: 'academy', label: 'Academy', count: 2 },
          { value: 'ir', label: 'Injured Reserve', count: 1 },
          { value: 'retained', label: 'Retained', count: 0 },
        ]}
      />
      <div
        key={tab}
        role="tabpanel"
        id={`kit-squad-panel-${tab}`}
        aria-labelledby={`kit-squad-tab-${tab}`}
        className={styles.tabPanel}
      >
        {shown.length === 0 ? (
          <p className={styles.empty}>No retained players. Retain a departing player to keep a claim on him.</p>
        ) : (
          <div className={styles.portraitRow}>
            {shown.map((p) => (
              <figure key={p.id} className={styles.portraitCell}>
                <Portrait photoUrl={p.photo} name={p.name} club={p.club} size="md" />
                <figcaption>{p.name.split(' ').slice(-1)[0]}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </Board>
  );
}

/* --- Toasts --- */

function ToastsBoard() {
  const saving = () => {
    const id = toast('Saving lineup…', { duration: Infinity });
    window.setTimeout(() => toast.success('Lineup saved', { id, description: '4-3-3 for Matchweek 9.' }), 1200);
  };

  return (
    <Board title="Toasts" instrument={<Button size="sm" variant="ghost" onClick={() => toast.dismiss()}>Clear All</Button>}>
      <div className={styles.row}>
        <Button onClick={() => toast.success('Bid placed', { description: 'Cole Palmer · €58m' })}>Success</Button>
        <Button onClick={() => toast.error('Bid refused', { description: 'Your Club Balance is €12m.' })}>Error</Button>
        <Button
          onClick={() =>
            toast('Rice moved to the bench', { action: { label: 'Undo', onClick: () => toast('Rice back in the XI') } })
          }
        >
          With Undo
        </Button>
        <Button onClick={saving}>Update in Place</Button>
      </div>
      <p className={styles.note}>
        Fire several. Hover the stack to fan it out; swipe a toast down or sideways to dismiss it.
      </p>
    </Board>
  );
}

/* --- Live figures: NumberRoll on a score bug --- */

function LiveBoard() {
  const [home, setHome] = useState(1);
  const [away, setAway] = useState(1);
  const [points, setPoints] = useState(47.5);
  const [minute, setMinute] = useState(63);

  const goal = (side: 'home' | 'away') => {
    if (side === 'home') setHome((g) => g + 1);
    else setAway((g) => g + 1);
    setPoints((p) => Math.round((p + (side === 'home' ? 8.5 : -1.5)) * 10) / 10);
    setMinute((m) => Math.min(m + 7, 90));
  };

  return (
    <Board
      title="Live Figures"
      instrument={
        <Button size="sm" variant="ghost" onClick={() => { setHome(1); setAway(1); setPoints(47.5); setMinute(63); }}>
          Reset
        </Button>
      }
    >
      <div className={styles.bug}>
        <span className={styles.bugSide}>
          {crest('arsenal', 32)}
          <span className={styles.bugClub}>Arsenal</span>
        </span>
        <span className={styles.bugScore}>
          <NumberRoll value={home} />
          <span className={styles.bugDash}>–</span>
          <NumberRoll value={away} />
        </span>
        <span className={[styles.bugSide, styles.bugAway].join(' ')}>
          <span className={styles.bugClub}>Chelsea</span>
          {crest('chelsea', 32)}
        </span>
        <span className={styles.bugMinute}>
          <NumberRoll value={minute} format={(n) => `${n}′`} />
        </span>
      </div>
      <div className={styles.pointsRow}>
        <span className={styles.pointsLabel}>Your Points</span>
        <span className={styles.points}>
          <NumberRoll value={points} format={(n) => n.toFixed(1)} />
        </span>
      </div>
      <div className={styles.row}>
        <Button variant="secondary" onClick={() => goal('home')} leadIcon={crest('arsenal', 16)}>
          Arsenal Goal
        </Button>
        <Button variant="secondary" onClick={() => goal('away')} leadIcon={crest('chelsea', 16)}>
          Chelsea Goal
        </Button>
      </div>
    </Board>
  );
}

/* --- Sheet: ResponsiveModal with a nested Select --- */

function SheetBoard() {
  const [open, setOpen] = useState(false);
  const [bid, setBid] = useState(40);
  const [player, setPlayer] = useState<string | null>('palmer');
  const chosen = PLAYERS.find((p) => p.id === player) ?? PLAYERS[1];

  return (
    <Board title="Sheets">
      <p className={styles.text}>
        Centred and scaled on desktop. On a phone it docks to the bottom; drag the handle or the header down, or
        flick it, to dismiss.
      </p>
      <div className={styles.row}>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Open Bid Sheet
        </Button>
        <span className={styles.hintKeys}>
          <Kbd>Esc</Kbd> to close
        </span>
      </div>
      <ResponsiveModal
        open={open}
        onClose={() => setOpen(false)}
        title="Place a Bid"
        lead={crest(chosen.slug, 24)}
        padded
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className={styles.footerPrimary}
              onClick={() => {
                setOpen(false);
                toast.success('Bid placed', { description: `${chosen.name} · €${bid}m` });
              }}
            >
              Place Bid
            </Button>
          </>
        }
      >
        <div className={styles.sheetBody}>
          <Select
            label="Player"
            fullWidth
            value={player}
            onChange={setPlayer}
            items={PLAYERS.map((p) => ({
              value: p.id,
              label: p.name,
              description: `${p.club} · €${p.value}m`,
              leading: <PositionBadge position={p.pos} size="sm" />,
            }))}
          />
          <MoneyStepper label="Your Bid" value={bid} onChange={setBid} min={20} max={148} hint="Club Balance €148m" />
        </div>
      </ResponsiveModal>
    </Board>
  );
}

/* --- Skeleton --- */

function SkeletonBoard() {
  const [loaded, setLoaded] = useState(false);
  const fixtures = [
    ['arsenal', 'Arsenal', 'chelsea', 'Chelsea', '2–1'],
    ['liverpool', 'Liverpool', 'man-city', 'Man City', '1–1'],
    ['spurs', 'Spurs', 'newcastle', 'Newcastle', '0–3'],
  ];
  return (
    <Board title="Skeletons" instrument={<Switch size="sm" checked={loaded} onChange={setLoaded} label="Loaded" />}>
      <ul className={styles.fixtures}>
        {fixtures.map(([hs, hn, as, an, score]) => (
          <li key={hs} className={styles.fixture}>
            {loaded ? (
              <>
                <span className={styles.fxSide}>{crest(hs, 22)} {hn}</span>
                <span className={styles.fxScore}>{score}</span>
                <span className={[styles.fxSide, styles.fxAway].join(' ')}>{an} {crest(as, 22)}</span>
              </>
            ) : (
              <>
                <span className={styles.fxSide}>
                  <Skeleton shape="circle" width={22} height={22} />
                  <Skeleton shape="text" width={72} />
                </span>
                <Skeleton width={34} height={20} />
                <span className={[styles.fxSide, styles.fxAway].join(' ')}>
                  <Skeleton shape="text" width={64} />
                  <Skeleton shape="circle" width={22} height={22} />
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </Board>
  );
}

/* --- Disclosure --- */

function DisclosureBoard() {
  return (
    <Board title="Disclosure">
      <Disclosure title="Match Rating" meta="7.8" defaultOpen>
        <dl className={styles.breakdown}>
          <div><dt>Threat</dt><dd>+1.4</dd></div>
          <div><dt>Creativity</dt><dd>+0.9</dd></div>
          <div><dt>Goal Involvement</dt><dd>+1.1</dd></div>
          <div><dt>Defensive</dt><dd>−0.2</dd></div>
        </dl>
      </Disclosure>
      <Disclosure title="Fantasy Points" meta="12.5">
        <p className={styles.text}>
          Points come from the rating through a convex curve, so a great match is worth more than two good ones.
        </p>
      </Disclosure>
      <Disclosure title="Out of Position" meta="−20%">
        <p className={styles.text}>A defender played outside his listed positions scores 20% less.</p>
      </Disclosure>
    </Board>
  );
}
