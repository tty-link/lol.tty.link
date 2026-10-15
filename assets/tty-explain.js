/* tty.link explanations: "이게 왜 웃겨요?" / "Why is this funny?"
 *
 *   TTYExplain.open({ id, lang, title, returnFocus, onClose })
 *       Open the explanation of page <id> (or switch the open one to another page or language).
 *       title is optional (taken from the data, then from pages/index.json); returnFocus is the
 *       element that gets focus back on close (default: whatever had focus); onClose runs once
 *       the dialog has closed.
 *   TTYExplain.close()
 *   TTYExplain.isOpen()
 *
 * The data, /pages/explain/<id>.json, is generated from each page's planning notes and fetched
 * only when someone asks. Strings may carry **bold**
 * and `code`: everything is HTML-escaped first, then only those two are turned into tags.
 *
 * The dialog is modal: focus stays inside, Esc and a click on the backdrop close it, and focus goes
 * back to the opener. While it is open the rest of the page is inert and the document does not
 * scroll (wheel, touch and keys only move the explanation). Phones (≤600px wide) get a bottom sheet
 * that scrolls inside itself; wide screens (≥1100px) dock the card on the left so the page stays in view.
 * Every style sits under #tty-explain and is injected once. The root resets what it inherits and its
 * descendants revert page rules, so page resets (* { margin: 0 }, button { … }) do not reach in and
 * nothing here leaks out. The only thing set outside it is an inline overflow lock on <html> (and the
 * inert attribute on the page's top-level elements), both undone on close.
 */
(() => {
  if (window.TTYExplain) return;

  const ROOT_ID = 'tty-explain';
  const TEXT = {
    ko: {
      ask: '이게 왜 웃겨요?',
      // E. B. White and Katharine S. White, preface to "A Subtreasury of American Humor" (1941):
      // "Humor can be dissected, as a frog can, but the thing dies in the process …"
      quip: '유머를 해부하면 개구리처럼 죽는다지만(E. B. 화이트 부부, 1941), 살살 해 볼게요.',
      tabs: ['처음 봐요', '좀 알아요', '다 알아요'],
      tiers: '얼마나 아세요?',
      close: '닫기',
      loading: '해설을 꺼내는 중…',
      missing: '해설을 준비하고 있어요',
      missingMore: '조금만 기다려 주세요. 그동안 한 번 더 보면 보일지도 몰라요 :)',
      points: '웃음 포인트',
      terms: '용어 풀이',
      links: '더 보기',
      deep: '두 번 봐야 보이는 것',
      newTab: '새 탭에서 열림',
      onlyOther: '아직 영어 해설만 있어요.',
      updated: (date) => `${date} 기준`,
      langName: { en: '영어', ko: '한국어' },
    },
    en: {
      ask: 'Why is this funny?',
      quip: '“Humor can be dissected, as a frog can, but the thing dies in the process.” — E. B. & Katharine S. White, 1941. We’ll be gentle.',
      tabs: ['New to this', 'Know a bit', 'Know it all'],
      tiers: 'How much do you know?',
      close: 'Close',
      loading: 'Fetching the explanation…',
      missing: 'The explanation is on its way',
      missingMore: 'Hang tight. Meanwhile, watching it once more might do the trick :)',
      points: 'Why it lands',
      terms: 'Words to know',
      links: 'See also',
      deep: 'Only on a second look',
      newTab: 'opens in a new tab',
      onlyOther: 'Only the Korean explanation is ready so far.',
      updated: (date) => `As of ${date}`,
      langName: { en: 'English', ko: 'Korean' },
    },
  };

  const INK = '#1b2b7a';
  const SUN = '#ffd84a';
  const UI_FONT = "'Recursive', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', monospace";
  const TEXT_FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', Roboto, 'Helvetica Neue', Arial, sans-serif";
  const R = '#' + ROOT_ID;
  const CSS = `
${R}{all:initial;position:fixed;inset:0;z-index:2147483647;display:grid;grid-template:minmax(0,1fr)/minmax(0,1fr);place-items:start center;
  padding:max(16px,min(10vh,calc(50vh - 350px))) 16px 16px;box-sizing:border-box;
  font:400 15px/1.55 ${TEXT_FONT};color:${INK};text-align:left;direction:ltr;-webkit-font-smoothing:antialiased;
  -webkit-text-size-adjust:100%;text-size-adjust:100%;cursor:auto;pointer-events:auto;visibility:visible;opacity:1}
${R} *,${R} *::before,${R} *::after{all:revert;box-sizing:border-box}
${R} [hidden]{display:none !important}
${R} .ttyx-backdrop{position:absolute;inset:0;background:rgba(12,18,52,.55);-webkit-tap-highlight-color:transparent}
${R} .ttyx-panel{position:relative;display:flex;flex-direction:column;width:min(560px,100%);max-height:min(700px,100%);margin:0;
  background:${SUN};color:${INK};border:2px solid ${INK};border-radius:22px;box-shadow:0 24px 60px rgba(10,16,48,.45);overflow:hidden;outline:none}
${R} .ttyx-head{position:relative;flex:none;margin:0;padding:18px 20px 14px}
${R} .ttyx-kicker{display:inline-block;margin:0 52px 0 0;padding:6px 11px;border-radius:999px;background:${INK};color:${SUN};
  font:700 12.5px/1.1 ${UI_FONT};font-variation-settings:'MONO' 1,'CASL' 0;letter-spacing:0}
${R} .ttyx-title{display:block;margin:10px 46px 0 0;padding:0;font:750 22px/1.22 ${UI_FONT};font-variation-settings:'MONO' 1,'CASL' 1;color:${INK};
  overflow-wrap:anywhere;word-break:keep-all;text-transform:none;letter-spacing:0}
${R} .ttyx-quip{display:block;margin:7px 0 0;padding:0;font:400 13px/1.5 ${TEXT_FONT};color:rgba(27,43,122,.78);word-break:keep-all;overflow-wrap:break-word}
${R} .ttyx-close{position:absolute;top:14px;right:14px;display:block;width:40px;height:40px;margin:0;padding:0;
  border:1.5px solid ${INK};border-radius:999px;background:transparent;color:${INK};cursor:pointer;-webkit-tap-highlight-color:transparent}
${R} .ttyx-close:hover{background:${INK};color:${SUN}}
${R} .ttyx-close::before,${R} .ttyx-close::after{content:'';position:absolute;left:50%;top:50%;width:16px;height:2.4px;margin:-1.2px 0 0 -8px;
  border-radius:2px;background:currentColor;transform:rotate(45deg)}
${R} .ttyx-close::after{transform:rotate(-45deg)}
${R} .ttyx-tabs{display:flex;flex:none;margin:0 20px 14px;padding:0;border:1.5px solid ${INK};border-radius:999px;overflow:hidden;background:transparent}
${R} .ttyx-tab{flex:1 1 0;min-width:0;min-height:38px;margin:0;padding:6px 8px;border:0;border-radius:0;background:transparent;color:${INK};
  font:700 13.5px/1.15 ${UI_FONT};font-variation-settings:'MONO' 1,'CASL' 0;text-align:center;word-break:keep-all;cursor:pointer;
  -webkit-tap-highlight-color:transparent}
${R} .ttyx-tab+.ttyx-tab{border-left:1.5px solid ${INK}}
${R} .ttyx-tab:hover{background:rgba(27,43,122,.12)}
${R} .ttyx-tab[aria-selected="true"]{background:${INK};color:${SUN}}
${R} .ttyx-stack{display:grid;grid-template:minmax(0,1fr)/minmax(0,1fr);flex:1 1 auto;min-height:0;margin:0 12px 12px}
${R} .ttyx-body{grid-area:1/1;min-height:0;margin:0;padding:18px 18px 16px;overflow-y:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;background:#fffaf0;border-radius:14px;color:${INK};outline:none}
${R} .ttyx-body:focus-visible{box-shadow:inset 0 0 0 3px ${INK}}
/* Desktop: the card is anchored near the top and a tier change only moves its bottom edge. */
${R} .ttyx-body.ttyx-off{display:none}
${R} .ttyx-body:lang(ko),${R} .ttyx-body [lang="ko"]{word-break:keep-all;overflow-wrap:break-word}
/* "There is more below": a fade over the bottom of a body that has not been scrolled to its end. */
${R} .ttyx-fade{grid-area:1/1;align-self:end;position:relative;z-index:1;height:46px;margin:0;border-radius:0 0 14px 14px;
  background:linear-gradient(rgba(255,250,240,0),rgba(255,250,240,.92) 62%);pointer-events:none}
${R} .ttyx-fade::after{content:'';position:absolute;left:50%;bottom:11px;width:9px;height:9px;margin-left:-5px;
  border:solid ${INK};border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
${R} .ttyx-line{display:block;margin:0 0 14px;padding:0;font:700 17px/1.5 ${TEXT_FONT};color:${INK}}
${R} .ttyx-h{display:block;margin:16px 0 8px;padding:0;font:700 12.5px/1.2 ${UI_FONT};font-variation-settings:'MONO' 1,'CASL' 0;
  letter-spacing:.02em;text-transform:none;color:rgba(27,43,122,.72)}
${R} .ttyx-h:first-child{margin-top:0}
${R} .ttyx-list{display:block;margin:0;padding:0;list-style:none}
${R} .ttyx-list>li{display:block;position:relative;margin:0 0 9px;padding:0 0 0 22px;font:400 15px/1.6 ${TEXT_FONT};color:${INK}}
${R} .ttyx-list>li::before{content:'';position:absolute;left:5px;top:.62em;width:8px;height:8px;border-radius:50%;background:${INK}}
${R} .ttyx-deep{counter-reset:ttyx}
${R} .ttyx-deep>li{counter-increment:ttyx;padding-left:32px}
${R} .ttyx-deep>li::before{content:counter(ttyx);left:0;top:.18em;width:22px;height:22px;display:grid;place-items:center;
  background:${INK};color:${SUN};font:700 12px/1 ${UI_FONT};border-radius:50%}
${R} .ttyx-terms{display:block;margin:0;padding:0}
${R} .ttyx-term{display:block;margin:0 0 10px;padding:0}
${R} .ttyx-term dt{display:block;margin:0;padding:0;font:700 15px/1.45 ${TEXT_FONT};color:${INK}}
${R} .ttyx-term dd{display:block;margin:2px 0 0;padding:0;font:400 14.5px/1.6 ${TEXT_FONT};color:${INK}}
${R} .ttyx-links>li::before{content:'↗';left:2px;top:0;width:auto;height:auto;border-radius:0;background:none;font:700 14px/1.6 ${UI_FONT};color:${INK}}
${R} .ttyx-a{color:${INK};font-weight:700;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.18em;cursor:pointer;
  overflow-wrap:anywhere}
${R} .ttyx-a:hover{background:${SUN}}
${R} .ttyx-lang{display:inline-block;margin:0 0 0 6px;padding:1px 7px;border:1px solid rgba(27,43,122,.45);border-radius:999px;
  font:600 11.5px/1.4 ${TEXT_FONT};color:rgba(27,43,122,.8);vertical-align:1px}
${R} .ttyx-note{display:block;margin:2px 0 0;font:400 14px/1.55 ${TEXT_FONT};color:rgba(27,43,122,.8)}
${R} .ttyx-strong{font-weight:800}
${R} .ttyx-code{padding:1px 5px;border-radius:5px;background:rgba(27,43,122,.1);font:600 .92em/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${INK};
  overflow-wrap:anywhere}
${R} .ttyx-meta{display:block;margin:16px 0 0;font:400 12px/1.4 ${UI_FONT};color:rgba(27,43,122,.76)}
${R} .ttyx-aside{display:block;margin:0 0 12px;padding:8px 12px;border-radius:10px;background:rgba(255,216,74,.45);font:600 13px/1.5 ${TEXT_FONT};color:${INK}}
${R} .ttyx-empty{display:block;margin:0;padding:10px 0;text-align:center}
${R} .ttyx-empty-face{display:block;margin:0 0 8px;font:750 34px/1 ${UI_FONT};color:${INK}}
${R} .ttyx-empty-title{display:block;margin:0;font:700 17px/1.4 ${TEXT_FONT}}
${R} .ttyx-empty-more{display:block;margin:6px 0 0;font:400 14px/1.55 ${TEXT_FONT};color:rgba(27,43,122,.8)}
${R} .ttyx-loading{display:block;margin:0;padding:12px 0;text-align:center;font:600 14px/1.5 ${UI_FONT};color:rgba(27,43,122,.7)}
/* Hangul has no monospace face here; the sans stack keeps Korean labels from getting wide gaps.
   (The root and every body carry the interface language; only explanation text may differ.) */
${R}:lang(ko) .ttyx-kicker,${R}:lang(ko) .ttyx-title,${R}:lang(ko) .ttyx-tab,${R}:lang(ko) .ttyx-h,${R}:lang(ko) .ttyx-meta,
${R}:lang(ko) .ttyx-loading{font-family:${TEXT_FONT};letter-spacing:0}
${R}:lang(ko) .ttyx-title{font-weight:800}
${R} .ttyx-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
${R} .ttyx-close:focus-visible,${R} .ttyx-a:focus-visible{outline:3px solid ${INK};outline-offset:3px}
${R} .ttyx-tab:focus-visible{outline:3px solid currentColor;outline-offset:-6px;border-radius:999px}
/* Wide screens: the card docks on the left (over the home rail) under a lighter veil, so the page
   it explains stays in view beside it. */
@media (min-width:1100px){
  ${R}{place-items:start start;padding-left:clamp(16px,3.4vw,48px)}
  ${R} .ttyx-panel{width:min(clamp(440px,40vw,560px),100%)}
  ${R} .ttyx-backdrop{background:rgba(12,18,52,.3)}
}
@media (max-width:600px){
  ${R}{place-items:end stretch;padding:0}
  ${R} .ttyx-panel{width:100%;max-height:calc(100% - 40px);border-width:2px 0 0;border-radius:22px 22px 0 0;
    padding-bottom:env(safe-area-inset-bottom,0px);box-shadow:0 -12px 40px rgba(10,16,48,.35)}
  ${R} .ttyx-head{padding:16px 16px 12px}
  ${R} .ttyx-close{top:12px;right:12px}
  ${R} .ttyx-title{font-size:19px}
  ${R} .ttyx-quip{font-size:12.5px}
  ${R} .ttyx-tabs{margin:0 14px 12px}
  ${R} .ttyx-tab{font-size:12.5px;padding:6px 4px}
  ${R} .ttyx-stack{margin:0 8px 8px}
  /* Phones: every tier keeps its place in one grid cell, so the sheet keeps one height (the tallest tier's). */
  ${R} .ttyx-body.ttyx-off{display:block;visibility:hidden}
  ${R} .ttyx-body{padding:16px 14px 14px}
  ${R} .ttyx-line{font-size:16px}
}
/* Short screens (small phones, phones held sideways, zoomed-in windows) keep the room for the
   explanation itself: the quip goes and the header tightens. */
@media (max-width:600px) and (max-height:700px),(max-height:520px){
  ${R} .ttyx-quip{display:none}
  ${R} .ttyx-head{padding-top:12px;padding-bottom:10px}
  ${R} .ttyx-close{top:9px}
  ${R} .ttyx-title{margin-top:8px}
  ${R} .ttyx-tabs{margin-bottom:10px}
}
/* Windows High Contrast and other forced colours: shapes drawn with backgrounds get system colours. */
@media (forced-colors:active){
  ${R} .ttyx-close::before,${R} .ttyx-close::after{forced-color-adjust:none;background:ButtonText}
  ${R} .ttyx-list>li::before{forced-color-adjust:none;background:CanvasText;color:Canvas}
  ${R} .ttyx-links>li::before{background:none;color:CanvasText}
  ${R} .ttyx-tab[aria-selected="true"]{forced-color-adjust:none;background:Highlight;color:HighlightText}
  ${R} .ttyx-fade{background:none}
  ${R} .ttyx-fade::after{forced-color-adjust:none;border-color:CanvasText}
}
`;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Escape everything, then allow only `code` and **bold**. Code spans are set aside first (their
  // stars stay literal) and put back after the bold pass, so bold may wrap or contain code.
  const md = (s) => {
    const codes = [];
    const text = String(s || '').replace(/\u0000/g, '').replace(/`([^`]+)`/g, (_, code) => `\u0000${codes.push(code) - 1}\u0000`);
    return esc(text)
      .replace(/\*\*(?=\S)(.+?)\*\*/g, '<strong class="ttyx-strong">$1</strong>')
      .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code class="ttyx-code">${esc(codes[i])}</code>`);
  };

  const el = (tag, cls, attrs) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    return node;
  };
  const rich = (tag, cls, text) => { const node = el(tag, cls); node.innerHTML = md(text); return node; };
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = () => matchMedia('(max-width: 600px)').matches;
  const list = (v) => (Array.isArray(v) ? v : []);
  const part = (c) => ({ line: (c && typeof c.line === 'string') ? c.line : '', points: list(c && c.points), terms: list(c && c.terms), links: list(c && c.links), deep: list(c && c.deep) });
  const filled = (c) => !!(c.line || c.points.length || c.terms.length || c.links.length || c.deep.length);

  /* ---- Data ---- */
  const cache = new Map();
  function load(id) {
    if (!cache.has(id)) {
      const request = fetch(`/pages/explain/${id}.json`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((data) => { if (!data) cache.delete(id); return data; });
      cache.set(id, request);
    }
    return cache.get(id);
  }
  let manifest = null;
  const pageTitle = (id, lang) => {
    if (!manifest) manifest = fetch('/pages/index.json').then((r) => r.json()).catch(() => ({}));
    return manifest.then((m) => {
      const p = ((m && m.pages) || []).find((x) => x.id === id);
      return (p && p.title && (p.title[lang] || p.title.en)) || '';
    });
  };

  /* ---- Dialog ---- */
  let root = null;
  let refs = null;
  let state = null;     // { id, lang, title, returnFocus, onClose, tier, data }
  let open_ = false;
  let seq = 0;
  let leaving = null;   // the closing animation, if any

  function injectStyle() {
    if (document.getElementById(ROOT_ID + '-style')) return;
    const style = el('style');
    style.id = ROOT_ID + '-style';
    style.textContent = CSS;
    (document.head || document.documentElement).append(style);
  }

  function build() {
    root = el('div');
    root.id = ROOT_ID;
    const backdrop = el('div', 'ttyx-backdrop');
    const panel = el('section', 'ttyx-panel', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ttyx-kicker ttyx-title', tabindex: '-1' });
    // A plain div: a <header> here would show up as a stray "banner" landmark inside the dialog.
    const head = el('div', 'ttyx-head');
    const kicker = el('p', 'ttyx-kicker', { id: 'ttyx-kicker' });
    const title = el('h2', 'ttyx-title', { id: 'ttyx-title' });
    const quip = el('p', 'ttyx-quip');
    // Named by its title alone (no aria-label), so the tooltip is not read a second time as a description.
    const close = el('button', 'ttyx-close', { type: 'button' });
    head.append(kicker, title, quip, close);
    const tabs = el('div', 'ttyx-tabs', { role: 'tablist' });
    const tabButtons = [0, 1, 2].map((i) => {
      const b = el('button', 'ttyx-tab', { type: 'button', role: 'tab', id: `ttyx-tab-${i}`, 'aria-controls': `ttyx-tier-${i}`, 'aria-selected': 'false', tabindex: '-1' });
      b.addEventListener('click', () => select(i, true));
      tabs.append(b);
      return b;
    });
    const bodies = [0, 1, 2].map((i) => el('div', 'ttyx-body', { id: `ttyx-tier-${i}`, tabindex: '0' }));
    const single = el('div', 'ttyx-body', { tabindex: '0' });
    const fade = el('div', 'ttyx-fade', { 'aria-hidden': 'true', hidden: '' });
    const stack = el('div', 'ttyx-stack');
    stack.append(...bodies, single, fade);
    // "Loading" and "on its way" are announced from here. The region is in the dialog from the
    // start and only its text changes, so screen readers pick the change up.
    const live = el('p', 'ttyx-sr', { role: 'status' });
    panel.append(head, tabs, stack, live);
    root.append(backdrop, panel);
    refs = { backdrop, panel, kicker, title, quip, close, tabs, tabButtons, bodies, single, stack, fade, live };

    close.addEventListener('click', () => api.close());
    backdrop.addEventListener('click', () => api.close());
    tabs.addEventListener('keydown', onTabKey);
    root.addEventListener('keydown', onKey);
    [...bodies, single].forEach((b) => b.addEventListener('scroll', updateFade, { passive: true }));
    if (window.ResizeObserver) new ResizeObserver(updateFade).observe(stack);
    // Nothing done inside the dialog should reach the page underneath (pages listen for clicks
    // and keys on window, e.g. "tap anywhere" or typing games).
    ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick',
      'touchstart', 'touchend', 'contextmenu', 'wheel'].forEach((type) => root.addEventListener(type, (e) => e.stopPropagation()));
    // The page behind never scrolls; only the sheet's own body does. (The document is also locked
    // while the dialog is open; this keeps a wheel or swipe on the panel from doing anything else.)
    const guard = (e) => {
      const body = e.target.closest && e.target.closest('.ttyx-body:not(.ttyx-off)');
      if (!body || body.scrollHeight <= body.clientHeight) e.preventDefault();
    };
    root.addEventListener('wheel', guard, { passive: false });
    root.addEventListener('touchmove', guard, { passive: false });
  }

  function focusables() {
    return [...refs.panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((n) => n.tabIndex >= 0 && !n.disabled && n.getClientRects().length && !n.closest('[hidden], .ttyx-off'));
  }

  // The explanation on screen (the selected tier, or the single body), if any.
  function shownBody() {
    if (!refs.single.hidden) return refs.single;
    return refs.tabs.hidden ? null : refs.bodies[state ? state.tier : 0];
  }

  // Scrolling keys pressed anywhere in the dialog (a tab, the close button) scroll the explanation,
  // never the page behind it. Inside the body itself the browser scrolls it as usual.
  const SCROLL_KEYS = { ArrowDown: 1, ArrowUp: -1, PageDown: 2, PageUp: -2, ' ': 2, Home: -3, End: 3 };
  function scrollKey(e) {
    let step = SCROLL_KEYS[e.key];
    if (step === undefined || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const body = shownBody();
    if (body && body.contains(e.target)) return;
    if (e.key === ' ' && e.target.closest && e.target.closest('button, a[href]')) return;
    e.preventDefault();
    if (!body) return;
    if (e.key === ' ' && e.shiftKey) step = -2;
    const behavior = reduce() ? 'auto' : 'smooth';
    if (Math.abs(step) === 3) body.scrollTo({ top: step < 0 ? 0 : body.scrollHeight, behavior });
    else body.scrollBy({ top: Math.sign(step) * (Math.abs(step) === 2 ? Math.max(40, body.clientHeight - 48) : 48), behavior });
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }
    if (e.key !== 'Tab') { scrollKey(e); return; }
    const items = focusables();
    if (!items.length) { e.preventDefault(); refs.panel.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === refs.panel || !refs.panel.contains(at))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !refs.panel.contains(at))) { e.preventDefault(); first.focus(); }
  }

  // Keys that start outside the dialog (focus dropped to <body>, say, while the content was being
  // swapped) are handled as if pressed inside it, and do not reach the page.
  function onDocKey(e) {
    if (!open_ || (root && root.contains(e.target))) return;
    e.stopPropagation();
    onKey(e);
  }

  // The fade at the bottom shows while the visible body has more to scroll.
  function updateFade() {
    if (!refs || !open_ || !state) return;
    const body = shownBody();
    const more = !!body && body.scrollHeight - body.scrollTop - body.clientHeight > 6;
    refs.fade.hidden = !more;
    if (more) refs.fade.style.marginRight = `${Math.max(0, body.offsetWidth - body.clientWidth)}px`;
  }

  /* While open: the document does not scroll and everything outside the dialog is inert. */
  const canInert = 'inert' in HTMLElement.prototype;
  let shelved = [];
  let lockSaved = null;
  function shelvePage() {
    const html = document.documentElement;
    const keep = (prop) => [html.style.getPropertyValue(prop), html.style.getPropertyPriority(prop)];
    lockSaved = { overflow: keep('overflow'), 'scrollbar-gutter': keep('scrollbar-gutter'), 'overscroll-behavior': keep('overscroll-behavior') };
    // A page with a classic scrollbar keeps its width, so nothing shifts sideways.
    if (innerWidth - html.clientWidth > 0) html.style.setProperty('scrollbar-gutter', 'stable', 'important');
    html.style.setProperty('overflow', 'hidden', 'important');
    html.style.setProperty('overscroll-behavior', 'none', 'important');
    shelved = [...document.body.children].filter((n) => n !== root && !/^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/.test(n.tagName)
      && !(canInert ? n.inert : n.getAttribute('aria-hidden') === 'true'));
    shelved.forEach((n) => { if (canInert) n.inert = true; else n.setAttribute('aria-hidden', 'true'); });
  }
  function unshelvePage() {
    shelved.forEach((n) => { if (canInert) n.inert = false; else n.removeAttribute('aria-hidden'); });
    shelved = [];
    if (!lockSaved) return;
    const html = document.documentElement;
    Object.keys(lockSaved).forEach((prop) => {
      const [value, priority] = lockSaved[prop];
      if (value) html.style.setProperty(prop, value, priority);
      else html.style.removeProperty(prop);
    });
    lockSaved = null;
  }

  let announceTimer = 0;
  function announce(text) {
    clearTimeout(announceTimer);
    refs.live.textContent = '';
    // A beat later, so the change is noticed even when the dialog has only just been added.
    if (text) announceTimer = setTimeout(() => { if (open_) refs.live.textContent = text; }, 150);
  }

  function onTabKey(e) {
    const shown = refs.tabButtons.filter((b) => !b.hidden);
    const at = shown.indexOf(document.activeElement);
    if (at < 0) return;
    let to = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (at + 1) % shown.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (at - 1 + shown.length) % shown.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = shown.length - 1;
    if (to === null) return;
    e.preventDefault();
    select(refs.tabButtons.indexOf(shown[to]), true);
  }

  // Focus that wanders out of the open dialog (a click elsewhere, a page script) is brought back.
  function onFocusIn(e) {
    if (open_ && root && !root.contains(e.target)) {
      const items = focusables();
      (items[0] || refs.panel).focus({ preventScroll: true });
    }
  }

  function select(i, focus) {
    if (!state) return;
    state.tier = i;
    refs.tabButtons.forEach((b, j) => {
      b.setAttribute('aria-selected', String(j === i));
      b.tabIndex = j === i ? 0 : -1;
    });
    refs.bodies.forEach((b, j) => { b.classList.toggle('ttyx-off', j !== i); });
    refs.bodies[i].scrollTop = 0;
    if (focus) refs.tabButtons[i].focus();
    updateFade();
  }

  // own(node) marks explanation text that is in the other language (only the other language's
  // explanation exists); headings, notes and screen-reader text stay in the interface language.
  function linkItem(link, lang, t, own) {
    const li = el('li');
    const url = String(link.url || '');
    if (!/^https?:\/\//i.test(url)) return null;
    const a = el('a', 'ttyx-a', { href: url, target: '_blank', rel: 'noopener noreferrer' });
    a.append(own(rich('span', '', link.title || url.replace(/^https?:\/\/(www\.)?/, ''))), el('span', 'ttyx-sr'));
    a.lastChild.textContent = ` (${t.newTab})`;
    li.append(a);
    const linkLang = link.lang || lang;
    if (linkLang !== state.lang && t.langName[linkLang]) {
      const tag = el('span', 'ttyx-lang');
      tag.textContent = `(${t.langName[linkLang]})`;
      li.append(tag);
    }
    if (link.note) li.append(own(rich('span', 'ttyx-note', link.note)));
    return li;
  }

  function fill(body, content, lang, tier, t, aside) {
    body.replaceChildren();
    body.setAttribute('lang', state.lang);
    const own = (node) => { if (lang !== state.lang) node.setAttribute('lang', lang); return node; };
    if (aside) { const p = el('p', 'ttyx-aside'); p.textContent = aside; body.append(p); }
    const heading = (text) => { const h = el('h3', 'ttyx-h'); h.textContent = text; body.append(h); };
    const bullets = (items, cls) => {
      const ul = el(cls === 'ttyx-deep' ? 'ol' : 'ul', 'ttyx-list' + (cls ? ' ' + cls : ''));
      items.forEach((item) => { if (item) ul.append(own(rich('li', '', item))); });
      body.append(ul);
    };
    if (tier === 0) {
      if (content.line) body.append(own(rich('p', 'ttyx-line', content.line)));
      if (content.points.length) { heading(t.points); bullets(content.points); }
    } else if (tier === 1) {
      const terms = content.terms.filter((x) => x && x.term);
      if (terms.length) {
        heading(t.terms);
        const dl = el('dl', 'ttyx-terms');
        terms.forEach((x) => {
          const row = own(el('div', 'ttyx-term'));
          row.append(rich('dt', '', x.term), rich('dd', '', x.plain || ''));
          dl.append(row);
        });
        body.append(dl);
      }
      const links = content.links.map((x) => x && linkItem(x, lang, t, own)).filter(Boolean);
      if (links.length) {
        heading(t.links);
        const ul = el('ul', 'ttyx-list ttyx-links');
        ul.append(...links);
        body.append(ul);
      }
    } else {
      heading(t.deep);
      bullets(content.deep, 'ttyx-deep');
    }
    if (state.data && state.data.updated) {
      const meta = el('p', 'ttyx-meta');
      meta.textContent = t.updated(state.data.updated);
      body.append(meta);
    }
  }

  // "Loading" or "on its way". What is drawn is hidden from screen readers; the same words are
  // announced through the dialog's status region instead (and stay readable there).
  function message(kind) {
    const t = TEXT[state.lang];
    refs.tabs.hidden = true;
    refs.bodies.forEach((b) => { b.hidden = true; });
    refs.single.hidden = false;
    refs.single.replaceChildren();
    refs.single.setAttribute('lang', state.lang);
    refs.single.removeAttribute('role');
    if (kind === 'loading') {
      const p = el('p', 'ttyx-loading', { 'aria-hidden': 'true' });
      p.textContent = t.loading;
      refs.single.append(p);
      announce(t.loading);
      return;
    }
    const box = el('div', 'ttyx-empty', { 'aria-hidden': 'true' });
    const face = el('span', 'ttyx-empty-face');
    face.textContent = ':)';
    const title = el('p', 'ttyx-empty-title');
    title.textContent = t.missing;
    const more = el('p', 'ttyx-empty-more');
    more.textContent = t.missingMore;
    box.append(face, title, more);
    refs.single.append(box);
    announce(`${t.missing}. ${t.missingMore}`);
  }

  function renderHead() {
    const t = TEXT[state.lang];
    root.setAttribute('lang', state.lang);
    refs.kicker.textContent = t.ask;
    refs.quip.textContent = t.quip;
    refs.close.title = t.close;
    refs.tabs.setAttribute('aria-label', t.tiers);
    refs.tabButtons.forEach((b, i) => { b.textContent = t.tabs[i]; });
    const data = state.data;
    const title = state.title || (data && data.title && (data.title[state.lang] || data.title.en)) || '';
    refs.title.textContent = title || ' ';
    if (!title) {
      const mine = seq;
      pageTitle(state.id, state.lang).then((found) => { if (mine === seq && found && !state.title) refs.title.textContent = found; });
    }
  }

  function render() {
    draw();
    keepFocus();
    updateFade();
  }

  function draw() {
    renderHead();
    const data = state.data;
    if (data === undefined) return message('loading');
    announce('');
    const t = TEXT[state.lang];
    const other = state.lang === 'ko' ? 'en' : 'ko';
    let lang = state.lang;
    let content = part(data && data[lang]);
    let aside = '';
    if (!filled(content) && data && filled(part(data[other]))) {
      lang = other;
      content = part(data[other]);
      aside = t.onlyOther;
    }
    if (!data || !filled(content)) return message('missing');
    const tiers = [
      !!(content.line || content.points.length),
      !!(content.terms.some((x) => x && x.term) || content.links.length),
      !!content.deep.some(Boolean),
    ];
    const available = [0, 1, 2].filter((i) => tiers[i]);
    if (available.length === 1) {
      refs.tabs.hidden = true;
      refs.bodies.forEach((b) => { b.hidden = true; });
      refs.single.hidden = false;
      fill(refs.single, content, lang, available[0], t, aside);
      state.tier = available[0];
      return;
    }
    refs.single.hidden = true;
    refs.tabs.hidden = false;
    refs.tabButtons.forEach((b, i) => { b.hidden = !tiers[i]; });
    refs.bodies.forEach((b, i) => {
      b.hidden = !tiers[i];
      b.setAttribute('role', 'tabpanel');
      b.setAttribute('aria-labelledby', `ttyx-tab-${i}`);
      if (tiers[i]) fill(b, content, lang, i, t, i === available[0] ? aside : '');
      else b.replaceChildren();
    });
    select(tiers[state.tier] ? state.tier : available[0], false);
  }

  function settleFocus() {
    if (!open_) return;
    const at = document.activeElement;
    if (at && at !== refs.panel && refs.panel.contains(at) && !at.closest('[hidden], .ttyx-off')) return;
    const tab = refs.tabs.hidden ? null : refs.tabButtons[state.tier];
    (tab || refs.close).focus({ preventScroll: true });
  }

  // A redraw can hide the element that had focus (the tabs, while another page's explanation
  // loads); focus then waits on the panel instead of falling out to the page.
  function keepFocus() {
    if (!open_) return;
    const at = document.activeElement;
    if (at && refs.panel.contains(at) && !at.closest('[hidden]')) return;
    refs.panel.focus({ preventScroll: true });
  }

  function animateIn() {
    if (reduce()) return;
    const easing = 'cubic-bezier(.2, .9, .3, 1)';
    refs.backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    refs.panel.animate(phone()
      ? [{ transform: 'translateY(100%)' }, { transform: 'none' }]
      : [{ opacity: 0, transform: 'translateY(14px) scale(.97)' }, { opacity: 1, transform: 'none' }],
    { duration: phone() ? 320 : 240, easing });
  }

  function finishLeaving() {
    if (!leaving) return;
    leaving.forEach((a) => a.cancel());
    leaving = null;
    if (root && !open_) root.remove();
  }

  const api = {
    open(options) {
      const opts = options || {};
      const id = String(opts.id || '');
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) return;
      let lang = opts.lang;
      if (lang !== 'ko' && lang !== 'en') lang = /^ko\b/i.test(document.documentElement.lang || '') ? 'ko' : 'en';
      injectStyle();
      if (!root) build();
      finishLeaving();
      const wasOpen = open_;
      const previous = state;
      state = {
        id,
        lang,
        title: opts.title || (wasOpen && previous.id === id && previous.lang === lang ? previous.title : ''),
        returnFocus: opts.returnFocus || (wasOpen ? previous.returnFocus : document.activeElement),
        onClose: opts.onClose || (wasOpen ? previous.onClose : null),
        tier: wasOpen && previous.id === id ? previous.tier : 0,
        // Same page again (a language switch, the stage reloading it): keep what is on screen
        // while the data is re-read, so the tabs and the focus on them do not flicker away.
        data: wasOpen && previous.id === id ? previous.data : undefined,
      };
      const mine = ++seq;
      if (!wasOpen) {
        open_ = true;
        document.body.append(root);
        shelvePage();
        document.addEventListener('focusin', onFocusIn, true);
        document.addEventListener('keydown', onDocKey, true);
        addEventListener('resize', updateFade);
        refs.panel.focus({ preventScroll: true });
        animateIn();
      }
      render();
      load(id).then((data) => {
        if (mine !== seq) return;
        state.data = data;
        render();
        settleFocus();
      });
    },

    close() {
      if (!open_) return;
      open_ = false;
      seq++;
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('keydown', onDocKey, true);
      removeEventListener('resize', updateFade);
      clearTimeout(announceTimer);
      refs.live.textContent = '';
      unshelvePage();
      const { returnFocus, onClose } = state;
      if (reduce()) root.remove();
      else {
        const panelOut = refs.panel.animate(phone()
          ? [{ transform: 'none' }, { transform: 'translateY(100%)' }]
          : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px) scale(.98)' }],
        { duration: 170, easing: 'ease-in', fill: 'forwards' });
        const backOut = refs.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 170, easing: 'ease-in', fill: 'forwards' });
        leaving = [panelOut, backOut];
        panelOut.finished.then(() => { if (leaving && leaving[0] === panelOut) finishLeaving(); }, () => {});
      }
      if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
        returnFocus.focus({ preventScroll: true });
        // The opener should be where the visitor left it; if it is not on screen any more, bring it back.
        const r = returnFocus.getBoundingClientRect();
        if ((r.width || r.height) && (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth)) {
          returnFocus.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
      // The opener is gone (the home stage moved on): focus must not stay in the leaving dialog.
      if (root.contains(document.activeElement)) document.activeElement.blur();
      state = null;
      if (typeof onClose === 'function') onClose();
    },

    isOpen: () => open_,
  };

  window.TTYExplain = api;
})();
