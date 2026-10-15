export const VERSION = 1;
export function parentOrigin() {
  const value = new URLSearchParams(location.search).get('parentOrigin');
  if (value === 'https://tty.link') return value;
  const local = (host) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  const tailnet = (host) => {
    const parts = host.split('.').map(Number);
    return parts.length === 4 && parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127
      && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  };
  try {
    const url = new URL(value);
    const preview = (local(location.hostname) && local(url.hostname)) || (tailnet(location.hostname) && url.hostname === location.hostname);
    if (value === url.origin && url.protocol === 'http:' && preview) return value;
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
