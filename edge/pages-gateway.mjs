// Keep the public origin stable while GitHub Pages serves the static content over HTTPS.
const PUBLIC_ORIGIN = 'https://lol.tty.link';
const UPSTREAM_ORIGIN = 'https://tty-link.github.io';
const PREFIX = '/lol.tty.link';
const CSP = "frame-ancestors 'self' https://tty.link";

function reply(body, status, headers = new Headers()) {
  headers.set('Content-Security-Policy', CSP);
  headers.delete('X-Frame-Options');
  return new Response(body, { status, headers });
}

function unavailable() {
  return reply('LOL is temporarily unavailable. Please try again.', 502,
    new Headers({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname !== 'lol.tty.link') return reply('Not found', 404);
    if (!['GET', 'HEAD'].includes(request.method)) return reply('Method not allowed', 405, new Headers({ Allow: 'GET, HEAD' }));
    if (url.protocol !== 'https:') {
      const headers = new Headers({ Location: PUBLIC_ORIGIN + url.pathname + url.search });
      return reply(null, 308, headers);
    }
    const upstreamURL = new URL(PREFIX + url.pathname + url.search, UPSTREAM_ORIGIN);
    const headers = new Headers();
    // Public static files never need a visitor's cookies, credentials, or arbitrary proxy headers.
    for (const name of ['Accept', 'If-None-Match', 'If-Modified-Since', 'Range', 'If-Range']) {
      if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }
    try {
      const upstream = await fetch(upstreamURL, { method: request.method, headers, redirect: 'manual' });
      const responseHeaders = new Headers(upstream.headers);
      if (upstream.status >= 300 && upstream.status < 400 && responseHeaders.has('Location')) {
        const target = new URL(responseHeaders.get('Location'), upstreamURL);
        if (target.origin !== UPSTREAM_ORIGIN || !(target.pathname === PREFIX || target.pathname.startsWith(PREFIX + '/'))) return unavailable();
        responseHeaders.set('Location', PUBLIC_ORIGIN + (target.pathname.slice(PREFIX.length) || '/') + target.search + target.hash);
      }
      responseHeaders.delete('Set-Cookie');
      return reply(upstream.body, upstream.status, responseHeaders);
    } catch {
      return unavailable();
    }
  },
};
