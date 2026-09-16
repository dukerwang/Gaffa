/**
 * Dumps a real League Home view model to JSON so a design prototype can be
 * built on live data rather than placeholders. Throwaway.
 *
 *   node node_modules/.bin/tsx scratch/dump_home_model.ts <leagueId> <userId>
 */
import { readFileSync, writeFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const [, , leagueId, userId, outPath] = process.argv;

const { createAdminClient } = await import('../src/lib/supabase/admin');
const { buildHomeModel } = await import('../src/lib/home/buildHomeModel');

const model = await buildHomeModel(createAdminClient(), leagueId, userId);
writeFileSync(outPath, JSON.stringify(model, null, 2));
console.log(`wrote ${outPath}`);
