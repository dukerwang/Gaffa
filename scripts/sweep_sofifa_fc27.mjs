import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEAGUES = [
  { id: 13, name: 'Premier League' },
  { id: 14, name: 'Sky Bet Championship' },
  { id: 53, name: 'LaLiga EA Sports' },
  { id: 31, name: 'Serie A' },
  { id: 19, name: 'Bundesliga' },
  { id: 16, name: 'Ligue 1' },
  { id: 308, name: 'Liga Portugal' },
];

const SOFIFA_BASE = 'https://sofifa.com';
const OUTPUT_FILE = path.join(__dirname, '..', 'scraped-sofifa-fc27.json');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeLeague(page, league) {
  console.log(`\n========================================`);
  console.log(` Scraping ${league.name} (id: ${league.id})`);
  console.log(`========================================`);

  let offset = 0;
  const leaguePlayers = [];
  const seenIds = new Set();

  while (true) {
    const url = `${SOFIFA_BASE}/players?lg=${league.id}&offset=${offset}`;
    process.stdout.write(`  Offset ${offset}... `);

    let rows = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        rows = await page.evaluate(() => {
          const trs = Array.from(document.querySelectorAll('table tbody tr'));
          return trs.map((r) => {
            const a = r.querySelector('a[href^="/player/"]');
            const teamEl = r.querySelector('a[href^="/team/"]');
            const posEls = Array.from(r.querySelectorAll('span.pos'));
            if (!a) return null;
            const href = a.getAttribute('href') || '';
            const parts = href.split('/');
            const id = parseInt(parts[2], 10);
            const slug = parts[3] || '';
            const tooltipName = a.getAttribute('data-tippy-content');
            const textName = a.innerText.trim();
            const commonName = tooltipName || textName;
            const slugName = slug
              .split('-')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
            const teamName = teamEl ? teamEl.innerText.trim() : null;
            const positions = posEls.map((p) => p.innerText.trim()).filter((p) => !['SUB', 'RES'].includes(p));

            return {
              id,
              commonName,
              fullName: slugName || commonName,
              href,
              teamName,
              positions,
            };
          }).filter(Boolean);
        });
        break;
      } catch (err) {
        console.log(`(retry ${attempt + 1}: ${err.message}) `);
        await delay(2000);
      }
    }

    let addedOnPage = 0;
    for (const p of rows) {
      if (p.id && !seenIds.has(p.id)) {
        seenIds.add(p.id);
        leaguePlayers.push({
          ...p,
          sofifaLeagueId: league.id,
          leagueName: league.name,
        });
        addedOnPage++;
      }
    }

    console.log(`got ${rows.length} rows (+${addedOnPage} new, total: ${leaguePlayers.length})`);

    // If fewer than 60 rows returned, or no new players added, we reached the end of this league
    if (rows.length < 60 || addedOnPage === 0) {
      break;
    }

    offset += 60;
    await delay(300); // Polite delay between pages
  }

  console.log(`✓ Finished ${league.name}: extracted ${leaguePlayers.length} players.`);
  return leaguePlayers;
}

(async () => {
  const startTime = Date.now();
  console.log('Launching browser with ./playwright-profile...');

  const context = await chromium.launchPersistentContext('./playwright-profile', {
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = context.pages()[0] || (await context.newPage());

  const allPlayers = [];

  try {
    for (const league of LEAGUES) {
      const players = await scrapeLeague(page, league);
      allPlayers.push(...players);
    }

    console.log(`\n========================================`);
    console.log(` Total Scraped Across All Leagues: ${allPlayers.length}`);
    console.log(` Saving to ${OUTPUT_FILE}...`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allPlayers, null, 2));
    console.log(` Successfully saved ${allPlayers.length} players in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`);
  } catch (err) {
    console.error('Fatal scrape error:', err);
  } finally {
    await context.close();
  }
})();
