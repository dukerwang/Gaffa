'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, IconButton, Popover, SegmentedControl, Select, Tabs } from '@/components/ui';
import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import Portrait from '@/components/players/Portrait';
import HeritageNav from '../(dashboard)/league/[leagueId]/heritage/HeritageNav';
import heritage from '../(dashboard)/league/[leagueId]/heritage/heritage.module.css';
import cups from '../(dashboard)/league/[leagueId]/tournaments/tournaments.module.css';
import pdm from '@/components/players/PlayerDetailsModal.module.css';
import chat from '@/components/chat/LeagueChatWidget.module.css';
import top from '@/components/layout/TopBar.module.css';
import help from '@/components/transfers/AuctionTimingHelp.module.css';
import styles from './kit.module.css';

/* Prototype only. The last kit components not yet in the app (Tabs, Popover,
   IconButton, and Disclosure's motion), each drawn on a 375px phone beside
   today's version. "Today" frames use the app's own CSS modules, so they are
   the shipped look rather than a copy of it. Club names and balances are
   Matchday Militia's; player figures are fixed examples. */

/* ─── Shared frame ─────────────────────────────────────────────────── */

function Case({ tag, title, where, children }: { tag: string; title: string; where: string; children: ReactNode }) {
  return (
    <div className={styles.protoCase}>
      <span className={styles.protoTag}>{tag}</span>
      <h3 className={styles.cpCaseTitle}>{title}</h3>
      <p className={styles.cpWhere}>{where}</p>
      <div className={styles.cpPhones}>{children}</div>
    </div>
  );
}

function Phone({
  label,
  note,
  height,
  children,
  recommended,
}: {
  label: string;
  note: string;
  height?: number;
  children: ReactNode;
  recommended?: boolean;
}) {
  return (
    <div className={styles.cpCol}>
      <div className={styles.cpLabel}>
        {label}
        {recommended && <span className={styles.cpPick}>Recommended</span>}
      </div>
      <p className={styles.cpNote}>{note}</p>
      <div className={styles.cpPhone} style={height ? { height } : undefined}>
        {children}
      </div>
    </div>
  );
}

/* ─── 1. Player card: Stats / Scouting and the season ─────────────── */

const SEASONS = [
  { value: '2026-27', label: '2026/27', pts: '64 pts' },
  { value: '2025-26', label: '2025/26', pts: '172 pts · Final' },
  { value: '2024-25', label: '2024/25', pts: '112 pts · Final' },
] as const;
type Season = (typeof SEASONS)[number]['value'];
type CardTab = 'stats' | 'scout';

function CardField() {
  return (
    <div className={styles.cpField}>
      <Portrait photoUrl="https://resources.premierleague.com/premierleague25/photos/players/110x140/223340.png" name="Bukayo Saka" club="Arsenal" size="md" />
      <div>
        <div className={styles.cpFieldName}>Bukayo Saka</div>
        <div className={styles.cpFieldMeta}>Arsenal · RW</div>
      </div>
    </div>
  );
}

function CardBody({ tab, season }: { tab: CardTab; season: Season }) {
  const past = season !== '2026-27';
  if (tab === 'scout') {
    return (
      <div className={styles.cpBody}>
        <p className={styles.cpProse}>
          Arsenal&apos;s first outlet on the right. Takes set pieces and most of the side&apos;s 1v1s.
        </p>
      </div>
    );
  }
  const rows: [string, string][] = past
    ? [['Minutes', '2,734'], ['Goals', '12'], ['Assists', '11'], ['Average Rating', '7.58']]
    : [['Minutes', '612'], ['Goals', '3'], ['Assists', '4'], ['Average Rating', '7.81']];
  return (
    <div className={styles.cpBody}>
      {rows.map(([k, v]) => (
        <div key={k} className={styles.cpStat}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

/** Today's tab bar, drawn with the modal's own classes and ink logic. */
function TodayCardBar({ tab, setTab, season, setSeason }: { tab: CardTab; setTab: (t: CardTab) => void; season: Season; setSeason: (s: Season) => void }) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useLayoutEffect(() => {
    const tabsEl = tabsRef.current;
    const ink = inkRef.current;
    if (!tabsEl || !ink) return;
    const place = () => {
      const active = tabsEl.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (!active) return;
      ink.style.width = `${active.offsetWidth}px`;
      ink.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(tabsEl);
    return () => ro.disconnect();
  }, [tab]);
  const current = SEASONS.find((s) => s.value === season)!;
  return (
    <div className={`${pdm.tabbar} ${styles.cpStatic}`}>
      <div className={pdm.tabs} role="tablist" ref={tabsRef}>
        <span className={pdm.ink} ref={inkRef} aria-hidden="true" />
        {(['stats', 'scout'] as const).map((t) => (
          <button key={t} type="button" role="tab" className={pdm.tab} aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'stats' ? 'Stats' : 'Scouting'}
          </button>
        ))}
      </div>
      <div className={pdm.seasonWrap} data-open={menuOpen ? 'true' : 'false'}>
        <button type="button" className={pdm.seasonBtn} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
          {current.label}
          <Icon name="chevron-down" size={14} strokeWidth={2} />
        </button>
        <div className={pdm.menu} role="menu" aria-label="Season">
          {SEASONS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="menuitemradio"
              aria-checked={s.value === season}
              className={pdm.menuItem}
              onClick={() => {
                setSeason(s.value);
                setMenuOpen(false);
              }}
            >
              <i aria-hidden="true">{s.value === season ? '✓' : ''}</i>
              <b>{s.label}</b>
              <em>{s.pts}</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const seasonItems = SEASONS.map((s) => ({ value: s.value, label: s.label, trailing: s.pts }));

function CardFrame({ kind }: { kind: 'today' | 'tabs' | 'ink' }) {
  const [tab, setTab] = useState<CardTab>('stats');
  const [season, setSeason] = useState<Season>('2026-27');
  const picker = <Select size="sm" ariaLabel="Season" items={seasonItems} value={season} onChange={setSeason} />;
  return (
    <div className={styles.cpCardVars}>
      <CardField />
      {kind === 'today' && <TodayCardBar tab={tab} setTab={setTab} season={season} setSeason={setSeason} />}
      {kind === 'tabs' && (
        <div className={styles.cpTabbarKit}>
          <Tabs
            ariaLabel="Player card"
            idBase="proto-card"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'stats', label: 'Stats' },
              { value: 'scout', label: 'Scouting' },
            ]}
            className={styles.cpTabsGrow}
          />
          <div className={styles.cpTabbarEnd}>{picker}</div>
        </div>
      )}
      {kind === 'ink' && (
        <div className={`${pdm.tabbar} ${styles.cpStatic}`}>
          <SegmentedControl
            ariaLabel="Player card"
            variant="ink"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'stats', label: 'Stats' },
              { value: 'scout', label: 'Scouting' },
            ]}
          />
          <div className={styles.cpTabbarEnd}>{picker}</div>
        </div>
      )}
      <CardBody tab={tab} season={season} />
    </div>
  );
}

/* ─── 2. League chat on a phone ───────────────────────────────────── */

type ChatTab = 'lobby' | 'futbolpedia' | 'dm';

function ChatFeed() {
  return (
    <div className={styles.cpFeed}>
      <div className={styles.cpMsg}>
        <b>Hayden FC</b>
        <span>Who&apos;s bidding on Barcola then</span>
      </div>
      <div className={styles.cpMsg}>
        <b>Tea FC</b>
        <span>Not me, I&apos;m at €2m over the clause</span>
      </div>
      <div className={`${styles.cpMsg} ${styles.cpMsgMine}`}>
        <span>Sold my soul for Wirtz already</span>
      </div>
    </div>
  );
}

function TodayChat() {
  const [tab, setTab] = useState<ChatTab>('lobby');
  return (
    <div className={styles.cpChat}>
      <header className={`${chat.widgetHeader} ${styles.cpChatHead}`}>
        <div className={chat.headerLeft}>
          <button className={chat.headerBackBtn} type="button" aria-label="View all channels">
            <Icon name="chevron-left" size={16} strokeWidth={2.5} />
            <span>Chats</span>
          </button>
          <div className={chat.headerTitleWrapper}>
            <Icon name="message-square" size={15} strokeWidth={2} />
            <span className={chat.headerTitle}>League Lobby</span>
          </div>
        </div>
        <div className={chat.headerRightActions}>
          <button type="button" className={chat.headerActionBtn} aria-label="Open full chat page">
            <Icon name="external-link" size={15} strokeWidth={2} />
          </button>
          <button type="button" className={chat.headerActionBtn} aria-label="Minimize chat">
            <Icon name="minus" size={16} strokeWidth={2.5} />
          </button>
          <button type="button" className={chat.headerActionBtn} aria-label="Close chat">
            <Icon name="x" size={16} strokeWidth={2.5} />
          </button>
        </div>
      </header>
      <div className={chat.channelTabBar}>
        <button type="button" className={`${chat.tabBtn} ${tab === 'lobby' ? chat.tabBtnActive : ''}`} onClick={() => setTab('lobby')}>
          <Icon name="message-square" size={13} strokeWidth={2} />
          <span>Lobby</span>
        </button>
        <button type="button" className={`${chat.tabBtn} ${tab === 'futbolpedia' ? chat.tabBtnActive : ''}`} onClick={() => setTab('futbolpedia')}>
          <Icon name="soccer" size={13} strokeWidth={2} />
          <span>Futbolpedia</span>
        </button>
        <button type="button" className={`${chat.tabBtn} ${tab === 'dm' ? chat.tabBtnActive : ''}`} onClick={() => setTab('dm')}>
          <Icon name="users" size={13} strokeWidth={2} />
          <span>Direct Messages</span>
          <span className={chat.tabBadge} />
        </button>
      </div>
      <ChatFeed />
    </div>
  );
}

function KitChat() {
  const [tab, setTab] = useState<ChatTab>('lobby');
  return (
    <div className={styles.cpChat}>
      <header className={`${chat.widgetHeader} ${styles.cpChatHead}`}>
        <div className={chat.headerLeft}>
          <button className={chat.headerBackBtn} type="button" aria-label="View all channels">
            <Icon name="chevron-left" size={16} strokeWidth={2.5} />
            <span>Chats</span>
          </button>
          <div className={chat.headerTitleWrapper}>
            <span className={chat.headerTitle}>League Lobby</span>
          </div>
        </div>
        <div className={styles.cpChatActions}>
          <IconButton label="Open Full Chat" icon={<Icon name="external-link" size={16} strokeWidth={2} />} />
          <IconButton label="Minimize" icon={<Icon name="minus" size={18} strokeWidth={2.25} />} />
          <IconButton label="Close" icon={<Icon name="x" size={18} strokeWidth={2.25} />} />
        </div>
      </header>
      <div className={styles.cpChatTabs}>
        <Tabs
          ariaLabel="Chat channels"
          idBase="proto-chat"
          className={styles.cpTabsGrow}
          value={tab}
          onChange={setTab}
          items={[
            { value: 'lobby', label: 'Lobby' },
            { value: 'futbolpedia', label: 'Futbolpedia' },
            { value: 'dm', label: 'Direct Messages', unread: true },
          ]}
        />
      </div>
      <ChatFeed />
    </div>
  );
}

/* ─── 3. Heritage and Cups ────────────────────────────────────────── */

const HERITAGE = ['Overview', 'Head-to-Head', 'Seasons', 'Record Book', 'Trophy Cabinets'] as const;
const CUPS = ['Champions Cup', 'League Cup', 'Consolation Cup'] as const;

function RouteHeads({ kind }: { kind: 'today' | 'kit' | 'rule' }) {
  const [h, setH] = useState<string>('Overview');
  const [c, setC] = useState<string>('Champions Cup');
  return (
    <div className={styles.cpRoutes}>
      <div className={styles.cpRouteBlock}>
        <h4 className={styles.cpPageTitle}>Heritage</h4>
        {kind === 'today' ? (
          // The real nav. Its links point at a league that doesn't exist, so taps stay here.
          <div onClickCapture={(e) => e.preventDefault()}>
            <HeritageNav leagueId="demo" active="Overview" />
          </div>
        ) : (
          <Tabs
            ariaLabel="Heritage sections"
            idBase={`proto-heritage-${kind}`}
            value={h}
            onChange={setH}
            items={HERITAGE.map((t) => ({ value: t, label: t }))}
            className={kind === 'rule' ? styles.cpInkRule : undefined}
          />
        )}
        <div className={heritage.sect}>
          <span className={styles.cpSectName}>Honours Board</span>
        </div>
      </div>

      <div className={styles.cpRouteBlock}>
        <h4 className={styles.cpPageTitle}>Cup Competitions</h4>
        {kind === 'today' ? (
          <div className={`${cups.tabContainer} ${styles.cpCupsToday}`}>
            {CUPS.map((t) => (
              <button
                key={t}
                type="button"
                className={`${cups.tab} ${t === c ? cups.tabActive : cups.tabInactive}`}
                onClick={() => setC(t)}
              >
                {t}
              </button>
            ))}
          </div>
        ) : (
          <Tabs
            ariaLabel="Cups"
            idBase={`proto-cups-${kind}`}
            value={c}
            onChange={setC}
            items={CUPS.map((t) => ({ value: t, label: t }))}
            className={kind === 'rule' ? styles.cpInkRule : undefined}
          />
        )}
      </div>
    </div>
  );
}

/* ─── 4. Top bar menus ────────────────────────────────────────────── */

interface Club {
  name: string;
  balance: number;
  crest: CrestConfig;
}

const CLUBS: Club[] = [
  { name: 'Pizzaking’s Club', balance: 335, crest: { icon: 'paw', shape: 'arch', division: 'solid', showText: true, iconColor: '#60A5FA', textColor: '#2E7D82', borderColor: '#C084FC', primaryColor: '#1C1C1C', tertiaryColor: '#2E7D82', secondaryColor: '#B54E7F' } as CrestConfig },
  { name: 'Hayden FC', balance: 296, crest: { icon: 'castle', shape: 'heraldic', division: 'solid', showText: false, iconColor: '#D4A017', textColor: '#F87171', borderColor: '#D4A017', primaryColor: '#A62626', tertiaryColor: '#D4A017', secondaryColor: '#0F1E36' } as CrestConfig },
  { name: 'Tea FC', balance: 292, crest: { icon: 'anchor', shape: 'circle', division: 'horizontal-half', showText: true, iconColor: '#F7F3ED', textColor: '#F7F3ED', borderColor: '#FBBF24', primaryColor: '#146B40', tertiaryColor: '#1C1C1C', secondaryColor: '#1B4A5A' } as CrestConfig },
  { name: 'tottenyang FC', balance: 205, crest: { icon: 'flame', shape: 'classic', division: 'solid', showText: false, iconColor: '#2A5A92', textColor: '#FFFFFF', borderColor: '#1C1C1C', primaryColor: '#E8E2D5', tertiaryColor: '#2A5A92', secondaryColor: '#8B5CF6' } as CrestConfig },
  { name: 'Not Too Xabi', balance: 204, crest: { icon: 'griffin', shape: 'circle', division: 'quartered', showText: false, iconColor: '#FBBF24', textColor: '#000000', borderColor: '#D4A017', primaryColor: '#4338CA', tertiaryColor: '#1C1C1C', secondaryColor: '#4338CA' } as CrestConfig },
  { name: 'ChelsZ FC', balance: 41, crest: { icon: 'crown', shape: 'circle', division: 'solid', showText: false, iconColor: '#D9D4CD', textColor: '#FFFFFF', borderColor: '#2A5A92', primaryColor: '#60A5FA', tertiaryColor: '#A7F3D0', secondaryColor: '#4A4A4A' } as CrestConfig },
];
const MINE = CLUBS[4];
const LEAGUES = [
  { name: 'Matchday Militia', season: '2026-27', current: true },
  { name: 'Dynasty Dragoon', season: '2026-27', current: false },
];

function Topbar({ open, onBalance, onAccount, balanceRef, avatarRef, children }: {
  open: 'balance' | 'account' | null;
  onBalance?: () => void;
  onAccount?: () => void;
  balanceRef?: React.Ref<HTMLButtonElement>;
  avatarRef?: React.Ref<HTMLButtonElement>;
  children?: ReactNode;
}) {
  return (
    <div className={styles.cpTopbar}>
      <span className={styles.cpTopDot} />
      <span className={styles.cpTopLeague}>Matchday Militia</span>
      <div className={top.balanceContainer}>
        <button ref={balanceRef} type="button" className={top.balancePill} aria-expanded={open === 'balance'} onClick={onBalance}>
          <span className={top.balancePillAmount}>€{MINE.balance}m</span>
          <span className={`${top.chevron} ${open === 'balance' ? top.chevronOpen : ''}`}>▾</span>
        </button>
        {open === 'balance' && children}
      </div>
      <span className={styles.cpTopDot} />
      <span className={styles.cpTopDot} />
      <div className={top.userDropdownContainer}>
        <button ref={avatarRef} type="button" className={top.avatarBtn} aria-label="User menu" aria-expanded={open === 'account'} onClick={onAccount}>
          <CrestBadge config={MINE.crest} size={32} teamName={MINE.name} interactive={false} />
        </button>
        {open === 'account' && children}
      </div>
    </div>
  );
}

function PageBehind() {
  return (
    <div className={styles.cpBehind} aria-hidden="true">
      <div className={styles.cpBehindTitle}>League Home</div>
      <div className={styles.cpBehindLine} />
      <div className={styles.cpBehindLine} style={{ width: '70%' }} />
      <div className={styles.cpBehindBox} />
      <div className={styles.cpBehindBox} />
    </div>
  );
}

function TodayBalance() {
  return (
    <div className={top.balanceDropdown}>
      <div className={top.dropdownSectionLabel}>Club Balances</div>
      <div className={top.balanceList}>
        {CLUBS.map((c) => (
          <a key={c.name} href="#" onClick={(e) => e.preventDefault()} className={`${top.balanceRow} ${c === MINE ? top.balanceRowActive : ''}`}>
            <CrestBadge config={c.crest} teamName={c.name} size={20} interactive={false} />
            <span className={top.balanceRowName}>{c.name}</span>
            <span className={top.balanceRowAmount}>€{c.balance}m</span>
          </a>
        ))}
      </div>
      <div className={top.dropdownDivider} />
      <a href="#" onClick={(e) => e.preventDefault()} className={top.dropdownActionLink}>View Finance →</a>
      <a href="#" onClick={(e) => e.preventDefault()} className={top.dropdownActionLink}>Club Facilities →</a>
    </div>
  );
}

function TodayAccount() {
  return (
    <div className={top.userDropdown}>
      <div className={top.dropdownHeader}>
        <div style={{ marginRight: 12, flexShrink: 0 }}>
          <CrestBadge config={MINE.crest} size={40} teamName={MINE.name} interactive={false} />
        </div>
        <div className={top.dropdownHeaderDetails}>
          <div className={top.dropdownClubName}>{MINE.name}</div>
          <div className={top.dropdownUsername}>@manager</div>
          <a href="#" onClick={(e) => e.preventDefault()} className={top.editCrestLink}>Edit Crest →</a>
        </div>
      </div>
      <div className={top.dropdownDivider} />
      <div className={top.dropdownSection}>
        <div className={top.dropdownSectionLabel}>Switch League</div>
        <div className={top.leagueList}>
          {LEAGUES.map((l) => (
            <a key={l.name} href="#" onClick={(e) => e.preventDefault()} className={`${top.dropdownItem} ${l.current ? top.dropdownItemActive : ''}`}>
              <span className={`${top.leagueDot} ${l.current ? top.leagueDotActive : top.leagueDotInactive}`} />
              <span className={top.dropdownItemName}>{l.name}</span>
              <span className={top.dropdownItemSeason}>{l.season}</span>
            </a>
          ))}
        </div>
        <div className={top.dropdownDivider} style={{ margin: '8px 0' }} />
        <a href="#" onClick={(e) => e.preventDefault()} className={top.dropdownActionLink}>+ Create League</a>
        <a href="#" onClick={(e) => e.preventDefault()} className={top.dropdownActionLink}>↳ Join League</a>
      </div>
      <div className={top.dropdownDivider} />
      {(['Lineup Builder', 'Settings', 'Help'] as const).map((t) => (
        <a key={t} href="#" onClick={(e) => e.preventDefault()} className={top.dropdownActionLink}>{t}</a>
      ))}
      <div className={top.dropdownDivider} />
      <div style={{ padding: '4px 0' }}>
        <button type="button" className={top.dropdownSignOutBtn}>Sign out</button>
      </div>
    </div>
  );
}

/** Option A's content: the same rows for the floating panel and the phone sheet. */
function KitBalance({ onPick }: { onPick?: () => void }) {
  return (
    <div className={styles.cpMenu}>
      {CLUBS.map((c) => (
        <a key={c.name} href="#" onClick={(e) => { e.preventDefault(); onPick?.(); }} className={styles.cpRow} aria-current={c === MINE ? 'true' : undefined}>
          <CrestBadge config={c.crest} teamName={c.name} size={24} interactive={false} />
          <span className={styles.cpRowName}>{c.name}</span>
          <span className={styles.cpRowFig}>€{c.balance}m</span>
        </a>
      ))}
      <div className={styles.cpSep} />
      <a href="#" onClick={(e) => { e.preventDefault(); onPick?.(); }} className={styles.cpRow}>
        <span className={styles.cpRowName}>Finance</span>
        <Icon name="chevron-right" size={16} strokeWidth={2} />
      </a>
      <a href="#" onClick={(e) => { e.preventDefault(); onPick?.(); }} className={styles.cpRow}>
        <span className={styles.cpRowName}>Club Facilities</span>
        <Icon name="chevron-right" size={16} strokeWidth={2} />
      </a>
    </div>
  );
}

function KitAccount({ onPick }: { onPick?: () => void }) {
  const go = (e: React.MouseEvent) => {
    e.preventDefault();
    onPick?.();
  };
  return (
    <div className={styles.cpMenu}>
      <a href="#" onClick={go} className={styles.cpIdentity}>
        <CrestBadge config={MINE.crest} size={44} teamName={MINE.name} interactive={false} />
        <span className={styles.cpIdentityText}>
          <b>{MINE.name}</b>
          <span>@manager · Edit Crest</span>
        </span>
      </a>
      <div className={styles.cpSep} />
      {LEAGUES.map((l) => (
        <a key={l.name} href="#" onClick={go} className={styles.cpRow} aria-current={l.current ? 'true' : undefined}>
          <span className={styles.cpRowName}>{l.name}</span>
          <span className={styles.cpRowMeta}>{l.season}</span>
          <span className={styles.cpRowCheck}>{l.current && <Icon name="check" size={16} strokeWidth={2.25} />}</span>
        </a>
      ))}
      <a href="#" onClick={go} className={styles.cpRow}>
        <Icon name="plus" size={16} strokeWidth={2} />
        <span className={styles.cpRowName}>Create or Join a League</span>
      </a>
      <div className={styles.cpSep} />
      {([['layout', 'Lineup Builder'], ['settings', 'Settings'], ['help-circle', 'Help']] as const).map(([icon, t]) => (
        <a key={t} href="#" onClick={go} className={styles.cpRow}>
          <Icon name={icon} size={16} strokeWidth={1.75} />
          <span className={styles.cpRowName}>{t}</span>
        </a>
      ))}
      <div className={styles.cpSep} />
      <button type="button" onClick={() => onPick?.()} className={`${styles.cpRow} ${styles.cpRowDanger}`}>
        <span className={styles.cpRowName}>Sign Out</span>
      </button>
    </div>
  );
}

/** A docked sheet drawn inside the phone frame, matching Popover's sheet mode. */
function DrawnSheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className={styles.cpScrim} />
      <div className={styles.cpSheet}>
        <div className={styles.cpSheetHead}>{title}</div>
        {children}
      </div>
    </>
  );
}

function TopbarToday({ which }: { which: 'balance' | 'account' }) {
  const [open, setOpen] = useState<'balance' | 'account' | null>(which);
  return (
    <>
      <Topbar
        open={open}
        onBalance={() => setOpen((o) => (o === 'balance' ? null : 'balance'))}
        onAccount={() => setOpen((o) => (o === 'account' ? null : 'account'))}
      >
        {open === 'balance' ? <TodayBalance /> : open === 'account' ? <TodayAccount /> : null}
      </Topbar>
      <PageBehind />
    </>
  );
}

/** The drawn sheet shows the open state; tapping the pill or crest opens the real Popover. */
function TopbarKit({ which }: { which: 'balance' | 'account' }) {
  const [live, setLive] = useState<'balance' | 'account' | null>(null);
  const [pill, setPill] = useState<HTMLButtonElement | null>(null);
  const [avatar, setAvatar] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <Topbar
        open={live}
        balanceRef={setPill}
        avatarRef={setAvatar}
        onBalance={() => setLive((o) => (o === 'balance' ? null : 'balance'))}
        onAccount={() => setLive((o) => (o === 'account' ? null : 'account'))}
      />
      <PageBehind />
      <DrawnSheet title={which === 'balance' ? 'Club Balances' : 'Account'}>
        {which === 'balance' ? <KitBalance /> : <KitAccount />}
      </DrawnSheet>
      <Popover
        open={live === 'balance'}
        onClose={() => setLive(null)}
        anchor={pill}
        placement="bottom-end"
        sheet
        sheetTitle="Club Balances"
        aria-label="Club Balances"
        className={styles.cpPopover}
      >
        <KitBalance onPick={() => setLive(null)} />
      </Popover>
      <Popover
        open={live === 'account'}
        onClose={() => setLive(null)}
        anchor={avatar}
        placement="bottom-end"
        sheet
        sheetTitle="Account"
        aria-label="Account"
        className={styles.cpPopover}
      >
        <KitAccount onPick={() => setLive(null)} />
      </Popover>
    </>
  );
}

/* ─── 5. Auction timing help and the lot toggle ───────────────────── */

const TIMING = ['Bigger fees get longer minimums.', 'Each bid extends the clock.', 'Nothing closes overnight.'];

function LotRow({ toggle, open, animate }: { toggle: ReactNode; open: boolean; animate?: boolean }) {
  return (
    <div className={styles.cpLot}>
      <div className={styles.cpLotRow}>
        <Portrait photoUrl="https://resources.premierleague.com/premierleague25/photos/players/110x140/244851.png" name="Cole Palmer" club="Chelsea" size="sm" />
        <div className={styles.cpLotWho}>
          <b>Cole Palmer</b>
          <span>€38m · 4 bids</span>
        </div>
        <span className={styles.cpLotBid}>Bid €39m</span>
        {toggle}
      </div>
      <div className={styles.cpLotPanel} data-open={open || undefined} data-animate={animate || undefined}>
        <div className={styles.cpLotInner}>
          <div className={styles.cpLotHistory}>
            {[['Hayden FC', '€38m'], ['Tea FC', '€35m'], ['Hayden FC', '€31m']].map(([who, amt], i) => (
              <div key={i} className={styles.cpStat}>
                <span>{who}</span>
                <b>{amt}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuctionToday() {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.cpPad}>
      <h4 className={styles.cpRoom}>
        The Auction Room{' '}
        <span className={help.help}>
          <button type="button" className={help.toggle} aria-describedby="proto-timing-today" aria-label="How auction timing works">
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <circle cx="5" cy="2.25" r="1" fill="currentColor" />
              <rect x="4.25" y="4.5" width="1.5" height="4.25" rx="0.75" fill="currentColor" />
            </svg>
          </button>
          <span role="tooltip" id="proto-timing-today" className={help.tip}>
            {TIMING.map((t) => <span key={t}>{t}</span>)}
          </span>
        </span>
      </h4>
      <LotRow
        open={open}
        toggle={
          <button type="button" className={styles.cpTodayToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Hide bid history' : 'Show bid history'}>
            {open ? '▴' : '▾'}
          </button>
        }
      />
    </div>
  );
}

function AuctionKit() {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const [tipAnchor, setTipAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <div className={styles.cpPad}>
      <h4 className={styles.cpRoom}>
        The Auction Room
        <IconButton
          ref={setTipAnchor}
          size="sm"
          label="Auction Timing"
          tooltip={false}
          aria-expanded={tip}
          onClick={() => setTip((t) => !t)}
          icon={<Icon name="help-circle" size={16} strokeWidth={2} />}
        />
      </h4>
      <Popover open={tip} onClose={() => setTip(false)} anchor={tipAnchor} placement="bottom-start" aria-label="Auction timing" className={styles.cpTip}>
        {TIMING.map((t) => <p key={t}>{t}</p>)}
      </Popover>
      <LotRow
        open={open}
        animate
        toggle={
          <IconButton
            label={open ? 'Hide Bid History' : 'Show Bid History'}
            tooltip={false}
            variant="secondary"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={styles.cpChevronBtn}
            icon={<Icon name="chevron-down" size={18} strokeWidth={2} />}
          />
        }
      />
    </div>
  );
}

/* ─── 6. Close buttons ────────────────────────────────────────────── */

const CLOSES: { where: string; today: CSSProperties; glyph: 'text' | 'icon'; size: string; kit: 'ghost' | 'secondary' }[] = [
  { where: 'Squad Peek', size: '23 × 24', glyph: 'text', kit: 'ghost', today: { background: 'none', border: 'none', fontSize: '1rem', lineHeight: 1, color: 'var(--color-text-muted)', padding: '0.25rem 0.35rem', borderRadius: 'var(--radius-sm)' } },
  { where: 'Roster Player Panel', size: '32 × 32', glyph: 'text', kit: 'secondary', today: { width: 32, height: 32, borderRadius: 'var(--r-round)', border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', fontSize: 'var(--t-13)' } },
  { where: 'Lineup Builder Picker', size: '34 × 34', glyph: 'text', kit: 'ghost', today: { width: 34, height: 34, fontSize: 'var(--t-17)', lineHeight: 1, color: 'var(--color-text-muted)', background: 'transparent', border: 'none', borderRadius: 'var(--r-control)' } },
  { where: 'Lineup Error Notice', size: '8 × 11', glyph: 'text', kit: 'ghost', today: { background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: 'var(--t-11)', padding: 0, lineHeight: 1 } },
  { where: 'Chat Header', size: '28 × 28', glyph: 'icon', kit: 'ghost', today: { width: 28, height: 28, borderRadius: 4, background: 'transparent', border: 'none', color: 'var(--color-text-secondary)' } },
];

function CloseTable() {
  return (
    <div className={styles.cpCloses}>
      <div className={`${styles.cpCloseRow} ${styles.cpCloseHead}`}>
        <span>Surface</span>
        <span>Today</span>
        <span>Kit</span>
      </div>
      {CLOSES.map((c) => (
        <div key={c.where} className={styles.cpCloseRow}>
          <span className={styles.cpCloseWhere}>
            {c.where}
            <em>{c.size}px</em>
          </span>
          <span>
            <button type="button" aria-label="Close" style={{ display: 'inline-grid', placeItems: 'center', cursor: 'pointer', ...c.today }}>
              {c.glyph === 'text' ? '✕' : <Icon name="x" size={16} strokeWidth={2.5} />}
            </button>
          </span>
          <span>
            <IconButton label="Close" variant={c.kit} icon={<Icon name="x" size={18} strokeWidth={2} />} />
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── The set ─────────────────────────────────────────────────────── */

export default function ChromePrototypes() {
  return (
    <section className={`${styles.protos} ${styles.cpWide}`} aria-labelledby="chrome-protos">
      <h2 id="chrome-protos" className={styles.protoGroupTitle}>
        Tabs, Menus and Close Buttons
      </h2>
      <p className={styles.protoIntro}>
        The last kit pieces not yet in the app. Each frame is a 375px phone; tap anything in it. Today uses the
        app&apos;s own styles. Nothing in the app changes until you pick.
      </p>

      <Case tag="1" title="Player Card: Stats, Scouting and Season" where="PlayerDetailsModal.tsx · the bar under the card on a phone, beside the panel head on desktop">
        <Phone label="Today" note="Tray tabs 30px tall; the season list is a 40px-row dropdown." height={380}>
          <CardFrame kind="today" />
        </Phone>
        <Phone label="A · Tabs" note="Kit Tabs: 44px, one underline travels. Season is a kit Select: a sheet with 48px rows on a phone." height={380} recommended>
          <CardFrame kind="tabs" />
        </Phone>
        <Phone label="B · Ink" note="The ink switcher chosen for section heads, with the same season Select." height={380}>
          <CardFrame kind="ink" />
        </Phone>
      </Case>

      <Case tag="2" title="League Chat" where="LeagueChatWidget.tsx · full screen on a phone, a floating panel on desktop">
        <Phone label="Today" note="12px chip tabs about 26px tall; header buttons 28px." height={330}>
          <TodayChat />
        </Phone>
        <Phone label="A · Kit" note="Kit Tabs with an unread mark; header IconButtons reach 44px under a finger." height={330} recommended>
          <KitChat />
        </Phone>
      </Case>

      <Case tag="3" title="Heritage and Cups Tabs" where="HeritageNav.tsx, tournaments/page.tsx · these are links, so Tabs gains a link mode">
        <Phone label="Today" note="Heritage: 12px links, about 29px tall. Cups: 10px uppercase, which wraps on a phone." height={330}>
          <RouteHeads kind="today" />
        </Phone>
        <Phone label="A · Tabs" note="Kit Tabs on a hairline, 44px. Same look as the player card in 1A." height={330} recommended>
          <RouteHeads kind="kit" />
        </Phone>
        <Phone label="B · Tabs on the ink rule" note="Kit Tabs sizing, keeping Heritage's 2px ink rule under the nav." height={330}>
          <RouteHeads kind="rule" />
        </Phone>
      </Case>

      <Case tag="4" title="Club Balance and Account Menus" where="TopBar.tsx · tap the pill or the crest in an A frame to open the real one">
        <Phone label="Today · Club Balance" note="A 240px dropdown; rows about 40px, links about 27px." height={560}>
          <TopbarToday which="balance" />
        </Phone>
        <Phone label="A · Club Balance" note="A kit Popover: a sheet with 48px rows on a phone, a floating panel on desktop." height={560} recommended>
          <TopbarKit which="balance" />
        </Phone>
        <Phone label="Today · Account" note="A 280px dropdown; most links about 27px tall." height={640}>
          <TopbarToday which="account" />
        </Phone>
        <Phone label="A · Account" note="Same sheet. The league dots become a check; Create and Join share one row." height={640} recommended>
          <TopbarKit which="account" />
        </Phone>
      </Case>

      <Case tag="5" title="Auction Timing Help and Bid History" where="AuctionTimingHelp.tsx (four Transfers pages), AuctionsClient.tsx">
        <Phone label="Today" note="An 18px button that opens only on hover or keyboard focus, so it stays shut under a finger on iPhone. A 24px arrow swaps the history in." height={300}>
          <AuctionToday />
        </Phone>
        <Phone label="A · Kit" note="Tap to open a Popover. A chevron IconButton; the history folds open with Disclosure's motion." height={300} recommended>
          <AuctionKit />
        </Phone>
      </Case>

      <Case tag="6" title="Close Buttons" where="SquadPeekDrawer, ClubClient, LineupPlayerPickerModal, PitchUI, LeagueChatWidget">
        <Phone label="Today and Kit" note="Kit IconButton: 36px, 44px under a finger, an SVG cross. The player card's own close stays as it is." height={330}>
          <CloseTable />
        </Phone>
      </Case>
    </section>
  );
}
