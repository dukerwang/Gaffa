import CrestBadge from '@/components/crest/CrestBadge';
import type { CrestConfig } from '@/components/crest/types';
import type { HomeModel } from '@/lib/home/buildHomeModel';
import styles from './home.module.css';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/**
 * The shelf — the field the rest of the page attaches to.
 *
 * It replaces the masthead, which set the club name at 38px over a 2px rule
 * with four read-only figures floated right. Duke named that arrangement as
 * the reason Gaffa pages read like HTML rather than an app (DECISIONS,
 * 2026-09-10), and the dashboard answered it by carrying the topbar's green
 * on down the page so the objects below have something to rise out of.
 *
 * The figures did not survive as figures. Rank and form are a score bug here;
 * the projected prize is the table's own Pays column; Club Balance is a
 * pressable chip on the market, where it is the number you act with; Match
 * Revenue rides the fixture it is riding on.
 */
export default function Shelf({ model }: { model: HomeModel }) {
  const { standing } = model;
  const behind =
    standing.rank === 1
      ? 'Top of the table'
      : `${standing.gapToLeader} behind ${standing.leaderName ?? 'the leader'}`;

  return (
    <div className={styles.shelf}>
      <div className={styles.shelfInner}>
        <span className={styles.shelfCrest}>
          <CrestBadge
            config={model.club.crest as CrestConfig | null}
            size={44}
            teamName={model.club.name}
            teamId={model.club.id}
          />
        </span>

        <div className={styles.shelfTitle}>
          <h1 className={styles.shelfH}>{model.club.name}</h1>
          <div className={styles.shelfSub}>{model.subtitle}</div>
        </div>

        <div className={styles.bug}>
          <span className={styles.bugRank}>
            <span className={styles.bugRankV}>{ordinal(standing.rank)}</span>
            <span className={styles.bugRankK}>of {standing.teamCount}</span>
          </span>
          <div className={styles.bugRight}>
            <div className={styles.bugForm} aria-label={`Form, newest first: ${standing.form.join(' ')}`}>
              {standing.form.map((p, i) => (
                <span
                  key={i}
                  className={p === 'W' ? styles.pipW : p === 'D' ? styles.pipD : styles.pipL}
                >
                  {p}
                </span>
              ))}
            </div>
            <div className={styles.bugLine}>
              {standing.leaguePoints} pts &middot; {behind}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
