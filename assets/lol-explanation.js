import { bridge, parentOrigin } from './lol-protocol.js';
const params = new URLSearchParams(location.search);
const origin = parentOrigin();
if (origin && parent !== window) {
  const open = (id, lang) => {
    if (!/^[a-z0-9-]+$/.test(id)) return;
    document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';
    document.title = document.documentElement.lang === 'ko' ? '이게 왜 웃겨요?' : 'Why is this funny?';
    window.TTYExplain.open({ id, lang: document.documentElement.lang, onClose: () => send('close') });
  };
  const send = bridge(origin, (data) => {
    if (data.type === 'explain') open(data.id, data.lang);
    if (data.type === 'close') window.TTYExplain.close();
  });
  open(params.get('id') || '', params.get('lang'));
  send('ready');
}
