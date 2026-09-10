/*
 * Builder's Diary — claude.ai conversation extractor
 * ---------------------------------------------------
 * Paste this whole block into the browser DevTools console WHILE you are on the
 * claude.ai cowork session page. It auto-scrolls the thread (to load messages
 * that virtual-scrolling has unloaded), collects every user + assistant turn in
 * document order, and downloads a single markdown file.
 *
 * Then attach the downloaded .md to the Hermes chat so I can read the whole thing.
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1) Find the largest scrollable element = the transcript scroller.
  const scroller = (() => {
    let best = document.scrollingElement || document.documentElement;
    let bestH = 0;
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const scrollable = /(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflow);
      const h = el.scrollHeight - el.clientHeight;
      if (scrollable && h > bestH) { bestH = h; best = el; }
    }
    return best;
  })();

  // 2) Message selectors — claude.ai user + assistant turns. Multiple fallbacks.
  const USER_SEL = '[data-testid="user-message"], div.font-user-message';
  const AST_SEL  = '.font-claude-message, [data-testid="assistant-message"]';
  const ALL_SEL  = USER_SEL + ', ' + AST_SEL;

  const collected = new Map(); // key -> {role, text, pos}
  const sRectTop = () => scroller.getBoundingClientRect().top;

  function harvest() {
    const base = sRectTop();
    for (const node of document.querySelectorAll(ALL_SEL)) {
      const text = (node.innerText || '').trim();
      if (!text) continue;
      const isUser = node.matches(USER_SEL) || !!node.closest('[data-testid="user-message"]');
      const role = isUser ? 'user' : 'assistant';
      const rect = node.getBoundingClientRect();
      const pos = scroller.scrollTop + (rect.top - base); // stable absolute position
      const key = role + '::' + text.slice(0, 140);
      if (!collected.has(key)) collected.set(key, { role, text, pos });
    }
  }

  // 3) Diagnostics — if these are both 0, the selectors need updating.
  const uCount = document.querySelectorAll(USER_SEL).length;
  const aCount = document.querySelectorAll(AST_SEL).length;
  console.log(`[extractor] visible now — user:${uCount} assistant:${aCount}`);
  if (uCount === 0 && aCount === 0) {
    console.warn('[extractor] No messages matched. claude.ai markup may have changed.');
  }

  // 4) Scroll from top to bottom, harvesting at each step (loads virtualized turns).
  console.log('[extractor] scrolling & collecting… (leave the tab focused)');
  scroller.scrollTo(0, 0); await sleep(500); harvest();

  let stableRounds = 0, lastTop = -1;
  for (let i = 0; i < 800; i++) {
    scroller.scrollBy(0, Math.max(300, scroller.clientHeight * 0.75));
    await sleep(280);
    harvest();
    const t = Math.round(scroller.scrollTop);
    if (t === lastTop) { if (++stableRounds >= 3) break; } else { stableRounds = 0; }
    lastTop = t;
  }
  await sleep(300); harvest();

  // 5) Assemble in document order.
  const msgs = [...collected.values()].sort((a, b) => a.pos - b.pos);
  const stamp = new Date().toISOString();
  let md = `# Claude Cowork transcript\n\n_${msgs.length} messages · exported ${stamp}_\n\n`;
  for (const m of msgs) {
    md += `\n---\n\n### ${m.role === 'user' ? '🧑 USER' : '🤖 ASSISTANT'}\n\n${m.text}\n`;
  }

  // 6) Download.
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `claude-cowork-transcript-${stamp.slice(0, 10)}.md`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);

  console.log(`✅ [extractor] ${msgs.length} messages → ${a.download}`);
  console.log('   Attach that file to the Hermes chat.');
})();
