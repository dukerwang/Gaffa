import { RoundSkeleton } from '@/components/gameweeks/Skeletons';

/** The gameweek page on its way, drawn in the page's own bar, scoreboard and panels. */
export default function Loading() {
  return (
    <div data-route-skeleton style={{ display: 'contents' }}>
      <RoundSkeleton />
    </div>
  );
}
