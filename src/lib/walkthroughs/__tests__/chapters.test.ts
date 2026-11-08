import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUCTION_TIMING_STEPS, CHAPTERS, chapterForPath, isPostDraft, stepsForFormat } from '../chapters';

const SRC = path.resolve(__dirname, '../../..');
const LEAGUE_APP = path.join(SRC, 'app/(dashboard)/league/[leagueId]');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

const anchors = new Set(
  sourceFiles(SRC).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/data-tour=(?:"([\w-]+)"|\{[^}]*?'([\w-]+)'[^}]*\})/g)].map((m) => m[1] ?? m[2])),
);

/** A page may sit in a route group, e.g. players/(index)/page.tsx. */
function routeExists(route: string, dir = LEAGUE_APP): boolean {
  const [head, ...rest] = route.split('/').filter(Boolean);
  const children = readdirSync(dir).filter((n) => statSync(path.join(dir, n)).isDirectory());
  const groups = children.filter((n) => n.startsWith('('));
  if (head === undefined) return existsSync(path.join(dir, 'page.tsx')) || groups.some((g) => routeExists('', path.join(dir, g)));
  if (children.includes(head) && routeExists(rest.join('/'), path.join(dir, head))) return true;
  return groups.some((g) => routeExists(route, path.join(dir, g)));
}

describe('walkthrough chapters', () => {
  it('points every step at an anchor that still exists on a page', () => {
    const missing = CHAPTERS.flatMap((c) => c.steps.filter((s) => s.at && !anchors.has(s.at)).map((s) => `${c.id}: ${s.at}`));
    expect(missing).toEqual([]);
  });

  it('points every chapter at a page that still exists', () => {
    expect(CHAPTERS.filter((c) => !routeExists(c.route)).map((c) => c.id)).toEqual([]);
  });

  it('gives each chapter a unique id and route', () => {
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    expect(new Set(CHAPTERS.map((c) => c.route)).size).toBe(CHAPTERS.length);
  });

  it('requires only anchors a chapter also explains', () => {
    for (const c of CHAPTERS) if (c.requires) expect(c.steps.some((s) => s.at === c.requires)).toBe(true);
  });

  it('never shows a redraft league the rolling auction clock', () => {
    const titles = stepsForFormat(AUCTION_TIMING_STEPS, 'redraft').map((s) => s.title);
    expect(titles).toEqual(['Transfer Day']);
  });

  it('matches pages exactly and hides dynasty-only chapters from redraft leagues', () => {
    expect(chapterForPath('/league/x', 'x', 'dynasty')?.id).toBe('home');
    expect(chapterForPath('/league/x/transfers/auctions', 'x', 'dynasty')?.id).toBe('auctions');
    expect(chapterForPath('/league/x/matchups/abc', 'x', 'dynasty')).toBeNull();
    expect(chapterForPath('/league/x/transfers/listings', 'x', 'redraft')).toBeNull();
    expect(chapterForPath('/league/y', 'x', 'dynasty')).toBeNull();
  });

  it('waits for the draft', () => {
    expect(['setup', 'pre_draft', 'drafting'].some(isPostDraft)).toBe(false);
    expect(['active', 'offseason'].every(isPostDraft)).toBe(true);
  });
});
