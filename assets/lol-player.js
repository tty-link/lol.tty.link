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
    // Pages that failed to load this visit are left out; only three failures in a row are an error.
    this.broken = new Set();
    this.failures = 0;
    this.advancing = false;
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
      await this.next();
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
    const loads = this.pages.filter((p) => !this.broken.has(p.id));
    const kept = loads.filter((p) => !this.fits(p.skip));
    return kept.length ? kept : loads.length ? loads : this.pages;
  }

  first() {
    const timely = this.rotation().filter((p) => this.fits(p.when));
    const pool = timely.length && Math.random() < .25 ? timely : this.rotation().flatMap((p) => p.opener ? [p, p] : [p]);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  pick() {
    this.bag = this.bag.filter((p) => !this.broken.has(p.id));
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
    // The next frame is asked for first, so nothing thrown below can stop the clock.
    this.raf = requestAnimationFrame(this.tick);
    if (this.running()) this.elapsed = Math.min(this.duration(), this.elapsed + now - this.lastTick);
    this.lastTick = now;
    if (this.current && this.status === 'playing') {
      if (this.duration() - this.elapsed < 4500 && !this.upcoming && this.pages.length > 1) this.upcoming = this.load(this.pick());
      if (this.elapsed >= this.duration() && this.running() && !this.advancing) {
        this.advancing = true;
        this.advance().finally(() => { this.advancing = false; });
      }
      if (now - this.lastReport >= 250) this.report();
    }
  }

  configure(values = {}) {
    if (!values || typeof values !== 'object') return;
    // Account for time before the incoming pause/visibility change, never for time spent hidden.
    const now = performance.now();
    if (this.running()) this.elapsed = Math.min(this.duration(), this.elapsed + now - this.lastTick);
    this.lastTick = now;
    const paused = this.paused;
    for (const key of ['paused', 'hovering', 'visible', 'explaining']) {
      if (typeof values[key] === 'boolean') this[key] = values[key];
    }
    // Pause stops the joke's own motion too, not only the move to the next one.
    if (this.paused !== paused) this.tell(this.current, this.paused ? 'pause' : 'play');
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

  // Shows a given page next, now (the home's previous button). The shuffled order carries on after it.
  goto(id) {
    const page = this.pages.find((p) => p.id === id);
    if (!page) return;
    this.drop(this.upcoming);
    this.upcoming = this.load(page);
    if (this.active) this.advance();
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

  // Waits for the page loading next. One that fails (a 404, a slow network, a phone asleep) is left
  // out for the rest of the visit and another takes its place; three failures in a row are an
  // error. Resolves to null when something else replaced the page meanwhile.
  async next() {
    for (;;) {
      const entry = this.upcoming;
      try {
        await entry.ready;
        return this.upcoming === entry ? entry : null;
      } catch (error) {
        if (this.upcoming !== entry) return null;
        this.broken.add(entry.page.id);
        this.drop(entry);
        this.failures += 1;
        if (this.failures >= 3) { this.upcoming = null; throw error; }
        this.upcoming = this.load(this.pick());
      }
    }
  }

  async advance() {
    if (!this.pages.length || !this.active) return;
    if (this.status === 'error') this.failures = 0;
    if (!this.upcoming) this.upcoming = this.load(this.pick());
    let entry;
    try { entry = await this.next(); } catch (error) { this.fail(); return; }
    if (!entry || this.upcoming !== entry || !this.active) return;
    this.failures = 0;
    this.upcoming = null;
    const previous = this.current;
    // Someone reading or playing in the joke with the keyboard stays in the stage.
    const focused = previous && document.activeElement === previous.frame;
    this.current = entry;
    entry.slot.style.zIndex = '2';
    entry.slot.classList.add('on');
    if (previous) previous.slot.style.zIndex = '1';
    this.tell(entry, 'show');
    if (this.paused) this.tell(entry, 'pause');
    if (focused) entry.frame.focus();
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

  tell(entry, type) {
    if (entry && entry.frame.contentWindow) entry.frame.contentWindow.postMessage({ source: 'tty-home', type }, location.origin);
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
