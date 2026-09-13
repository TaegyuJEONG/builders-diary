// Verifies the right-hand panel is scoped to one job for one project.
// Drives system Chrome via puppeteer-core against the dev server (demo data).
const puppeteer = require('puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:3111/?demo=1';
const SHOTS = require('path').join(__dirname, '..', '.shots');
const shot = (page, name) => page.screenshot({ path: require('path').join(SHOTS, name) }).catch(() => {});

const panelTitle = () => {
  const aside = document.querySelector('aside');
  if (!aside) return null;
  const strong = aside.querySelector('strong');
  return strong ? strong.textContent.trim() : null;
};

const panelText = () => {
  const aside = document.querySelector('aside');
  return aside ? aside.innerText : '';
};

const clickBySelector = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return false;
  el.click();
  return true;
};

const clickByText = (text) => {
  const el = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === text);
  if (!el) return false;
  el.click();
  return true;
};

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// Panel labels render with CSS text-transform: uppercase, so innerText is uppercase.
const hasAll = (text, labels) => labels.every(label => text.toLowerCase().includes(label.toLowerCase()));
const hasNone = (text, labels) => labels.every(label => !text.toLowerCase().includes(label.toLowerCase()));
const excerpt = text => text.replace(/\s+/g, ' ').trim().slice(0, 220);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="Edit"]').length > 0, { timeout: 20000 });

  // 1) project edit
  const projectName = await page.evaluate(() => {
    const edit = document.querySelector('button[aria-label^="Edit"]');
    const label = edit.getAttribute('aria-label').replace(/^Edit\s+/, '');
    edit.click();
    return label;
  });
  await page.waitForFunction(panelTitleWrapper, { timeout: 10000 }, projectName);
  let title = await page.evaluate(panelTitle);
  let text = await page.evaluate(panelText);
  check('project edit panel is titled for that project', title === `Edit · ${projectName}`, title);
  await shot(page, 'panel-1-edit-project.png');
  check('project edit panel shows project fields only',
    hasAll(text, ['Name', 'Type', 'Sector', 'One-line story', 'Logo URL', 'Save project'])
    && hasNone(text, ['Add stage', 'Create task', 'New task', 'Delete stage']),
    excerpt(text));

  // 2) add project
  await page.evaluate(() => document.querySelector('aside button[aria-label="Close"]').click());
  await page.waitForFunction(() => !document.querySelector('aside'), { timeout: 10000 });
  await page.evaluate(() => document.querySelector('button[title="Create project or learning"]').click());
  await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 10000 });
  title = await page.evaluate(panelTitle);
  text = await page.evaluate(panelText);
  check('add project opens a create-only panel', title === 'New project or learning', title);
  await shot(page, 'panel-2-create-project.png');
  check('create panel offers no stage or task controls',
    hasAll(text, ['Create project'])
    && hasNone(text, ['Add stage', 'Save stages', 'Create task', 'Delete project']),
    excerpt(text));

  // 3) project stages
  await page.evaluate(() => document.querySelector('aside button[aria-label="Close"]').click());
  await page.waitForFunction(() => !document.querySelector('aside'), { timeout: 10000 });
  await page.evaluate(() => document.querySelectorAll('[role="button"]')[0].click());
  await page.waitForFunction(() => !!document.querySelector('button[title="Create stage"]'), { timeout: 10000 });
  await page.evaluate(() => document.querySelector('button[title="Create stage"]').click());
  await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 10000 });
  title = await page.evaluate(panelTitle);
  text = await page.evaluate(panelText);
  check('stage panel is scoped to the selected project', /^Stages · /.test(title || ''), title);
  await shot(page, 'panel-3-stages.png');
  check('stage panel offers stage controls only',
    hasAll(text, ['Add stage', 'Save stages'])
    && hasNone(text, ['Create task', 'Delete project', 'One-line story']),
    excerpt(text));

  // 4) new task for a stage
  await page.evaluate(() => document.querySelector('aside button[aria-label="Close"]').click());
  await page.waitForFunction(() => !document.querySelector('aside'), { timeout: 10000 });
  await page.evaluate(() => {
    const add = Array.from(document.querySelectorAll('button')).find(b => /^Add task to /.test(b.getAttribute('title') || ''));
    add.click();
  });
  await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 10000 });
  title = await page.evaluate(panelTitle);
  text = await page.evaluate(panelText);
  check('task panel is scoped to the selected project', /^New task · /.test(title || ''), title);
  await shot(page, 'panel-4-new-task.png');
  check('task panel offers task fields only',
    hasAll(text, ['Stage', 'Purpose', 'Task title', 'Activities', 'Create task'])
    && hasNone(text, ['Add stage', 'Delete project', 'One-line story']),
    excerpt(text));

  check('no uncaught page errors', errors.length === 0, errors.join(' | ') || null);

  // 5) removing a stage that still has tasks must confirm in-app and name the tasks
  await page.evaluate(() => document.querySelector('aside button[aria-label="Close"]').click());
  await page.waitForFunction(() => !document.querySelector('aside'), { timeout: 10000 });
  // Pick a stage column that actually holds tasks, so the confirm path is exercised.
  const populated = await page.evaluate(() => Array.from(document.querySelectorAll('button[title^="Add task to "]'))
    .map(button => {
      const header = button.closest('div');
      const match = (header ? header.innerText : '').replace(/\s+/g, ' ').match(/(\d+)\s+TASKS?/i);
      return { stage: button.getAttribute('title').replace(/^Add task to /, ''), count: match ? Number(match[1]) : 0 };
    })
    .filter(entry => entry.count > 0));
  check('found a stage with tasks to remove', populated.length > 0, JSON.stringify(populated));
  const stageToRemove = populated[0].stage;

  await page.evaluate(() => document.querySelector('button[title="Create stage"]').click());
  await page.waitForFunction(() => !!document.querySelector('aside'), { timeout: 10000 });
  await page.evaluate(stage => {
    const remover = Array.from(document.querySelectorAll('aside button'))
      .find(button => button.getAttribute('title') === `Remove ${stage}`);
    remover.click();
  }, stageToRemove);
  await page.evaluate(() => {
    const save = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Save stages');
    save.click();
  });
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 10000 }).catch(() => {});
  const dialog = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    return el ? el.innerText.replace(/\s+/g, ' ').trim() : null;
  });
  await shot(page, 'panel-5-delete-stage-confirm.png');
  check('removing a stage opens an in-app confirm dialog', !!dialog, dialog ? dialog.slice(0, 240) : null);
  check('the dialog names the stage and its tasks before deleting',
    !!dialog && new RegExp(stageToRemove, 'i').test(dialog) && /Task/.test(dialog) && /cannot be undone/.test(dialog),
    null);
  const reportedCount = dialog ? Number((dialog.match(/(\d+)\s+TASKS?/i) || [])[1]) : NaN;
  check('the dialog count matches the stage column it came from',
    reportedCount === populated[0].count,
    `dialog says ${reportedCount}, column says ${populated[0].count}`);

  // 6) stage editing is offered only while one project is selected
  await page.evaluate(() => {
    const cancel = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => (b.textContent || '').trim() === 'Cancel');
    if (cancel) cancel.click();
  });
  // A fresh load starts on All Projects, which is where stage controls must be absent.
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector('button[title="Create project or learning"]'), { timeout: 20000 });
  const allProjectsControls = await page.evaluate(() => ({
    stageButtons: document.querySelectorAll('button[title="Create stage"]').length,
    deleteStage: Array.from(document.querySelectorAll('button')).filter(b => /^Delete /.test(b.getAttribute('title') || '')).length,
  }));
  check('All Projects view hides per-project stage controls',
    allProjectsControls.stageButtons === 0 && allProjectsControls.deleteStage === 0,
    JSON.stringify(allProjectsControls));
  await page.evaluate(() => document.querySelectorAll('[role="button"]')[0].click());
  await page.waitForFunction(() => !!document.querySelector('button[title="Create stage"]'), { timeout: 10000 }).catch(() => {});
  const singleProjectControls = await page.evaluate(() => ({
    stageButtons: document.querySelectorAll('button[title="Create stage"]').length,
    addTask: Array.from(document.querySelectorAll('button')).filter(b => /^Add task to /.test(b.getAttribute('title') || '')).length,
  }));
  check('single-project view restores per-project stage controls',
    singleProjectControls.stageButtons === 1 && singleProjectControls.addTask > 0,
    JSON.stringify(singleProjectControls));

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(error => { console.error('ERR', error); process.exit(1); });

// puppeteer cannot serialize a function reference into waitForFunction, so this
// helper is stringified into the page to wait for the panel title to appear.
function panelTitleWrapper(expected) {
  const aside = document.querySelector('aside');
  return !!aside && !!aside.querySelector('strong') && aside.querySelector('strong').textContent.trim() === `Edit · ${expected}`;
}
