import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILE_DIR = path.join(__dirname, '..', 'playwright-profile');

console.log('==============================================');
console.log(' SoFIFA One-Time Login Setup');
console.log('==============================================');
console.log('Opening Chrome window with persistent profile at:');
console.log(PROFILE_DIR);
console.log('\nPlease log in to your SoFIFA account in the browser window.');
console.log('You can use Google sign-in, email, or whatever login method you use.');
console.log('The script will wait until you are back on SoFIFA logged in.\n');

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
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

await page.goto('https://sofifa.com/signIn', { waitUntil: 'domcontentloaded' });

console.log('Waiting for you to complete login... (The window will stay open until login succeeds)');

const startTime = Date.now();
const TIMEOUT_MS = 300000; // 5 minutes

while (Date.now() - startTime < TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, 2000));
  
  const currentUrl = page.url();

  // We only count as logged in if we are back on sofifa.com and have an authenticated element
  const isLoggedIn = await page.evaluate(() => {
    const host = window.location.hostname;
    const path = window.location.pathname;
    if (!host.includes('sofifa.com')) return false;
    if (path.includes('/signIn') || path.includes('/callback')) return false;

    // Look for logged-in indicators
    const hasAvatar = !!document.querySelector('img.avatar, a[href^="/user/"], a[href^="/settings"], a[href^="/calculator"]');
    const hasSignInLink = !!document.querySelector('a[href="/signIn"]');
    return hasAvatar || !hasSignInLink;
  }).catch(() => false);

  if (isLoggedIn) {
    console.log('\n✅ Login detected!');
    console.log('Current URL:', currentUrl);
    console.log('Saving session to ./playwright-profile...');
    await page.waitForTimeout(3000);
    await context.close();
    console.log('Session saved successfully. Scraper is now authenticated.\n');
    process.exit(0);
  }
}

console.log('\nTimed out waiting for login (5 minutes).');
await context.close();
process.exit(1);
