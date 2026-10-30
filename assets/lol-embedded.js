import { LOLPlayer } from './lol-player.js?v=remote-1';
import { bridge, parentOrigin } from './lol-protocol.js';

const params = new URLSearchParams(location.search);
const origin = parentOrigin();
if (origin && parent !== window) {
  const send = bridge(origin, (data) => {
    if (data.type === 'configure') player.configure(data.values);
    if (data.type === 'show') player.start();
    if (data.type === 'next') player.advance();
    if (data.type === 'goto' && typeof data.id === 'string') player.goto(data.id);
    if (data.type === 'focus') player.focus();
  });
  const player = new LOLPlayer(document.querySelector('.lol-stage'), {
    lang: params.get('lang'), page: params.get('page') || '',
    onState: (state) => send('state', { state }), onAsk: () => send('ask'),
  });
  // hello: the page is up (the home waits longer for ready, which can take a few jokes' tries).
  send('hello');
  player.init().then((ok) => { if (ok) send('ready'); });
} else {
  document.body.textContent = 'Open LOL at lol.tty.link.';
}
