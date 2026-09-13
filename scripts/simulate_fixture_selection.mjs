import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local
const envPath = path.resolve('.env.local');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq > 0) {
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = val;
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const CLUB_TIERS = {
  'man-city': 10.0,
  'arsenal': 9.5,
  'liverpool': 9.5,
  'chelsea': 8.5,
  'man-utd': 8.5,
  'spurs': 8.0,
  'newcastle': 7.5,
  'aston-villa': 7.5,
  'brighton': 6.5,
  'west-ham': 6.0,
  'everton': 6.0,
  'crystal-palace': 5.5,
  'bournemouth': 5.0,
  'wolves': 5.0,
  'brentford': 5.0,
  'fulham': 5.0,
  'nottingham-forest': 5.0,
  'leeds': 4.5,
  'sunderland': 4.0,
  'ipswich-town': 3.5,
  'coventry-city': 3.5,
  'hull-city': 3.5,
};

const RIVALRIES = [
  [['arsenal', 'spurs'], 6.0],
  [['man-utd', 'man-city'], 6.0],
  [['liverpool', 'man-utd'], 6.0],
  [['liverpool', 'everton'], 5.0],
  [['arsenal', 'chelsea'], 4.5],
  [['chelsea', 'spurs'], 4.5],
  [['newcastle', 'sunderland'], 5.5],
  [['leeds', 'man-utd'], 4.5],
  [['chelsea', 'fulham'], 3.0],
  [['aston-villa', 'wolves'], 3.0],
];

function getRivalryBonus(c1, c2) {
  for (const [pair, bonus] of RIVALRIES) {
    if ((pair[0] === c1 && pair[1] === c2) || (pair[0] === c2 && pair[1] === c1)) {
      return bonus;
    }
  }
  return 0;
}

async function run() {
  const { data: fixtures, error } = await supabase
    .from('pl_fixtures')
    .select('*')
    .eq('season', '2026-27')
    .order('gameweek', { ascending: true })
    .order('kickoff_time', { ascending: true });

  if (error) {
    console.error('Error fetching fixtures:', error);
    return;
  }

  // Group by gameweek
  const byGw = new Map();
  for (const f of fixtures) {
    if (!byGw.has(f.gameweek)) byGw.set(f.gameweek, []);
    byGw.get(f.gameweek).push(f);
  }

  const appearances = new Map();
  const clubCounts = {};

  console.log('--- SIMULATION: 38 GAMEWEEKS FEATURED MATCH ---');
  for (let gw = 1; gw <= 38; gw++) {
    const list = byGw.get(gw) || [];
    let bestFixture = null;
    let bestScore = -Infinity;

    for (const f of list) {
      const hScore = CLUB_TIERS[f.home_club] || 4.0;
      const aScore = CLUB_TIERS[f.away_club] || 4.0;
      const rivalry = getRivalryBonus(f.home_club, f.away_club);

      // Recency penalty:
      // If club appeared in gw-1, -7 pts
      // If club appeared in gw-2, -3.5 pts
      // Cumulative appearance penalty: -1.0 pt per previous appearance this season
      let recencyPen = 0;
      for (const c of [f.home_club, f.away_club]) {
        const lastSeen = appearances.get(c) || [];
        if (lastSeen.includes(gw - 1)) recencyPen += 7.0;
        if (lastSeen.includes(gw - 2)) recencyPen += 3.5;
        recencyPen += (clubCounts[c] || 0) * 0.8;
      }

      const rawScore = (hScore + aScore) + rivalry - recencyPen;

      if (rawScore > bestScore) {
        bestScore = rawScore;
        bestFixture = f;
      }
    }

    if (bestFixture) {
      appearances.set(bestFixture.home_club, [...(appearances.get(bestFixture.home_club) || []), gw]);
      appearances.set(bestFixture.away_club, [...(appearances.get(bestFixture.away_club) || []), gw]);
      clubCounts[bestFixture.home_club] = (clubCounts[bestFixture.home_club] || 0) + 1;
      clubCounts[bestFixture.away_club] = (clubCounts[bestFixture.away_club] || 0) + 1;

      console.log(`GW${String(gw).padStart(2, ' ')}: ${bestFixture.home_club} vs ${bestFixture.away_club} (Score: ${bestScore.toFixed(1)})`);
    }
  }

  console.log('\n--- CLUB SELECTION FREQUENCY (Total 38 matches = 76 team slots) ---');
  const sorted = Object.entries(clubCounts).sort((a, b) => b[1] - a[1]);
  for (const [club, count] of sorted) {
    console.log(`${club.padEnd(20)}: ${count}`);
  }
}

run();
