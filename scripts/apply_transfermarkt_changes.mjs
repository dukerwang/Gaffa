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
  const changelogPath = path.join(__dirname, '..', 'changelog-transfermarkt.json');
  if (!fs.existsSync(changelogPath)) {
    console.error('No changelog found at', changelogPath);
    process.exit(1);
  }

  const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
  const changes = changelog.changes || [];
  console.log(`Applying ${changes.length} Transfermarkt market_value updates to public.players...`);

  for (const c of changes) {
    const { error } = await supabase
      .from('players')
      .update({
        market_value: c.newValue,
        market_value_updated_at: new Date().toISOString(),
      })
      .eq('id', c.playerId);

    if (error) {
      console.error(`Error updating ${c.playerName}:`, error.message);
    } else {
      console.log(`✓ ${c.playerName} (${c.club}): €${c.oldValue}m -> €${c.newValue}m`);
    }
  }

  console.log('✅ All Transfermarkt market_value updates applied.');
}

main().catch(console.error);
