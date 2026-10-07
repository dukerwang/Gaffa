import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scraped = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraped-sofifa-fc27.json'), 'utf8'));
const plFullbacks = scraped.filter(p => p.sofifaLeagueId === 13 && (
  p.positions.includes('LB') || p.positions.includes('RB') || p.positions.includes('LWB') || p.positions.includes('RWB')
));

console.log(`Found ${plFullbacks.length} PL fullbacks to scrape roles for.`);

const context = await chromium.launchPersistentContext(path.join(__dirname, '..', 'playwright-profile'), {
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
});

const page = context.pages()[0] || await context.newPage();
await page.goto('https://sofifa.com/players?lg=13', { waitUntil: 'domcontentloaded' });

const results = [];
const BATCH_SIZE = 5;

for (let i = 0; i < plFullbacks.length; i += BATCH_SIZE) {
  const batch = plFullbacks.slice(i, i + BATCH_SIZE);
  
  const batchData = await Promise.all(batch.map(async (p) => {
    try {
      const data = await page.evaluate(async (url) => {
        const res = await fetch(url);
        if (res.status !== 200) return { error: `status ${res.status}` };
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const bodyText = doc.body.innerText;
        const roleIdx = bodyText.indexOf('Roles');
        if (roleIdx === -1) return { roles: [] };

        const chunk = bodyText.substring(roleIdx, roleIdx + 600);
        const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
        const rolesFound = [];
        
        for (let k = 1; k < Math.min(lines.length, 25); k++) {
          const line = lines[k];
          if (['Layout', 'Attacking', 'Skill', 'Movement', 'Power', 'Mentality', 'Defending', 'Goalkeeping'].includes(line)) break;
          // Skip position badges
          if (['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'CF', 'SUB', 'RES'].includes(line)) continue;
          // Skip tactical focus labels
          if (['Defend', 'Balanced', 'Attack', 'Roaming', 'Build-up', 'Support', 'Inverted', 'Stay Wide', 'Overlap'].includes(line)) continue;
          rolesFound.push(line);
        }
        return { roles: Array.from(new Set(rolesFound)) };
      }, `https://sofifa.com${p.href}`);

      return {
        id: p.id,
        name: p.commonName,
        fullName: p.fullName,
        club: p.teamName,
        positions: p.positions,
        href: p.href,
        roles: data.roles || []
      };
    } catch (err) {
      return {
        id: p.id,
        name: p.commonName,
        fullName: p.fullName,
        club: p.teamName,
        positions: p.positions,
        href: p.href,
        roles: [],
        error: err.message
      };
    }
  }));

  results.push(...batchData);
  process.stdout.write(`Scraped ${Math.min(i + BATCH_SIZE, plFullbacks.length)}/${plFullbacks.length}...\r`);
  await new Promise(r => setTimeout(r, 400));
}

await context.close();

fs.writeFileSync(path.join(__dirname, '..', 'scraped-pl-roles.json'), JSON.stringify(results, null, 2));
console.log(`\nDone! Saved ${results.length} PL fullback roles to scraped-pl-roles.json.`);
