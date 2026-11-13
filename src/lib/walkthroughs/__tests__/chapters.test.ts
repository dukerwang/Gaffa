import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUCTION_TIMING_STEPS, CHAPTERS, FIGURES, FIRST_LOOK, WELCOME, chapterForPath, isPostDraft, stepsForFormat } from '../chapters';

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

  it('quotes the figures the rules actually use', () => {
    const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
    const num = (f: string, re: RegExp) => Number(re.exec(read(f))?.[1]);
    expect(num('lib/offseason/seasonKickoff.ts', /AUCTION_THRESHOLD = ([\d.]+)/)).toBe(FIGURES.arrivalAuctionMin);
    expect(num('lib/auction/leagueAuctionSettings.ts', /DEFAULT_BID_FLOOR = ([\d.]+)/) * 100).toBeCloseTo(FIGURES.bidFloorPct);
    expect(num('lib/transfers/compensation.ts', /COMPENSATION_RATE = ([\d.]+)/) * 100).toBeCloseTo(FIGURES.compensationPct);
    expect(num('lib/roster/executeDrop.ts', /marketValue \* ([\d.]+)/) * 100).toBeCloseTo(FIGURES.severancePct);
    expect(num('lib/roster/executeDrop.ts', /Math\.max\((\d+), Math\.floor\(marketValue/)).toBe(FIGURES.severanceMin);
    expect(num('lib/economy/meritPayments.ts', /MERIT_PERIOD_LENGTH = (\d+)/)).toBe(FIGURES.meritPeriod);
    const size = /clamp\(Math\.round\(maxTeams \?\? \d+\), (\d+), (\d+)\)/.exec(read('app/api/leagues/create/route.ts'));
    expect([Number(size?.[1]), Number(size?.[2])]).toEqual([FIGURES.leagueMin, FIGURES.leagueMax]);
  });

  it('gives every First Look card a picture and no page anchor', () => {
    expect(FIRST_LOOK.every((s) => s.diagram && !s.at)).toBe(true);
  });

  it('keeps Welcome independent of any page', () => {
    expect(WELCOME.steps.every((s) => !s.at)).toBe(true);
    expect(CHAPTERS.some((c) => c.id === WELCOME.id)).toBe(false);
  });

  it('names each step instead of narrating it', () => {
    const narrated = /^(where|when|who|how|what|why|if|your|find|make|open)\b/i;
    const titles = [WELCOME, ...CHAPTERS, { steps: FIRST_LOOK }].flatMap((c) => c.steps.map((s) => s.title));
    expect(titles.filter((t) => narrated.test(t))).toEqual([]);
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
    expect(chapterForPath('/league/x/transfers/listings', 'x', 'dynasty')).toBeNull();
    expect(chapterForPath('/league/y', 'x', 'dynasty')).toBeNull();
  });

  it('waits for the draft', () => {
    expect(['setup', 'pre_draft', 'drafting'].some(isPostDraft)).toBe(false);
    expect(['active', 'offseason'].every(isPostDraft)).toBe(true);
  });
});
