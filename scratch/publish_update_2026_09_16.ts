/**
 * One-off: publish the mid-September update and send the announcement pop-up.
 *
 * Reads the post from docs/UPDATE-2026-09-16-futbolpedia-facilities-heritage.md
 * so the copy that ships is the copy that was reviewed.
 *
 *   tsx scratch/publish_update_2026_09_16.ts --dry-run       print the post, write nothing
 *   tsx scratch/publish_update_2026_09_16.ts --no-notify     publish the entry, send no pop-up
 *   tsx scratch/publish_update_2026_09_16.ts --notify-only   send the pop-up for the published entry
 *   tsx scratch/publish_update_2026_09_16.ts                 publish and notify everyone
 *
 * Each account gets one `kind: 'product'` notification. That row lights the bell
 * and opens UpdateAnnouncementModal once (title, summary, highlights, and a
 * "See what's new" button to /updates#<slug>). Re-running is safe: the row is
 * upserted by slug, and nobody gets a second notification.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notifications/createNotification';

function loadEnvLocal() {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const DOC = 'docs/UPDATE-2026-09-16-futbolpedia-facilities-heritage.md';

export const SLUG = 'ask-futbolpedia-club-facilities-heritage';
export const TITLE = 'Ask Futbolpedia, Club Facilities, and Heritage';
export const SUMMARY =
  'Ask Futbolpedia about your club in league chat, spend Club Balance on permanent squad upgrades, and look back on your league in Heritage.';
export const HIGHLIGHTS = [
  'Ask Futbolpedia about your club in league chat',
  'Club Facilities: buy extra Academy, IR, and loan slots',
  "A 60% bid floor, and a Scout's Fee whether you win or lose",
  'Held players: what happens when a player joins a full squad',
];

/** The post body: from the first section heading to the Part 2 divider. */
export function readBody(): string {
  const md = readFileSync(resolve(process.cwd(), DOC), 'utf8');
  const start = md.indexOf('## Ask Futbolpedia');
  const end = md.indexOf('# Part 2: Why This Order');
  if (start < 0 || end < 0) throw new Error(`could not locate the post body in ${DOC}`);
  return md.slice(start, end).replace(/\n---\n\s*$/, '').trim();
}

/** The header block in the doc must agree with the constants above. */
function assertHeaderMatchesDoc() {
  const md = readFileSync(resolve(process.cwd(), DOC), 'utf8');
  for (const [label, value] of [
    ['slug', SLUG],
    ['title', TITLE],
    ['summary', SUMMARY],
    ...HIGHLIGHTS.map((h) => ['highlight', h] as const),
  ] as const) {
    if (!md.includes(value)) throw new Error(`${label} is out of step with ${DOC}: ${value}`);
  }
}

async function main() {
  loadEnvLocal();
  assertHeaderMatchesDoc();
  const body = readBody();
  const dryRun = process.argv.includes('--dry-run');

  console.log(`[post] ${TITLE}`);
  console.log(`[body] ${body.split(/\s+/).length} words, ${body.length} chars`);
  if (dryRun) {
    console.log(`\n--- SUMMARY ---\n${SUMMARY}\n\n--- HIGHLIGHTS ---\n${HIGHLIGHTS.map((h, i) => `${i + 1}. ${h}`).join('\n')}`);
    console.log('\n--- BODY ---\n');
    console.log(body);
    return;
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const noNotify = process.argv.includes('--no-notify');
  const notifyOnly = process.argv.includes('--notify-only');

  if (notifyOnly) {
    const { data: existing, error: exErr } = await admin
      .from('product_updates')
      .select('slug, published_at')
      .eq('slug', SLUG)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error(`${SLUG} isn't published yet; run without --notify-only first`);
    console.log(`[update] ${existing.slug} already published at ${existing.published_at}`);
  } else {
    // Keep the original publish time on a re-run, so a copy fix doesn't move the
    // entry's date.
    const { data: prior } = await admin
      .from('product_updates')
      .select('published_at')
      .eq('slug', SLUG)
      .maybeSingle();
    const { data: row, error } = await admin
      .from('product_updates')
      .upsert(
        {
          slug: SLUG,
          title: TITLE,
          summary: SUMMARY,
          body,
          highlights: HIGHLIGHTS,
          is_major: true,
          published_at: prior?.published_at ?? new Date().toISOString(),
        },
        { onConflict: 'slug' },
      )
      .select('id, slug, published_at')
      .single();
    if (error) throw new Error(error.message);
    console.log(`[update] ${row.slug} published_at ${row.published_at}`);
  }

  if (noNotify) {
    console.log('[notifications] skipped (--no-notify)');
    return;
  }

  // One row per account, league_id NULL so it shows in every league's bell.
  const { data: users, error: uErr } = await admin.from('users').select('id');
  if (uErr) throw new Error(uErr.message);

  const { data: already } = await admin
    .from('notifications')
    .select('user_id')
    .eq('kind', 'product')
    .eq('url', `/updates#${SLUG}`);
  const alreadySent = new Set((already ?? []).map((r: { user_id: string }) => r.user_id));

  let sent = 0;
  let skipped = 0;
  for (const u of (users ?? []) as { id: string }[]) {
    if (alreadySent.has(u.id)) {
      skipped++;
      continue;
    }
    await createNotification(admin, {
      leagueId: null,
      userId: u.id,
      kind: 'product',
      title: TITLE,
      content: SUMMARY,
      url: `/updates#${SLUG}`,
    });
    sent++;
  }
  console.log(`[notifications] ${sent} sent, ${skipped} already had it`);
}

if (process.argv[1]?.endsWith('publish_update_2026_09_16.ts')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
