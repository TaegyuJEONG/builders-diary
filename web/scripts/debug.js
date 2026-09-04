const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 880 },
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[PAGEERROR] ${e.message}`));
  page.on('requestfailed', r => logs.push(`[REQFAIL] ${r.url()} ${r.failure()?.errorText}`));

  await page.goto('http://localhost:3111/?demo=1', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const info = await page.evaluate(() => ({
    bodyLen: document.body.innerText.length,
    bodyText: document.body.innerText.slice(0, 400),
    cards: document.querySelectorAll('[data-record-id]').length,
    buttons: document.querySelectorAll('button').length,
    html: document.getElementById('__next') ? document.getElementById('__next').innerHTML.length : -1,
  }));
  console.log('INFO', JSON.stringify(info, null, 2));
  console.log('LOGS:\n' + logs.join('\n'));
  await browser.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
