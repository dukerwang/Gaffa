/**
 * Heritage's own nav, shown on every surface of the hub: kit Tabs in link
 * mode. It scrolls horizontally on a phone rather than wrapping, so the five
 * destinations stay one row. Each page renders its own nav, so the underline
 * lands on the new tab rather than travelling to it.
 */

import { Tabs } from '@/components/ui';

export type HeritageTab =
  | 'Overview'
  | 'Head-to-Head'
  | 'Seasons'
  | 'Record Book'
  | 'Trophy Cabinets';

const TABS: { label: HeritageTab; href: string }[] = [
  { label: 'Overview', href: '' },
  { label: 'Head-to-Head', href: '/head-to-head' },
  { label: 'Seasons', href: '/seasons' },
  { label: 'Record Book', href: '/records' },
  { label: 'Trophy Cabinets', href: '/cabinets' },
];

export default function HeritageNav({
  leagueId,
  active,
}: {
  leagueId: string;
  active: HeritageTab;
}) {
  return (
    <Tabs
      ariaLabel="Heritage sections"
      value={active}
      items={TABS.map((t) => ({
        value: t.label,
        label: t.label,
        href: `/league/${leagueId}/heritage${t.href}`,
      }))}
    />
  );
}
