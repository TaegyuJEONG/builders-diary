/*
 * claude.ai cowork — DOM DIAGNOSTIC (read-only, no scroll, no download)
 * Paste in DevTools console on the cowork session tab, then copy ALL console
 * output back to Hermes so the extractor selectors can be fixed.
 */
(() => {
  const out = {};

  // 1) Candidate message containers by common attributes/classes.
  const probes = [
    '[data-testid="user-message"]',
    'div.font-user-message',
    '.font-claude-message',
    '[data-testid="assistant-message"]',
    '[data-test-render-count]',
    '[data-message-author-role]',
    '[class*="message"]',
    '[class*="Message"]',
    'article',
    '[role="article"]',
  ];
  out.selectorCounts = {};
  for (const s of probes) {
    try { out.selectorCounts[s] = document.querySelectorAll(s).length; } catch { out.selectorCounts[s] = 'ERR'; }
  }

  // 2) Largest scrollable element info.
  let best = document.scrollingElement, bestH = 0;
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY + cs.overflow)) {
      const h = el.scrollHeight - el.clientHeight;
      if (h > bestH) { bestH = h; best = el; }
    }
  }
  out.scroller = { tag: best?.tagName, cls: (best?.className || '').slice(0, 80), scrollHeight: best?.scrollHeight, clientHeight: best?.clientHeight };

  // 3) Sample: find elements whose text looks like a chat turn, report their classes.
  const bigText = [...document.querySelectorAll('div,article,section')]
    .filter(el => (el.innerText || '').trim().length > 80 && el.children.length < 40)
    .slice(0, 6)
    .map(el => ({
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 90),
      testid: el.getAttribute('data-testid') || null,
      role: el.getAttribute('data-message-author-role') || null,
      head: (el.innerText || '').trim().slice(0, 60).replace(/\n/g, ' '),
    }));
  out.textBlocks = bigText;

  console.log('=== COWORK DOM DIAGNOSTIC ===');
  console.log(JSON.stringify(out, null, 2));
  console.log('=== copy everything above back to Hermes ===');
})();
