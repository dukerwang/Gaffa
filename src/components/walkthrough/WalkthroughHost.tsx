'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  CHAPTERS,
  WELCOME,
  chapterForPath,
  isPostDraft,
  stepsForFormat,
  type Chapter,
  type LeagueFormat,
} from '@/lib/walkthroughs/chapters';
import { markSeen, shouldAutoStart, turnOffAutoStart } from '@/lib/walkthroughs/seen';
import Walkthrough, { findTarget } from './Walkthrough';
import { WALKTHROUGH_EVENT } from './WalkthroughButton';

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
 * Starts the walkthroughs. Welcome runs first, the first time a manager opens
 * their league after the draft. Then each page's chapter runs the first time
 * they open that page. Help (?tour=) and the button beside a page's title
 * replay them. Everything here reads the DOM and browser storage; a
 * walkthrough makes no requests.
 */
export default function WalkthroughHost({ leagueId, status, isDynasty }: Props) {
  const pathname = usePathname();
  const tour = useSearchParams().get('tour');
  const [active, setActive] = useState<{ chapter: Chapter; pathname: string } | null>(null);
  // Bumped when Welcome finishes, so the page's own chapter can follow it.
  const [finished, setFinished] = useState(0);
  const format: LeagueFormat = isDynasty ? 'dynasty' : 'redraft';

  useEffect(() => {
    const pageChapter = chapterForPath(pathname, leagueId, format);
    const welcomeDue = tour === WELCOME.id || (isPostDraft(status) && shouldAutoStart(WELCOME));
    const chapter = welcomeDue ? WELCOME : pageChapter;
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
        (chapter === WELCOME || steps.some((s) => s.at && findTarget(s.at)));
      if (ready) {
        if (forced) window.history.replaceState(null, '', pathname);
        setActive({ chapter, pathname });
        return;
      }
      if (Date.now() - started < WAIT_MS) timer = window.setTimeout(check, POLL_MS);
    };
    timer = window.setTimeout(check, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, tour, leagueId, status, format, finished]);

  // The question mark beside a page's title.
  useEffect(() => {
    const onReplay = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const chapter = id === WELCOME.id ? WELCOME : CHAPTERS.find((c) => c.id === id);
      if (chapter) setActive({ chapter, pathname: window.location.pathname });
    };
    window.addEventListener(WALKTHROUGH_EVENT, onReplay);
    return () => window.removeEventListener(WALKTHROUGH_EVENT, onReplay);
  }, []);

  // A walkthrough belongs to the page it started on.
  if (!active || active.pathname !== pathname) return null;

  const done = () => {
    markSeen(active.chapter);
    setActive(null);
    if (active.chapter === WELCOME) setFinished((n) => n + 1);
  };

  return (
    <Walkthrough
      key={active.chapter.id}
      steps={stepsForFormat(active.chapter.steps, format)}
      onExit={done}
      onSkipAll={() => {
        turnOffAutoStart();
        done();
      }}
    />
  );
}
