'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import topBarStyles from '@/components/layout/TopBar.module.css';
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

/** A slow page shouldn't lose its walkthrough, so the wait is generous. It only reads the DOM. */
const WAIT_MS = 60_000;
const POLL_MS = 250;

/** Another dialog on screen goes first. */
function blockedByAnotherLayer() {
  return [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]')].some((el) => el.getClientRects().length > 0);
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
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const format: LeagueFormat = isDynasty ? 'dynasty' : 'redraft';
  const pageChapter = isPostDraft(status) ? chapterForPath(pathname, leagueId, format) : null;

  // The top bar is rendered by the layout above this one.
  useEffect(() => {
    let tries = 0;
    let timer = 0;
    const find = () => {
      const el = document.getElementById('walkthrough-slot');
      if (el) setSlot(el);
      else if (tries++ < 40) timer = window.setTimeout(find, POLL_MS);
    };
    timer = window.setTimeout(find, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const chapter = chapterForPath(pathname, leagueId, format);
    if (!chapter) return;
    const forced = tour === chapter.id;
    if (!forced && (!isPostDraft(status) || !shouldAutoStart(chapter))) return;

    const steps = stepsForFormat(chapter.steps, format);
    const started = Date.now();
    let timer = 0;
    const check = () => {
      const ready =
        !blockedByAnotherLayer() &&
        (forced || !chapter.requires || findTarget(chapter.requires)) &&
        steps.some((s) => s.at && findTarget(s.at));
      if (ready) {
        if (forced) window.history.replaceState(null, '', pathname);
        setActive({ chapter, steps, pathname });
        return;
      }
      if (Date.now() - started < WAIT_MS) timer = window.setTimeout(check, POLL_MS);
    };
    timer = window.setTimeout(check, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, tour, leagueId, status, format]);

  const replay =
    pageChapter && slot
      ? createPortal(
          <button
            type="button"
            className={topBarStyles.iconBtn}
            aria-label="Page Walkthrough"
            title="Page Walkthrough"
            data-tour="nav-help"
            onClick={() => setActive({ chapter: pageChapter, steps: stepsForFormat(pageChapter.steps, format), pathname })}
          >
            <Icon name="help-circle" size={18} strokeWidth={1.75} />
          </button>,
          slot,
        )
      : null;

  // A walkthrough belongs to the page it started on.
  if (!active || active.pathname !== pathname) return replay;

  return (
    <>
      {replay}
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
    </>
  );
}
