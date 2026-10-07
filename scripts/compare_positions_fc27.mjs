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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// POS_MAP identical to src/app/api/sync/sofifa-players/route.ts
const POS_MAP = {
  GK: 'GK',
  SW: 'CB',
  RWB: 'RWB',
  RB: 'RB',
  RCB: 'CB',
  CB: 'CB',
  LCB: 'CB',
  LB: 'LB',
  LWB: 'LWB',
  RDM: 'DM',
  CDM: 'DM',
  LDM: 'DM',
  RM: 'RW',
  RCM: 'CM',
  CM: 'CM',
  LCM: 'CM',
  LM: 'LW',
  RAM: 'AM',
  CAM: 'AM',
  LAM: 'AM',
  RF: 'RW',
  CF: 'ST',
  LF: 'LW',
  RW: 'RW',
  RS: 'ST',
  ST: 'ST',
  LS: 'ST',
  LW: 'LW',
  DM: 'DM',
  AM: 'AM',
};

function normalizeName(name) {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const NAME_PARTICLES = new Set([
  'de', 'da', 'do', 'dos', 'das', 'van', 'von', 'del', 'della', 'di', 'la', 'le',
  'el', 'al', 'bin', 'ibn', 'den', 'der', 'ter', 'dos', 'santos', 'silva', 'junior',
]);

function significantTokens(str) {
  return new Set(
    normalizeName(str)
      .split(' ')
      .filter((t) => t.length >= 3 && !NAME_PARTICLES.has(t)),
  );
}

function normalizeTeam(t) {
  const n = normalizeName(t ?? '');
  if (!n) return '';
  if (n.includes('manchester city') || n === 'man city') return 'man city';
  if (n.includes('manchester united') || n === 'man utd') return 'man utd';
  if (n.includes('tottenham') || n === 'spurs') return 'spurs';
  if (n.includes('newcastle')) return 'newcastle';
  if (n.includes('wolverhampton') || n === 'wolves') return 'wolves';
  if (n.includes('nottingham') || n === 'nottm forest') return 'nottm forest';
  if (n.includes('brighton')) return 'brighton';
  if (n.includes('west ham')) return 'west ham';
  if (n.includes('bournemouth')) return 'bournemouth';
  if (n.includes('aston villa')) return 'aston villa';
  if (n.includes('leicester')) return 'leicester';
  if (n.includes('ipswich')) return 'ipswich';
  if (n.includes('chelsea')) return 'chelsea';
  if (n.includes('arsenal')) return 'arsenal';
  if (n.includes('liverpool')) return 'liverpool';
  if (n.includes('everton')) return 'everton';
  if (n.includes('fulham')) return 'fulham';
  if (n.includes('brentford')) return 'brentford';
  if (n.includes('crystal palace')) return 'crystal palace';
  if (n.includes('southampton')) return 'southampton';
  if (n.includes('leeds')) return 'leeds';
  if (n.includes('sunderland')) return 'sunderland';
  if (n.includes('coventry')) return 'coventry';
  if (n.includes('hull')) return 'hull';
  return n;
}

function firstLast(name) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

const MANUAL_OVERRIDES = {
  'Louis Jordan Beyer': 'Jordan Beyer',
  'Toluwalase Emmanuel Arokodare': 'Tolu Arokodare',
  'Alejandro Jiménez Sánchez': 'Álex Jiménez Sánchez',
  'Tóth Alex László': 'Alex Tóth',
  'Xavier Quentin Shay Simons': 'Xavi Simons',
  'Valentín Mariano José Castellanos Giménez': 'Valentín Castellanos',
  'Abdul-Nasir Oluwatosin Oluwadoyinsolami Adarabioyo': 'Tosin Adarabioyo',
  'Eli Junior Eric Anat Kroupi': 'Junior Kroupi',
  'Eli Junior Kroupi': 'Junior Kroupi',
  'Adilson Angel Abreu de Almeida Gomés': 'Angel Gomes',
  'James William McConnell': 'James McConnell',
  'Lewis William Orford': 'Lewis Orford',
  'Nicolás González Iglesias': 'Nico González',
  'Nicolas Gonzalez Iglesias': 'Nico González',
};

export const TACTICAL_HYBRID_PROFILES = {
  'Pedro Lomba Neto': ['RWB', 'LWB'],
  'Geovany Tcherno Quenda': ['RWB'],
};

// Hybrid position resolver faithfully matching route.ts
export function resolvePositions(rawPositions, roles = [], fullName = '', commonName = '') {
  if (!rawPositions || rawPositions.length === 0) {
    return { primary: null, secondaries: [] };
  }

  const sofifaPrimaryRaw = rawPositions[0];
  const allRaw = new Set(rawPositions);

  const hasLB = allRaw.has('LB') || allRaw.has('LWB');
  const hasLM = allRaw.has('LM');
  const hasLW = allRaw.has('LW') || allRaw.has('LF');

  const hasRB = allRaw.has('RB') || allRaw.has('RWB');
  const hasRM = allRaw.has('RM');
  const hasRW = allRaw.has('RW') || allRaw.has('RF');

  const hasBothMid = hasLM && hasRM;
  const hasOnlyOneFB = (hasLB && !hasRB) || (!hasLB && hasRB);

  const finalSet = new Set();
  let primary = POS_MAP[sofifaPrimaryRaw] || sofifaPrimaryRaw;

  const applySide = (side, hasFB, hasMid, hasWing) => {
    const fb = `${side}B`;
    const wb = `${side}WB`;
    const wing = `${side}W`;
    const midRaw = `${side}M`;
    const fbRaw = `${side}B`;
    const wbRaw = `${side}WB`;
    const wingRaw = `${side}W`;
    const hasExplicitFB = allRaw.has(fbRaw);
    const hasExplicitWB = allRaw.has(wbRaw);

    const pCat =
      sofifaPrimaryRaw === midRaw ? 'mid'
      : sofifaPrimaryRaw === wingRaw ? 'wing'
      : (sofifaPrimaryRaw === fbRaw || sofifaPrimaryRaw === wbRaw) ? 'fb'
      : 'other';

    if (hasBothMid && hasOnlyOneFB) {
      if (hasMid) {
        finalSet.add(wing);
        if (pCat === 'mid' || pCat === 'wing') primary = wing;
      }
      if (hasFB) {
        finalSet.add(wb);
        if (pCat === 'fb') primary = wb;
      }
      return;
    }

    if (!hasFB || !hasMid) {
      if (hasMid) {
        finalSet.add(wing);
        if (pCat === 'mid') primary = wing;
      }
      if (hasWing) {
        finalSet.add(wing);
        if (pCat === 'wing') primary = wing;
      }
      if (hasFB) {
        const hasWBRole = roles.some((r) => {
          const l = r.toLowerCase();
          return l.includes('wingback') || l.includes('wing-back');
        });
        const firstRoleLower = (roles[0] || '').toLowerCase();
        const isAttackingOrInverted =
          firstRoleLower.includes('attacking wingback') || firstRoleLower.includes('inverted wingback');

        if (hasWBRole) {
          finalSet.add(wb);
          finalSet.add(fb);
          if (pCat === 'fb') {
            primary = hasExplicitWB || isAttackingOrInverted ? wb : fb;
          }
        } else {
          if (hasExplicitWB) {
            finalSet.add(wb);
            if (pCat === 'fb' && sofifaPrimaryRaw === wbRaw) primary = wb;
          }
          if (hasExplicitFB) {
            finalSet.add(fb);
            if (pCat === 'fb' && sofifaPrimaryRaw === fbRaw) primary = fb;
          }
          if (!hasExplicitWB && !hasExplicitFB) {
            finalSet.add(fb);
            if (pCat === 'fb') primary = fb;
          }
        }
      }
      return;
    }

    if (hasFB && hasMid && hasWing) {
      if (pCat === 'mid' || pCat === 'wing') {
        primary = wing;
        finalSet.add(wing);
        finalSet.add(wb);
      } else if (pCat === 'fb') {
        primary = wb;
        finalSet.add(wb);
        finalSet.add(wing);
        if (hasExplicitFB) finalSet.add(fb);
      } else {
        finalSet.add(wing);
        finalSet.add(wb);
      }
      return;
    }

    if (hasFB && hasMid && !hasWing) {
      const hasWBRole = roles.some((r) => {
        const l = r.toLowerCase();
        return l.includes('wingback') || l.includes('wing-back');
      });
      const firstRoleLower = (roles[0] || '').toLowerCase();
      const isAttackingOrInverted =
        firstRoleLower.includes('attacking wingback') || firstRoleLower.includes('inverted wingback');

      if (isAttackingOrInverted) {
        if (pCat === 'fb' || pCat === 'mid') primary = wb;
        finalSet.add(wb);
        finalSet.add(fb);
      } else {
        if (pCat === 'fb' || pCat === 'mid') primary = hasExplicitWB && !hasExplicitFB ? wb : fb;
        finalSet.add(fb);
        finalSet.add(wb);
      }
      return;
    }
  };

  applySide('L', hasLB, hasLM, hasLW);
  applySide('R', hasRB, hasRM, hasRW);

  for (const raw of rawPositions) {
    const mapped = POS_MAP[raw];
    if (mapped && !['LB', 'RB', 'LW', 'RW', 'LM', 'RM', 'LF', 'RF'].includes(raw)) {
      finalSet.add(mapped);
    }
  }
  if (allRaw.has('LWB')) finalSet.add('LWB');
  if (allRaw.has('RWB')) finalSet.add('RWB');

  const hybridPositions = TACTICAL_HYBRID_PROFILES[fullName] || TACTICAL_HYBRID_PROFILES[commonName];
  if (hybridPositions) {
    for (const hp of hybridPositions) {
      finalSet.add(hp);
    }
  }

  if (primary && !finalSet.has(primary)) {
    finalSet.add(primary);
  }

  const secondaries = Array.from(finalSet).filter((p) => p !== primary);
  return { primary, secondaries };
}

async function main() {
  const scrapedPath = path.join(__dirname, '..', 'scraped-sofifa-fc27.json');
  if (!fs.existsSync(scrapedPath)) {
    console.error(`Cannot find ${scrapedPath}. Wait for scraper to finish.`);
    process.exit(1);
  }

  const scrapedPlayers = JSON.parse(fs.readFileSync(scrapedPath, 'utf8'));
  console.log(`Loaded ${scrapedPlayers.length} scraped players from FC 27 dataset.`);

  // 1. Fetch DB players & roster status
  console.log('Fetching players from Supabase...');
  const { data: dbPlayers, error } = await supabase
    .from('players')
    .select('id, name, web_name, pl_team, primary_position, secondary_positions, is_active, market_value');

  if (error || !dbPlayers) {
    console.error('Failed to fetch DB players:', error);
    process.exit(1);
  }
  console.log(`Loaded ${dbPlayers.length} players from public.players`);

  // Fetch roster ownership
  const { data: rosterEntries, error: rosterErr } = await supabase
    .from('roster_entries')
    .select('player_id, team_id, league_id, status');

  if (rosterErr) {
    console.error('Error fetching roster entries:', rosterErr);
  }

  const rosteredSet = new Set((rosterEntries || []).map((e) => e.player_id));
  console.log(`Found ${rosteredSet.size} distinct players currently on manager rosters`);

  // 2. Build Candidate Name Lookup Map
  const nameMap = new Map();
  function addToMap(key, player) {
    if (!key) return;
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key).push(player);
  }

  for (const p of dbPlayers) {
    const normFull = normalizeName(p.name);
    const normWeb = p.web_name ? normalizeName(p.web_name) : null;

    addToMap(normFull, p);
    if (normWeb) addToMap(normWeb, p);
    addToMap(firstLast(normFull), p);
    if (normWeb) addToMap(firstLast(normWeb), p);

    const fullParts = normFull.split(' ').filter(Boolean);
    if (fullParts.length === 2) {
      addToMap(`${fullParts[1]} ${fullParts[0]}`, p);
    }
    if (normWeb) {
      const webParts = normWeb.split(' ').filter(Boolean);
      if (webParts.length === 2) {
        addToMap(`${webParts[1]} ${webParts[0]}`, p);
      }
    }
  }

  // 3. Match & Compare
  const matchedDbIds = new Set();
  const changes = [];
  const unchanged = [];
  const referenceRows = [];

  for (const sp of scrapedPlayers) {
    const fullName = sp.fullName || sp.commonName || '';
    const common = sp.commonName || '';
    const { primary, secondaries } = resolvePositions(sp.positions, sp.roles || [], fullName, common);
    if (!primary) continue;
    const normFull = normalizeName(fullName);
    const normCommon = normalizeName(common);

    const candidates = Array.from(
      new Set([normFull, normCommon, firstLast(normFull), firstLast(normCommon)]),
    ).filter(Boolean);

    // Prepare reference cache row for sofifa_position_reference
    referenceRows.push({
      sofifa_id: sp.id,
      full_name: fullName,
      common_name: common || null,
      name_aliases: candidates,
      club_name: sp.teamName || null,
      sofifa_league_id: sp.sofifaLeagueId,
      primary_position: primary,
      secondary_positions: secondaries,
    });

    let dbMatch = null;
    if (MANUAL_OVERRIDES[fullName]) {
      dbMatch = nameMap.get(normalizeName(MANUAL_OVERRIDES[fullName]))?.[0] ?? null;
    }
    if (!dbMatch && common && MANUAL_OVERRIDES[common]) {
      dbMatch = nameMap.get(normalizeName(MANUAL_OVERRIDES[common]))?.[0] ?? null;
    }

    if (!dbMatch) {
      for (const c of candidates) {
        const matches = nameMap.get(c) ?? [];
        if (matches.length === 0) continue;

      for (const candidate of matches) {
        const dbTeamNorm = normalizeTeam(candidate.pl_team ?? '');
        const sfTeamNorm = normalizeTeam(sp.teamName ?? '');

        const teamMatches =
          !dbTeamNorm ||
          !sfTeamNorm ||
          dbTeamNorm === sfTeamNorm ||
          dbTeamNorm.includes(sfTeamNorm) ||
          sfTeamNorm.includes(dbTeamNorm);

        const pTokens = significantTokens(candidate.name);
        const sfTokens = significantTokens(`${fullName} ${common}`);
        let sharedTokens = 0;
        for (const t of pTokens) {
          if (sfTokens.has(t)) sharedTokens++;
        }

        // Strict club validation for active Premier League players:
        // A player active at Newcastle cannot match a player at Juventus or another foreign club.
        if (candidate.is_active && dbTeamNorm && sfTeamNorm && !teamMatches) {
          continue;
        }

        const exactNameMatches =
          normFull === normalizeName(candidate.name) ||
          (normCommon && normCommon === normalizeName(candidate.name));

        const positionMismatch =
          (candidate.primary_position === 'GK' && primary !== 'GK') ||
          (candidate.primary_position !== 'GK' && primary === 'GK');

        if ((teamMatches || exactNameMatches) && (sharedTokens > 0 || exactNameMatches) && !positionMismatch) {
          dbMatch = candidate;
          break;
        }
      }
      if (dbMatch) break;
    }
  }

  if (dbMatch) {
      matchedDbIds.add(dbMatch.id);

      const oldPrimary = dbMatch.primary_position || null;
      const oldSecondaries = (dbMatch.secondary_positions || []).slice().sort();
      const newSecondaries = secondaries.slice().sort();

      const primaryChanged = oldPrimary !== primary;
      const secondaryChanged =
        oldSecondaries.length !== newSecondaries.length ||
        oldSecondaries.some((pos, idx) => pos !== newSecondaries[idx]);

      const isRostered = rosteredSet.has(dbMatch.id);

      const changeRecord = {
        playerId: dbMatch.id,
        playerName: dbMatch.name,
        webName: dbMatch.web_name,
        club: dbMatch.pl_team,
        sofifaClub: sp.teamName,
        sofifaId: sp.id,
        isRostered,
        isActive: dbMatch.is_active,
        oldPrimary,
        newPrimary: primary,
        oldSecondaries: dbMatch.secondary_positions || [],
        newSecondaries: secondaries,
        primaryChanged,
        secondaryChanged,
        rawPositions: sp.positions,
      };

      if (primaryChanged || secondaryChanged) {
        changes.push(changeRecord);
      } else {
        unchanged.push(changeRecord);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(` POSITION COMPARISON SUMMARY`);
  console.log(`========================================`);
  console.log(`Total DB Players matched: ${matchedDbIds.size}`);
  console.log(`Total Players with Position Changes: ${changes.length}`);
  console.log(`  - Primary Position Changed: ${changes.filter((c) => c.primaryChanged).length}`);
  console.log(`  - Secondary Positions Changed: ${changes.filter((c) => c.secondaryChanged).length}`);
  console.log(`  - On Manager Rosters (Active impact): ${changes.filter((c) => c.isRostered).length}`);
  console.log(`Unchanged Players: ${unchanged.length}`);

  // Write out changelog JSON
  const changelogOut = {
    generatedAt: new Date().toISOString(),
    totalScraped: scrapedPlayers.length,
    totalMatched: matchedDbIds.size,
    totalChanges: changes.length,
    primaryChangesCount: changes.filter((c) => c.primaryChanged).length,
    secondaryChangesCount: changes.filter((c) => c.secondaryChanged).length,
    rosteredImpactedCount: changes.filter((c) => c.isRostered).length,
    changes,
  };

  const changelogPath = path.join(__dirname, '..', 'changelog-positions.json');
  fs.writeFileSync(changelogPath, JSON.stringify(changelogOut, null, 2));
  console.log(`Saved detailed changelog to ${changelogPath}`);

  // Also save deduped reference rows for sofifa_position_reference
  const dedupedRef = Array.from(new Map(referenceRows.map((r) => [r.sofifa_id, r])).values());
  const refPath = path.join(__dirname, '..', 'sofifa-reference-rows.json');
  fs.writeFileSync(refPath, JSON.stringify(dedupedRef, null, 2));
  console.log(`Saved ${dedupedRef.length} unique reference cache rows to ${refPath}`);
}

main().catch(console.error);
