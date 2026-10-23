'use client';

import { useState, type ReactNode } from 'react';
import { Button, HoldButton, SegmentedControl, toast } from '@/components/ui';
import PositionBadge from '@/components/players/PositionBadge';
import club from '../(dashboard)/league/[leagueId]/team/roster/club.module.css';
import deals from '../(dashboard)/league/[leagueId]/transfers/deals/deals.module.css';
import players from '../(dashboard)/league/[leagueId]/players/playersIndex.module.css';
import finance from '../(dashboard)/league/[leagueId]/finance/finance.module.css';
import inbox from '../(dashboard)/league/[leagueId]/inbox/Inbox.module.css';
import styles from './kit.module.css';

/* Prototype only. Each case draws the shipped control with the page's own CSS
   module next to the kit replacement, so the comparison is against what is
   live, not a reconstruction. Nothing here calls an API. */

function Compare({ columns }: { columns: { label: string; note?: string; body: ReactNode }[] }) {
  return (
    <div className={styles.compare} style={{ ['--cols' as string]: columns.length }}>
      {columns.map((c) => (
        <div key={c.label} className={styles.compareCol}>
          <div className={styles.compareLabel}>
            {c.label}
            {c.note && <span className={styles.compareNote}>{c.note}</span>}
          </div>
          <div className={styles.compareStage}>{c.body}</div>
        </div>
      ))}
    </div>
  );
}

function Case({ tag, title, where, children }: { tag: string; title: string; where: string; children: ReactNode }) {
  return (
    <div className={styles.protoCase}>
      <span className={styles.protoTag}>{tag}</span>
      <h3 className={styles.caseTitle}>{title}</h3>
      <p className={styles.caseWhere}>{where}</p>
      {children}
    </div>
  );
}

/* ─── Hold to Confirm ─────────────────────────────────────────────── */

const DROP = { name: 'Evanilson', pos: 'ST', club: 'Bournemouth', severance: 7 };

function InspectorHead() {
  return (
    <div className={styles.inspectorHead}>
      <span className="g-namerow">
        <PositionBadge position={DROP.pos} size="sm" />
        <span className={styles.inspectorName}>{DROP.name}</span>
      </span>
      <span className={styles.inspectorMeta}>
        <img src="/team-logos/bournemouth.png" alt="" width={14} height={14} />
        {DROP.club} · €35m
      </span>
    </div>
  );
}

function InspectorToday() {
  const [armed, setArmed] = useState(false);
  return (
    <div className={styles.inspector}>
      <InspectorHead />
      <div className={club.acts}>
        <button type="button" className={club.act}>List for Transfer</button>
        {armed ? (
          <button
            type="button"
            className={`${club.act} ${club.actDanger}`}
            onClick={() => {
              setArmed(false);
              toast.success(`${DROP.name} released`, { description: `Severance €${DROP.severance}m` });
            }}
          >
            Confirm — €{DROP.severance}m
          </button>
        ) : (
          <button type="button" className={`${club.act} ${club.actDanger}`} onClick={() => setArmed(true)}>
            Drop
          </button>
        )}
      </div>
    </div>
  );
}

function InspectorHold() {
  return (
    <div className={styles.inspector}>
      <InspectorHead />
      <div className={club.acts}>
        <button type="button" className={club.act}>List for Transfer</button>
        <HoldButton
          size="sm"
          fullWidth
          className={styles.inspectorHold}
          confirmedLabel="Released"
          onConfirm={() => toast.success(`${DROP.name} released`, { description: `Severance €${DROP.severance}m` })}
        >
          Drop · €{DROP.severance}m
        </HoldButton>
      </div>
    </div>
  );
}

function DepartureFoot({ hold }: { hold: boolean }) {
  const decline = () => toast('Rights declined', { description: 'Ben White stays at his new club.' });
  return (
    <div className={styles.sheet}>
      <p className={styles.sheetCopy}>
        <b>Ben White</b> is back in the Premier League. Keep him, or decline your retained rights and let him go to
        auction.
      </p>
      <div className={styles.sheetFoot}>
        <Button variant="secondary">Keep Him</Button>
        {hold ? (
          <HoldButton size="sm" fullWidth confirmedLabel="Declined" onConfirm={decline}>
            Decline for Nothing
          </HoldButton>
        ) : (
          <Button variant="danger" fullWidth onClick={decline}>
            Decline for Nothing
          </Button>
        )}
      </div>
    </div>
  );
}

function LoanStrip({ hold }: { hold: boolean }) {
  const recall = () => toast.success('Loan recalled', { description: 'Joško Gvardiol returns next gameweek. €25m to Stamford & Sons.' });
  return (
    <div className={styles.dealCard}>
      <div className={styles.dealCardBody}>
        <span className="g-namerow">
          <PositionBadge position="CB" size="sm" />
          <b>Joško Gvardiol</b>
        </span>
        <span className={styles.inspectorMeta}>On loan to Stamford &amp; Sons · GW8–GW14</span>
      </div>
      <div className={deals.dealActions}>
        <span className={deals.dealStatus}>Slot bought back</span>
        {hold ? (
          <HoldButton size="sm" className={styles.stripHold} confirmedLabel="Recalled" onConfirm={recall}>
            Recall · €25m
          </HoldButton>
        ) : (
          <button
            type="button"
            className={deals.dealBtn}
            onClick={() => {
              if (window.confirm('Recall Joško Gvardiol early? You will pay a €25m penalty to the borrower.')) recall();
            }}
          >
            Recall
          </button>
        )}
      </div>
    </div>
  );
}

function LeaveLeague({ hold }: { hold: boolean }) {
  const consequence =
    "Your club stays in the league, and the Caretaker runs it until a new manager joins. You can't undo this.";
  const left = () => toast('Left Dynasty Dragoon', { description: 'Prototype: nothing was changed.' });
  if (!hold) {
    return (
      <button
        type="button"
        className={styles.leaveToday}
        onClick={() => {
          if (window.confirm(`Leave this league? ${consequence}`)) left();
        }}
      >
        Leave League
      </button>
    );
  }
  return (
    <div className={styles.leaveHold}>
      <p className={styles.sheetCopy}>{consequence}</p>
      <HoldButton confirmedLabel="Left" onConfirm={left}>
        Leave League
      </HoldButton>
    </div>
  );
}

export function HoldPrototypes() {
  return (
    <div className={styles.protos}>
      <h2 className={styles.protoGroupTitle}>Hold to Confirm</h2>
      <p className={styles.protoIntro}>
        Four actions that cost money or can&apos;t be undone, as they work today and with a hold. Tap a proposed button
        once to see its hint, then press and hold it. The browser dialogs in the Today column are the real ones.
      </p>

      <Case tag="1" title="Drop" where="Roster Inspector · team/roster/Inspector.tsx">
        <Compare
          columns={[
            { label: 'Today', body: <InspectorToday /> },
            { label: 'Proposed', body: <InspectorHold /> },
          ]}
        />
      </Case>

      <Case tag="2" title="Decline for Nothing" where="Departure sheet · components/teams/DepartureDecisionModal.tsx">
        <Compare
          columns={[
            { label: 'Today', body: <DepartureFoot hold={false} /> },
            { label: 'Proposed', body: <DepartureFoot hold /> },
          ]}
        />
      </Case>

      <Case tag="3" title="Recall a Loan" where="Deals · transfers/deals/DealsClient.tsx">
        <Compare
          columns={[
            { label: 'Today', note: 'browser dialog', body: <LoanStrip hold={false} /> },
            { label: 'Proposed', body: <LoanStrip hold /> },
          ]}
        />
      </Case>

      <Case tag="4" title="Leave League" where="Settings · components/settings/LeaveLeagueButton.tsx">
        <Compare
          columns={[
            { label: 'Today', note: 'browser dialog', body: <LeaveLeague hold={false} /> },
            { label: 'Proposed', body: <LeaveLeague hold /> },
          ]}
        />
      </Case>

      <p className={styles.caseFoot}>
        The same treatment would cover the other browser dialogs: Clear Inbox, Cancel Expansion, Cancel Draft and Hand
        Over Commissioner.
      </p>
    </div>
  );
}

/* ─── Section-head switchers ──────────────────────────────────────── */

interface Opt {
  value: string;
  label: string;
  /** What the shipped control prints, where it differs from the label. */
  today?: string;
}

type Today = (value: string, set: (v: string) => void, opts: Opt[]) => ReactNode;
type Frame = (control: ReactNode) => ReactNode;

function SwitchCase({ opts, today, frame }: { opts: Opt[]; today: Today; frame: Frame }) {
  const [a, setA] = useState(opts[0].value);
  const [b, setB] = useState(opts[0].value);
  const [c, setC] = useState(opts[0].value);
  const kit = opts.map((o) => ({ value: o.value, label: o.label }));
  return (
    <Compare
      columns={[
        { label: 'Today', body: frame(today(a, setA, opts)) },
        {
          label: 'A · Ink',
          note: 'recommended',
          body: frame(<SegmentedControl variant="ink" ariaLabel="View" value={b} onChange={setB} options={kit} />),
        },
        {
          label: 'B · Underline',
          body: frame(<SegmentedControl variant="underline" ariaLabel="View" value={c} onChange={setC} options={kit} />),
        },
      ]}
    />
  );
}

const PLAYER_VIEWS: Opt[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'table', label: 'Table' },
  { value: 'explorer', label: 'Explorer' },
];
const POS_TYPES: Opt[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'both', label: 'Both' },
];
const LEDGER: Opt[] = [
  { value: 'all', label: 'All' },
  { value: 'out', label: 'Spending' },
  { value: 'in', label: 'Earnings' },
];
const SQUAD_VIEWS: Opt[] = [
  { value: 'pitch', label: 'Pitch' },
  { value: 'depth', label: 'Depth Chart', today: 'Depth chart' },
  { value: 'table', label: 'Table' },
];
const PITCH_MODES: Opt[] = [
  { value: 'projected', label: 'Projected XI' },
  { value: 'saved', label: 'Saved Lineup' },
];
const ALERTS: Opt[] = [
  { value: 'all', label: 'All Alerts (12)' },
  { value: 'unread', label: 'Unread (3)' },
];

const headRight: Frame = (control) => (
  <div className={styles.switchHead}>
    <span className={styles.switchHeadTitle}>Players</span>
    {control}
  </div>
);

export function SwitcherPrototypes() {
  return (
    <div className={styles.protos}>
      <h2 className={styles.protoGroupTitle}>Section Switchers</h2>
      <p className={styles.protoIntro}>
        Six switchers that still use their own trays and tabs, next to the dashboard&apos;s ink switcher (A, the one you
        picked for Top Rated) and the underline (B). Each Today column is the shipped CSS. Switch any of them.
      </p>

      <Case tag="1" title="Players View" where="Players · players/PlayersIndex.tsx">
        <SwitchCase
          opts={PLAYER_VIEWS}
          frame={headRight}
          today={(v, set, opts) => (
            <nav className={players.seg} aria-label="View">
              {opts.map((o) => (
                <button key={o.value} type="button" className={`${players.segBtn} ${v === o.value ? players.segOn : ''}`} onClick={() => set(o.value)}>
                  {o.label}
                </button>
              ))}
            </nav>
          )}
        />
      </Case>

      <Case tag="2" title="Which Positions Count" where="Players and Stats filters · PlayersIndex.tsx, GlobalStatsTable.tsx">
        <SwitchCase
          opts={POS_TYPES}
          frame={(control) => (
            <div className={styles.switchHead}>
              <span className={styles.switchHeadLabel}>Positions</span>
              {control}
            </div>
          )}
          today={(v, set, opts) => (
            <div className={players.segmented} role="group" aria-label="Which positions count">
              {opts.map((o) => (
                <button key={o.value} type="button" className={`${players.segment} ${v === o.value ? players.segmentOn : ''}`} aria-pressed={v === o.value} onClick={() => set(o.value)}>
                  {o.value}
                </button>
              ))}
            </div>
          )}
        />
      </Case>

      <Case tag="3" title="Club Ledger" where="Finance · finance/FinanceClient.tsx">
        <SwitchCase
          opts={LEDGER}
          frame={(control) => (
            <div className={`${finance.ledgerHeader} ${styles.ledgerFrame}`}>
              <h4 className={finance.sectionHead}>Club Ledger</h4>
              {control}
            </div>
          )}
          today={(v, set, opts) => (
            <div className={finance.segmented} role="tablist">
              {opts.map((o) => (
                <button key={o.value} type="button" role="tab" aria-selected={v === o.value} className={`${finance.segment} ${v === o.value ? finance.segmentOn : ''}`} onClick={() => set(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        />
      </Case>

      <Case tag="4" title="Squad View" where="Roster toolbar · team/roster/ClubClient.tsx">
        <SwitchCase
          opts={SQUAD_VIEWS}
          frame={(control) => <div className={styles.switchToolbar}>{control}</div>}
          today={(v, set, opts) => (
            <div className={club.seg}>
              {opts.map((o) => (
                <button key={o.value} type="button" className={`${club.segBtn} ${v === o.value ? club.segBtnOn : ''}`} onClick={() => set(o.value)}>
                  {o.today ?? o.label}
                </button>
              ))}
            </div>
          )}
        />
      </Case>

      <Case tag="5" title="Pitch Mode" where="Roster pitch head · team/roster/SquadViews.tsx">
        <SwitchCase
          opts={PITCH_MODES}
          frame={(control) => (
            <div className={styles.switchHead}>
              <span className={styles.switchHeadTitle}>4-3-3</span>
              {control}
            </div>
          )}
          today={(v, set, opts) => (
            <div className={club.pitchMode} role="group" aria-label="Pitch mode">
              {opts.map((o) => (
                <button key={o.value} type="button" className={v === o.value ? club.pitchModeOn : undefined} aria-pressed={v === o.value} onClick={() => set(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        />
      </Case>

      <Case tag="6" title="Inbox Filter" where="Inbox · inbox/InboxClient.tsx">
        <SwitchCase
          opts={ALERTS}
          frame={(control) => <div className={`${inbox.controls} ${styles.switchInbox}`}>{control}</div>}
          today={(v, set, opts) => (
            <div className={inbox.tabs}>
              {opts.map((o) => (
                <button key={o.value} type="button" className={`${inbox.tab} ${v === o.value ? inbox.tabActive : ''}`} onClick={() => set(o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        />
      </Case>

      <p className={styles.caseFoot}>
        Left as they are: the Transactions filters (the working bar you chose, with counts on the filters), the
        League Home fixture tabs (already an underline), the Player Explorer legend (a toggle that can be cleared, not a
        switch) and the player card&apos;s chart switch.
      </p>
    </div>
  );
}
