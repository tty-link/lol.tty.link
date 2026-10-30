/* The Han/Eng key every Korean keyboard has, as the site's language switch (the home's rail and the
 * /tools/ page). Its legend is the mode it is in and the one it goes to, as an input indicator shows
 * it: 한/A in Korean, A/한 in English. The current mode is solid; pointing turns the emphasis over
 * (what pressing will do); pressing swaps the two, then the page turns. A small light shows Hangul
 * mode. The real key works too, where the browser is told about it (Windows Korean keyboards).
 *   const key = TTYHanKey.make(go)   go(lang) switches the page; the button is key.button
 *   key.update(lang)                 after every switch (and once at the start)
 * Needs lettering.js. */
(() => {
  const L = window.TTYLetter;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NAME = { en: 'English', ko: '한국어' };
  const MARK = { ko: '한', en: 'A' };
  const span = (cls) => Object.assign(document.createElement('span'), { className: cls });

  function make(go) {
    let lang = 'en';
    const other = () => (lang === 'ko' ? 'en' : 'ko');
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'hankey' });
    const key = span('hankey-key');
    key.setAttribute('aria-hidden', 'true');
    const cur = span('hankey-cur');
    const sep = span('hankey-sep');
    const alt = span('hankey-alt');
    key.append(cur, sep, alt, span('hankey-led'));
    button.append(key);
    button.dataset.ltShake = 'kku';
    L.set(sep, '/', { size: '15px' });

    let busy = false;
    const press = () => { button.classList.add('down'); setTimeout(() => button.classList.remove('down'), 160); };
    // The two legends trade places, then the page turns (the new legend already reads that way).
    const swap = () => {
      if (busy) return;
      busy = true;
      press();
      const target = other();
      const done = () => { go(target); busy = false; };
      if (reduce) { done(); return; }
      const dx = alt.offsetLeft - cur.offsetLeft;
      const opts = { duration: 240, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' };
      const a = cur.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${dx}px)`, opacity: .38 }], opts);
      alt.animate([{ transform: 'none', opacity: .38 }, { transform: `translateX(${-dx}px)`, opacity: 1 }], opts);
      a.finished.then(() => { cur.getAnimations().forEach((x) => x.cancel()); alt.getAnimations().forEach((x) => x.cancel()); done(); });
    };
    button.addEventListener('click', swap);
    addEventListener('keydown', (event) => { if (event.key === 'HangulMode' || event.code === 'Lang1') swap(); });

    const update = (now) => {
      lang = now;
      const target = other();
      L.set(cur, MARK[lang], { size: '19px' });
      L.set(alt, MARK[target], { size: '19px' });
      button.setAttribute('aria-label', NAME[target]);
      button.setAttribute('lang', target);
      button.title = lang === 'ko' ? 'English로 보기 (한/영 키)' : '한국어로 보기 · View in Korean (Han/Eng key)';
    };
    return { button, update };
  }

  const style = document.createElement('style');
  style.textContent = [
    '.hankey{display:inline-flex;align-items:center;padding:0;border:0;background:none;color:var(--ink);cursor:pointer}',
    '.hankey-key{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:64px;height:38px;padding:0 17px 0 13px;',
    'border:1.5px solid var(--ink);border-radius:8px;background:var(--sun);box-shadow:0 3px 0 var(--ink);transition:transform .08s,box-shadow .08s,background .15s}',
    '.hankey:hover .hankey-key{background:rgba(27,43,122,.08)}',
    '.hankey.down .hankey-key,.hankey:active .hankey-key{transform:translateY(3px);box-shadow:0 0 0 var(--ink)}',
    '.hankey-cur,.hankey-alt{display:inline-flex;transition:opacity .2s ease}',
    '.hankey-alt{opacity:.38}',
    '.hankey-sep{opacity:.5}',
    '.hankey:hover .hankey-cur{opacity:.38}',
    '.hankey:hover .hankey-alt{opacity:1}',
    '.hankey-led{position:absolute;top:4px;right:5px;width:6px;height:6px;border:1.5px solid var(--ink);border-radius:50%;transition:background .2s}',
    '.lang-ko .hankey-led{background:var(--ink);box-shadow:0 0 6px rgba(27,43,122,.6)}',
    '@media (prefers-reduced-motion:reduce){.hankey-cur,.hankey-alt{transition:none}}',
  ].join('');
  document.head.append(style);

  window.TTYHanKey = { make };
})();
