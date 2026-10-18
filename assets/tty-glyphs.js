/* tty.link stroke letters: the alphabet of the wordmark, the home page sentence and its menu.
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
    // The rest of the alphabet, for the home's menu and posters (drawn, never set in a font).
    b: [1, ['M0 -1.42V0', 'O.5 -.5 .5']],
    c: [.92, ['M.88 -.82A.5 .5 0 1 0 .88 -.18']],
    d: [1, ['O.5 -.5 .5', 'M1 -1.42V0']],
    j: [.42, ['M.32 -1V.12C.32 .32 .2 .42 0 .42', 'D.32 -1.32']],
    q: [1, ['O.5 -.5 .5', 'M1 -1V.42']],
    s: [.8, ['M.74 -.86C.66 -.96 .54 -1 .4 -1C.2 -1 .06 -.9 .06 -.74C.06 -.38 .74 -.6 .74 -.24C.74 -.08 .58 0 .4 0C.24 0 .1 -.04 .02 -.14']],
    v: [1, ['M0 -1L.5 0', 'M.5 0L1 -1']],
    w: [1.5, ['M0 -1L.375 0', 'M.375 0L.75 -1', 'M.75 -1L1.125 0', 'M1.125 0L1.5 -1']],
    x: [.9, ['M0 -1L.9 0', 'M.9 -1L0 0']],
    z: [.86, ['M.04 -1H.82', 'M.82 -1L.04 0', 'M.04 0H.86']],
    // Capitals.
    A: [1.2, ['M0 0L.6 -1.42', 'M.6 -1.42L1.2 0', 'M.22 -.5H.98']],
    B: [.96, ['M0 0V-1.42', 'M0 -1.42H.48C.72 -1.42 .88 -1.28 .88 -1.07C.88 -.86 .72 -.74 .48 -.74H0', 'M.48 -.74C.78 -.74 .96 -.58 .96 -.36C.96 -.14 .8 0 .52 0H0']],
    C: [1.3, ['M1.25 -1.17A.71 .71 0 1 0 1.25 -.25']],
    D: [1.12, ['M0 0V-1.42', 'M0 -1.42H.4C.84 -1.42 1.12 -1.12 1.12 -.71C1.12 -.3 .84 0 .4 0H0']],
    E: [.86, ['M.86 -1.42H0V0H.86', 'M0 -.72H.74']],
    F: [.82, ['M.82 -1.42H0V0', 'M0 -.72H.7']],
    G: [1.42, ['M1.25 -1.17A.71 .71 0 1 0 1.42 -.71H.84']],
    H: [1.06, ['M0 -1.42V0', 'M1.06 -1.42V0', 'M0 -.72H1.06']],
    I: [.2, ['M.1 -1.42V0']],
    J: [.82, ['M.72 -1.42V-.4C.72 -.14 .54 0 .36 0C.16 0 .02 -.12 0 -.32']],
    K: [.96, ['M0 -1.42V0', 'M.92 -1.42L.04 -.56', 'M.34 -.86L.96 0']],
    P: [.94, ['M0 0V-1.42', 'M0 -1.42H.5C.76 -1.42 .94 -1.24 .94 -1C.94 -.76 .76 -.58 .5 -.58H0']],
    Q: [1.42, ['O.71 -.71 .71', 'M.92 -.32L1.38 .1']],
    R: [.98, ['M0 0V-1.42', 'M0 -1.42H.5C.76 -1.42 .94 -1.24 .94 -1C.94 -.76 .76 -.58 .5 -.58H0', 'M.46 -.58L.98 0']],
    S: [.94, ['M.88 -1.22C.78 -1.36 .62 -1.42 .46 -1.42C.22 -1.42 .06 -1.28 .06 -1.06C.06 -.56 .9 -.84 .9 -.36C.9 -.12 .7 0 .46 0C.26 0 .1 -.06 0 -.2']],
    T: [1, ['M0 -1.42H1', 'M.5 -1.42V0']],
    U: [1.1, ['M0 -1.42V-.55A.55 .55 0 0 0 1.1 -.55V-1.42']],
    V: [1.2, ['M0 -1.42L.6 0', 'M.6 0L1.2 -1.42']],
    W: [1.7, ['M0 -1.42L.425 0', 'M.425 0L.85 -1.42', 'M.85 -1.42L1.275 0', 'M1.275 0L1.7 -1.42']],
    X: [1.1, ['M0 -1.42L1.1 0', 'M1.1 -1.42L0 0']],
    Y: [1.1, ['M0 -1.42L.55 -.7', 'M1.1 -1.42L.55 -.7', 'M.55 -.7V0']],
    Z: [1, ['M.04 -1.42H.96', 'M.96 -1.42L.04 0', 'M.04 0H1']],
    // Figures, as tall as the capitals.
    0: [.96, ['M.48 -1.42A.48 .71 0 1 0 .48 0A.48 .71 0 1 0 .48 -1.42']],
    1: [.56, ['M.04 -1.1L.42 -1.42V0']],
    2: [.9, ['M.04 -1.06C.06 -1.28 .24 -1.42 .46 -1.42C.7 -1.42 .86 -1.26 .86 -1.04C.86 -.84 .74 -.7 .56 -.54L.04 0H.9']],
    3: [.88, ['M.06 -1.24C.14 -1.36 .28 -1.42 .44 -1.42C.66 -1.42 .82 -1.28 .82 -1.08C.82 -.88 .66 -.76 .42 -.76', 'M.42 -.76C.7 -.76 .88 -.6 .88 -.38C.88 -.14 .7 0 .44 0C.26 0 .1 -.08 .02 -.2']],
    4: [.96, ['M.7 0V-1.42L0 -.42H.96']],
    5: [.88, ['M.82 -1.42H.14L.08 -.78C.18 -.84 .3 -.86 .44 -.86C.7 -.86 .88 -.68 .88 -.44C.88 -.18 .68 0 .42 0C.24 0 .1 -.06 .02 -.18']],
    6: [.92, ['M.8 -1.34C.7 -1.4 .6 -1.42 .5 -1.42C.22 -1.42 .04 -1.1 .04 -.5', 'O.48 -.44 .44']],
    7: [.86, ['M0 -1.42H.86L.3 0']],
    8: [.9, ['O.45 -1.08 .34', 'O.45 -.4 .4']],
    9: [.92, ['O.44 -.98 .44', 'M.88 -.98V-.5C.88 -.18 .7 0 .42 0C.3 0 .2 -.03 .12 -.08']],
    // Punctuation and marks the menus use.
    ',': [.24, ['M.16 -.14V-.02C.16 .12 .1 .22 .02 .28']],
    ';': [.24, ['D.12 -.8', 'M.16 -.14V-.02C.16 .12 .1 .22 .02 .28']],
    '\u00a0': [.34, []],
    '-': [.6, ['M.06 -.5H.54']],
    '–': [.86, ['M.04 -.5H.82']],
    '—': [1.2, ['M.04 -.5H1.16']],
    '·': [.3, ['D.15 -.55']],
    '/': [.7, ['M.66 -1.42L.04 .2']],
    '?': [.8, ['M.06 -1.12C.08 -1.3 .22 -1.42 .42 -1.42C.62 -1.42 .76 -1.28 .76 -1.1C.76 -.84 .44 -.8 .44 -.46V-.36', 'D.44 -.06']],
    '!': [.2, ['M.1 -1.42V-.38', 'D.1 -.06']],
    "'": [.2, ['M.1 -1.42V-1.06']],
    '’': [.24, ['M.16 -1.42V-1.3C.16 -1.16 .1 -1.06 .02 -1']],
    '"': [.4, ['M.1 -1.42V-1.06', 'M.3 -1.42V-1.06']],
    '→': [1.1, ['M0 -.55H1.04', 'M.7 -.86L1.04 -.55L.7 -.24']],
    '←': [1.1, ['M1.1 -.55H.06', 'M.4 -.86L.06 -.55L.4 -.24']],
    '↘': [.9, ['M.06 -1.1L.84 -.32', 'M.84 -.74V-.32H.42']],
    '↗': [.9, ['M.06 -.32L.84 -1.1', 'M.42 -1.1H.84V-.68']],
    '+': [.8, ['M.4 -.9V-.1', 'M0 -.5H.8']],
    '×': [.7, ['M.06 -.86L.64 -.24', 'M.64 -.86L.06 -.24']],
    '…': [.9, ['D.12 -.06', 'D.45 -.06', 'D.78 -.06']],
    '=': [.8, ['M.04 -.72H.76', 'M.04 -.32H.76']],
    '%': [1.1, ['O.24 -1.18 .22', 'O.86 -.24 .22', 'M.98 -1.42L.12 0']],
    '#': [.96, ['M.36 -1.3L.22 -.12', 'M.76 -1.3L.62 -.12', 'M.06 -.94H.92', 'M.02 -.48H.88']],
    '&': [1.1, ['M1.04 0L.24 -.88C.12 -1.02 .1 -1.12 .1 -1.18C.1 -1.32 .22 -1.42 .38 -1.42C.54 -1.42 .66 -1.32 .66 -1.18C.66 -1 .5 -.9 .3 -.78C.12 -.66 .02 -.52 .02 -.36C.02 -.14 .2 0 .44 0C.66 0 .86 -.14 .96 -.42']],
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
