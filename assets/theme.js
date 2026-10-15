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
  // <k-product> — product page gallery and quantity stepper.
  //   showMedia(id) brings a media item forward: in the editorial and
  //   stacked layouts it moves to the first (wide) slot, in the thumbnails
  //   layout it becomes the visible item. On phones the slider scrolls to it.
  // ------------------------------------------------------------------
  define('k-product', class extends HTMLElement {
    connectedCallback() {
      this.list = this.querySelector('.k-pdp__media-list');
      this.thumbsLayout = this.classList.contains('k-pdp__grid--thumbnails');
      this.addEventListener('click', (e) => {
        var thumb = e.target.closest('[data-thumb]');
        if (thumb) { this.showMedia(thumb.dataset.thumb); return; }
        var step = e.target.closest('[data-media-step]');
        if (step) { this.step(parseInt(step.dataset.mediaStep, 10)); return; }
        var zoomable = e.target.closest('.k-pdp__gallery--zoom .k-pdp__media .k-media');
        if (zoomable && !window.matchMedia('(max-width: 900px)').matches) { this.toggleZoom(zoomable, e); return; }
        var qty = e.target.closest('[data-qty-step]');
        if (qty) {
          var input = qty.parentElement.querySelector('input');
          input.value = Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(qty.dataset.qtyStep, 10));
        }
      });
      if (this.list) {
        this.bindDrag();
        this.counter = this.querySelector('[data-media-index]');
        this.list.addEventListener('scroll', () => this.syncCounter(), { passive: true });
      }
    }
    items() { return this.list ? Array.prototype.slice.call(this.list.children) : []; }
    // Click zooms the image in place; the pointer moves the zoomed area.
    toggleZoom(frame, e) {
      var item = frame.closest('.k-pdp__media');
      var on = !item.classList.contains('is-zoomed');
      this.items().forEach(function (el) { el.classList.remove('is-zoomed'); });
      if (!on) return;
      var move = function (ev) {
        var r = frame.getBoundingClientRect();
        frame.style.setProperty('--zx', ((ev.clientX - r.left) / r.width * 100) + '%');
        frame.style.setProperty('--zy', ((ev.clientY - r.top) / r.height * 100) + '%');
      };
      move(e);
      item.classList.add('is-zoomed');
      frame.addEventListener('pointermove', move);
      frame.addEventListener('pointerleave', function leave() {
        item.classList.remove('is-zoomed');
        frame.removeEventListener('pointermove', move);
        frame.removeEventListener('pointerleave', leave);
      });
    }
    currentIndex() {
      var items = this.items();
      if (window.matchMedia('(max-width: 900px)').matches) {
        var left = this.list.scrollLeft, best = Infinity, index = 0;
        items.forEach(function (el, i) {
          var d = Math.abs(el.offsetLeft - items[0].offsetLeft - left);
          if (d < best) { best = d; index = i; }
        });
        return index;
      }
      return Math.max(0, items.findIndex(function (el) { return el.classList.contains('is-active'); }));
    }
    step(dir) {
      var items = this.items();
      var next = items[(this.currentIndex() + dir + items.length) % items.length];
      if (next) this.showMedia(next.dataset.mediaId);
    }
    // Mouse drag-to-swipe for the phone-width slider (touch swipes natively).
    bindDrag() {
      var list = this.list, startX = 0, startLeft = 0, dragging = false, moved = false;
      list.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        if (!window.matchMedia('(max-width: 900px)').matches) return;
        dragging = true; moved = false; startX = e.clientX; startLeft = list.scrollLeft;
      });
      window.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 4) { moved = true; list.classList.add('is-dragging'); }
        list.scrollLeft = startLeft - dx;
      });
      window.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        list.classList.remove('is-dragging');
        if (!moved) return;
        var target = this.items()[this.currentIndex()];
        if (target) this.showMedia(target.dataset.mediaId);
      });
      // A drag must not also follow a link inside the slide.
      list.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    }
    showMedia(id) {
      var items = this.items();
      var target = items.find(function (el) { return el.dataset.mediaId === String(id); });
      if (!target) return;
      var mobile = window.matchMedia('(max-width: 900px)').matches;
      if (!this.thumbsLayout && !mobile && target !== items[0]) {
        // Promote to the wide slot.
        items[0].classList.remove('k-pdp__media--big');
        this.list.prepend(target);
        target.classList.add('k-pdp__media--big');
        target.style.setProperty('--pos', 1);
      }
      this.items().forEach(function (el) { el.classList.toggle('is-active', el === target); });
      this.querySelectorAll('[data-thumb]').forEach(function (t) {
        t.setAttribute('aria-current', t.dataset.thumb === String(id) ? 'true' : 'false');
      });
      if (mobile) {
        // Clamp to the real maximum: a smooth scroll aimed past the end is cancelled by scroll-snap.
        var maxLeft = this.list.scrollWidth - this.list.clientWidth;
        var left = target.offsetLeft - this.list.offsetLeft - parseFloat(getComputedStyle(this.list).paddingLeft);
        this.list.scrollTo({ left: Math.max(0, Math.min(maxLeft, left)), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      }
      // Pause any other playing video when switching.
      this.querySelectorAll('.k-pdp__media:not(.is-active) video').forEach(function (v) { v.pause(); });
      // On phones the scroll event updates the counter once the slider arrives.
      if (!mobile) this.syncCounter();
    }
    syncCounter() {
      if (!this.counter) return;
      var items = this.items();
      var mobile = window.matchMedia('(max-width: 900px)').matches;
      var index = 0;
      if (mobile) {
        var left = this.list.scrollLeft;
        var best = Infinity;
        items.forEach(function (el, i) {
          var d = Math.abs(el.offsetLeft - items[0].offsetLeft - left);
          if (d < best) { best = d; index = i; }
        });
      } else {
        index = Math.max(0, items.findIndex(function (el) { return el.classList.contains('is-active'); }));
      }
      this.counter.textContent = index + 1;
      if (mobile) {
        var id = items[index] && items[index].dataset.mediaId;
        this.querySelectorAll('[data-thumb]').forEach(function (t) {
          t.setAttribute('aria-current', t.dataset.thumb === id ? 'true' : 'false');
        });
      }
    }
  });

  // ------------------------------------------------------------------
  // <k-variant-picker> — matches the selected options to a variant and
  // updates price, SKU, the add-to-bag button, the URL and which option
  // values are unavailable. Fires mp:variant-change for pickup availability.
  // ------------------------------------------------------------------
  define('k-variant-picker', class extends HTMLElement {
    connectedCallback() {
      try { this.variants = JSON.parse(this.querySelector('[data-variants]').textContent); } catch (e) { this.variants = []; }
      this.fieldsets = Array.prototype.slice.call(this.querySelectorAll('[data-option-position]'));
      this.form = document.getElementById(this.dataset.formId);
      this.section = this.closest('.k-pdp') || document;
      this.addEventListener('change', (e) => { if (e.target.matches('[data-option-value]')) this.onChange(); });
      this.updateAvailability(this.selected());
    }
    selected() {
      return this.fieldsets.map(function (fs) {
        var checked = fs.querySelector('[data-option-value]:checked');
        return checked ? checked.value : null;
      });
    }
    find(options) {
      return this.variants.find(function (v) {
        return v.options.every(function (o, i) { return o === options[i]; });
      }) || null;
    }
    updateAvailability(sel) {
      var variants = this.variants;
      this.fieldsets.forEach(function (fs, i) {
        fs.querySelectorAll('[data-option-value]').forEach(function (input) {
          var ok = variants.some(function (v) {
            if (!v.available || v.options[i] !== input.value) return false;
            return v.options.every(function (o, j) { return j === i || sel[j] == null || o === sel[j]; });
          });
          var label = fs.querySelector('label[for="' + input.id + '"]');
          if (!label) return;
          label.classList.toggle('is-unavailable', !ok);
          var oos = label.querySelector('.k-pdp__oos-text');
          if (oos) oos.hidden = ok;
        });
        var chosen = fs.querySelector('[data-option-value]:checked');
        var out = fs.querySelector('[data-option-selected]');
        if (chosen && out) out.textContent = chosen.value;
      });
    }
    onChange() {
      var sel = this.selected();
      var v = this.find(sel);
      this.updateAvailability(sel);

      var idInput = this.form && this.form.querySelector('[data-variant-id-input]');
      var atc = this.form && this.form.querySelector('[data-atc]');
      var atcText = atc && atc.querySelector('[data-atc-text]');

      if (atc) {
        if (!v) {
          atc.disabled = true;
          atcText.textContent = atc.dataset.labelUnavailable;
        } else if (!v.available) {
          atc.disabled = true;
          atcText.textContent = atc.dataset.labelSoldOut;
        } else {
          atc.disabled = false;
          atcText.textContent = (v.pre && atc.dataset.labelPreorder ? atc.dataset.labelPreorder : atc.dataset.labelAdd) + ' — ' + v.price;
        }
      }
      var pre = this.form && this.form.querySelector('[data-preorder]');
      if (pre) pre.hidden = !(v && v.pre);
      if (!v) return;

      if (idInput) {
        idInput.value = v.id;
        idInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      var price = this.section.querySelector('[data-price]');
      if (price) {
        price.textContent = '';
        var cur = document.createElement('span');
        cur.className = 'k-price__current';
        cur.textContent = v.price;
        price.appendChild(cur);
        if (v.compare) {
          var cmp = document.createElement('s');
          cmp.className = 'k-price__compare';
          cmp.textContent = v.compare;
          price.appendChild(cmp);
        }
        if (v.unit) {
          var unit = document.createElement('span');
          unit.className = 'k-price__unit';
          unit.textContent = v.unit;
          price.appendChild(unit);
        }
      }

      var sku = this.section.querySelector('[data-sku]');
      if (sku) {
        sku.hidden = !v.sku;
        var skuValue = sku.querySelector('[data-sku-value]');
        if (skuValue) skuValue.textContent = v.sku || '';
      }

      var save = this.section.querySelector('[data-save]');
      if (save) {
        save.hidden = !v.save;
        if (v.save) save.textContent = save.dataset.template.replace('[amount]', v.save);
      }
      var badge = this.section.querySelector('[data-sale-badge]');
      if (badge) {
        badge.hidden = !v.off;
        if (v.off) badge.textContent = badge.dataset.template.replace('[percent]', v.off);
      }
      var stock = this.section.querySelector('[data-stock]');
      if (stock) {
        var low = v.qty != null && v.qty > 0 && v.qty <= parseInt(stock.dataset.threshold, 10);
        stock.hidden = !(low || (stock.dataset.showIn === 'true' && v.available));
        stock.querySelector('i').classList.toggle('is-low', low);
        stock.querySelector('[data-stock-text]').textContent = low ? stock.dataset.labelLow : stock.dataset.labelIn;
      }
      var bar = document.querySelector('[data-sticky-atc][data-form-id="' + this.dataset.formId + '"]');
      if (bar) {
        var barVariant = bar.querySelector('[data-bar-variant]');
        if (barVariant) barVariant.textContent = v.title;
        bar.querySelector('[data-bar-price]').textContent = v.price;
        var barBtn = bar.querySelector('[data-bar-atc]');
        barBtn.disabled = !v.available;
        if (atc) barBtn.querySelector('[data-bar-text]').textContent = v.available ? atc.dataset.labelAdd : atc.dataset.labelSoldOut;
      }

      if (v.media) {
        var product = this.closest('k-product');
        if (product) product.showMedia(v.media);
      }

      if (this.dataset.url && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', v.id);
        window.history.replaceState({}, '', url.toString());
      }

      this.dispatchEvent(new CustomEvent('mp:variant-change', { bubbles: true, detail: { variantId: v.id } }));
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
  // <k-complementary> — swaps in complementary products from the
  // Search and Discovery app; keeps the fallback list when there are none.
  // ------------------------------------------------------------------
  define('k-complementary', class extends HTMLElement {
    connectedCallback() {
      var load = () => {
        fetch(this.dataset.url)
          .then(function (r) { return r.text(); })
          .then((html) => {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var fresh = doc.querySelector('[data-complementary="' + this.dataset.blockId + '"]');
            var current = this.querySelector('[data-complementary]');
            if (fresh && current && fresh.querySelector('li')) current.innerHTML = fresh.innerHTML;
          })
          .catch(function () {});
      };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) { io.disconnect(); load(); }
        }, { rootMargin: '0px 0px 300px 0px' });
        io.observe(this);
      } else {
        load();
      }
    }
  });

  // Share: the native share sheet where there is one, otherwise copy the link.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-share]');
    if (!btn) return;
    var url = btn.dataset.url || window.location.href;
    if (navigator.share) {
      navigator.share({ title: btn.dataset.title, url: url }).catch(function () {});
      return;
    }
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(url).then(function () {
      var text = btn.querySelector('[data-share-text]');
      var original = text.textContent;
      text.textContent = btn.dataset.labelCopied;
      setTimeout(function () { text.textContent = original; }, 2000);
    });
  });

  // Sticky add-to-cart bar: shown once the main button has scrolled out of view.
  document.querySelectorAll('[data-sticky-atc]').forEach(function (bar) {
    var form = document.getElementById(bar.dataset.formId);
    var atc = form && form.querySelector('[data-atc]');
    if (!atc || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      var entry = entries[0];
      var show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      bar.classList.toggle('is-visible', show);
      bar.setAttribute('aria-hidden', show ? 'false' : 'true');
      bar.inert = !show;
    }).observe(atc);
    bar.querySelector('[data-bar-atc]').addEventListener('click', function () { atc.click(); });
  });

  // ------------------------------------------------------------------
  // <k-predictive-search> — header search suggestions from the Predictive
  // Search API. The input is an ARIA combobox; results are a listbox
  // rendered by sections/predictive-search.liquid.
  // ------------------------------------------------------------------
  // Wrap the searched words in <mark> inside [data-highlight] elements.
  function highlight(root, term) {
    if (!term) return;
    var words = term.split(/\s+/).filter(function (w) { return w.length > 1; })
      .map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!words.length) return;
    var re = new RegExp('(' + words.join('|') + ')', 'gi');
    root.querySelectorAll('[data-highlight]').forEach(function (el) {
      if (el.dataset.highlighted) return;
      el.dataset.highlighted = '1';
      var text = el.textContent;
      el.textContent = '';
      text.split(re).forEach(function (part, i) {
        if (!part) return;
        if (i % 2) { var m = document.createElement('mark'); m.textContent = part; el.appendChild(m); }
        else el.appendChild(document.createTextNode(part));
      });
    });
  }
  window.ObliqueHighlight = highlight;

  // ------------------------------------------------------------------
  // Page transitions: the clicked card's photo is named "k-photo" so the
  // browser moves it into the product page, whose main photo carries the
  // same name in CSS. The product photo's name is dropped while a card on
  // the product page travels, so the name is never used twice.
  // ------------------------------------------------------------------
  (function () {
    if (!('onpageswap' in window)) return;
    var html = document.documentElement;
    var still = function () { return html.dataset.motion === 'off' || html.classList.contains('motion-paused') || reduceMotion.matches; };
    var named = null;
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href*="/products/"]');
      if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || link.target === '_blank') return;
      var card = link.closest('.k-card, .k-ps__pr, .k-pdp__pair, .k-art__sp');
      var img = card && card.querySelector('img');
      if (!img) return;
      if (named) named.style.viewTransitionName = '';
      html.classList.add('k-vt-card');
      img.style.viewTransitionName = 'k-photo';
      named = img;
    }, true);
    window.addEventListener('pageswap', function (e) {
      if (e.viewTransition && still()) e.viewTransition.skipTransition();
    });
    // Coming back from the browser cache: clear the travelling photo.
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      html.classList.remove('k-vt-card');
      if (named) { named.style.viewTransitionName = ''; named = null; }
    });
  })();

  // Back to top: shown after scrolling past the first screen; the ring
  // shows how far down the page the shopper is.
  (function () {
    var btn = document.querySelector('[data-back-to-top]');
    if (!btn) return;
    var ticking = false;
    var update = function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var y = window.scrollY;
      btn.style.setProperty('--progress', max > 0 ? Math.min(1, y / max).toFixed(3) : 0);
      var show = y > window.innerHeight;
      btn.classList.toggle('is-visible', show);
      btn.tabIndex = show ? 0 : -1;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
    btn.addEventListener('click', function () {
      if (window.lenis) window.lenis.scrollTo(0);
      else window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      var skip = document.getElementById('main-content');
      if (skip) skip.focus({ preventScroll: true });
    });
  })();

  // "View" cursor over photos (settings.custom_cursor). Mouse users only.
  (function () {
    var label = document.documentElement.dataset.cursor;
    if (!label || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    // Only photos that open something; the lookbook photo holds hotspots, not a link.
    var TARGETS = '.k-card__media, a .k-media, a.k-media, .k-tile, .k-acard__img';
    var SKIP = 'button, input, select, textarea, [data-quick-add], [data-save], .k-look__pin, .k-details__pin, .k-card__qa';
    var el = document.createElement('div');
    el.className = 'k-cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="k-cursor__dot"></span>';
    el.firstChild.textContent = label;
    document.body.appendChild(el);
    var x = 0, y = 0, frame = 0;
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var on = !!e.target.closest(TARGETS) && !e.target.closest(SKIP);
      el.classList.toggle('is-on', on);
      x = e.clientX; y = e.clientY;
      if (!frame) frame = requestAnimationFrame(function () { frame = 0; el.style.transform = 'translate(' + x + 'px, ' + y + 'px)'; });
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { el.classList.remove('is-on'); });
    window.addEventListener('blur', function () { el.classList.remove('is-on'); });
  })();

  // "/" opens the header search from anywhere outside a text field.
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var details = document.querySelector('.k-header__search-modal details');
    if (!details) return;
    e.preventDefault();
    details.open = true;
  });

  define('k-predictive-search', class extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('[data-predictive-input]');
      this.results = this.querySelector('[data-predictive-results]');
      this.status = this.querySelector('[data-predictive-status]');
      if (!this.input || !this.results) return;
      this.cache = {};
      var timer;
      this.clearBtn = this.querySelector('[data-predictive-clear]');
      this.input.addEventListener('input', () => {
        if (this.clearBtn) this.clearBtn.hidden = !this.input.value;
        clearTimeout(timer);
        timer = setTimeout(() => this.search(this.input.value.trim()), 250);
      });
      if (this.clearBtn) {
        this.clearBtn.hidden = !this.input.value;
        this.clearBtn.addEventListener('click', () => {
          this.input.value = '';
          this.clearBtn.hidden = true;
          this.search('');
          this.input.focus();
        });
      }
      // Popular searches fill the input instead of leaving the page.
      this.addEventListener('click', (e) => {
        var pick = e.target.closest('[data-predictive-term]');
        if (!pick) return;
        e.preventDefault();
        this.input.value = pick.dataset.predictiveTerm;
        if (this.clearBtn) this.clearBtn.hidden = false;
        this.search(this.input.value);
        this.input.focus();
      });
      this.input.addEventListener('focus', () => {
        if (this.results.innerHTML.trim() && this.input.value.trim()) this.open();
      });
      this.input.addEventListener('keydown', (e) => this.onKey(e));
      this.addEventListener('focusout', () => {
        setTimeout(() => { if (!this.contains(document.activeElement)) this.close(); }, 0);
      });
    }
    search(q) {
      this.term = q;
      if (!q) { this.close(); this.results.innerHTML = ''; return; }
      if (this.cache[q] != null) { this.render(this.cache[q]); return; }
      if (this.controller) this.controller.abort();
      this.controller = new AbortController();
      var base = (window.routes && window.routes.predictive_search_url) || '/search/suggest';
      var url = base + '?q=' + encodeURIComponent(q) +
        '&section_id=' + encodeURIComponent(this.dataset.sectionId) +
        '&resources[type]=product,collection,article,page,query' +
        '&resources[limit]=4&resources[limit_scope]=each&resources[options][prefix]=last';
      this.setAttribute('aria-busy', 'true');
      fetch(url, { signal: this.controller.signal })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then((html) => {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var list = doc.querySelector('#predictive-search-listbox');
          var markup = list ? list.outerHTML : '';
          this.cache[q] = markup;
          if (q === this.term) this.render(markup);
        })
        .catch((err) => { if (err.name !== 'AbortError') this.close(); })
        .finally(() => this.removeAttribute('aria-busy'));
    }
    render(markup) {
      this.results.innerHTML = markup;
      if (!markup) { this.close(); return; }
      highlight(this.results, this.term);
      var status = this.results.querySelector('[data-ps-status]');
      if (this.status && status) this.status.textContent = status.textContent;
      this.open();
    }
    options() { return Array.prototype.slice.call(this.results.querySelectorAll('[role="option"]')); }
    open() {
      this.results.hidden = false;
      this.input.setAttribute('aria-expanded', 'true');
    }
    close() {
      this.results.hidden = true;
      this.input.setAttribute('aria-expanded', 'false');
      this.input.removeAttribute('aria-activedescendant');
      this.options().forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
    }
    select(index) {
      var opts = this.options();
      if (!opts.length) return;
      var i = (index + opts.length) % opts.length;
      opts.forEach(function (o, j) { o.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
      this.input.setAttribute('aria-activedescendant', opts[i].id);
      opts[i].scrollIntoView({ block: 'nearest' });
    }
    onKey(e) {
      var expanded = !this.results.hidden;
      var opts = this.options();
      var current = opts.findIndex(function (o) { return o.getAttribute('aria-selected') === 'true'; });
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!opts.length) return;
        e.preventDefault();
        if (!expanded) this.open();
        if (e.key === 'ArrowDown') this.select(current + 1);
        else this.select(current === -1 ? opts.length - 1 : current - 1);
      } else if (e.key === 'Enter' && expanded && current > -1) {
        e.preventDefault();
        opts[current].click();
      } else if (e.key === 'Escape' && expanded) {
        // Close the suggestions first; a second Escape closes the search panel.
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    }
  });

  // ------------------------------------------------------------------
  // <k-filter-drawer> — the filter panel from snippets/k-facets.
  // Opened by [data-filter-open][aria-controls]; Escape and a focus trap.
  // ------------------------------------------------------------------
  define('k-filter-drawer', class extends HTMLElement {
    connectedCallback() {
      this.panel = this.querySelector('[role="dialog"]');
      this.querySelectorAll('[data-filter-close]').forEach((b) => b.addEventListener('click', () => this.close()));
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); this.close(); }
        if (e.key !== 'Tab') return;
        var f = this.panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }
    open(trigger) {
      this.trigger = trigger;
      this.hidden = false;
      document.body.style.overflow = 'hidden';
      var first = this.panel.querySelector('button, input');
      if (first) setTimeout(function () { first.focus(); }, 30);
    }
    close() {
      this.hidden = true;
      document.body.style.overflow = '';
      if (this.trigger) this.trigger.focus();
    }
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter-open]');
    if (!btn) return;
    var drawer = document.getElementById(btn.getAttribute('aria-controls'));
    if (drawer && drawer.open) drawer.open(btn);
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-sort-select]')) e.target.form.submit();
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

/* <k-countdown>: Next drop section and the password page. */
  if (!customElements.get('k-countdown')) {
  customElements.define('k-countdown', class extends HTMLElement {
    connectedCallback() {
      var focus = this.querySelector('[data-focus-on-load]');
      if (focus) focus.focus();
      this.end = Date.parse(this.dataset.end);
      if (isNaN(this.end) || this.hasAttribute('data-ended')) return;
      this.units = {};
      this.querySelectorAll('[data-unit]').forEach((el) => { this.units[el.dataset.unit] = el; });
      this.tick();
      this.timer = setInterval(() => this.tick(), 1000);
    }
    disconnectedCallback() { clearInterval(this.timer); }
    tick() {
      var s = Math.max(0, Math.floor((this.end - Date.now()) / 1000));
      var v = { days: Math.floor(s / 86400), hours: Math.floor(s % 86400 / 3600), minutes: Math.floor(s % 3600 / 60), seconds: s % 60 };
      Object.keys(v).forEach((k) => {
        var el = this.units[k];
        if (!el) return;
        var t = (v[k] < 10 ? '0' : '') + v[k];
        if (el.textContent === t) return;
        el.textContent = t;
        el.classList.remove('is-tick'); void el.offsetWidth; el.classList.add('is-tick');
      });
      if (s === 0) this.finish();
    }
    finish() {
      clearInterval(this.timer);
      if (this.dataset.after === 'hide' && !window.Shopify?.designMode) { this.hidden = true; return; }
      this.querySelectorAll('[data-drop-live-hide]').forEach(function (el) { el.hidden = true; });
      this.querySelectorAll('[data-drop-live]').forEach(function (el) { el.hidden = false; });
      // Drop mode on the product page: reveal the buy buttons and bring the gallery into focus.
      if (this.dataset.unlock) {
        document.querySelectorAll('[data-unlock-target="' + this.dataset.unlock + '"]').forEach(function (el) { el.hidden = false; });
        var pdp = this.closest('.k-pdp');
        if (pdp) pdp.classList.remove('is-drop-locked');
      }
    }
  });
}

/* Quick view: links with data-quick-view open the product in the side dialog.
   The content is the quick-view section, rendered by Shopify for that product. */
(function () {
  var dialog = document.querySelector('dialog[data-quick-view-dialog]');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var body = dialog.querySelector('[data-qv-body]');
  var opener = null;
  var seq = 0;

  function load(href) {
    var mine = ++seq;
    var url = new URL(href, window.location.href);
    url.searchParams.set('section_id', 'quick-view');
    body.classList.add('is-loading');
    if (!body.firstElementChild) body.innerHTML = '<div class="k-qv-dialog__skel" aria-hidden="true"><i></i><i></i></div>';
    return fetch(url.toString(), { headers: { Accept: 'text/html' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        if (mine !== seq) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var root = doc.querySelector('[data-qv-root]');
        if (!root) throw new Error('no quick view');
        body.innerHTML = '';
        body.appendChild(document.importNode(root, true));
        body.classList.remove('is-loading');
        var title = body.querySelector('h2[id]');
        if (title) dialog.setAttribute('aria-labelledby', title.id);
        var first = body.querySelector('[data-option-value]:checked, [data-atc]');
        if (first) first.focus({ preventScroll: true });
      });
  }

  function open(link) {
    opener = link;
    body.innerHTML = '';
    dialog.showModal();
    document.documentElement.classList.add('k-qv-lock');
    if (window.lenis && typeof window.lenis.stop === 'function') window.lenis.stop();
    load(link.href).catch(function () { window.location.href = link.href; });
  }

  function close() { if (dialog.open) dialog.close(); }

  dialog.addEventListener('close', function () {
    document.documentElement.classList.remove('k-qv-lock');
    if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start();
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  });

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-quick-view]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    open(link);
  });

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog || e.target.closest('[data-qv-close]')) { close(); return; }
    var swap = e.target.closest('a[data-qv-swap]');
    if (swap) { e.preventDefault(); load(swap.href).catch(function () { window.location.href = swap.href; }); return; }
    var thumb = e.target.closest('[data-qv-thumb]');
    if (thumb) showMedia(thumb.dataset.qvThumb);
  });

  function showMedia(id) {
    var thumb = body.querySelector('[data-qv-thumb="' + id + '"]');
    var img = body.querySelector('[data-qv-main] img');
    if (!thumb || !img) return;
    img.removeAttribute('srcset');
    img.src = thumb.dataset.src;
    img.alt = thumb.dataset.alt || '';
    body.querySelectorAll('[data-qv-thumb]').forEach(function (b) { b.setAttribute('aria-pressed', b === thumb ? 'true' : 'false'); });
  }

  // A variant with its own photo shows it.
  dialog.addEventListener('mp:variant-change', function (e) {
    var picker = e.target.closest('k-variant-picker');
    var v = picker && picker.variants && picker.variants.find(function (x) { return x.id === e.detail.variantId; });
    if (v && v.media) showMedia(v.media);
  });

  // Adding to the bag hands over to the cart drawer, so close the window first.
  dialog.addEventListener('submit', function () { setTimeout(close, 0); });
})();

/* <k-fit>: size finder on the product page (snippets/k-pdp-fit). Three steps,
   then a recommendation that selects the size in the variant picker. */
if (!customElements.get('k-fit')) {
  customElements.define('k-fit', class extends HTMLElement {
    connectedCallback() {
      this.finder = this.querySelector('[data-fit-finder]');
      if (!this.finder) return;
      try { this.chart = JSON.parse(this.querySelector('[data-fit-chart]').textContent); } catch (e) { this.chart = []; }
      if (this.chart.length < 2) return;
      this.openBtn = this.querySelector('[data-fit-open]');
      this.steps = Array.from(this.finder.querySelectorAll('[data-step]'));
      this.bars = Array.from(this.finder.querySelectorAll('.k-fit__steps span'));
      this.next = this.finder.querySelector('[data-fit-next]');
      this.back = this.finder.querySelector('[data-fit-back]');
      this.range = this.finder.querySelector('[data-fit-h]');
      this.step = 1;
      var usual = this.finder.querySelector('[data-fit-usual]');
      var name = this.finder.id + '-usual';
      this.chart.forEach((row, i) => {
        var label = document.createElement('label');
        var input = document.createElement('input');
        input.type = 'radio'; input.name = name; input.value = String(i);
        if (i === Math.floor(this.chart.length / 2)) input.checked = true;
        var span = document.createElement('span');
        span.textContent = row.size;
        label.appendChild(input); label.appendChild(span);
        usual.appendChild(label);
      });
      this.range.addEventListener('input', () => { this.finder.querySelector('[data-fit-h-out]').textContent = this.range.value; });
      this.openBtn.addEventListener('click', () => this.toggle(true));
      this.finder.querySelector('[data-fit-x]').addEventListener('click', () => this.toggle(false));
      this.finder.addEventListener('click', (e) => { if (e.target === this.finder) this.toggle(false); });
      this.next.addEventListener('click', () => { if (this.step < 4) this.go(this.step + 1); else this.use(); });
      this.back.addEventListener('click', () => { if (this.step > 1 && this.step < 4) this.go(this.step - 1); else this.toggle(false); });
    }
    toggle(open) {
      if (open) {
        this.go(1);
        if (typeof this.finder.showModal === 'function') this.finder.showModal(); else this.finder.setAttribute('open', '');
        this.range.focus();
      } else {
        if (typeof this.finder.close === 'function' && this.finder.open) this.finder.close(); else this.finder.removeAttribute('open');
        this.openBtn.focus();
      }
    }
    go(n) {
      this.step = n;
      this.steps.forEach((s) => { s.hidden = s.dataset.step !== String(n); });
      this.bars.forEach((b, i) => b.classList.toggle('is-on', i < Math.min(n, 3)));
      this.finder.querySelector('.k-fit__steps').hidden = n === 4;
      this.back.textContent = (n > 1 && n < 4 ? this.finder.querySelector('[data-fit-label-back]') : this.finder.querySelector('[data-fit-label-close]')).textContent;
      if (n === 4) {
        this.size = this.recommend();
        this.finder.querySelector('[data-fit-size]').textContent = this.size;
        var title = this.finder.querySelector('[data-fit-title]');
        title.textContent = title.dataset.template.replace('[size]', this.size);
        this.next.textContent = this.next.dataset.labelUse.replace('[size]', this.size);
      } else {
        this.next.textContent = this.next.dataset.labelNext;
      }
    }
    recommend() {
      var h = parseInt(this.range.value, 10);
      var chart = this.chart;
      // The row whose range centre is closest to the height.
      var byHeight = 0, best = Infinity;
      chart.forEach(function (row, i) {
        var d = Math.abs(h - (row.min + row.max) / 2);
        if (d < best) { best = d; byHeight = i; }
      });
      var usualInput = this.finder.querySelector('[data-fit-usual] input:checked');
      var usual = usualInput ? parseInt(usualInput.value, 10) : byHeight;
      var idx = Math.round((byHeight + usual) / 2);
      var scale = parseInt(this.dataset.scale, 10) || 3;
      if (scale >= 4) idx -= 1;      // runs large: size down
      if (scale <= 2) idx += 1;      // runs small: size up
      var pref = this.finder.querySelector('input[name$="-pref"]:checked');
      idx += pref ? parseInt(pref.value, 10) : 0;
      idx = Math.max(0, Math.min(chart.length - 1, idx));
      return chart[idx].size;
    }
    use() {
      var form = document.getElementById(this.dataset.formId);
      var scope = (form && form.closest('.k-pdp')) || document;
      var fs = scope.querySelector('k-variant-picker [data-option-position="' + this.dataset.sizePosition + '"]');
      if (fs) {
        var target = this.size.toLowerCase();
        fs.querySelectorAll('.k-pdp__fit-tag').forEach(function (t) { t.remove(); });
        var input = Array.from(fs.querySelectorAll('[data-option-value]')).find(function (i) { return i.value.toLowerCase() === target; });
        if (input) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          var label = fs.querySelector('label[for="' + input.id + '"]');
          if (label) {
            var tag = document.createElement('span');
            tag.className = 'k-pdp__fit-tag';
            tag.textContent = this.finder.querySelector('[data-fit-label-for-you]').textContent;
            label.appendChild(tag);
          }
        }
      }
      this.toggle(false);
    }
  });
}

/* Moodboard: save buttons on product cards. Handles are kept in this browser
   under oblique:moodboard; the moodboard page section reads the same list. */
window.ObliqueMoodboard = (function () {
  var KEY = 'oblique:moodboard';
  function read() { try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function write(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} document.dispatchEvent(new CustomEvent('moodboard:change', { detail: { items: list } })); }
  function has(h) { return read().indexOf(h) !== -1; }
  function toggle(h) { var l = read(); var i = l.indexOf(h); if (i === -1) l.unshift(h); else l.splice(i, 1); write(l); return i === -1; }
  function paint(root) {
    var list = read();
    (root || document).querySelectorAll('[data-save]').forEach(function (b) {
      var on = list.indexOf(b.dataset.save) !== -1;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', on ? b.dataset.labelSaved : b.dataset.labelSave);
    });
  }
  var toastTimer;
  function toast(saved) {
    var cfg = (window.themeSettings && window.themeSettings.moodboard) || {};
    var old = document.querySelector('.k-save-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'k-save-toast';
    el.setAttribute('role', 'status');
    var span = document.createElement('span');
    span.textContent = saved ? cfg.savedText : cfg.removedText;
    el.appendChild(span);
    if (saved && cfg.url) {
      var a = document.createElement('a');
      a.href = cfg.url; a.textContent = cfg.viewText;
      el.appendChild(a);
    }
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 3200);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-save]');
    if (!b) return;
    e.preventDefault();
    toast(toggle(b.dataset.save));
  });
  document.addEventListener('moodboard:change', function () { paint(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { paint(); }); else paint();
  // Cards added later (load more, quick view, recommendations) get painted too.
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; paint(); });
  }).observe(document.body, { childList: true, subtree: true });
  return { read: read, write: write, has: has, toggle: toggle };
})();
