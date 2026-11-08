'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  chapterForPath,
  isPostDraft,
  stepsForFormat,
  type Chapter,
  type LeagueFormat,
  type WalkthroughStep,
} from '@/lib/walkthroughs/chapters';
import { markSeen, shouldAutoStart, turnOffAutoStart } from '@/lib/walkthroughs/seen';
import Walkthrough, { findTarget } from './Walkthrough';

interface Props {
  leagueId: string;
  status: string;
  isDynasty: boolean;
}

/** How long a page gets to render its anchors before the chapter gives up for this visit. */
const WAIT_MS = 6000;
const POLL_MS = 200;

/** Steps whose part of the page exists right now: phones and empty states hide some. */
function availableSteps(steps: WalkthroughStep[]) {
  return steps.filter((s) => !s.at || findTarget(s.at));
}

function blockedByAnotherLayer() {
  return !!document.querySelector('[aria-modal="true"], [data-route-skeleton]');
}

/**
 * Starts a page's chapter the first time a manager opens that page after the
 * draft, and whenever Help sends them to it with ?tour=. Everything here reads
 * the DOM and browser storage; a walkthrough makes no requests.
 */
export default function WalkthroughHost({ leagueId, status, isDynasty }: Props) {
  const pathname = usePathname();
  const tour = useSearchParams().get('tour');
  const [active, setActive] = useState<{ chapter: Chapter; steps: WalkthroughStep[]; pathname: string } | null>(null);
  const format: LeagueFormat = isDynasty ? 'dynasty' : 'redraft';

  useEffect(() => {
    const chapter = chapterForPath(pathname, leagueId, format);
    if (!chapter) return;
    const forced = tour === chapter.id;
    if (!forced && (!isPostDraft(status) || !shouldAutoStart(chapter))) return;

    const steps = stepsForFormat(chapter.steps, format);
    const started = Date.now();
    let timer = 0;
    const check = () => {
      const ready = !blockedByAnotherLayer() && (forced || !chapter.requires || findTarget(chapter.requires));
      const available = ready ? availableSteps(steps) : [];
      const spotlit = available.some((s) => s.at);
      if (ready && available.length > 0 && spotlit) {
        if (forced) window.history.replaceState(null, '', pathname);
        setActive({ chapter, steps: available, pathname });
        return;
      }
      if (Date.now() - started < WAIT_MS) timer = window.setTimeout(check, POLL_MS);
    };
    timer = window.setTimeout(check, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, tour, leagueId, status, format]);

  // A walkthrough belongs to the page it started on.
  if (!active || active.pathname !== pathname) return null;

  return (
    <Walkthrough
      steps={active.steps}
      onExit={() => {
        markSeen(active.chapter);
        setActive(null);
      }}
      onSkipAll={() => {
        turnOffAutoStart();
        markSeen(active.chapter);
        setActive(null);
      }}
    />
  );
}
