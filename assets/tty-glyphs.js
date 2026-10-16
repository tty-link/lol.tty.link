/* tty.link stroke letters: the alphabet of the wordmark and of the home page sentence.
 *
 * Every letter is a few stroke parts (stems, bowls, arms, dots), the way font-kku builds
 * Hangul from jamo, so the letters can be assembled and shaken apart.
 *
 *   TTYGlyphs.setWords(el, ['Making', 'fun', '|', 'to'])  build words of letters into el
 *                                                       ("|" breaks the line, "|n" only
 *                                                       on narrow screens)
 *   TTYGlyphs.wordmark(el, px, words)                   draw a wordmark (default "tty.link :)")
 *   TTYGlyphs.GLYPHS                                    the letters, to add new ones
 *
 * Units: x-height 1, baseline at 0, ascender -1.42, descender .42.
 * A part is an SVG path, "O cx cy r" for a ring, or "D cx cy" for a dot.
 * Classes: .w word, .g letter, .part stroke (.dot filled), inside a .tty-glyphs container.
 * The styles below only reach inside that container (pages that load this file for the
 * wordmark have their own .w or .part), and are wrapped in :where() so a page can override them.
 * The wordmark goes on every page opened on its own (pages/_kit.js), whose own .part or .dot
 * rules would reach it, so its classes carry a prefix: .tty-w, .tty-g, .tty-part, .tty-dot.
 */
(() => {
  if (window.TTYGlyphs) return;

  const GLYPHS = {
    L: [.88, ['M0 -1.42V0', 'M0 0H.88']],
    M: [1.24, ['M0 0V-1.42', 'M0 -1.42L.62 -.42', 'M.62 -.42L1.24 -1.42', 'M1.24 -1.42V0']],
    N: [1.1, ['M0 0V-1.42', 'M0 -1.42L1.1 0', 'M1.1 0V-1.42']],
    O: [1.42, ['O.71 -.71 .71']],
    a: [1, ['O.5 -.5 .5', 'M1 -1V0']],
    e: [1, ['M.02 -.5H.98', 'M.98 -.5A.48 .5 0 1 0 .86 -.16']],
    f: [.72, ['M.3 0V-1.08C.3 -1.3 .44 -1.42 .62 -1.42L.72 -1.42', 'M0 -1H.66']],
    g: [1, ['O.5 -.5 .5', 'M1 -1V.02C1 .32 .78 .42 .5 .42C.3 .42 .13 .35 .04 .24']],
    h: [1, ['M0 -1.42V0', 'M0 -.5A.5 .5 0 0 1 1 -.5V0']],
    i: [.2, ['M.1 -1V0', 'D.1 -1.32']],
    k: [.8, ['M0 -1.42V0', 'M.76 -1L.04 -.4', 'M.3 -.6L.8 0']],
    // l carries a small foot so it never reads as i, I or a dot at small sizes.
    l: [.4, ['M.1 -1.42V-.26C.1 -.08 .22 0 .4 0']],
    m: [1.6, ['M0 -1V0', 'M0 -.58A.4 .42 0 0 1 .8 -.58V0', 'M.8 -.58A.4 .42 0 0 1 1.6 -.58V0']],
    n: [1, ['M0 -1V0', 'M0 -.5A.5 .5 0 0 1 1 -.5V0']],
    o: [1, ['O.5 -.5 .5']],
    p: [1, ['M0 -1V.42', 'O.5 -.5 .5']],
    r: [.62, ['M0 -1V0', 'M0 -.52C0 -.84 .24 -1 .5 -1L.62 -1']],
    t: [.66, ['M.3 -1.32V0', 'M0 -1H.66']],
    u: [1, ['M0 -1V-.5A.5 .5 0 0 0 1 -.5', 'M1 -1V0']],
    y: [1, ['M0 -1L.5 -.05', 'M1 -1L.28 .42']],
    '.': [.2, ['D.1 -.06']],
    ':': [.2, ['D.1 -.8', 'D.1 -.12']],
    ')': [.34, ['M0 -1.3C.44 -.95 .44 -.05 0 .3']],
    '(': [.34, ['M.34 -1.3C-.1 -.95 -.1 -.05 .34 .3']],
  };

  const style = document.createElement('style');
  style.textContent = [
    ':where(.tty-glyphs .w,.tty-glyphs .tty-w){display:inline-block;margin-right:.46em;white-space:nowrap}',
    ':where(.tty-glyphs .w:last-child,.tty-glyphs .tty-w:last-child){margin-right:0}',
    ':where(.tty-glyphs .g,.tty-glyphs .tty-g){display:inline-block;width:calc((var(--w) + .24) * 1em);height:1.9em;margin-right:.04em;vertical-align:top;transform-origin:0 0}',
    ':where(.tty-glyphs .g svg,.tty-glyphs .tty-g svg){display:block;width:100%;height:100%;overflow:visible}',
    ':where(.tty-glyphs .part,.tty-glyphs .tty-part){fill:none;stroke:currentColor;stroke-width:var(--sw,.19);stroke-linecap:round;stroke-linejoin:round;transform-box:fill-box;transform-origin:center}',
    ':where(.tty-glyphs .part.dot,.tty-glyphs .tty-part.tty-dot){fill:currentColor;stroke:none}',
    // The wordmark: a little extra tracking keeps it legible when small.
    ':where(.tty-wordmark){display:inline-block;line-height:1.9;--sw:.2}',
    ':where(.tty-wordmark .tty-g){margin-right:.12em}',
    ':where(.tty-wordmark .tty-w){margin-right:.5em}',
    ':where(.tty-wordmark .tty-w:last-child){margin-right:0}',
  ].join('');
  document.head.append(style);

  const SVG = 'http://www.w3.org/2000/svg';
  const PLAIN = { w: 'w', g: 'g', part: 'part', dot: 'dot' };
  const PREFIXED = { w: 'tty-w', g: 'tty-g', part: 'tty-part', dot: 'tty-dot' };
  function glyph(ch, names = PLAIN) {
    // A letter the alphabet doesn't have yet is shown as plain text rather than breaking the page.
    if (!GLYPHS[ch]) return Object.assign(document.createElement('span'), { className: 'g-missing', textContent: ch });
    const [w, parts] = GLYPHS[ch];
    const box = document.createElement('span');
    box.className = names.g;
    box.style.setProperty('--w', w);
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `-0.12 -1.5 ${w + 0.24} 1.9`);
    svg.setAttribute('aria-hidden', 'true');
    parts.forEach((spec) => {
      const nums = spec.slice(1).trim().split(/\s+/).map(Number);
      let el;
      if (spec[0] === 'O' || spec[0] === 'D') {
        el = document.createElementNS(SVG, 'circle');
        el.setAttribute('cx', nums[0]);
        el.setAttribute('cy', nums[1]);
        el.setAttribute('r', spec[0] === 'O' ? nums[2] : .125);
        if (spec[0] === 'D') el.classList.add(names.dot);
      } else {
        el = document.createElementNS(SVG, 'path');
        el.setAttribute('d', spec);
      }
      el.classList.add(names.part);
      svg.append(el);
    });
    box.append(svg);
    return box;
  }

  function setWords(el, words, names = PLAIN) {
    el.classList.add('tty-glyphs');
    el.replaceChildren(...words.map((word) => {
      if (word === '|') return document.createElement('br');
      if (word === '|n') return Object.assign(document.createElement('br'), { className: 'br-narrow' });
      const w = document.createElement('span');
      w.className = names.w;
      w.setAttribute('aria-hidden', 'true');
      w.append(...[...word].map((ch) => glyph(ch, names)));
      return w;
    }));
  }

  // Keep the studio wordmark as the default for pages/_kit.js.
  function wordmark(el, px, words = ['tty.link', ':)']) {
    el.classList.add('tty-wordmark');
    if (px) el.style.fontSize = px + 'px';
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', words[0]);
    setWords(el, words, PREFIXED);
  }

  window.TTYGlyphs = { GLYPHS, glyph, setWords, wordmark };
})();
