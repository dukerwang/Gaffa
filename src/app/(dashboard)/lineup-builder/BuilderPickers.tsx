'use client';

import { useMemo } from 'react';
import { Picker, type PickerGroup, type PickerOption } from '@/components/ui/Picker';
import { CLUB_BY_SLUG, clubBadgePath } from '@/lib/clubs/registry';
import { fixtureKey, kickoffDay, kickoffTime, type BuilderFixture } from '@/lib/lineups/builderFixtures';
import styles from './lineup-builder.module.css';

/* eslint-disable @next/next/no-img-element */

function Crest({ slug, size = 18 }: { slug: string; size?: number }) {
  const src = clubBadgePath(slug);
  return src ? (
    <img src={src} alt="" width={size} height={size} className={styles.pickCrest} />
  ) : (
    <span className={styles.pickCrest} style={{ width: size, height: size }} aria-hidden="true" />
  );
}

interface MatchOption extends PickerOption {
  fixture: BuilderFixture | null;
}

/**
 * The match a lineup is for. Rows read like the dashboard's fixture list: both
 * crests, both clubs, and the score once played or the kickoff time before.
 */
export function MatchPicker({
  weeks,
  value,
  onChange,
}: {
  weeks: [string, BuilderFixture[]][];
  value: BuilderFixture | null;
  onChange: (key: string) => void;
}) {
  const groups = useMemo<PickerGroup<MatchOption>[]>(
    () => [
      { options: [{ value: '', label: 'Any Match', fixture: null }] },
      ...weeks.map(([week, list]) => ({
        label: week,
        options: list.map((f) => ({
          value: fixtureKey(f),
          label: `${f.homeName} vs. ${f.awayName}`,
          keywords: [CLUB_BY_SLUG.get(f.home)?.shortName, CLUB_BY_SLUG.get(f.away)?.shortName].join(' '),
          fixture: f,
        })),
      })),
    ],
    [weeks],
  );
  // With nothing chosen, the list opens on the next match to kick off.
  const next = weeks.flatMap(([, list]) => list).find((f) => !f.finished);

  return (
    <Picker<MatchOption>
      groups={groups}
      value={value ? fixtureKey(value) : ''}
      onChange={(v) => onChange(v)}
      ariaLabel="Match"
      searchable
      searchPlaceholder="Search Clubs"
      scrollToValue={next ? fixtureKey(next) : undefined}
      popoverWidth={360}
      align="end"
      renderValue={(o) =>
        o.fixture ? (
          <span className={styles.pickValue}>
            <Crest slug={o.fixture.home} size={16} />
            <span className={styles.pickValueText}>
              {o.fixture.homeName} vs. {o.fixture.awayName}
            </span>
          </span>
        ) : (
          o.label
        )
      }
      renderOption={(o) => {
        const f = o.fixture;
        if (!f) return <span className={styles.pickAny}>{o.label}</span>;
        const played = f.homeScore !== null && f.awayScore !== null;
        return (
          <span className={styles.fxRow}>
            <span className={styles.fxSideHome}>
              <span className={styles.fxName}>{f.homeName}</span>
              <Crest slug={f.home} />
            </span>
            <span className={played ? styles.fxScore : styles.fxTime}>
              {played ? (
                `${f.homeScore}–${f.awayScore}`
              ) : (
                <>
                  <span>{kickoffDay(f.kickoff).split(' ')[0]}</span>
                  <span>{kickoffTime(f.kickoff)}</span>
                </>
              )}
            </span>
            <span className={styles.fxSideAway}>
              <Crest slug={f.away} />
              <span className={styles.fxName}>{f.awayName}</span>
            </span>
          </span>
        );
      }}
    />
  );
}

/** A club, or every club, with crests and a search. */
export function ClubPicker({
  clubs,
  value,
  onChange,
  allLabel = 'All Clubs',
  ariaLabel = 'Club',
}: {
  clubs: { slug: string; name: string }[];
  value: string | null;
  onChange: (slug: string | null) => void;
  allLabel?: string;
  ariaLabel?: string;
}) {
  const groups = useMemo<PickerGroup[]>(
    () => [
      { options: [{ value: '', label: allLabel }] },
      {
        options: clubs.map((c) => ({ value: c.slug, label: c.name, keywords: CLUB_BY_SLUG.get(c.slug)?.shortName })),
      },
    ],
    [clubs, allLabel],
  );
  const row = (o: PickerOption) =>
    o.value ? (
      <span className={styles.pickValue}>
        <Crest slug={o.value} size={18} />
        <span className={styles.pickValueText}>{o.label}</span>
      </span>
    ) : (
      <span className={styles.pickAny}>{o.label}</span>
    );

  return (
    <Picker
      groups={groups}
      value={value ?? ''}
      onChange={(v) => onChange(v || null)}
      ariaLabel={ariaLabel}
      searchable
      searchPlaceholder="Search Clubs"
      popoverWidth={240}
      renderValue={row}
      renderOption={row}
    />
  );
}
