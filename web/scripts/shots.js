// Real-render screenshotter: drives system Chrome via puppeteer-core.
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, '..', '.shots');
const BASE = 'http://localhost:3111';

async function shot(page, url, file, extra) {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  // let fonts + client render settle
  await new Promise(r => setTimeout(r, 900));
  if (extra) await extra(page);
  const p = path.join(OUT, file);
  await page.screenshot({ path: p });
  console.log('WROTE', p);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1'],
    defaultViewport: { width: 1440, height: 880 },
  });
  const page = await browser.newPage();

  // 1) onboarding
  await shot(page, BASE + '/', '01-onboarding.png');

  // 2) connected (demo mode)
  await shot(page, BASE + '/?demo=1', '02-connected.png');

  // 3) click first card -> detail panel opens
  await shot(page, BASE + '/?demo=1', '03-card-detail.png', async (pg) => {
    const clicked = await pg.evaluate(() => {
      const el = document.querySelector('[data-record-id]');
      if (el) { el.click(); return true; }
      return false;
    });
    console.log('card clicked:', clicked);
    await new Promise(r => setTimeout(r, 600));
  });

  // 4) open the 마인드셋 searchable dropdown
  await shot(page, BASE + '/?demo=1', '04-tag-dropdown.png', async (pg) => {
    await pg.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // header mindset select trigger shows placeholder '전체'
      const t = btns.find(b => b.textContent && b.textContent.trim().startsWith('전체'));
      if (t) t.click();
    });
    await new Promise(r => setTimeout(r, 500));
  });

  // 5) click a goal in the left list -> cards narrow
  await shot(page, BASE + '/?demo=1', '05-goal-selected.png', async (pg) => {
    const ok = await pg.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const g = btns.find(b => (b.textContent || '').includes('MCP 서버 연동'));
      if (g) { g.click(); return true; }
      return false;
    });
    console.log('goal clicked:', ok);
    await new Promise(r => setTimeout(r, 500));
  });

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e); process.exit(1); });
