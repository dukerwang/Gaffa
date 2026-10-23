'use client';

import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui';
import loading from '../(dashboard)/loading.module.css';
import styles from './kit.module.css';

/* Prototype only. What each page shows on a phone between the tap and the
   data: today's blank page with a bar, against skeletons drawn at the sizes
   measured on the live pages (375px wide). A keeps whatever is known before
   the data arrives as real text; B draws everything as shapes. */

/** Real text in A, a bone of about its size in B. */
function Label({ chrome, w, h = 12, children, className }: { chrome: boolean; w: number | string; h?: number; children: ReactNode; className?: string }) {
  return chrome ? <span className={className}>{children}</span> : <Skeleton width={w} height={h} />;
}

function Phone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={styles.skelPhone} aria-label={label}>
      <div className={styles.skelTopbar} aria-hidden="true">
        <span className={styles.skelTopDot} />
        <span className={styles.skelTopPill} />
        <span className={styles.skelTopDot} />
        <span className={styles.skelTopDot} />
        <span className={styles.skelTopDot} />
        <span className={styles.skelTopDot} />
      </div>
      <div className={styles.skelScreen}>{children}</div>
    </div>
  );
}

/* ─── League Home ─────────────────────────────────────────────────── */

function HomeSkeleton({ chrome }: { chrome: boolean }) {
  return (
    <div className={styles.skelPad}>
      <div className={styles.skelRow}>
        <Skeleton width={46} height={55} />
        <div className={styles.skelCol}>
          <Skeleton width="70%" height={28} />
          <Skeleton shape="text" lines={2} />
        </div>
      </div>
      <div className={styles.skelFigs}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.skelCol}>
            <Skeleton width="55%" height={24} />
            <Skeleton shape="text" lines={2} />
          </div>
        ))}
      </div>
      <div className={styles.skelRule} />
      <div className={styles.skelBox}>
        <div className={styles.skelBoxHead}>
          <Label chrome={chrome} w={96} className={styles.skelSmall}>
            Matchweek
          </Label>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className={styles.skelTeam}>
            <Skeleton shape="circle" width={34} height={34} />
            <div className={styles.skelCol}>
              <Skeleton width="60%" height={20} />
              <Skeleton width="35%" height={10} />
            </div>
            <Skeleton width={58} height={28} />
          </div>
        ))}
      </div>
      <Skeleton width="38%" height={22} />
      <div className={styles.skelBox}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skelTeam}>
            <Skeleton width={18} height={14} />
            <Skeleton shape="circle" width={24} height={24} />
            <div className={styles.skelCol}>
              <Skeleton width="55%" height={14} />
            </div>
            <Skeleton width={36} height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Roster ──────────────────────────────────────────────────────── */

function RosterSkeleton({ chrome }: { chrome: boolean }) {
  const fig = (label: string) => (
    <div className={styles.skelFigRow}>
      <Label chrome={chrome} w={90} h={10} className={styles.skelCaps}>
        {label}
      </Label>
      <Skeleton width="45%" height={26} />
      <Skeleton width="55%" height={11} />
    </div>
  );
  return (
    <div className={styles.skelCard}>
      <div className={styles.skelPadTight}>
        <Skeleton width={50} height={58} />
        <Skeleton width="55%" height={10} />
        <Skeleton width="65%" height={30} />
        <Skeleton width="80%" height={12} />
      </div>
      <div className={styles.skelStrip}>
        {[120, 132, 110].map((w, i) => (
          <Skeleton key={i} width={w} height={36} className={styles.skelRound} />
        ))}
      </div>
      {fig('Club Balance')}
      {fig('Squad Value')}
      {fig('Points For')}
    </div>
  );
}

/* ─── Transfers (Market) ──────────────────────────────────────────── */

function TransfersSkeleton({ chrome }: { chrome: boolean }) {
  const tabs = ['Market', 'Auctions', 'Listings', 'Free Agency', 'Deals'];
  const figs = ['Club Balance', 'Lots Live', 'Offers to Answer', 'On the Board'];
  return (
    <div className={styles.skelPad}>
      <div className={styles.skelTabs}>
        {tabs.map((t, i) =>
          chrome ? (
            <span key={t} className={i === 0 ? styles.skelTabOn : styles.skelTab}>
              {t}
            </span>
          ) : (
            <Skeleton key={t} width={t.length * 7} height={12} />
          ),
        )}
      </div>
      <Skeleton width="78%" height={10} />
      <Label chrome={chrome} w="62%" h={28} className={styles.skelTitle}>
        Transfer Market
      </Label>
      <div className={styles.skelFigs}>
        {figs.map((f) => (
          <div key={f} className={styles.skelCol}>
            <Skeleton width={56} height={22} />
            <Label chrome={chrome} w={70} h={9} className={styles.skelCaps}>
              {f}
            </Label>
          </div>
        ))}
      </div>
      <div className={styles.skelRule} />
      <Label chrome={chrome} w="45%" h={22} className={styles.skelSection}>
        Closing now
      </Label>
      <div className={styles.skelBox}>
        <div className={styles.skelTeam}>
          <Skeleton width={74} height={86} />
          <div className={styles.skelCol}>
            <Skeleton width="55%" height={18} />
            <Skeleton width="70%" height={11} />
          </div>
        </div>
        <div className={styles.skelLadder}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skelCol}>
              <Skeleton width="60%" height={9} />
              <Skeleton width="50%" height={16} />
            </div>
          ))}
        </div>
      </div>
      <Label chrome={chrome} w="62%" h={22} className={styles.skelSection}>
        On the Listings Board
      </Label>
      <div className={styles.skelBox}>
        <div className={styles.skelTeam}>
          <Skeleton width={74} height={86} />
          <div className={styles.skelCol}>
            <Skeleton width="50%" height={18} />
            <Skeleton width="65%" height={11} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Players (Cards) ─────────────────────────────────────────────── */

function PlayersSkeleton({ chrome }: { chrome: boolean }) {
  return (
    <div className={styles.skelCard}>
      <div className={styles.skelPadTight}>
        <Skeleton width="42%" height={10} />
        <Label chrome={chrome} w="40%" h={30} className={styles.skelTitle}>
          Players
        </Label>
        <div className={styles.skelRow}>
          <Skeleton width={44} height={24} />
          <Skeleton width={150} height={30} />
        </div>
        {chrome ? (
          <div className={styles.skelSwitch}>
            <span>Cards</span>
            <span>Table</span>
            <span>Explorer</span>
          </div>
        ) : (
          <Skeleton width={190} height={30} />
        )}
      </div>
      <div className={styles.skelTools}>
        {chrome ? (
          <div className={styles.skelSearch}>Search player or club…</div>
        ) : (
          <Skeleton height={44} />
        )}
        <div className={styles.skelSelects}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={44} />
          ))}
        </div>
      </div>
      <div className={styles.skelPadTight}>
        <div className={styles.skelBox}>
          <div className={styles.skelTeam}>
            <Skeleton width={54} height={64} />
            <div className={styles.skelCol}>
              <Skeleton width={70} height={16} />
              <Skeleton width="65%" height={18} />
              <Skeleton width="35%" height={10} />
            </div>
          </div>
          <div className={styles.skelPadTight}>
            <Skeleton shape="text" lines={3} />
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGES = [
  { key: 'home', title: 'League Home', where: 'league/[leagueId]/page.tsx', Comp: HomeSkeleton },
  { key: 'roster', title: 'Roster', where: 'league/[leagueId]/team/roster', Comp: RosterSkeleton },
  { key: 'transfers', title: 'Transfers', where: 'league/[leagueId]/transfers (Market)', Comp: TransfersSkeleton },
  { key: 'players', title: 'Players', where: 'league/[leagueId]/players (Cards)', Comp: PlayersSkeleton },
] as const;

export function SkeletonPrototypes() {
  return (
    <div className={`${styles.protos} ${styles.skelWide}`}>
      <h2 className={styles.protoGroupTitle}>Loading Pages</h2>
      <p className={styles.protoIntro}>
        What a phone shows between the tap and the data, drawn at the sizes measured on the live pages. A shows what
        is known before the data arrives as real text (page names, tabs, figure labels) and shapes only the data. B
        draws everything as shapes.
      </p>

      <div className={styles.protoCase}>
        <span className={styles.protoTag}>0</span>
        <h3 className={styles.skelCaseTitle}>Today</h3>
        <p className={styles.skelCaseWhere}>(dashboard)/loading.tsx: a 3px bar over a blank page, on every route</p>
        <div className={styles.skelPhones}>
          <div className={styles.skelPhoneCol}>
            <Phone label="Today">
              <div className={`${loading.loadingContainer} ${styles.skelBar}`}>
                <div className={loading.progressBar} />
              </div>
            </Phone>
          </div>
        </div>
      </div>

      {PAGES.map(({ key, title, where, Comp }, i) => (
        <div key={key} className={styles.protoCase}>
          <span className={styles.protoTag}>{i + 1}</span>
          <h3 className={styles.skelCaseTitle}>{title}</h3>
          <p className={styles.skelCaseWhere}>{where}</p>
          <div className={styles.skelPhones}>
            <div className={styles.skelPhoneCol}>
              <div className={styles.skelLabel}>
                A · Labels and Shapes <span className={styles.skelNote}>recommended</span>
              </div>
              <Phone label={`${title}, option A`}>
                <Comp chrome />
              </Phone>
            </div>
            <div className={styles.skelPhoneCol}>
              <div className={styles.skelLabel}>B · Shapes Only</div>
              <Phone label={`${title}, option B`}>
                <Comp chrome={false} />
              </Phone>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
