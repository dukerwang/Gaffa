import NavigationLink from '@/components/ui/NavigationLink';
import CrestBadge from '@/components/crest/CrestBadge';
import Trophy from '@/components/trophies/Trophy';
import { fmt } from '@/lib/matchups/roundView';
import type { NextTie as NextTieModel, TieLine } from '@/lib/cups/cupsView';
import type { HonourKind } from '@/lib/honours/getClubHonours';
import s from './cups.module.css';

function Side({ l }: { l: TieLine }) {
  return (
    <div className={s.bugSide}>
      {l.club ? (
        <CrestBadge config={l.club.crest} size={44} teamName={l.club.name} interactive={false} />
      ) : (
        <span className={s.placeCrest} aria-hidden>?</span>
      )}
      {l.club ? (
        <span className={`${s.bugName}${l.mine ? ` ${s.nmMine}` : ''}`}>{l.club.name}</span>
      ) : (
        <span className={`${s.bugName} ${s.placeName}`}>{l.label}</span>
      )}
      {l.score != null && <span className={`${s.bugScore}${l.lost ? ` ${s.bugLost}` : ''}`}>{fmt(l.score)}</span>}
    </div>
  );
}

/** Your tie in the selected cup: next up, live, the one that put you out, or the cup's winner. */
export function NextTie({ next, kind }: { next: NextTieModel; kind: HonourKind }) {
  if (next.kind === 'winner') {
    return (
      <div className={s.next}>
        <div className={s.through}>
          <CrestBadge config={next.club.crest} size={44} teamName={next.club.name} interactive={false} />
          <div className={s.throughTx}>
            <span className={s.throughH}>{next.mine ? 'You won the ' : `${next.club.name} won the `}{next.cupName}</span>
            <span className={s.throughNote}>Winner</span>
          </div>
        </div>
      </div>
    );
  }

  if (next.kind === 'through') {
    return (
      <div className={s.next}>
        <div className={s.through}>
          <Trophy kind={kind} size="pip" height={40} />
          <div className={s.throughTx}>
            <span className={s.throughH}>{next.bye ? 'Bye to the' : 'Through to the'} {next.next}</span>
            <span className={s.throughNote}>{next.note}</span>
          </div>
        </div>
      </div>
    );
  }

  const tie = next.tie;
  const live = tie.state === 'live';
  const label = tie.a.club && tie.b.club ? `Open ${tie.a.club.name} v ${tie.b.club.name}` : undefined;
  const played = tie.a.score != null || tie.b.score != null;
  return (
    <div className={s.next}>
      {tie.href && <NavigationLink href={tie.href} className={s.stretch} aria-label={label}>{null}</NavigationLink>}
      <div className={s.bug}>
        <Side l={tie.a} />
        <span className={s.bugMid}>{played ? '–' : 'v'}</span>
        <Side l={tie.b} />
      </div>
      <div className={s.meta}>
        <span>
          <b>{next.kind === 'out' ? `Out · ${next.round}` : next.round}</b>
          {next.kind === 'tie' && <> · {next.mw}</>}
        </span>
        {live ? (
          <span className={s.metaLive}>Live</span>
        ) : next.kind === 'tie' ? (
          <span>{next.when}</span>
        ) : (
          <span>{tie.decidedLabel ?? 'Final'}</span>
        )}
      </div>
    </div>
  );
}
