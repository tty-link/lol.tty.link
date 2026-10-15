import { LOLPlayer } from './lol-player.js';

const params = new URLSearchParams(location.search);
let picked;
try { picked = localStorage.getItem('tty.lang'); } catch (error) { /* storage blocked */ }
let lang = params.get('lang') || picked;
if (lang !== 'ko' && lang !== 'en') lang = (navigator.languages || [navigator.language]).some((l) => /^ko\b/i.test(l)) ? 'ko' : 'en';
const ui = {
  en: { pause: 'Pause', play: 'Play', next: 'Next', ask: 'Why is this funny?', all: 'All pages', language: 'Language', error: 'LOL could not load. Try reloading the page.' },
  ko: { pause: '일시정지', play: '재생', next: '다음', ask: '이게 왜 웃겨요?', all: '전체 보기', language: '언어', error: 'LOL을 불러오지 못했어요. 새로고침해 주세요.' },
};
const stage = document.querySelector('.lol-stage');
const ask = document.querySelector('.ask');
const pause = document.querySelector('.pause');
const error = document.querySelector('.error');
const nav = performance.getEntriesByType('navigation')[0];
const fresh = !nav || !['reload', 'back_forward'].includes(nav.type);
let clock = null;
let explaining = false;
let explained = '';
let explainScript = null;
const player = new LOLPlayer(stage, { lang, page: fresh ? location.hash.slice(1) : '', onState: render, onAsk: () => openExplain(stage) });

function applyLang() {
  document.documentElement.lang = lang;
  pause.textContent = player.paused ? ui[lang].play : ui[lang].pause;
  document.querySelector('.next').textContent = ui[lang].next;
  document.querySelector('.all').textContent = ui[lang].all;
  document.querySelector('.all').href = '/all/?lang=' + lang;
  document.querySelector('.langs').setAttribute('aria-label', ui[lang].language);
  ask.textContent = ui[lang].ask;
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
function render(state) {
  if (state.status === 'error') { error.hidden = false; error.textContent = ui[lang].error; return; }
  if (!state.id) return;
  document.querySelector('.now-title').textContent = state.title;
  history.replaceState(null, '', '#' + state.id);
  if (!clock || clock.effect.getTiming().duration !== state.duration) {
    if (clock) clock.cancel();
    clock = document.querySelector('.progress span').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: state.duration, fill: 'forwards' });
  }
  clock.currentTime = state.elapsed;
  if (state.running) clock.play(); else clock.pause();
  const key = state.id + ':' + lang;
  if (explaining && window.TTYExplain && explained !== key) {
    explained = key;
    window.TTYExplain.open({ id: state.id, lang, title: state.title });
  }
}
async function openExplain(returnFocus) {
  if (!player.current || explaining) return;
  explaining = true;
  player.configure({ explaining: true });
  ask.setAttribute('aria-expanded', 'true');
  try {
    if (!explainScript) explainScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/assets/tty-explain.js';
      script.onload = resolve;
      script.onerror = () => { explainScript = null; reject(new Error('explanation')); };
      document.head.append(script);
    });
    await explainScript;
    explained = player.current.page.id + ':' + lang;
    window.TTYExplain.open({ id: player.current.page.id, lang, returnFocus, onClose: () => {
      explaining = false;
      ask.setAttribute('aria-expanded', 'false');
      player.configure({ explaining: false });
      if (returnFocus === stage) player.focus();
    } });
  } catch (reason) {
    explaining = false;
    ask.setAttribute('aria-expanded', 'false');
    player.configure({ explaining: false });
    error.hidden = false;
    error.textContent = lang === 'ko' ? '해설을 불러오지 못했어요.' : 'The explanation could not load.';
  }
}
pause.addEventListener('click', () => { player.configure({ paused: !player.paused }); pause.setAttribute('aria-pressed', String(player.paused)); applyLang(); });
document.querySelector('.next').addEventListener('click', () => player.advance());
ask.addEventListener('click', () => openExplain(ask));
stage.addEventListener('mouseenter', () => player.configure({ hovering: true }));
stage.addEventListener('mouseleave', () => player.configure({ hovering: false }));
document.addEventListener('visibilitychange', () => player.configure({ visible: !document.hidden }));
document.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => { lang = button.dataset.lang; applyLang(); player.configure({ lang }); }));
addEventListener('keydown', (event) => {
  if (explaining || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (event.key === 'ArrowRight') player.advance();
  if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); openExplain(document.activeElement); }
});
applyLang();
player.init().then((ok) => { if (ok) player.start(); });
