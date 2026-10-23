'use client';

import { useState, type ReactNode } from 'react';
import { HoldButton, Select, type SelectItem } from '@/components/ui';
import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import Portrait from '@/components/players/Portrait';
import { clubBadgePath } from '@/lib/clubs/registry';
import { POS_FILTER_OPTIONS } from '@/lib/players/positionFilter';
import players from '../(dashboard)/league/[leagueId]/players/playersIndex.module.css';
import bid from '@/components/transfers/BidDialog.module.css';
import settings from '@/components/settings/settings.module.css';
import styles from './kit.module.css';

/* Prototype only. Each Today column is the shipped <select> with its page's
   own CSS module; the proposals use the kit Select. Premier League clubs and
   players are real; the Gaffa clubs are invented, because this page is public
   and a league's club names and crests belong to its managers. */

const PL_CLUBS = [
  'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton', 'Chelsea', 'Coventry City',
  'Crystal Palace', 'Everton', 'Fulham', 'Hull City', 'Ipswich Town', 'Leeds', 'Liverpool',
  'Man City', 'Man Utd', 'Newcastle', "Nott'm Forest", 'Spurs', 'Sunderland',
];

const crest = (c: Partial<CrestConfig>): CrestConfig => ({
  shape: 'heraldic',
  division: 'solid',
  primaryColor: '#185B37',
  secondaryColor: '#F7F3ED',
  borderColor: '#1C1C1C',
  icon: null,
  iconColor: '#F7F3ED',
  showText: false,
  textColor: '#F7F3ED',
  ...c,
});

const GAFFA_CLUBS: { id: string; name: string; manager: string; crest: CrestConfig }[] = [
  { id: 'hr', name: 'Highbury Rovers', manager: 'Sam', crest: crest({ division: 'thirds', primaryColor: '#B91C1C', secondaryColor: '#F7F3ED', tertiaryColor: '#B91C1C', icon: 'crown', iconColor: '#D4A017' }) },
  { id: 'nl', name: 'Northern Lights', manager: 'Priya', crest: crest({ shape: 'circle', division: 'sash', primaryColor: '#1E3A8A', secondaryColor: '#FBBF24', borderColor: '#FBBF24', icon: 'star', iconColor: '#F7F3ED' }) },
  { id: 'rr', name: 'Real Ruislip', manager: 'Tom', crest: crest({ shape: 'classic', division: 'vertical-half', primaryColor: '#5B21B6', secondaryColor: '#F7F3ED', icon: 'lion', iconColor: '#D4A017' }) },
  { id: 'ah', name: 'Atlético Hackney', manager: 'Ana', crest: crest({ shape: 'escutcheon', division: 'quartered', primaryColor: '#DC2626', secondaryColor: '#F7F3ED', icon: 'bull', iconColor: '#1C1C1C' }) },
  { id: 'dd', name: 'Dynamo Deptford', manager: 'Kofi', crest: crest({ shape: 'hexagon', division: 'chevron', primaryColor: '#0369A1', secondaryColor: '#E0F2FE', icon: 'lightning', iconColor: '#FBBF24' }) },
  { id: 'ss', name: 'Sporting Salford', manager: 'Lee', crest: crest({ shape: 'continental', division: 'horizontal-half', primaryColor: '#15803D', secondaryColor: '#F7F3ED', icon: 'eagle', iconColor: '#1C1C1C' }) },
];

const photo = (code: number) => `https://resources.premierleague.com/premierleague25/photos/players/110x140/${code}.png`;

const SQUAD = [
  { id: 'saka', name: 'Bukayo Saka', pos: 'RW', club: 'Arsenal', value: 120, photo: photo(223340) },
  { id: 'palmer', name: 'Cole Palmer', pos: 'AM', club: 'Chelsea', value: 100, photo: photo(244851) },
  { id: 'wirtz', name: 'Florian Wirtz', pos: 'AM', club: 'Liverpool', value: 100, photo: photo(494595) },
  { id: 'rice', name: 'Declan Rice', pos: 'DM', club: 'Arsenal', value: 90, photo: photo(204480) },
  { id: 'isak', name: 'Alexander Isak', pos: 'ST', club: 'Liverpool', value: 85, photo: photo(219168) },
  { id: 'wharton', name: 'Adam Wharton', pos: 'CM', club: 'Crystal Palace', value: 70, photo: photo(496221) },
  { id: 'timber', name: 'Jurriën Timber', pos: 'RWB', club: 'Arsenal', value: 70, photo: photo(445122) },
  { id: 'colwill', name: 'Levi Colwill', pos: 'CB', club: 'Chelsea', value: 50, photo: photo(460028) },
  { id: 'acheampong', name: 'Josh Acheampong', pos: 'CB', club: 'Chelsea', value: 25, photo: photo(577016) },
  { id: 'kinsky', name: 'Antonín Kinský', pos: 'GK', club: 'Spurs', value: 15, photo: photo(485055) },
];

/** Keeps a crest-less option ("All clubs") in line with the crested ones. */
const Spacer = () => <span className={styles.selectSpacer} aria-hidden="true" />;

const badge = (club: string) => {
  const src = clubBadgePath(club);
  return src ? <img src={src} alt="" /> : <Spacer />;
};

const PL_ITEMS: SelectItem[] = [
  { value: 'ALL', label: 'All clubs', leading: <Spacer /> },
  ...PL_CLUBS.map((c) => ({ value: c, label: c, leading: badge(c) })),
];

const GAFFA_ITEMS: SelectItem[] = [
  { value: 'ALL', label: 'All Gaffa clubs', leading: <Spacer /> },
  { value: 'FREE', label: 'Free agents', leading: <Spacer /> },
  ...GAFFA_CLUBS.map((c) => ({
    value: c.id,
    label: c.name,
    leading: <CrestBadge config={c.crest} size={20} teamName={c.name} interactive={false} />,
  })),
];

const POS_ITEMS: SelectItem[] = POS_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const MIN_ITEMS: SelectItem[] = [
  { value: 'played', label: 'Played (>0 mins)' },
  { value: 'all', label: 'Meaningful (≥15 mins)' },
  { value: 'gt45', label: 'Starters (>45 mins)' },
];

const playerItems = (empty: string): SelectItem[] => [
  { value: '', label: empty },
  ...SQUAD.map((p) => ({
    value: p.id,
    label: p.name,
    description: `${p.pos} · ${p.club} · €${p.value}m`,
    leading: <Portrait photoUrl={p.photo} name={p.name} club={p.club} size="sm" />,
  })),
];

function Compare({ stack, columns }: { stack?: boolean; columns: { label: string; note?: string; body: ReactNode }[] }) {
  return (
    <div className={stack ? styles.compareStack : styles.compare} style={{ ['--cols' as string]: columns.length }}>
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

/* ─── 1. Filter bar ───────────────────────────────────────────────── */

type Scope = 'crests' | 'row';

function FilterBar({ scope }: { scope: Scope | 'today' }) {
  const [pos, setPos] = useState('ALL');
  const [club, setClub] = useState('Arsenal');
  const [team, setTeam] = useState('nl');
  const [mins, setMins] = useState('all');
  type Field = (value: string, set: (v: string) => void, items: SelectItem[], label: string, width: number) => ReactNode;
  const native: Field = (value, set, items, label) => (
    <select className={players.select} value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
      {items.map((i) => (
        <option key={i.value} value={i.value}>{i.label}</option>
      ))}
    </select>
  );
  /* Native fields size to their longest option; the kit field is given that width. */
  const kit: Field = (value, set, items, label, width) => (
    <span className={styles.filterSelect} style={{ width }}>
      <Select fullWidth ariaLabel={label} value={value} onChange={set} items={items} />
    </span>
  );
  const crests = scope === 'today' ? native : kit;
  const plain = scope === 'row' ? kit : native;
  return (
    <div className={`${players.tools} ${styles.filterFrame}`}>
      <input className={players.input} placeholder="Search player or club…" aria-label="Search player" />
      {plain(pos, setPos, POS_ITEMS, 'Position', 150)}
      {crests(club, setClub, PL_ITEMS, 'Club', 166)}
      {crests(team, setTeam, GAFFA_ITEMS, 'Gaffa club', 184)}
      {plain(mins, setMins, MIN_ITEMS, 'Minutes filter', 188)}
    </div>
  );
}

/* ─── 2. Commissioner handover ────────────────────────────────────── */

function Handover({ kit }: { kit: boolean }) {
  const [next, setNext] = useState('hr');
  const items: SelectItem[] = GAFFA_CLUBS.map((c) => ({
    value: c.id,
    label: `${c.manager} · ${c.name}`,
    leading: <CrestBadge config={c.crest} size={24} teamName={c.name} interactive={false} />,
  }));
  return (
    <div className={settings.form}>
      <span className={settings.fieldLabel}>Transfer Commissioner</span>
      {kit ? (
        <Select fullWidth ariaLabel="Next commissioner" value={next} onChange={setNext} items={items} />
      ) : (
        <select className={settings.select} value={next} onChange={(e) => setNext(e.target.value)} aria-label="Next commissioner">
          {GAFFA_CLUBS.map((c) => (
            <option key={c.id} value={c.id}>{`${c.manager} (${c.name})`}</option>
          ))}
        </select>
      )}
      <div className={settings.formActions}>
        <HoldButton size="sm" variant="primary" onConfirm={() => undefined}>
          Transfer Role
        </HoldButton>
      </div>
    </div>
  );
}

/* ─── 3. Player to drop ───────────────────────────────────────────── */

function DropPicker({ kit }: { kit: boolean }) {
  const [drop, setDrop] = useState('acheampong');
  const empty = 'Send him to the academy if there is room';
  return (
    <div className={bid.field}>
      <span className={bid.fieldLabel}>Player to drop</span>
      {kit ? (
        <Select
          fullWidth
          className={styles.playerSelect}
          ariaLabel="Player to drop"
          value={drop}
          onChange={setDrop}
          items={playerItems(empty)}
        />
      ) : (
        <select className={bid.select} value={drop} onChange={(e) => setDrop(e.target.value)} aria-label="Player to drop">
          <option value="">{empty}</option>
          {SQUAD.map((p) => (
            <option key={p.id} value={p.id}>{`${p.name} · ${p.pos} · €${p.value}m`}</option>
          ))}
        </select>
      )}
      <div className={bid.hint}>
        Your squad is full. Nominate a player to release upon winning, or send him to the academy.
      </div>
    </div>
  );
}

export function SelectPrototypes() {
  return (
    <div className={styles.protos}>
      <h2 className={styles.protoGroupTitle}>Dropdowns with Crests</h2>
      <p className={styles.protoIntro}>
        The eleven dropdowns whose options are a club or a player, as they are today and with the kit Select. Open
        any of them. Plain lists (minutes, sort, season, gameweek) stay native unless you pick B in case 1.
      </p>

      <Case tag="1" title="Club Filters" where="Players, Stats, Listings, Player Explorer, Transactions · 7 dropdowns">
        <Compare
          stack
          columns={[
            { label: 'Today', body: <FilterBar scope="today" /> },
            { label: 'A · Crest dropdowns only', note: 'recommended', body: <FilterBar scope="crests" /> },
            { label: 'B · The whole bar', body: <FilterBar scope="row" /> },
          ]}
        />
      </Case>

      <Case tag="2" title="Transfer Commissioner" where="League settings · components/settings/CommissionerTools.tsx">
        <Compare
          columns={[
            { label: 'Today', body: <Handover kit={false} /> },
            { label: 'Proposed', body: <Handover kit /> },
          ]}
        />
      </Case>

      <Case tag="3" title="Player to Drop" where="Bid and Sign Now dialogs, Listing editor · 3 dropdowns">
        <Compare
          columns={[
            { label: 'Today', body: <DropPicker kit={false} /> },
            { label: 'Proposed', body: <DropPicker kit /> },
          ]}
        />
      </Case>

      <p className={styles.caseFoot}>
        A in case 1 puts a kit dropdown beside native ones in the same bar; B makes the bar consistent at the cost of
        the phone&apos;s native wheel for the plain lists. On a phone the kit dropdown opens as a list under the field,
        not the system picker.
      </p>
    </div>
  );
}
