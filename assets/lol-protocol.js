export const VERSION = 1;
export function parentOrigin() {
  const value = new URLSearchParams(location.search).get('parentOrigin');
  if (value === 'https://tty.link') return value;
  const local = (host) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  try {
    const url = new URL(value);
    if (value === url.origin && url.protocol === 'http:' && local(url.hostname) && local(location.hostname)) return value;
  } catch (error) { /* not an allowed parent */ }
  return null;
}
export function bridge(origin, receive) {
  const send = (type, payload = {}) => {
    if (origin && parent !== window) parent.postMessage({ source: 'lol-player', version: VERSION, type, ...payload }, origin);
  };
  addEventListener('message', (event) => {
    const data = event.data;
    if (!origin || event.origin !== origin || event.source !== parent || !data || data.source !== 'tty-lol-host' || data.version !== VERSION) return;
    receive(data);
  });
  return send;
}
