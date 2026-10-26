/* tty.link page kit. Every page under /pages/ loads this first in <head>, before font-kku.
 *
 *   TTY.lang       'en' | 'ko' — from ?lang=, then the visitor's pick, then the browser
 *   TTY.t({en, ko}) the value for the current language
 *   TTY.reduce     true when the visitor asked for less motion
 *   TTY.embedded   true inside the home page's stage
 *   TTY.onShow(fn) run fn when the page is actually on screen. On the home page a page is
 *                  loaded hidden a few seconds early; start timelines here, not on load.
 *                  Opened on its own, a page is on screen at once: fn runs right after the
 *                  page's script, before the load and the fonts.
 *   TTY.drawn      a promise, settled once the page has loaded with its fonts (at most 2.5 s
 *                  after the kit starts). A timeline whose first second matters, or that
 *                  measures text, waits for it: TTY.onPlay(play) (the same as
 *                  TTY.onShow(() => TTY.drawn.then(play)), and it marks 'tty-play').
 *                  On the home stage it has nearly always settled by the time the page is shown.
 *   TTY.onPlay(fn) TTY.onShow, then TTY.drawn, then fn: the start for a timeline whose first
 *                  second matters or that measures text. Marks 'tty-play' (below).
 *   TTY.timeline(fn, { punch }) a timeline a visitor can pause but never break: fn(t) awaits
 *                  t.at(ms) / t.wait(ms) in autoplay time, which stands still while the visitor is
 *                  busy; a run that was stopped or started again never resumes; with TTY.reduce every
 *                  wait resolves at once, so it ends on the autoplay's own last scene. See below.
 *   TTY.readMs(text, min) how long a line must stay fully shown to be read, in ms: Korean 8 letters
 *                  a second (spaces not counted), English 3 words a second, never under min (2000)
 *   TTY.busy(ms)   the visitor is doing something: every timeline stands still for ms (2500).
 *                  The visitor's own pointerdown and keydown already call it.
 *   TTY.ready()    tell the home page this page has drawn and can be shown
 *   TTY.hold(ms)   ask the home page to keep this page up a little longer (someone is playing).
 *                  Every pointerdown and keydown already sends TTY.hold(12000); call it only to ask
 *                  for longer.
 *
 * Markup for one language only goes in an element with data-lang="en" or data-lang="ko";
 * the other language's elements are removed before the page draws.
 *
 * For the page checker, which counts a page's time from its start and judges its copy:
 *   performance marks  'tty-show' when the page is first on screen (onShow runs, or the home page
 *                  shows it) and 'tty-play' when a timeline starts (TTY.onPlay, TTY.timeline).
 *                  Time 0 is the first 'tty-play', else 'tty-show', else DOMContentLoaded.
 *   data-tty-line  on the copy that carries the joke: "punch", "setup" or "tag" (set it in JS too
 *                  when a line is built at run time); "title" on a title that is not an h1–h3;
 *                  "decor" on lettering inside a prop that is not meant to be read (a fridge
 *                  screen, a coin) and on montage lines whose speed is the joke. None of these
 *                  change how the page looks or plays.
 */
(() => {
  const params = new URLSearchParams(location.search);
  const embedded = window.parent !== window;

  let lang = params.get('lang');
  if (lang !== 'en' && lang !== 'ko') {
    let picked = null;
    try { picked = localStorage.getItem('tty.lang'); } catch (e) { /* storage blocked */ }
    const langs = navigator.languages || [navigator.language || 'en'];
    lang = picked === 'en' || picked === 'ko' ? picked : langs.some((l) => /^ko\b/i.test(l)) ? 'ko' : 'en';
  }

  const root = document.documentElement;
  root.lang = lang;

  // font-kku spaces words and lines with margins inside its own cascade layers. A page reset
  // like `* { margin: 0 }` sits outside any layer and would win; hand those boxes back.
  const guard = document.createElement('style');
  guard.textContent = 'font-kku *, .font-kku * { margin: revert-layer; padding: revert-layer; box-sizing: revert-layer; }';
  document.head.append(guard);
  root.classList.add('lang-' + lang);
  if (embedded) root.classList.add('embedded');

  const post = (message) => {
    if (embedded) parent.postMessage(Object.assign({ source: 'tty-page' }, message), location.origin);
  };

  // Until the page has its styles, fonts and pictures, its layout is not what it will be: a
  // timeline started earlier plays its first second in fallback fonts and measures the wrong
  // boxes. Fonts are asked for once the page lays out, so they are awaited after the load.
  // (onShow itself does not wait on its own: several pages draw their last scene first and set
  // the opening up in onShow, and that would show for a moment.)
  const loaded = document.readyState === 'complete' ? Promise.resolve()
    : new Promise((resolve) => addEventListener('load', resolve, { once: true }));
  const drawn = Promise.race([
    loaded.then(() => (document.fonts ? document.fonts.ready : null)),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]).then(() => {});
  let shown = !embedded;
  const showQueue = [];
  // 'tty-show': the moment the page is first on screen (see the top). Marked once.
  let marked = false;
  const markShown = () => {
    if (marked) return;
    marked = true;
    try { performance.mark('tty-show'); } catch (e) { /* old browsers */ }
  };
  const TTY = {
    lang,
    embedded,
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
    t: (pair) => (pair[lang] !== undefined ? pair[lang] : pair.en),
    // How long a line must stay fully shown to be read, in ms. Korean: letters without spaces / 8 a
    // second; English: words / 3 a second; never under `min`. say(line, TTY.readMs(line)), not 1800.
    readMs: (text, min = 2000) => {
      const s = String(text == null ? '' : text).replace(/<[^>]*>/g, ' ');
      const n = /[\uac00-\ud7a3]/.test(s) ? s.replace(/\s/g, '').length / 8
        : s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length / 3;
      return Math.max(min, Math.ceil(n * 1000));
    },
    onShow(fn) {
      if (shown) setTimeout(() => { markShown(); fn(); }, 0);
      else showQueue.push(fn);
    },
    drawn,
    ready: () => post({ type: 'ready' }),
    hold: (ms) => post({ type: 'hold', ms: ms || 12000 }),
  };
  window.TTY = TTY;

  // ---- timelines a visitor can pause but never break ---------------------------------------------
  // Time the visitor spends touching or typing does not count as autoplay time: their pointerdown
  // or keydown makes the page "busy" for 2.5 s (TTY.busy(ms) for longer), and timelines stand still
  // while it is busy. Events a page dispatches itself (an autoplay "tap") do not count.
  let busyStart = 0, busyEnd = 0, busyDone = 0;
  const busyUpTo = (t) => busyDone + Math.max(0, Math.min(t, busyEnd) - busyStart);
  const timelines = new Set();
  const busy = (ms) => {
    const now = performance.now();
    if (now > busyEnd) { busyDone += busyEnd - busyStart; busyStart = now; }
    busyEnd = Math.max(busyEnd, now + (ms || 2500));
    timelines.forEach((run) => run.held());
  };
  ['pointerdown', 'keydown'].forEach((type) => addEventListener(type, (e) => { if (e.isTrusted) busy(); }, { capture: true, passive: true }));
  TTY.busy = busy;

  // const play = TTY.timeline(async (t) => {
  //   await t.at(800); show(cat);        // 0.8 s of autoplay after the start
  //   await t.wait(1200); show(bubble);  // 1.2 s after the step before
  //   await fetchSomething(); if (!t.live()) return;   // any other await: check live()
  // }, { punch: 14.8 });
  // TTY.onPlay(play.start);             // or play.start() from a reset; play.stop() when the visitor takes over for good
  //
  // · at(ms) and wait(ms) count autoplay time, so a tap delays the autoplay instead of racing it.
  //   at() is measured from the start, so one late step does not push every later step back.
  // · A stopped run (stop(), or start() again) never resumes: its pending at()/wait() never resolve,
  //   so an old run cannot write over a new run or over what the visitor made.
  // · With TTY.reduce every at()/wait() resolves at once: the run ends on the same last scene the
  //   autoplay ends on. Draw that scene, not a separate one (give animations TTY.reduce ? 0 : ms).
  //   t.now() is then the autoplay time those waits reached, so a loop that runs until t.now() passes
  //   a time ends as it does in autoplay. A loop that never ends (a ticker) is stopped after 5000 such
  //   waits; give it its own TTY.reduce branch.
  // · { punch } is when the punch lands, in seconds of autoplay: while it is still to come, a pause
  //   asks the home page (TTY.hold) for enough time that it still lands with 3 s to read it.
  // · t.live() is false once the run is stopped, t.now() is its autoplay time so far (ms);
  //   play.live() is true from start() until stop().
  // · start() marks 'tty-play' (performance.mark), the page's time 0 for the checker.
  TTY.timeline = (fn, opts = {}) => {
    let current = null;
    const control = {
      start() {
        if (current) current.stop();
        const t0 = performance.now(), b0 = busyUpTo(t0);
        const clock = (now = performance.now()) => now - t0 - (busyUpTo(now) - b0);
        // With TTY.reduce no time passes: `reached` is the autoplay time the waits have jumped to.
        let alive = true, skipped = 0, reached = 0;
        const autoplay = () => (TTY.reduce ? reached : clock());
        const run = {
          stop() { alive = false; timelines.delete(run); },
          held() {
            if (!alive || !opts.punch) return;
            const now = performance.now(), left = opts.punch * 1000 - autoplay();
            if (left > 0) TTY.hold(left + (busyEnd - now) + 3000);
          },
        };
        const until = (target) => new Promise((resolve) => {
          const step = () => {
            if (!alive) return; // stopped: never resolves
            if (TTY.reduce) {
              if (++skipped > 5000) run.stop();
              else { reached = Math.max(reached, target); resolve(); }
              return;
            }
            const left = target - clock();
            if (left <= 0) resolve();
            else setTimeout(step, Math.min(Math.max(left, 4), 50));
          };
          step();
        });
        const t = {
          at: (ms) => until(ms),
          wait: (ms) => until(autoplay() + ms),
          live: () => alive,
          now: autoplay,
        };
        current = run;
        timelines.add(run);
        // a press just before the start already stands this run still: ask for its time too
        if (busyEnd > t0) run.held();
        try { performance.mark('tty-play'); } catch (e) { /* old browsers */ }
        Promise.resolve().then(() => fn(t)).catch((e) => setTimeout(() => { throw e; }));
        return t;
      },
      stop() { if (current) current.stop(); },
      live: () => !!current && timelines.has(current),
    };
    control.start = control.start.bind(control);
    return control;
  };
  // onShow, then wait for the fonts (TTY.drawn): for a timeline whose first second matters or that
  // measures text. Marks 'tty-play' when fn starts.
  TTY.onPlay = (fn) => TTY.onShow(() => drawn.then(() => { try { performance.mark('tty-play'); } catch (e) { /* */ } fn(); }));

  addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== parent || !event.data || event.data.source !== 'tty-home') return;
    if (event.data.type === 'show' && !shown) {
      shown = true;
      markShown();
      showQueue.splice(0).forEach((fn) => fn());
    }
  });

  // Someone touching or typing in a page wants it to stay.
  ['pointerdown', 'keydown'].forEach((type) => addEventListener(type, () => TTY.hold(), { passive: true }));

  // On the home stage, "?" asks the home page to explain this page (focus is often in here after a
  // click or a Tab). Not while typing in a field, and not when the page used the key itself
  // (called preventDefault, e.g. a typing game); that is known only once its own handlers have run.
  if (embedded) {
    addEventListener('keydown', (event) => {
      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const t = event.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      setTimeout(() => { if (!event.defaultPrevented) post({ type: 'ask' }); }, 0);
    });
  }

  // Elements for the other language are removed as the parser inserts them, so a page's
  // own script (which runs before DOMContentLoaded) only ever sees the current language.
  const dropOtherLanguage = (root) => {
    if (root.nodeType !== 1) return;
    if (root.hasAttribute('data-lang') && root.getAttribute('data-lang') !== lang) { root.remove(); return; }
    root.querySelectorAll('[data-lang]').forEach((el) => { if (el.getAttribute('data-lang') !== lang) el.remove(); });
  };
  const parsing = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(dropOtherLanguage)));
  parsing.observe(root, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', () => {
    parsing.disconnect();
    document.querySelectorAll('[data-lang]').forEach((el) => {
      if (el.getAttribute('data-lang') !== lang) el.remove();
    });

    // Opened on its own (a shared link, or from the all-pages list), a page gets a quiet
    // way back to the home page and to the list. Up to 900px wide (phones either way up,
    // tablets, narrow windows) it folds into a small ":)" button so it does not cover the
    // page; tapping it shows the two links. (Unfolded it is about 290px wide: on a 648px
    // window that is the corner of nearly half the width, and it covered titles and hints.)
    // A "?" explains the joke ("이게 왜 웃겨요?"); it loads /assets/tty-explain.js only when
    // pressed. It sits right beside the corner: after "tty.link :)" on wide screens, and on
    // phones next to ":)" and outside the fold, so opening the fold adds the links to the
    // left without moving it. Its footprint is about 290×46px on wide screens and 84×50px
    // folded.
    // The nav sits at the bottom right unless the page has more there than in another corner:
    // see `placeNav` below. A page can also pin it to a corner, and then it is not moved:
    //   <html data-tty-nav="top">          top right   ("left": bottom left, "top left": top left,
    //                                                   "bottom right": the bottom right)
    //   <html data-tty-nav-phone="top">    the same, only where the nav is folded (up to 900px wide);
    //                                      it wins over data-tty-nav there ("auto": let the kit pick)
    // Both are read again when they change and when the window is resized.
    if (!embedded) {
      const style = document.createElement('style');
      style.textContent = [
        '.tty-nav{position:fixed;right:12px;bottom:12px;left:auto;top:auto;z-index:2147483647;display:flex;gap:6px;align-items:center;margin:0;padding:0}',
        '.tty-nav a,.tty-nav button{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:30px;margin:0;padding:4px 10px;border:0;border-radius:999px;background:#ffd84a;color:#1b2b7a;',
        'font:600 13px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:0;text-transform:none;text-decoration:none;cursor:pointer;',
        'box-shadow:0 0 0 1px rgba(27,43,122,.25),0 2px 8px rgba(0,0,0,.15)}',
        // Hangul has no monospace face; the sans stack keeps "전체 보기" from getting a wide gap.
        "html:lang(ko) .tty-nav a{font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif}",
        '.tty-nav a:focus-visible,.tty-nav button:focus-visible{outline:3px solid #1b2b7a;outline-offset:2px;box-shadow:0 0 0 5px #fff}',
        '.tty-nav .tty-nav-ask{width:30px;height:30px;padding:0;font-size:15px;font-weight:800}',
        '.tty-nav .tty-nav-menu{display:none;width:34px;height:34px;padding:0}',
        '.tty-nav.tty-nav-wait{visibility:hidden}',
        // The corner is data-at ("top", "left", "top left"; none = bottom right), set by the script
        // from the page's pin or its own choice, so a pin can differ by width.
        '.tty-nav[data-at~="top"]{top:12px;bottom:auto}',
        '.tty-nav[data-at~="left"]{left:12px;right:auto;flex-direction:row-reverse}',
        '@media (max-width:900px){.tty-nav{right:8px;bottom:8px}.tty-nav .tty-nav-menu{display:inline-flex}',
        '.tty-nav[data-at~="top"]{top:8px}.tty-nav[data-at~="left"]{left:8px}',
        '.tty-nav .tty-nav-ask{width:34px;height:34px}.tty-nav:not(.open) a{display:none}}',
      ].join('');
      document.head.append(style);
      const bar = document.createElement('nav');
      bar.className = 'tty-nav';
      bar.setAttribute('aria-label', 'tty.link');
      const link = (href, text) => Object.assign(document.createElement('a'), { href, textContent: text });
      const home = link('https://tty.link/', 'tty.link :)');
      home.setAttribute('aria-label', 'tty.link');
      bar.append(link('/all/?lang=' + lang, lang === 'ko' ? '전체 보기' : 'All pages'), home);
      const page = (location.pathname.match(/\/pages\/([a-z0-9][a-z0-9-]*?)(?:\.html)?\/?$/i) || [])[1];
      if (page) {
        const ask = document.createElement('button');
        ask.type = 'button';
        ask.className = 'tty-nav-ask';
        // Named by its title (the "?" itself is hidden from screen readers), so the tooltip
        // is not read a second time as a description.
        const mark = document.createElement('span');
        mark.textContent = '?';
        mark.setAttribute('aria-hidden', 'true');
        ask.append(mark);
        ask.title = lang === 'ko' ? '이게 왜 웃겨요?' : 'Why is this funny?';
        ask.setAttribute('aria-haspopup', 'dialog');
        let script = null;
        ask.addEventListener('click', () => {
          script = script || new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = '/assets/tty-explain.js';
            s.onload = resolve;
            s.onerror = () => { script = null; reject(); };
            document.head.append(s);
          });
          script.then(() => window.TTYExplain && window.TTYExplain.open({ id: page, lang, returnFocus: ask }), () => {});
        });
        bar.append(ask);
      }
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'tty-nav-menu';
      toggle.textContent = ':)';
      toggle.setAttribute('aria-label', lang === 'ko' ? 'tty.link 메뉴' : 'tty.link menu');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        const open = bar.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      bar.append(toggle);
      document.body.append(bar);

      // placeNav: pages differ in what they keep in their corners (a button, a punchline, a
      // ticker), so the nav looks at what lies under its footprint in each corner and takes the
      // quietest. Counted: text (the boxes of its lines, not the whole element; font-kku
      // lettering by the boxes of its words), controls and small pictures (an icon, a
      // character; least, as a picture with a corner hidden still reads), as far as overflow
      // clipping lets them show. A backdrop, or a whole scene that reacts to a tap, is not
      // something the nav could hide. Transparent elements count too, so a line that fades in
      // later already keeps the nav away; what is not there yet (display: none, visibility:
      // hidden, text still to be written, an element still to be placed) cannot. Each element
      // is remembered at the most it has covered of each corner; one that is nearly always found
      // moving (a ticker, a wandering bug) passes under the nav and shows elsewhere, so it counts
      // a quarter. The nav moves only to a clearly quieter corner and never back to one it has
      // left, so it settles instead of chasing the page. It looks while the page builds and
      // plays its opening (about 25 s) and again after a resize, but never moves while the
      // visitor is using it, and not at all while the page pins it.
      {
        const SPOTS = ['', 'top', 'left', 'top left']; // in order of preference on a tie
        const WEIGHT = { text: 2, control: 3, picture: 0.5 };
        const CONTROL = 'a[href],button,input,select,textarea,label,summary,[role=button],[role=link],[role=slider],[role=tab],[tabindex]:not([tabindex="-1"])';
        const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|HEAD)$/;
        const KKU = 'data-fy-upgraded'; // on a <font-kku> (or .font-kku) once it has drawn its letters
        const folded = matchMedia('(max-width: 900px)'); // the nav's own fold, in the style above
        // The corner the page pins the nav to at this width (one of SPOTS), or null.
        const pin = () => {
          const own = folded.matches && root.hasAttribute('data-tty-nav-phone')
            ? root.getAttribute('data-tty-nav-phone') : root.getAttribute('data-tty-nav');
          if (own === null || own.trim() === 'auto') return null;
          const words = own.trim().split(/\s+/);
          return ['top', 'left'].filter((w) => words.includes(w)).join(' ');
        };
        const range = document.createRange();
        let was, held, spot, gone;
        // was: element -> where it was at the last look; held: element -> { parts: most covered
        // per corner, moving, still }; spot: index in SPOTS; gone: corners the nav has left.
        const forget = () => { was = new WeakMap(); held = new Map(); spot = 0; gone = new Set(); };
        forget();

        const look = (boxes) => {
          const screen = innerWidth * innerHeight;
          const footprint = (boxes[0].right - boxes[0].left) * (boxes[0].bottom - boxes[0].top);
          const meets = (q) => boxes.some((b) => q.right > b.left && q.left < b.right && q.bottom > b.top && q.top < b.bottom);
          // What of q its ancestors' overflow clipping leaves on screen; null if nothing.
          const shown = (q, el, own) => {
            let { left, top, right, bottom } = q;
            for (let n = el; n && n !== document.body; n = n.parentElement) {
              const cs = getComputedStyle(n);
              if (n === el && cs.visibility === 'hidden') return null;
              if ((n !== el || !own) && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')) {
                const c = n.getBoundingClientRect();
                left = Math.max(left, c.left); top = Math.max(top, c.top);
                right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom);
                if (right <= left || bottom <= top) return null;
              }
              if (cs.position === 'fixed') break;
            }
            return { left, top, right, bottom };
          };
          const now = new Map(); // element -> what it covers of each corner in this look
          const add = (el, q, weight) => boxes.forEach((b, k) => {
            const w = Math.min(q.right, b.right) - Math.max(q.left, b.left);
            const h = Math.min(q.bottom, b.bottom) - Math.max(q.top, b.top);
            if (w <= 0 || h <= 0) return;
            if (!now.has(el)) now.set(el, boxes.map(() => 0));
            now.get(el)[k] += w * h * weight;
          });
          const motion = new Map(); // element -> moved since the last look (true/false)
          // font-kku draws its letters as empty boxes (the real text is a screen-reader copy), so
          // its insides are not walked: the lettering is counted at its host, below.
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => (n === bar || (n.nodeType === 1 && (SKIP.test(n.tagName) || n.id === 'tty-explain'
              || (n.parentElement && n.parentElement.hasAttribute(KKU))))
              ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
          });
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.nodeType === 3) {
              if (!n.data.trim()) continue;
              range.selectNodeContents(n);
              for (const q of range.getClientRects()) {
                const v = meets(q) && shown(q, n.parentElement, false);
                if (v) add(n.parentElement, v, WEIGHT.text);
              }
              continue;
            }
            const q = n.getBoundingClientRect();
            const before = was.get(n);
            was.set(n, [q.left, q.top]);
            if (before) motion.set(n, Math.abs(before[0] - q.left) + Math.abs(before[1] - q.top) > 4);
            if (n.hasAttribute(KKU)) {
              const words = n.querySelectorAll('[part~="word"]');
              for (const w of words.length ? words : [n]) {
                const r = w.getBoundingClientRect();
                const v = meets(r) && shown(r, w, false);
                if (v) add(n, v, WEIGHT.text);
              }
              continue;
            }
            if (!meets(q)) continue;
            const area = q.width * q.height;
            const tag = n.tagName.toLowerCase();
            let kind = null;
            if (n.matches(CONTROL) || (getComputedStyle(n).cursor === 'pointer'
              && !(n.parentElement && getComputedStyle(n.parentElement).cursor === 'pointer'))) {
              if (area < screen / 4) kind = 'control';
            } else if (/^(img|video|canvas|picture)$/.test(tag) || (tag === 'svg' && !n.ownerSVGElement)) {
              if (area < footprint * 4) kind = 'picture';
            }
            const v = kind && shown(q, n, true);
            if (v) add(n, v, WEIGHT[kind]);
          }
          now.forEach((parts, el) => {
            const h = held.get(el) || { parts: boxes.map(() => 0), moving: 0, still: 0 };
            parts.forEach((p, k) => { h.parts[k] = Math.max(h.parts[k], p); });
            if (motion.has(el)) { if (motion.get(el)) h.moving++; else h.still++; }
            held.set(el, h);
          });
        };

        // How busy each corner has been, for a nav of the current size; null while unseen.
        const measure = () => {
          const r = bar.getBoundingClientRect();
          if (!r.width) return null;
          const inset = folded.matches ? 8 : 12;
          const pad = 4; // a little air between the nav and the page's text
          const W = root.clientWidth, H = root.clientHeight;
          look(SPOTS.map((s) => {
            const left = /left/.test(s) ? inset : W - inset - r.width;
            const top = /top/.test(s) ? inset : H - inset - r.height;
            return { left: left - pad, top: top - pad, right: left + r.width + pad, bottom: top + r.height + pad };
          }));
          const score = SPOTS.map(() => 0);
          held.forEach((h) => {
            const share = h.moving > 2 * h.still ? 0.25 : 1;
            h.parts.forEach((p, k) => { score[k] += p * share; });
          });
          return score;
        };

        const setAt = (at, fade) => {
          if ((bar.dataset.at || '') === at) return;
          if (at) bar.dataset.at = at; else delete bar.dataset.at;
          if (fade && !TTY.reduce && bar.animate && !bar.classList.contains('tty-nav-wait')) {
            bar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
          }
        };

        let pinned = pin();
        const placeNav = () => {
          if (pinned !== null || bar.classList.contains('open') || bar.matches(':hover, :focus-within')
            || (window.TTYExplain && window.TTYExplain.isOpen())) return;
          const score = measure();
          if (!score) return;
          let best = spot;
          score.forEach((s, k) => { if (!gone.has(k) && s < score[best]) best = k; });
          // Move only to a clearly quieter corner: a third quieter, and by more than a few
          // letters' worth.
          if (score[best] + Math.max(160, score[spot] / 3) < score[spot]) { gone.add(spot); spot = best; }
          setAt(SPOTS[spot], true);
        };

        let until = 0, timer = 0;
        const watch = (ms) => {
          until = Math.max(until, Date.now() + ms);
          if (!timer) timer = setInterval(() => {
            if (!document.hidden) placeNav();
            if (Date.now() > until || pinned !== null) { clearInterval(timer); timer = 0; }
          }, 1500);
        };
        // A pinned nav is in its corner from the start. Otherwise, until the page has its styles,
        // fonts and pictures its corners are not what they will be, so the nav waits unseen for
        // TTY.drawn (load and fonts, at most 2.5 s). Then it looks twice, a second apart, to tell
        // what moves, and appears in its place.
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          if (pinned !== null) return;
          measure();
          setTimeout(() => {
            if (pinned !== null) return; // pinned meanwhile: already shown in its corner
            placeNav();
            if (bar.classList.contains('tty-nav-wait')) {
              bar.classList.remove('tty-nav-wait');
              if (!TTY.reduce && bar.animate) bar.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
            }
            watch(25000);
          }, 1000);
        };
        if (pinned !== null) setAt(pinned, false);
        else bar.classList.add('tty-nav-wait');
        drawn.then(settle);
        // A new size (a phone turned, a window resized) is a new layout: forget the corners and
        // start over from the bottom right. A pin that changes (or differs at the new width)
        // simply moves the nav there.
        let again = 0;
        const restart = () => {
          clearTimeout(again);
          again = setTimeout(() => {
            const before = pinned;
            pinned = pin();
            if (pinned !== null) {
              bar.classList.remove('tty-nav-wait');
              setAt(pinned, true);
              return;
            }
            forget();
            if (!settled) return; // settle() will look
            if (before !== null) setAt('', true);
            measure();
            setTimeout(placeNav, 1000);
            watch(6000);
          }, 200);
        };
        addEventListener('resize', restart);
        new MutationObserver(restart).observe(root, { attributes: true, attributeFilter: ['data-tty-nav', 'data-tty-nav-phone'] });
      }

      // Same wordmark as the home page; the text stays if the alphabet cannot load.
      const glyphs = document.createElement('script');
      glyphs.src = '/assets/tty-glyphs.js';
      glyphs.onload = () => window.TTYGlyphs && window.TTYGlyphs.wordmark(home, 11);
      document.head.append(glyphs);
    }
  });
})();
