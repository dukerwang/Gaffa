import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import stringSimilarity from 'string-similarity';
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

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function parseMarketValue(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/,/g, '').replace(/\s/g, '');
  if (!s || s === '-' || s === 'N/A') return null;
  const clean = s.replace(/^[€$£]/, '');
  const lower = clean.toLowerCase();
  if (lower.endsWith('bn')) return parseFloat(lower) * 1000;
  if (lower.endsWith('m')) return parseFloat(lower);
  if (lower.endsWith('k') || lower.endsWith('th.')) return parseFloat(lower) / 1000;
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// 20 Active Premier League clubs in 2026/27
const CLUB_SQUADS = [
  { name: 'Manchester City', url: 'https://www.transfermarkt.com/manchester-city/kader/verein/281/saison_id/2026' },
  { name: 'Arsenal FC', url: 'https://www.transfermarkt.com/fc-arsenal/kader/verein/11/saison_id/2026' },
  { name: 'Chelsea FC', url: 'https://www.transfermarkt.com/fc-chelsea/kader/verein/631/saison_id/2026' },
  { name: 'Liverpool FC', url: 'https://www.transfermarkt.com/fc-liverpool/kader/verein/31/saison_id/2026' },
  { name: 'Tottenham Hotspur', url: 'https://www.transfermarkt.com/tottenham-hotspur/kader/verein/148/saison_id/2026' },
  { name: 'Manchester United', url: 'https://www.transfermarkt.com/manchester-united/kader/verein/985/saison_id/2026' },
  { name: 'Brighton & Hove Albion', url: 'https://www.transfermarkt.com/brighton-amp-hove-albion/kader/verein/1237/saison_id/2026' },
  { name: 'Newcastle United', url: 'https://www.transfermarkt.com/newcastle-united/kader/verein/762/saison_id/2026' },
  { name: 'Crystal Palace', url: 'https://www.transfermarkt.com/crystal-palace/kader/verein/873/saison_id/2026' },
  { name: 'AFC Bournemouth', url: 'https://www.transfermarkt.com/afc-bournemouth/kader/verein/989/saison_id/2026' },
  { name: 'Brentford FC', url: 'https://www.transfermarkt.com/brentford-fc/kader/verein/1148/saison_id/2026' },
  { name: 'Aston Villa', url: 'https://www.transfermarkt.com/aston-villa/kader/verein/405/saison_id/2026' },
  { name: 'Nottingham Forest', url: 'https://www.transfermarkt.com/nottingham-forest/kader/verein/703/saison_id/2026' },
  { name: 'Everton FC', url: 'https://www.transfermarkt.com/everton-fc/kader/verein/29/saison_id/2026' },
  { name: 'Leeds United', url: 'https://www.transfermarkt.com/leeds-united/kader/verein/399/saison_id/2026' },
  { name: 'Sunderland AFC', url: 'https://www.transfermarkt.com/sunderland-afc/kader/verein/289/saison_id/2026' },
  { name: 'Fulham FC', url: 'https://www.transfermarkt.com/fulham-fc/kader/verein/931/saison_id/2026' },
  { name: 'Ipswich Town', url: 'https://www.transfermarkt.com/ipswich-town/kader/verein/687/saison_id/2026' },
  { name: 'Coventry City', url: 'https://www.transfermarkt.com/coventry-city/kader/verein/990/saison_id/2026' },
  { name: 'Hull City', url: 'https://www.transfermarkt.com/hull-city/kader/verein/3008/saison_id/2026' },
];

function normalizeMatchName(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function wordsMatch(tmName, dbName) {
  const normTM = normalizeMatchName(tmName);
  const normDB = normalizeMatchName(dbName);
  const tmParts = normTM.split(/\s+/).filter(Boolean);
  if (tmParts.length === 0) return false;
  return tmParts.every((part) => normDB.includes(part));
}

async function scrapeSquads() {
  console.log(`\n========================================`);
  console.log(` Scraping 20 Premier League Squads on Transfermarkt`);
  console.log(`========================================`);

  const tmPlayers = [];

  for (let i = 0; i < CLUB_SQUADS.length; i++) {
    const club = CLUB_SQUADS[i];
    process.stdout.write(`[${i + 1}/${CLUB_SQUADS.length}] ${club.name}... `);

    try {
      await delay(600);
      const res = await fetch(club.url, { headers: HEADERS });
      if (!res.ok) {
        console.log(`HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      let count = 0;

      $('table.items tbody tr.odd, table.items tbody tr.even').each((_, el) => {
        const nameEl = $(el).find('td.hauptlink a').first();
        const playerName = nameEl.text().trim();
        const mvRaw = $(el).find('td.rechts.hauptlink').text().trim();
        const parsed = parseMarketValue(mvRaw);

        if (playerName && parsed != null) {
          tmPlayers.push({
            playerName,
            marketValueRaw: mvRaw,
            marketValue: parsed,
            clubName: club.name,
          });
          count++;
        }
      });

      console.log(`✓ ${count} players`);
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }

  console.log(`Total Transfermarkt squad players collected: ${tmPlayers.length}`);
  return tmPlayers;
}

async function main() {
  const outPath = path.join(__dirname, 'players.json');
  let tmPlayers = [];

  if (process.argv.includes('--cached') && fs.existsSync(outPath)) {
    console.log(`Reading cached Transfermarkt squad data from ${outPath}...`);
    const cached = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    tmPlayers = cached.map((p) => ({
      playerName: p.player_name,
      marketValueRaw: p.market_value_raw,
      marketValue: p.market_value,
      clubName: p.club_name,
    }));
  } else {
    tmPlayers = await scrapeSquads();
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        tmPlayers.map((p) => ({
          player_name: p.playerName,
          market_value_raw: p.marketValueRaw,
          market_value: p.marketValue,
          club_name: p.clubName,
        })),
        null,
        2,
      ),
    );
  }

  // Fetch DB players & roster status
  console.log('\nFetching players from Supabase...');
  const { data: dbPlayers, error } = await supabase
    .from('players')
    .select('id, name, web_name, pl_team, market_value, market_value_updated_at, is_active');

  if (error || !dbPlayers) {
    console.error('Failed to fetch DB players:', error);
    process.exit(1);
  }

  const { data: rosterEntries } = await supabase
    .from('roster_entries')
    .select('player_id, team_id');
  const rosteredSet = new Set((rosterEntries || []).map((e) => e.player_id));

  const dbNames = dbPlayers.map((p) => p.name);
  const matchedUpdates = [];
  const unmatchedTM = [];

  function normalizeClub(c) {
    if (!c) return '';
    const s = c.toLowerCase().replace(/ fc| afc| & hove albion| hotspur/g, '').trim();
    if (s.includes('manchester city') || s === 'man city') return 'man city';
    if (s.includes('manchester united') || s === 'man utd') return 'man utd';
    if (s.includes('nottingham') || s.includes("nott'm")) return 'nottm forest';
    if (s.includes('tottenham') || s === 'spurs') return 'spurs';
    if (s.includes('newcastle')) return 'newcastle';
    if (s.includes('brighton')) return 'brighton';
    if (s.includes('west ham')) return 'west ham';
    if (s.includes('bournemouth')) return 'bournemouth';
    if (s.includes('aston villa')) return 'aston villa';
    if (s.includes('crystal palace')) return 'crystal palace';
    if (s.includes('coventry')) return 'coventry';
    if (s.includes('hull')) return 'hull';
    if (s.includes('leeds')) return 'leeds';
    if (s.includes('sunderland')) return 'sunderland';
    if (s.includes('ipswich')) return 'ipswich';
    if (s.includes('chelsea')) return 'chelsea';
    if (s.includes('arsenal')) return 'arsenal';
    if (s.includes('liverpool')) return 'liverpool';
    if (s.includes('everton')) return 'everton';
    if (s.includes('fulham')) return 'fulham';
    if (s.includes('brentford')) return 'brentford';
    return s;
  }

  for (const tmP of tmPlayers) {
    const tmNormName = normalizeMatchName(tmP.playerName);
    const tmNormClub = normalizeClub(tmP.clubName);

    // 1. Exact match on same club (full name or web_name), preferring active
    let sameClubMatches = dbPlayers.filter(
      (p) =>
        (normalizeMatchName(p.name) === tmNormName || (p.web_name && normalizeMatchName(p.web_name) === tmNormName)) &&
        normalizeClub(p.pl_team) === tmNormClub,
    );
    sameClubMatches.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0));
    let bestDbPlayer = sameClubMatches[0] || null;

    // 2. Exact match on any club, preferring active
    if (!bestDbPlayer) {
      let anyClubMatches = dbPlayers.filter(
        (p) => normalizeMatchName(p.name) === tmNormName || (p.web_name && normalizeMatchName(p.web_name) === tmNormName),
      );
      anyClubMatches.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0));
      bestDbPlayer = anyClubMatches[0] || null;
    }

    // 3. Same club subset / fuzzy match
    if (!bestDbPlayer) {
      const sameClubPlayers = dbPlayers.filter((p) => normalizeClub(p.pl_team) === tmNormClub);
      if (sameClubPlayers.length > 0) {
        const clubNames = sameClubPlayers.map((p) => p.name);
        const isShortTM = tmP.playerName.split(' ').length === 1 && tmP.playerName.length <= 5;
        const subset = !isShortTM ? clubNames.find((cn) => wordsMatch(tmP.playerName, cn)) : null;

        if (subset) {
          bestDbPlayer = sameClubPlayers.find((p) => p.name === subset);
        } else {
          const { bestMatch } = stringSimilarity.findBestMatch(tmP.playerName, clubNames);
          if (bestMatch.rating >= 0.70) {
            bestDbPlayer = sameClubPlayers.find((p) => p.name === bestMatch.target);
          }
        }
      }
    }

    // 4. Global subset / fuzzy match (higher threshold to avoid cross-club false positives)
    if (!bestDbPlayer) {
      const isShortTM = tmP.playerName.split(' ').length === 1 && tmP.playerName.length <= 5;
      const subset = !isShortTM ? dbNames.find((dbName) => wordsMatch(tmP.playerName, dbName)) : null;
      if (subset) {
        const candidate = dbPlayers.find((p) => p.name === subset);
        // Only accept if same club or player is inactive/transferred
        if (candidate && (!candidate.pl_team || !candidate.is_active || normalizeClub(candidate.pl_team) === tmNormClub)) {
          bestDbPlayer = candidate;
        }
      } else {
        const { bestMatch } = stringSimilarity.findBestMatch(tmP.playerName, dbNames);
        if (bestMatch.rating >= 0.85) {
          const candidate = dbPlayers.find((p) => p.name === bestMatch.target);
          if (candidate && (!candidate.pl_team || !candidate.is_active || normalizeClub(candidate.pl_team) === tmNormClub)) {
            bestDbPlayer = candidate;
          }
        }
      }
    }

    if (bestDbPlayer) {
      const oldVal = bestDbPlayer.market_value != null ? Number(bestDbPlayer.market_value) : null;
      const newVal = tmP.marketValue;
      const diff = oldVal != null ? newVal - oldVal : newVal;
      const pctChange = oldVal != null && oldVal > 0 ? (diff / oldVal) * 100 : null;
      const isRostered = rosteredSet.has(bestDbPlayer.id);

      matchedUpdates.push({
        playerId: bestDbPlayer.id,
        playerName: bestDbPlayer.name,
        webName: bestDbPlayer.web_name,
        club: bestDbPlayer.pl_team,
        tmClub: tmP.clubName,
        tmName: tmP.playerName,
        oldValue: oldVal,
        newValue: newVal,
        diff: Number(diff.toFixed(2)),
        pctChange: pctChange != null ? Number(pctChange.toFixed(1)) : null,
        isRostered,
        isActive: bestDbPlayer.is_active,
      });
    } else {
      unmatchedTM.push(tmP);
    }
  }

  // Deduplicate matches by playerId (keep highest score or latest)
  const uniqueUpdates = Array.from(
    new Map(matchedUpdates.map((u) => [u.playerId, u])).values(),
  );

  const changed = uniqueUpdates.filter((u) => u.oldValue !== u.newValue);
  const increased = changed.filter((u) => u.diff > 0);
  const decreased = changed.filter((u) => u.diff < 0);
  const firstTime = changed.filter((u) => u.oldValue == null);

  console.log(`\n========================================`);
  console.log(` TRANSFERMARKT COMPARISON SUMMARY`);
  console.log(`========================================`);
  console.log(`Total TM squad rows scraped: ${tmPlayers.length}`);
  console.log(`Total DB players matched: ${uniqueUpdates.length}`);
  console.log(`Total Players with Value Changes: ${changed.length}`);
  console.log(`  - Value Increased: ${increased.length}`);
  console.log(`  - Value Decreased: ${decreased.length}`);
  console.log(`  - First-time Value: ${firstTime.length}`);
  console.log(`  - Rostered Players Affected: ${changed.filter((c) => c.isRostered).length}`);

  // Sort changes by absolute change descending
  changed.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const tmChangelog = {
    generatedAt: new Date().toISOString(),
    totalMatched: uniqueUpdates.length,
    totalChanged: changed.length,
    increasedCount: increased.length,
    decreasedCount: decreased.length,
    firstTimeCount: firstTime.length,
    rosteredAffectedCount: changed.filter((c) => c.isRostered).length,
    topGainers: increased.sort((a, b) => b.diff - a.diff).slice(0, 15),
    topFallers: decreased.sort((a, b) => a.diff - b.diff).slice(0, 15),
    changes: changed,
  };

  const changelogPath = path.join(__dirname, '..', 'changelog-transfermarkt.json');
  fs.writeFileSync(changelogPath, JSON.stringify(tmChangelog, null, 2));
  console.log(`Saved Transfermarkt changelog to ${changelogPath}`);
}

main().catch(console.error);
