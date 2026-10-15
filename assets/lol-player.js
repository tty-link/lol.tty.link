// One player for the standalone service and its embedded stage.
export class LOLPlayer {
  constructor(stage, { lang = 'en', page = '', onState = () => {}, onAsk = () => {} } = {}) {
    this.stage = stage;
    this.lang = lang === 'ko' ? 'ko' : 'en';
    document.documentElement.lang = this.lang;
    this.wanted = page;
    this.onState = onState;
    this.onAsk = onAsk;
    this.pages = [];
    this.bag = [];
    this.current = null;
    this.upcoming = null;
    this.active = false;
    this.paused = false;
    this.hovering = false;
    this.visible = !document.hidden;
    this.explaining = false;
    this.elapsed = 0;
    this.status = 'loading';
    this.lastTick = performance.now();
    this.lastReport = 0;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.receive = this.receive.bind(this);
    addEventListener('message', this.receive);
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  async init() {
    try {
      const response = await fetch('/pages/index.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('manifest');
      const data = await response.json();
      this.pages = (data.pages || []).filter((p) => /^[a-z0-9-]+$/.test(p.id) && /^[a-z0-9-]+\.html$/.test(p.file));
      if (!this.pages.length) throw new Error('empty manifest');
      this.upcoming = this.load(this.pages.find((p) => p.id === this.wanted) || this.first());
      await this.upcoming.ready;
      this.status = 'ready';
      this.report();
      if (this.active) await this.advance();
      return true;
    } catch (error) {
      this.fail();
      return false;
    }
  }

  fits(when, now = new Date()) {
    if (!when) return false;
    const inRange = (x, a, b, inclusive = false) => a <= b
      ? x >= a && (inclusive ? x <= b : x < b) : x >= a || (inclusive ? x <= b : x < b);
    if (when.days && !when.days.includes(now.getDay())) return false;
    if (when.nth && Math.ceil(now.getDate() / 7) !== when.nth) return false;
    if (when.hours && !inRange(now.getHours(), ...when.hours)) return false;
    if (when.dates) {
      const day = (s) => { const [m, d] = s.split('-').map(Number); return m * 100 + d; };
      if (!inRange((now.getMonth() + 1) * 100 + now.getDate(), ...when.dates.map(day), true)) return false;
    }
    return true;
  }

  rotation() {
    const kept = this.pages.filter((p) => !this.fits(p.skip));
    return kept.length ? kept : this.pages;
  }

  first() {
    const timely = this.rotation().filter((p) => this.fits(p.when));
    const pool = timely.length && Math.random() < .25 ? timely : this.rotation().flatMap((p) => p.opener ? [p, p] : [p]);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  pick() {
    if (!this.bag.length) {
      this.bag = this.rotation().filter((p) => !this.current || p.id !== this.current.page.id);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    const last = this.current && this.current.page;
    for (let i = this.bag.length - 1; i >= 0; i--) {
      if (!last || !(last.family || []).some((f) => (this.bag[i].family || []).includes(f))) return this.bag.splice(i, 1)[0];
    }
    return this.bag.pop() || this.rotation()[0];
  }

  duration() { return this.current ? (this.current.page.seconds || 16) * 1000 : 0; }
  running() { return !!this.current && this.active && this.visible && !this.paused && !this.hovering && !this.explaining && this.status === 'playing'; }

  snapshot() {
    const page = this.current && this.current.page;
    return {
      status: this.status, lang: this.lang, id: page ? page.id : '',
      title: page ? ((page.title || {})[this.lang] || (page.title || {}).en || page.id) : '',
      elapsed: this.elapsed, duration: this.duration(), running: this.running(), paused: this.paused,
    };
  }

  report() { this.lastReport = performance.now(); this.onState(this.snapshot()); }

  tick(now) {
    if (this.running()) this.elapsed = Math.min(this.duration(), this.elapsed + now - this.lastTick);
    this.lastTick = now;
    if (this.current && this.status === 'playing') {
      if (this.duration() - this.elapsed < 4500 && !this.upcoming && this.pages.length > 1) this.upcoming = this.load(this.pick());
      if (this.elapsed >= this.duration() && this.running()) this.advance();
      if (now - this.lastReport >= 250) this.report();
    }
    this.raf = requestAnimationFrame(this.tick);
  }

  configure(values = {}) {
    if (!values || typeof values !== 'object') return;
    // Account for time before the incoming pause/visibility change, never for time spent hidden.
    const now = performance.now();
    if (this.running()) this.elapsed = Math.min(this.duration(), this.elapsed + now - this.lastTick);
    this.lastTick = now;
    for (const key of ['paused', 'hovering', 'visible', 'explaining']) {
      if (typeof values[key] === 'boolean') this[key] = values[key];
    }
    if ((values.lang === 'en' || values.lang === 'ko') && values.lang !== this.lang) {
      this.lang = values.lang;
      document.documentElement.lang = this.lang;
      try { localStorage.setItem('tty.lang', this.lang); } catch (error) { /* storage blocked */ }
      const page = (this.current || this.upcoming || {}).page;
      this.drop(this.upcoming);
      this.upcoming = page ? this.load(page) : null;
      if (this.active && this.upcoming) this.advance();
    }
    this.report();
  }

  start() {
    this.active = true;
    this.lastTick = performance.now();
    if (!this.current && this.upcoming && this.status === 'ready') this.advance();
  }

  load(page) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const frame = document.createElement('iframe');
    frame.title = (page.title || {})[this.lang] || (page.title || {}).en || page.id;
    frame.src = `/pages/${page.file}?lang=${this.lang}`;
    const entry = { page, slot, frame, timer: null, drawn: null };
    entry.ready = new Promise((resolve, reject) => {
      entry.resolve = () => { clearTimeout(entry.timer); clearTimeout(entry.drawn); resolve(); };
      entry.timer = setTimeout(() => reject(new Error('page timeout')), 12000);
      frame.addEventListener('load', () => {
        try {
          if (!frame.contentWindow.TTY) throw new Error('page unavailable');
        } catch (error) { reject(error); return; }
        entry.drawn = setTimeout(entry.resolve, 1200);
      }, { once: true });
      frame.addEventListener('error', () => reject(new Error('page unavailable')), { once: true });
    });
    // A preload may fail before advance() awaits it.
    entry.ready.catch(() => {});
    slot.append(frame);
    this.stage.append(slot);
    return entry;
  }

  drop(entry) {
    if (!entry) return;
    clearTimeout(entry.timer);
    clearTimeout(entry.drawn);
    entry.resolve();
    entry.slot.remove();
  }

  async advance() {
    if (!this.pages.length || !this.active) return;
    if (!this.upcoming) this.upcoming = this.load(this.pick());
    const entry = this.upcoming;
    try { await entry.ready; } catch (error) { if (this.upcoming === entry) this.fail(); return; }
    if (this.upcoming !== entry || !this.active) return;
    this.upcoming = null;
    const previous = this.current;
    this.current = entry;
    entry.slot.style.zIndex = '2';
    entry.slot.classList.add('on');
    if (previous) previous.slot.style.zIndex = '1';
    entry.frame.contentWindow.postMessage({ source: 'tty-home', type: 'show' }, location.origin);
    setTimeout(() => { if (previous !== this.current) this.drop(previous); entry.slot.style.zIndex = ''; }, this.reduce ? 0 : 800);
    this.elapsed = 0;
    this.lastTick = performance.now();
    this.status = 'playing';
    this.report();
  }

  receive(event) {
    if (event.origin !== location.origin || !event.data || event.data.source !== 'tty-page') return;
    const entry = [this.current, this.upcoming].find((e) => e && e.frame.contentWindow === event.source);
    if (!entry) return;
    if (event.data.type === 'ready') entry.resolve();
    if (event.data.type === 'hold' && entry === this.current) {
      const ms = Number.isFinite(event.data.ms) ? Math.max(0, Math.min(120000, event.data.ms)) : 12000;
      this.elapsed = Math.min(this.elapsed, Math.max(0, this.duration() - ms));
      this.lastTick = performance.now();
      this.report();
    }
    if (event.data.type === 'ask' && entry === this.current) this.onAsk();
  }

  focus() { if (this.current) this.current.frame.contentWindow.focus(); }
  fail() { this.status = 'error'; this.report(); }
  destroy() {
    this.active = false;
    cancelAnimationFrame(this.raf);
    removeEventListener('message', this.receive);
    this.drop(this.upcoming);
    this.drop(this.current);
  }
}
