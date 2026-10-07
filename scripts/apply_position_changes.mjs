import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const getEnv = (k) => {
  const m = envFile.match(new RegExp('^' + k + '=(.+)$', 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  const changelogPath = path.join(__dirname, '..', 'changelog-positions.json');
  if (!fs.existsSync(changelogPath)) {
    console.error('No changelog found at', changelogPath);
    process.exit(1);
  }

  const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
  const changes = changelog.changes || [];
  console.log(`Applying ${changes.length} position updates to public.players...`);

  const chunkSize = 50;
  let updated = 0;

  for (let i = 0; i < changes.length; i += chunkSize) {
    const chunk = changes.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((c) =>
        supabase
          .from('players')
          .update({
            primary_position: c.newPrimary,
            secondary_positions: c.newSecondaries,
          })
          .eq('id', c.playerId),
      ),
    );
    updated += chunk.length;
    process.stdout.write(`\rUpdated ${updated}/${changes.length} players...`);
  }

  console.log('\n✅ All player position updates applied successfully.');

  // Upsert sofifa_position_reference cache
  const refPath = path.join(__dirname, '..', 'sofifa-reference-rows.json');
  if (fs.existsSync(refPath)) {
    const refRows = JSON.parse(fs.readFileSync(refPath, 'utf8'));
    console.log(`\nUpserting ${refRows.length} rows to sofifa_position_reference...`);
    const refChunkSize = 200;
    let refUpdated = 0;
    for (let i = 0; i < refRows.length; i += refChunkSize) {
      const chunk = refRows.slice(i, i + refChunkSize);
      const { error: refErr } = await supabase.from('sofifa_position_reference').upsert(chunk, { onConflict: 'sofifa_id' });
      if (refErr) {
        console.error('\nError upserting sofifa reference chunk:', refErr.message);
      }
      refUpdated += chunk.length;
      process.stdout.write(`\rUpserted ${refUpdated}/${refRows.length} reference rows...`);
    }
    console.log('\n✅ SoFIFA reference cache updated successfully.');
  }
}

main().catch(console.error);
