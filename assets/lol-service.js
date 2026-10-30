import { LOLPlayer } from './lol-player.js?v=remote-1';

const params = new URLSearchParams(location.search);
let picked;
try { picked = localStorage.getItem('tty.lang'); } catch (error) { /* storage blocked */ }
let lang = params.get('lang') || picked;
if (lang !== 'ko' && lang !== 'en') lang = (navigator.languages || [navigator.language]).some((l) => /^ko\b/i.test(l)) ? 'ko' : 'en';
const ui = {
  en: { pause: 'Pause', play: 'Play', next: 'Next', prev: 'Previous', ask: 'Why is this funny?', all: 'All pages', error: 'LOL could not load. Try reloading the page.', explain: 'The explanation could not load.' },
  ko: { pause: '일시정지', play: '재생', next: '다음', prev: '이전', ask: '이게 왜 웃겨요?', all: '전체 보기', error: 'LOL을 불러오지 못했어요. 새로고침해 주세요.', explain: '해설을 불러오지 못했어요.' },
};
const L = window.TTYLetter;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const body = document.body;
const stage = document.querySelector('.lol-stage');
const title = document.querySelector('.now-title');
const ask = document.querySelector('.ask');
const askWrap = document.querySelector('.ask-wrap');
const pause = document.querySelector('.pause');
const pauseLabel = document.querySelector('.pause-label');
const next = document.querySelector('.next');
const prev = document.querySelector('.prev');
const all = document.querySelector('.all');
const tools = document.querySelector('.tools');
const spoken = document.querySelector('.sr-now');
const error = document.querySelector('.error');
const nav = performance.getEntriesByType('navigation')[0];
const fresh = !nav || !['reload', 'back_forward'].includes(nav.type);
let clock = null;
let explaining = false;
let explained = '';
let explainScript = null;
let shownId = '';
// A title is read out only when the visitor asked for another joke, not on every autoplay turn.
let announce = false;

const player = new LOLPlayer(stage, { lang, page: fresh ? location.hash.slice(1) : '', onState: render, onAsk: () => openExplain(stage) });

/* ---- Drawn letters: the stroke alphabet for Latin, font-kku for Hangul, as on the home ---- */
window.TTYGlyphs.wordmark(document.querySelector('.logo'), null, ['LOL', ':)']);
if (L) {
  L.set(document.querySelector('.motto'), 'Making fun to make happy :)', { size: '13px' });
  document.querySelectorAll('.btn.all, .now-title').forEach((node) => { node.dataset.ltShake = 'kku'; });
  L.watch(title, { size: '16px', animate: reduce ? false : 'random' });
  L.watch(all, { size: '14px' });
  L.watch(document.querySelector('.ask-q'), { size: '15px' });
}
const key = window.TTYHanKey ? window.TTYHanKey.make((target) => {
  if (target === lang) return;
  lang = target;
  try { localStorage.setItem('tty.lang', lang); } catch (error) { /* storage blocked */ }
  if (player.paused) setPaused(false);
  applyLang();
  player.configure({ lang });
}) : null;
if (key) document.querySelector('header nav').append(key.button);

/* ---- The bubble after the "?": at each joke's punchline (once), and when the "?" is pointed at ---- */
const pop = Object.assign(document.createElement('span'), { className: 'ask-pop' });
const bubble = Object.assign(document.createElement('button'), { type: 'button', className: 'ask-bubble', tabIndex: -1 });
bubble.setAttribute('aria-hidden', 'true');
bubble.addEventListener('click', () => ask.click());
pop.append(bubble);
askWrap.append(pop);
const nudged = new Set();
const asked = new Set();
let opened = 0;
let nudgeTimer = 0;
let hideTimer = 0;
// Room after the "?" up to the controls (or the edge); with none, the bubble opens back over the
// title only for a visitor pointing at the "?", and never over the joke or a control.
const side = (pointing) => {
  const need = bubble.offsetWidth + 12;
  const at = askWrap.getBoundingClientRect();
  const t = tools.getBoundingClientRect();
  const end = t.left > at.right && t.top < at.bottom && t.bottom > at.top ? t.left - 8 : document.documentElement.clientWidth - 8;
  if (end - at.right >= need) return 'right';
  return pointing ? 'left' : null;
};
const showBubble = (pointing, stay) => {
  if (!bubble.classList.contains('show')) {
    const where = side(pointing);
    if (!where) return;
    pop.dataset.side = where;
    bubble.classList.remove('hide');
    bubble.classList.add('show');
    if (!reduce && L) L.assemble(bubble);
  }
  clearTimeout(hideTimer);
  if (stay) hideTimer = setTimeout(hideBubble, stay);
};
function hideBubble() {
  clearTimeout(hideTimer);
  if (!bubble.classList.contains('show')) return;
  if (bubble.matches(':hover') || ask.matches(':hover')) { hideTimer = setTimeout(hideBubble, 1200); return; }
  bubble.classList.remove('show');
  bubble.classList.add('hide');
}
ask.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showBubble(true); });
ask.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideTimer = setTimeout(hideBubble, 700); });
bubble.addEventListener('pointerleave', () => { hideTimer = setTimeout(hideBubble, 700); });
// A little after the punchline (55% of the way, never before 4.5 s), only while the joke plays.
const planNudge = (state) => {
  clearTimeout(nudgeTimer);
  if (!state.running || nudged.has(state.id) || asked.has(state.id) || opened >= 3) return;
  const wait = Math.max(4500, state.duration * .55) - state.elapsed;
  if (wait < -3000) return;
  nudgeTimer = setTimeout(() => {
    if (explaining || document.hidden || player.paused || nudged.has(state.id)) return;
    nudged.add(state.id);
    showBubble(false, 4500);
  }, Math.max(0, wait));
};

/* ---- Previous: what has been shown, and the one before ---- */
let seen = [];
let at = -1;
let jumping = null;
const markPrev = () => prev.setAttribute('aria-disabled', String(at <= 0));
function track(id) {
  if (id === seen[at]) return;
  if (id === jumping) jumping = null;
  else { seen = seen.slice(0, at + 1); seen.push(id); at = seen.length - 1; }
  markPrev();
}
// Asking for another joke plays it: a paused player starts again.
function go(fn) {
  if (player.paused) setPaused(false);
  announce = true;
  fn();
}
function back() {
  if (at <= 0) return;
  at -= 1;
  jumping = seen[at];
  markPrev();
  go(() => player.goto(jumping));
}

function setPaused(on) {
  player.configure({ paused: on });
  body.classList.toggle('paused', on);
  pauseLabel.textContent = on ? ui[lang].play : ui[lang].pause;
  pause.title = pauseLabel.textContent;
  if (on) { clearTimeout(nudgeTimer); hideBubble(); }
}
function showError(text) { error.hidden = false; error.textContent = text; }
function hideError() { error.hidden = true; error.textContent = ''; }

function applyLang() {
  const t = ui[lang];
  document.documentElement.lang = lang;
  document.documentElement.classList.toggle('lang-ko', lang === 'ko');
  pauseLabel.textContent = player.paused ? t.play : t.pause;
  pause.title = pauseLabel.textContent;
  next.setAttribute('aria-label', t.next);
  next.title = t.next;
  prev.setAttribute('aria-label', t.prev);
  prev.title = t.prev;
  document.querySelector('.ask-label').textContent = t.ask;
  ask.title = t.ask;
  all.textContent = t.all;
  all.href = '/all/?lang=' + lang;
  if (L) L.set(bubble, t.ask, { size: '16px' });
  else bubble.textContent = t.ask;
  if (key) key.update(lang);
}
function render(state) {
  if (state.status === 'error') { showError(ui[lang].error); return; }
  if (!state.id) return;
  title.textContent = state.title;
  if (state.id !== shownId) {
    shownId = state.id;
    hideError();
    history.replaceState(null, '', '#' + state.id);
    track(state.id);
    if (announce) { spoken.textContent = state.title; announce = false; }
  }
  if (!clock || clock.effect.getTiming().duration !== state.duration) {
    if (clock) clock.cancel();
    clock = document.querySelector('.progress span').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: state.duration, fill: 'forwards' });
  }
  clock.currentTime = state.elapsed;
  if (state.running) clock.play(); else clock.pause();
  planNudge(state);
  const key = state.id + ':' + lang;
  if (explaining && window.TTYExplain && explained !== key) {
    explained = key;
    window.TTYExplain.open({ id: state.id, lang, title: state.title });
  }
}
async function openExplain(returnFocus) {
  if (!player.current || explaining) return;
  explaining = true;
  opened += 1;
  asked.add(player.current.page.id);
  clearTimeout(nudgeTimer);
  hideBubble();
  body.classList.add('explaining');
  player.configure({ explaining: true });
  ask.setAttribute('aria-expanded', 'true');
  const done = () => {
    explaining = false;
    body.classList.remove('explaining');
    ask.setAttribute('aria-expanded', 'false');
    player.configure({ explaining: false });
  };
  try {
    if (!explainScript) explainScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/assets/tty-explain.js';
      script.onload = resolve;
      script.onerror = () => { explainScript = null; reject(new Error('explanation')); };
      document.head.append(script);
    });
    await explainScript;
    hideError();
    explained = player.current.page.id + ':' + lang;
    window.TTYExplain.open({ id: player.current.page.id, lang, returnFocus, onClose: () => {
      done();
      if (returnFocus === stage) player.focus();
    } });
  } catch (reason) {
    done();
    showError(ui[lang].explain);
  }
}
pause.addEventListener('click', () => setPaused(!player.paused));
next.addEventListener('click', () => go(() => player.advance()));
prev.addEventListener('click', back);
ask.addEventListener('click', () => { hideBubble(); openExplain(ask); });
stage.addEventListener('mouseenter', () => player.configure({ hovering: true }));
stage.addEventListener('mouseleave', () => player.configure({ hovering: false }));
document.addEventListener('visibilitychange', () => player.configure({ visible: !document.hidden }));
addEventListener('keydown', (event) => {
  if (explaining || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (event.key === 'ArrowRight') go(() => player.advance());
  if (event.key === 'ArrowLeft') back();
  if (event.key === '?') { event.preventDefault(); openExplain(document.activeElement); }
});
applyLang();
// Started even when the first load failed, so Next can try again.
player.init().then(() => player.start());
