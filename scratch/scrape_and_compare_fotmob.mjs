import { createClient } from '@supabase/supabase-js';
import stringSimilarity from 'string-similarity';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BUILD_ID = "3UlpvGQRYQ2eQWkEfLVww";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return await res.json();
}

function normalizeName(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function main() {
  console.log("1. Fetching Premier League schedule from FotMob...");
  const overview = await fetchJson(`https://www.fotmob.com/_next/data/${BUILD_ID}/leagues/47/overview/premier-league.json`);
  const allMatches = overview.pageProps.fixtures.allMatches;
  const finishedMatches = allMatches.filter(m => m.status?.finished);
  console.log(`Found ${finishedMatches.length} finished Premier League matches in 2026/27.`);

  // Load all players and player_stats from Gaffa database
  console.log("2. Loading Gaffa players and 2026-27 player_stats...");
  const { data: gaffaPlayers, error: pErr } = await supabase
    .from('players')
    .select('id, name, web_name, fpl_id, primary_position, pl_team, pl_team_id');
  if (pErr) throw pErr;

  const { data: gaffaStats, error: sErr } = await supabase
    .from('player_stats')
    .select('id, player_id, gameweek, match_rating, fantasy_points, stats')
    .eq('season', '2026-27')
    .gt('match_rating', 0);
  if (sErr) throw sErr;

  console.log(`Loaded ${gaffaPlayers.length} players and ${gaffaStats.length} positive match-rating rows from Gaffa.`);

  // Index Gaffa stats by playerId + gameweek
  const playerById = new Map(gaffaPlayers.map(p => [p.id, p]));
  const statsByPlayerGw = new Map();
  for (const s of gaffaStats) {
    const key = `${s.player_id}_${s.gameweek}`;
    statsByPlayerGw.set(key, s);
  }

  // Pre-build name index for Gaffa players
  const gaffaNameMap = new Map();
  for (const p of gaffaPlayers) {
    const normFull = normalizeName(p.name);
    const normWeb = normalizeName(p.web_name);
    if (!gaffaNameMap.has(normFull)) gaffaNameMap.set(normFull, p);
    if (!gaffaNameMap.has(normWeb)) gaffaNameMap.set(normWeb, p);
  }

  // Scrape match details
  console.log(`3. Scraping ${finishedMatches.length} matches from FotMob...`);
  const fotmobPlayerMatches = [];
  let fetchedCount = 0;

  for (const match of finishedMatches) {
    const gw = parseInt(match.round || match.roundName, 10);
    const slug = match.pageUrl.split('#')[0].replace(/^\/matches\//, '');
    const matchUrl = `https://www.fotmob.com/_next/data/${BUILD_ID}/matches/${slug}.json`;

    try {
      const matchData = await fetchJson(matchUrl);
      const playerStats = matchData.pageProps.content?.playerStats;
      if (!playerStats) continue;

      for (const [fotmobId, pData] of Object.entries(playerStats)) {
        if (!pData.stats || pData.stats.length === 0) continue;

        let rating = null;
        let minutes = 0;
        let goals = 0;
        let assists = 0;
        let xg = 0;
        let xa = 0;
        let shots = 0;
        let shotsOnTarget = 0;
        let chancesCreated = 0;
        let groundDuelsWon = 0;
        let groundDuelsTotal = 0;
        let aerialDuelsWon = 0;
        let aerialDuelsTotal = 0;
        let defensiveActions = 0;
        let recoveries = 0;
        let tackles = 0;
        let interceptions = 0;
        let clearances = 0;
        let topSpeed = null;
        let distanceCovered = null;

        // Traverse stats categories
        for (const cat of pData.stats) {
          const s = cat.stats;
          if (!s) continue;
          if (s["FotMob rating"]?.stat?.value) rating = parseFloat(s["FotMob rating"].stat.value);
          if (s["Minutes played"]?.stat?.value) minutes = parseInt(s["Minutes played"].stat.value, 10);
          if (s["Goals"]?.stat?.value) goals = parseInt(s["Goals"].stat.value, 10);
          if (s["Assists"]?.stat?.value) assists = parseInt(s["Assists"].stat.value, 10);
          if (s["Expected goals (xG)"]?.stat?.value) xg = parseFloat(s["Expected goals (xG)"].stat.value);
          if (s["Expected assists (xA)"]?.stat?.value) xa = parseFloat(s["Expected assists (xA)"].stat.value);
          if (s["Total shots"]?.stat?.value) shots = parseInt(s["Total shots"].stat.value, 10);
          if (s["Shots on target"]?.stat?.value) shotsOnTarget = parseInt(s["Shots on target"].stat.value, 10);
          if (s["Chances created"]?.stat?.value) chancesCreated = parseInt(s["Chances created"].stat.value, 10);
          if (s["Defensive actions"]?.stat?.value) defensiveActions = parseInt(s["Defensive actions"].stat.value, 10);
          if (s["Recoveries"]?.stat?.value) recoveries = parseInt(s["Recoveries"].stat.value, 10);
          if (s["Tackles"]?.stat?.value) tackles = parseInt(s["Tackles"].stat.value, 10);
          if (s["Interceptions"]?.stat?.value) interceptions = parseInt(s["Interceptions"].stat.value, 10);
          if (s["Clearances"]?.stat?.value) clearances = parseInt(s["Clearances"].stat.value, 10);
          if (s["Top speed"]?.stat?.value) topSpeed = parseFloat(s["Top speed"].stat.value);
          if (s["Distance covered"]?.stat?.value) distanceCovered = parseInt(s["Distance covered"].stat.value, 10);

          if (s["Ground duels won"]?.stat) {
            groundDuelsWon = s["Ground duels won"].stat.value || 0;
            groundDuelsTotal = s["Ground duels won"].stat.total || 0;
          }
          if (s["Aerial duels won"]?.stat) {
            aerialDuelsWon = s["Aerial duels won"].stat.value || 0;
            aerialDuelsTotal = s["Aerial duels won"].stat.total || 0;
          }
        }

        // Only include if player actually participated and has a rating
        if (minutes > 0 && rating) {
          fotmobPlayerMatches.push({
            fotmobId,
            name: pData.name,
            teamId: pData.teamId,
            teamName: pData.teamName,
            matchId: match.id,
            gameweek: gw,
            rating,
            minutes,
            goals,
            assists,
            xg,
            xa,
            shots,
            shotsOnTarget,
            chancesCreated,
            groundDuelsWon,
            groundDuelsTotal,
            aerialDuelsWon,
            aerialDuelsTotal,
            defensiveActions,
            recoveries,
            tackles,
            interceptions,
            clearances,
            topSpeed,
            distanceCovered
          });
        }
      }
      fetchedCount++;
      if (fetchedCount % 10 === 0) {
        console.log(`  Processed ${fetchedCount}/${finishedMatches.length} matches (${fotmobPlayerMatches.length} player appearances)...`);
      }
    } catch (err) {
      console.warn(`  Failed match ${slug}: ${err.message}`);
    }
  }

  console.log(`\n4. Matching ${fotmobPlayerMatches.length} FotMob appearances with Gaffa ratings...`);

  const matchedPairs = [];
  const unmatched = [];

  for (const fpm of fotmobPlayerMatches) {
    const norm = normalizeName(fpm.name);
    let matchedGaffaPlayer = gaffaNameMap.get(norm);

    if (!matchedGaffaPlayer) {
      // Try fuzzy matching among Gaffa players
      let bestSim = 0;
      let bestMatch = null;
      for (const gp of gaffaPlayers) {
        const simFull = stringSimilarity.compareTwoStrings(norm, normalizeName(gp.name));
        const simWeb = stringSimilarity.compareTwoStrings(norm, normalizeName(gp.web_name));
        const sim = Math.max(simFull, simWeb);
        if (sim > bestSim && sim > 0.8) {
          bestSim = sim;
          bestMatch = gp;
        }
      }
      if (bestMatch) {
        matchedGaffaPlayer = bestMatch;
      }
    }

    if (!matchedGaffaPlayer) {
      unmatched.push(fpm);
      continue;
    }

    const gaffaStatKey = `${matchedGaffaPlayer.id}_${fpm.gameweek}`;
    const gaffaStat = statsByPlayerGw.get(gaffaStatKey);

    if (gaffaStat) {
      matchedPairs.push({
        name: matchedGaffaPlayer.name,
        webName: matchedGaffaPlayer.web_name,
        position: matchedGaffaPlayer.primary_position,
        gameweek: fpm.gameweek,
        fotmobRating: fpm.rating,
        gaffaRating: gaffaStat.match_rating,
        ratingDiff: parseFloat((gaffaStat.match_rating - fpm.rating).toFixed(2)),
        absDiff: parseFloat(Math.abs(gaffaStat.match_rating - fpm.rating).toFixed(2)),
        minutes: fpm.minutes,
        goals: fpm.goals,
        assists: fpm.assists,
        xg: fpm.xg,
        xa: fpm.xa,
        shotsOnTarget: fpm.shotsOnTarget,
        groundDuelsWon: fpm.groundDuelsWon,
        groundDuelsTotal: fpm.groundDuelsTotal,
        aerialDuelsWon: fpm.aerialDuelsWon,
        aerialDuelsTotal: fpm.aerialDuelsTotal,
        defensiveActions: fpm.defensiveActions,
        recoveries: fpm.recoveries,
        tackles: fpm.tackles,
        gaffaPts: gaffaStat.fantasy_points,
        fplMinutes: gaffaStat.stats?.minutes_played || 0
      });
    }
  }

  console.log(`Matched ${matchedPairs.length} player-match ratings across GW 1–5!`);

  // Compute statistics
  const n = matchedPairs.length;
  if (n === 0) {
    console.log("No matched pairs found.");
    return;
  }

  const gaffaRatings = matchedPairs.map(p => p.gaffaRating);
  const fotmobRatings = matchedPairs.map(p => p.fotmobRating);

  const meanGaffa = gaffaRatings.reduce((a, b) => a + b, 0) / n;
  const meanFotmob = fotmobRatings.reduce((a, b) => a + b, 0) / n;

  const mae = matchedPairs.map(p => p.absDiff).reduce((a, b) => a + b, 0) / n;
  const rmse = Math.sqrt(matchedPairs.map(p => Math.pow(p.gaffaRating - p.fotmobRating, 2)).reduce((a, b) => a + b, 0) / n);

  // Pearson correlation
  let num = 0;
  let den1 = 0;
  let den2 = 0;
  for (let i = 0; i < n; i++) {
    const diffG = gaffaRatings[i] - meanGaffa;
    const diffF = fotmobRatings[i] - meanFotmob;
    num += diffG * diffF;
    den1 += diffG * diffG;
    den2 += diffF * diffF;
  }
  const correlation = num / Math.sqrt(den1 * den2);

  console.log("\n=================== OVERALL METRICS ===================");
  console.log(`Sample size: ${n} player-match appearances`);
  console.log(`Gaffa Mean Rating:  ${meanGaffa.toFixed(2)}`);
  console.log(`FotMob Mean Rating: ${meanFotmob.toFixed(2)}`);
  console.log(`Mean Absolute Error (MAE): ${mae.toFixed(2)} rating points`);
  console.log(`Root Mean Squared Error (RMSE): ${rmse.toFixed(2)}`);
  console.log(`Pearson Correlation (r): ${correlation.toFixed(3)}`);

  // Position breakdown
  const byPosition = {};
  for (const pair of matchedPairs) {
    const pos = pair.position || 'Unknown';
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(pair);
  }

  console.log("\n================ POSITION BREAKDOWN ================");
  const posSummary = [];
  for (const [pos, pairs] of Object.entries(byPosition)) {
    const count = pairs.length;
    const gMean = pairs.reduce((acc, p) => acc + p.gaffaRating, 0) / count;
    const fMean = pairs.reduce((acc, p) => acc + p.fotmobRating, 0) / count;
    const posMae = pairs.reduce((acc, p) => acc + p.absDiff, 0) / count;

    let pNum = 0, pDen1 = 0, pDen2 = 0;
    for (const p of pairs) {
      const dg = p.gaffaRating - gMean;
      const df = p.fotmobRating - fMean;
      pNum += dg * df;
      pDen1 += dg * dg;
      pDen2 += df * df;
    }
    const posR = pDen1 && pDen2 ? pNum / Math.sqrt(pDen1 * pDen2) : 0;

    posSummary.push({ pos, count, gMean, fMean, posMae, posR });
    console.log(`${pos.padEnd(5)} (n=${String(count).padStart(3)}): Gaffa=${gMean.toFixed(2)} | FotMob=${fMean.toFixed(2)} | MAE=${posMae.toFixed(2)} | r=${posR.toFixed(3)}`);
  }

  // Top Outliers: FotMob Much Higher
  const fotmobMuchHigher = [...matchedPairs].sort((a, b) => (b.fotmobRating - b.gaffaRating) - (a.fotmobRating - a.gaffaRating)).slice(0, 10);

  // Top Outliers: Gaffa Much Higher
  const gaffaMuchHigher = [...matchedPairs].sort((a, b) => (b.gaffaRating - b.fotmobRating) - (a.gaffaRating - a.fotmobRating)).slice(0, 10);

  const report = {
    generatedAt: new Date().toISOString(),
    sampleSize: n,
    matchesScraped: finishedMatches.length,
    meanGaffa: parseFloat(meanGaffa.toFixed(2)),
    meanFotmob: parseFloat(meanFotmob.toFixed(2)),
    mae: parseFloat(mae.toFixed(2)),
    rmse: parseFloat(rmse.toFixed(2)),
    correlation: parseFloat(correlation.toFixed(3)),
    posSummary,
    fotmobMuchHigher,
    gaffaMuchHigher,
    matchedPairs
  };

  const outPath = path.resolve('scratch/fotmob_gaffa_comparison_data.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved comparison data to ${outPath}`);
}

main().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
