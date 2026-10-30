/* Lettering: text drawn rather than set. Hangul goes to font-kku (sebul), everything else (Latin,
 * figures, marks) to the stroke alphabet of "tty.link :)". Words wrap as units; a word that mixes
 * scripts ("11,172자", "DNS") is split into runs, each drawn its own way, sitting on one line.
 * Stroke letters move the way the home's sentence does: their parts fly in from scattered places
 * and lock together, the smile winks once it is whole, and pointing at them shakes the parts loose
 * for a moment. Hangul in the same places plays one of font-kku's own motions, picked at random.
 *   TTYLetter.render(text, { size, animate, delay })  a new element (animate: put together as it appears)
 *                                                       wait: ms before a still drawing's Hangul goes in
 *   TTYLetter.set(el, text, opts)                       draw text inside an existing element
 *   TTYLetter.watch(el, opts)                           keep redrawing el when a script rewrites its text
 *   TTYLetter.assemble(root, { delay, step, skip })     fly in the stroke letters already in root
 *   TTYLetter.shake(root)                               shake them loose and back
 *   data-lt-shake on any element                        pointing at it shakes the letters inside
 *   data-lt-shake="kku"                                  …and plays a random font-kku motion on its Hangul
 * Screen readers get the plain text from a hidden copy; the drawing is aria-hidden. */
(() => {
  const { glyph, GLYPHS } = window.TTYGlyphs;
  const HANGUL = /[가-힣ㄱ-ㆎ]/;
  const RUNS = /[가-힣ㄱ-ㆎ]+|[^가-힣ㄱ-ㆎ]+/g;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const missing = new Set();
  window.__ltMissing = missing;

  const el = (tag, cls) => Object.assign(document.createElement(tag), cls ? { className: cls } : {});
  const rand = (a, b) => a + Math.random() * (b - a);
  // Where a part waits before it flies in (SVG units: 1 = one x-height), as on the home's sentence.
  const scattered = (reach) => `translate(${rand(-1.6, 1.6) * reach}px, ${rand(-2.2, .8) * reach}px) rotate(${rand(-150, 150) * Math.min(reach, 1)}deg) scale(${rand(.5, 1.2)})`;

  // Every font-kku drawing re-lays the page, so drawings never pile into one frame: they wait in a
  // queue and each frame takes what fits in a few milliseconds (at least one). On a slow machine
  // timers fire late and bunch up; the queue spreads them out again.
  const queue = [];
  let pumping = false;
  const pump = () => {
    const start = performance.now();
    do queue.shift()(); while (queue.length && performance.now() - start < 6);
    if (queue.length) requestAnimationFrame(pump); else pumping = false;
  };
  const later = (fn, delay = 0) => setTimeout(() => {
    queue.push(fn);
    if (!pumping) { pumping = true; requestAnimationFrame(pump); }
  }, delay);

  // font-kku motions that run once (a menu should not keep moving): picked at random, never the same
  // twice in a row on one word. Pointing may also get one round of a looping motion, then it stops.
  const ONCE = ['assemble', 'drop', 'draw', 'rise', 'stagger', 'fade'];
  const POINTED = ['assemble', 'drop', 'draw', 'rise', 'stagger', 'wave', 'bounce'];
  const ROUND = { wave: 1600, bounce: 1200 };
  const pick = (list, not) => {
    const choices = list.filter((name) => name !== not);
    return choices[Math.floor(Math.random() * choices.length)];
  };
  function play(kku, list = ONCE) {
    if (reduce || !kku.isConnected || !window.FontKkuFx) return;
    const name = pick(list, kku.dataset.ltLast);
    kku.dataset.ltLast = name;
    kku.setAttribute('animate', name);
    FontKkuFx.replay(kku);
    if (ROUND[name]) setTimeout(() => { if (kku.getAttribute('animate') === name) kku.removeAttribute('animate'); }, ROUND[name]);
  }

  function word(w, { animate, delay, wait }) {
    const box = el('span', 'lt-w');
    if (w === ':)') box.dataset.smile = '';
    (w.match(RUNS) || []).forEach((run) => {
      if (HANGUL.test(run)) {
        const kku = document.createElement('font-kku');
        kku.setAttribute('font', 'sebul');
        kku.setAttribute('lang', 'ko');
        // sebul draws its syllables smaller than the size and toward the top: a little larger, a little lower.
        kku.setAttribute('size', 'calc(var(--lt, 20px) * 1.16)');
        if (animate && !reduce) {
          const name = animate === 'random' ? pick(ONCE) : animate === true ? 'assemble' : animate;
          kku.setAttribute('animate', name);
          kku.dataset.ltLast = name;
        }
        kku.textContent = run;
        // A word that waits is put in only when its turn comes. font-kku draws a word as it is put in,
        // so the drawing falls inside the queue's few milliseconds; an empty word put in now and filled
        // later would be drawn twice, the second time outside them. A still word can wait too (wait).
        const at = animate ? delay : wait;
        if (at && !reduce) {
          const slot = document.createComment('');
          box.append(slot);
          later(() => { if (slot.isConnected) slot.replaceWith(kku); }, at);
        } else box.append(kku);
      } else {
        // tty-glyphs: the alphabet's own styles (letter boxes, strokes), so a page needs none of its own.
        const strokes = el('span', 'lt-s tty-glyphs');
        [...run].forEach((ch) => {
          if (!GLYPHS[ch]) missing.add(ch);
          strokes.append(glyph(ch));
        });
        box.append(strokes);
      }
    });
    return box;
  }

  // Parts fly in glyph after glyph. Several drawn pieces in one root (a menu) start one after
  // another and each puts itself together quickly, so the whole thing reads top to bottom in about a
  // second; one piece on its own steps like the home's sentence (faster when it is long). With
  // hangul, the piece's Hangul plays a random font-kku motion as the piece starts.
  // skip: a selector for letters that are there but not shown (a closed chapter's sections).
  function assemble(root, { delay = 0, step, rowStep = 35, skip, hangul = true } = {}) {
    if (reduce || !root) return 0;
    const pieces = (root.matches('.lt, .lt-art') ? [root] : [...root.querySelectorAll('.lt')]).filter((piece) => !(skip && piece.closest(skip)));
    const several = pieces.length > 1;
    let end = 0;
    pieces.forEach((piece, k) => {
      const glyphs = [...piece.querySelectorAll('.lt-s .g')];
      const each = step != null ? step : several ? 30 : Math.max(10, Math.min(72, 900 / Math.max(1, glyphs.length)));
      const start = delay + (several ? k * rowStep : 0);
      glyphs.forEach((g, i) => g.querySelectorAll('.part').forEach((part, j) => {
        const at = start + i * each + j * 50;
        part.animate([{ transform: scattered(1), opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 720, delay: at, easing: 'cubic-bezier(.22, 1.4, .42, 1)', fill: 'backwards' });
        end = Math.max(end, at + 720);
      }));
      if (hangul) piece.querySelectorAll('font-kku').forEach((kku, m) => later(() => play(kku), start + m * 80));
    });
    // The smile winks once it is whole (the upper dot of the colon is its eye).
    root.querySelectorAll('.lt-w[data-smile]').forEach((smile) => {
      const eye = smile.querySelector('.dot');
      if (eye) eye.animate([{ transform: 'none' }, { transform: 'scaleY(.12)' }, { transform: 'none' }], { duration: 260, delay: end + 260, easing: 'ease-in-out' });
    });
    return end;
  }

  function shake(root) {
    if (reduce || !root) return;
    root.querySelectorAll('.lt-s .part').forEach((part) => part.animate(
      [{ transform: 'none' }, { transform: scattered(.45), offset: .4 }, { transform: 'none' }],
      { duration: 760, delay: rand(0, 140), easing: 'cubic-bezier(.3, .7, .3, 1)' }));
  }

  // Pointing at anything marked data-lt-shake shakes the letters in it, at most once a second.
  // It is only a flourish: nothing opens or changes on hover. Only a pointer that actually moved
  // counts: when a menu opens and rows slide under a resting pointer, the browser reports them as
  // pointed at, and those must not shake.
  const shaken = new WeakMap();
  let px = null;
  let py = null;
  document.addEventListener('pointermove', (event) => { px = event.clientX; py = event.clientY; }, true);
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (event.clientX === px && event.clientY === py) return;
    const host = event.target.closest && event.target.closest('[data-lt-shake]');
    if (!host || (event.relatedTarget && host.contains(event.relatedTarget))) return;
    const now = performance.now();
    if (now - (shaken.get(host) || 0) < 1000) return;
    shaken.set(host, now);
    shake(host);
    if (host.dataset.ltShake === 'kku') host.querySelectorAll('font-kku').forEach((kku, i) => later(() => play(kku, POINTED), i * 70));
  });

  function fill(box, text, opts) {
    const sr = el('span', 'lt-sr');
    sr.textContent = text;
    const art = el('span', 'lt-art');
    art.setAttribute('aria-hidden', 'true');
    // Only ordinary spaces break; a no-break space (\u00a0) keeps words together on one line.
    String(text).split(/[ \t\n]+/).filter(Boolean).forEach((w, i) => art.append(word(w, { ...opts, delay: opts.delay ? opts.delay + i * 60 : 0 })));
    box.replaceChildren(sr, art);
    box.dataset.lt = text;
    if (opts.size) box.style.setProperty('--lt', opts.size);
    if (opts.animate) assemble(art, { delay: opts.delay || 0, step: opts.step, hangul: false });
  }

  function render(text, opts = {}) {
    const box = el('span', 'lt');
    fill(box, text, opts);
    return box;
  }

  // Draw into an element without touching how the element itself is laid out.
  function set(target, text, opts = {}) {
    const box = render(text, opts);
    target.replaceChildren(box);
    target.dataset.lt = text;
    return box;
  }

  // For text the home's own script rewrites (the joke's title, button labels): it writes with
  // textContent, so the element answers that itself. The home writes the same title again every time
  // LOL reports its state; the same words leave the drawing untouched (taking it out and putting it
  // back would restart font-kku's assembly), new words are drawn and put together. The first drawing
  // carries the motion too (quiet: true to draw it still).
  const plain = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  function watch(target, opts = {}) {
    let current = target.textContent.trim();
    if (current) set(target, current, opts.quiet ? { ...opts, animate: false } : opts);
    const later = { ...opts, delay: 0 };
    Object.defineProperty(target, 'textContent', {
      configurable: true,
      get() { return current; },
      set(value) {
        const text = String(value == null ? '' : value).trim();
        if (text === current) return;
        current = text;
        if (text) set(target, text, later);
        else plain.set.call(target, '');
      },
    });
  }

  const style = document.createElement('style');
  style.textContent = [
    '.lt{--lt:20px;display:inline-flex;max-width:100%;vertical-align:middle}',
    '.lt-art{display:inline-flex;flex-wrap:wrap;align-items:center;column-gap:calc(var(--lt) * .34);row-gap:calc(var(--lt) * .2)}',
    '.lt-w{display:inline-flex;align-items:center;white-space:nowrap}',
    '.lt-s{display:inline-flex;align-items:center;font-size:calc(var(--lt) * .56);line-height:1}',
    '.lt-s .g{vertical-align:middle;margin-right:.06em}',
    '.lt-s .g:last-child{margin-right:0}',
    '.lt-s .g svg{overflow:visible}',
    '.lt-s .part{transform-box:fill-box;transform-origin:center}',
    '.lt-w > font-kku{flex:none;position:relative;top:calc(var(--lt) * .1)}',
    '.lt-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
  ].join('');
  document.head.append(style);

  window.TTYLetter = { render, set, watch, assemble, shake, play, missing };
})();
