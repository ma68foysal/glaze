/**
 * Kinetic theme behaviour.
 *
 * Small custom elements, one per interaction. Each one is idempotent so the
 * theme editor can re-render sections (shopify:section:load) without leaks.
 * Cart writes go through window.SkinovaCart (assets/cart.js).
 */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var MOTION_KEY = 'k-motion-paused';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function storageGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function storageSet(key, value) { try { window.localStorage.setItem(key, value); } catch (e) {} }

  if (storageGet(MOTION_KEY) === '1') root.classList.add('motion-paused');

  function define(name, ctor) {
    if (!customElements.get(name)) customElements.define(name, ctor);
  }

  // ------------------------------------------------------------------
  // <k-motion-toggle> — shopper-facing pause/play for all looping motion.
  // ------------------------------------------------------------------
  define('k-motion-toggle', class extends HTMLElement {
    connectedCallback() {
      this.button = this.querySelector('button');
      if (!this.button) return;
      this.sync();
      this.button.addEventListener('click', () => {
        var paused = !root.classList.contains('motion-paused');
        root.classList.toggle('motion-paused', paused);
        storageSet(MOTION_KEY, paused ? '1' : '0');
        document.querySelectorAll('k-motion-toggle').forEach(function (el) { el.sync(); });
        document.querySelectorAll('video[data-k-autoplay]').forEach(function (v) {
          if (paused) v.pause(); else v.play().catch(function () {});
        });
      });
    }
    sync() {
      var paused = root.classList.contains('motion-paused');
      this.button.setAttribute('aria-pressed', paused ? 'true' : 'false');
      var label = this.querySelector('[data-label]');
      if (label) label.textContent = paused ? this.dataset.playLabel : this.dataset.pauseLabel;
    }
  });

  // ------------------------------------------------------------------
  // Scroll reveal fallback for browsers without animation-timeline.
  // ------------------------------------------------------------------
  var supportsTimeline = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
  var revealObserver = null;
  function initReveals(scope) {
    var els = (scope || document).querySelectorAll('.k-reveal:not(.is-visible)');
    if (supportsTimeline || reduceMotion.matches || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px' });
    }
    els.forEach(function (el) { revealObserver.observe(el); });
  }

  // ------------------------------------------------------------------
  // Autoplay videos only when motion is allowed and they're on screen.
  // ------------------------------------------------------------------
  function motionAllowed() {
    return !reduceMotion.matches && root.dataset.motion !== 'off' && !root.classList.contains('motion-paused');
  }
  var videoObserver = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var v = entry.target;
      if (entry.isIntersecting && motionAllowed()) v.play().catch(function () {});
      else v.pause();
    });
  }, { threshold: 0.15 }) : null;
  function initVideos(scope) {
    (scope || document).querySelectorAll('video[data-k-autoplay]').forEach(function (v) {
      v.muted = true;
      if (videoObserver) videoObserver.observe(v);
    });
  }

  // ------------------------------------------------------------------
  // <k-tabs> — buttons [role=tab] switch [role=tabpanel] siblings.
  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  // ------------------------------------------------------------------
  define('k-tabs', class extends HTMLElement {
    connectedCallback() {
      this.tabs = Array.prototype.slice.call(this.querySelectorAll('[role="tab"]'));
      this.tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => this.select(i));
        tab.addEventListener('keydown', (e) => {
          var next = null;
          if (e.key === 'ArrowRight') next = (i + 1) % this.tabs.length;
          if (e.key === 'ArrowLeft') next = (i - 1 + this.tabs.length) % this.tabs.length;
          if (e.key === 'Home') next = 0;
          if (e.key === 'End') next = this.tabs.length - 1;
          if (next !== null) { e.preventDefault(); this.select(next, true); }
        });
      });
    }
    select(index, focus) {
      this.tabs.forEach((tab, i) => {
        var on = i === index;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
        if (on && focus) tab.focus();
      });
    }
  });

  // ------------------------------------------------------------------
  // <k-accordion-media> — one open item at a time; the matching media
  // panel and stat card are shown alongside.
  // ------------------------------------------------------------------
  define('k-accordion-media', class extends HTMLElement {
    connectedCallback() {
      this.buttons = Array.prototype.slice.call(this.querySelectorAll('[data-acc-button]'));
      this.buttons.forEach((btn, i) => btn.addEventListener('click', () => this.open(i)));
    }
    open(index) {
      this.buttons.forEach((btn, i) => {
        var on = i === index;
        btn.setAttribute('aria-expanded', on ? 'true' : 'false');
        btn.closest('[data-acc-item]').classList.toggle('is-open', on);
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      this.querySelectorAll('[data-acc-media]').forEach(function (m) {
        m.classList.toggle('is-active', String(m.dataset.accMedia) === String(index));
      });
    }
  });

  // ------------------------------------------------------------------
  // <k-lookbook> — hotspot pins and list rows select the same product.
  // ------------------------------------------------------------------
  define('k-lookbook', class extends HTMLElement {
    connectedCallback() {
      this.querySelectorAll('[data-look-pick]').forEach((el) => {
        el.addEventListener('click', () => this.pick(el.dataset.lookPick));
      });
    }
    pick(index) {
      this.querySelectorAll('[data-look-pick]').forEach(function (el) {
        el.setAttribute('aria-pressed', el.dataset.lookPick === index ? 'true' : 'false');
      });
      this.querySelectorAll('[data-look-detail]').forEach(function (el) {
        el.hidden = el.dataset.lookDetail !== index;
      });
    }
  });

  // ------------------------------------------------------------------
  // <k-rotator data-interval="3"> — crossfades [data-slide] children and
  // updates an optional [data-counter] and [data-progress]. Pauses when
  // motion is paused/off, when off screen and when the tab is hidden.
  // ------------------------------------------------------------------
  define('k-rotator', class extends HTMLElement {
    connectedCallback() {
      this.slides = Array.prototype.slice.call(this.querySelectorAll('[data-slide]'));
      this.counter = this.querySelector('[data-counter]') || (this.closest('section') || document).querySelector('[data-counter]');
      this.progress = (this.closest('section') || document).querySelector('[data-progress]');
      this.index = 0;
      this.interval = (parseFloat(this.dataset.interval) || 3) * 1000;
      this.visible = true;
      if (this.slides.length < 2) return;
      if ('IntersectionObserver' in window) {
        this.io = new IntersectionObserver((entries) => { this.visible = entries[0].isIntersecting; });
        this.io.observe(this);
      }
      this.show(0);
      this.timer = setInterval(() => {
        if (!this.visible || document.hidden || !motionAllowed()) return;
        this.show((this.index + 1) % this.slides.length);
      }, this.interval);
    }
    disconnectedCallback() {
      clearInterval(this.timer);
      if (this.io) this.io.disconnect();
    }
    show(i) {
      this.index = i;
      this.slides.forEach(function (s, n) { s.classList.toggle('is-active', n === i); });
      if (this.counter) this.counter.textContent = String(i + 1).padStart(2, '0');
      if (this.progress && motionAllowed()) {
        var bar = this.progress;
        bar.style.transition = 'none';
        bar.style.transform = 'scaleX(0)';
        void bar.offsetWidth;
        bar.style.transition = 'transform ' + this.interval + 'ms linear';
        bar.style.transform = 'scaleX(1)';
      }
    }
  });

  // ------------------------------------------------------------------
  // <k-rail> — previous/next buttons for a horizontal scroll-snap track.
  // Buttons hide when everything fits, and disable at either end.
  // ------------------------------------------------------------------
  define('k-rail', class extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-rail-track]');
      this.prev = this.querySelector('[data-rail-prev]');
      this.next = this.querySelector('[data-rail-next]');
      if (!this.track) return;
      var step = (dir) => {
        var item = this.track.firstElementChild;
        var gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
        var by = item ? item.getBoundingClientRect().width + gap : this.track.clientWidth;
        this.track.scrollBy({ left: dir * by, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      };
      if (this.prev) this.prev.addEventListener('click', () => step(-1));
      if (this.next) this.next.addEventListener('click', () => step(1));
      this.update = this.update.bind(this);
      this.track.addEventListener('scroll', this.update, { passive: true });
      if ('ResizeObserver' in window) { this.ro = new ResizeObserver(this.update); this.ro.observe(this.track); }
      this.update();
    }
    disconnectedCallback() { if (this.ro) this.ro.disconnect(); }
    update() {
      var t = this.track;
      var max = t.scrollWidth - t.clientWidth - 2;
      this.classList.toggle('k-rail-wrap--static', max <= 0);
      if (this.prev) this.prev.disabled = t.scrollLeft <= 2;
      if (this.next) this.next.disabled = t.scrollLeft >= max;
    }
  });

  // ------------------------------------------------------------------
  // Quick add: any button with data-quick-add="<variant id>".
  // ------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-quick-add]');
    if (!btn || btn.disabled) return;
    if (!window.SkinovaCart) return; // falls through to the product link
    e.preventDefault();
    btn.classList.add('k-loading');
    btn.setAttribute('aria-busy', 'true');
    window.SkinovaCart.addToCart(btn.dataset.quickAdd, { quantity: 1, sourceButton: btn, source: 'quick-add' })
      .catch(function (err) {
        var msg = btn.parentElement.querySelector('[data-quick-add-error]');
        if (msg) { msg.textContent = err.message; msg.hidden = false; }
      })
      .finally(function () {
        btn.classList.remove('k-loading');
        btn.removeAttribute('aria-busy');
      });
  });

  // ------------------------------------------------------------------
  // <k-modal> — wraps a <details> used as a modal (menu drawer, search).
  // Adds Escape, focus trap, scroll lock and focus return.
  // ------------------------------------------------------------------
  define('k-modal', class extends HTMLElement {
    connectedCallback() {
      this.details = this.querySelector('details');
      if (!this.details) return;
      this.summary = this.details.querySelector('summary');
      this.details.addEventListener('toggle', () => this.onToggle());
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.details.open) { e.preventDefault(); this.close(); }
        if (e.key === 'Tab' && this.details.open) this.trap(e);
      });
      this.querySelectorAll('[data-modal-close]').forEach((el) => el.addEventListener('click', (e) => {
        if (el.tagName !== 'A') e.preventDefault();
        this.close();
      }));
    }
    onToggle() {
      var open = this.details.open;
      document.body.style.overflow = open ? 'hidden' : '';
      if (window.lenis) { open ? window.lenis.stop() : window.lenis.start(); }
      if (open) {
        var first = this.querySelector('[data-modal-focus]') || this.details.querySelector('.k-modal__panel a, .k-modal__panel button, .k-modal__panel input');
        if (first) setTimeout(function () { first.focus(); }, 30);
      }
    }
    close() {
      this.details.open = false;
      if (this.summary) this.summary.focus();
    }
    trap(e) {
      var panel = this.querySelector('.k-modal__panel');
      if (!panel) return;
      var f = panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ------------------------------------------------------------------
  // Header: close open dropdowns on outside click or Escape, and only one
  // dropdown open at a time.
  // ------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    document.querySelectorAll('.k-header details.k-dropdown[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.open = false;
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.k-header details.k-dropdown[open]').forEach(function (d) {
      d.open = false;
      var s = d.querySelector('summary'); if (s) s.focus();
    });
  });
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.classList.contains('k-dropdown') || !d.open) return;
    document.querySelectorAll('.k-header details.k-dropdown[open]').forEach(function (o) { if (o !== d) o.open = false; });
  }, true);

  // Sticky header: mark when scrolled so it can gain a border/background.
  var header = null;
  function onScroll() {
    if (!header) header = document.querySelector('.k-header');
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ------------------------------------------------------------------
  // Boot + theme editor hooks
  // ------------------------------------------------------------------
  function init(scope) {
    initReveals(scope);
    initVideos(scope);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); onScroll(); });
  else { init(); onScroll(); }

  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
  document.addEventListener('shopify:block:select', function (e) {
    var el = e.target;
    var lookIndex = el.dataset && el.dataset.lookBlock;
    var look = el.closest && el.closest('k-lookbook');
    if (look && lookIndex != null) look.pick(lookIndex);
    var acc = el.closest && el.closest('k-accordion-media');
    if (acc && el.dataset.accIndex != null) acc.open(parseInt(el.dataset.accIndex, 10));
  });
})();
