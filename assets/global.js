/* eslint-disable no-console */
/**
 * Glaze — global theme utilities. Loaded on every page before cart.js.
 *
 * Exposes `window.Glaze` with:
 *   utils        : debounce, throttle, ready, money, prefersReducedMotion
 *   reveal       : IntersectionObserver-driven [data-reveal] animations
 *   stagger      : auto-assigns --stagger-index on children of [data-stagger]
 *   accordion    : keyboard-accessible accordion for [data-glaze-accordion]
 *   tabsIndicator: smooth sliding underline between tab buttons
 *   hero         : slideshow controller for [data-glaze-hero] sections
 *
 * Auto-init on DOMContentLoaded for any element matching the corresponding
 * data-attributes. Sections opt in declaratively rather than writing JS.
 */
(function () {
  'use strict';

  // ----------------------------------------------------------------------
  // utils
  // ----------------------------------------------------------------------
  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function throttle(fn, wait) {
    var last = 0, scheduled = null;
    return function () {
      var now = Date.now(), args = arguments, ctx = this;
      var remaining = wait - (now - last);
      if (remaining <= 0) {
        last = now;
        fn.apply(ctx, args);
      } else if (!scheduled) {
        scheduled = setTimeout(function () {
          last = Date.now();
          scheduled = null;
          fn.apply(ctx, args);
        }, remaining);
      }
    };
  }

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // Formats integer cents using the storefront's money format. Supports
  // amount / amount_no_decimals / amount_with_comma_separator /
  // amount_no_decimals_with_comma_separator placeholders. Falls back to
  // "$X.XX" if window.shopMoneyFormat isn't set.
  function money(cents) {
    var n = parseInt(cents, 10) || 0;
    var amount = (n / 100).toFixed(2);
    var parts = amount.split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var formatted = intPart + '.' + parts[1];
    var fmt = window.shopMoneyFormat || '${{amount}}';
    return fmt
      .replace(/\{\{\s*amount\s*\}\}/g, formatted)
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, intPart)
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, formatted.replace('.', ','))
      .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, intPart);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ----------------------------------------------------------------------
  // reveal — IntersectionObserver wiring for [data-reveal] elements.
  //
  // Markup:
  //   <div data-reveal>          → fade + slide up (default)
  //   <h2 data-reveal="mask">    → clip-path mask wipe
  //   <img data-reveal="scale">  → scale-in
  //   <div data-reveal data-stagger>  ← parent: children get stagger-index
  //
  // The actual visual transition lives in base.css (section 22) so this JS
  // is only responsible for toggling [data-reveal-active] when the element
  // enters the viewport.
  // ----------------------------------------------------------------------
  function initReveal(root) {
    if (prefersReducedMotion()) {
      // Mark everything as already-active so layouts that depend on the
      // active state (e.g. unhidden text) render correctly.
      (root || document).querySelectorAll('[data-reveal]').forEach(function (el) {
        el.setAttribute('data-reveal-active', '');
      });
      return;
    }
    if (!('IntersectionObserver' in window)) {
      (root || document).querySelectorAll('[data-reveal]').forEach(function (el) {
        el.setAttribute('data-reveal-active', '');
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-reveal-active', '');
        if (entry.target.getAttribute('data-reveal-once') !== 'false') {
          io.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -8% 0px'
    });
    (root || document).querySelectorAll('[data-reveal]:not([data-reveal-bound])').forEach(function (el) {
      el.setAttribute('data-reveal-bound', '');
      io.observe(el);
    });
  }

  // ----------------------------------------------------------------------
  // stagger — auto-sets --stagger-index on direct children of [data-stagger]
  // so the reveal transition cascades naturally without merchant maths.
  //
  // Markup:
  //   <ul data-stagger>
  //     <li data-reveal>first  → --stagger-index: 0
  //     <li data-reveal>second → --stagger-index: 1
  //   </ul>
  // ----------------------------------------------------------------------
  function initStagger(root) {
    (root || document).querySelectorAll('[data-stagger]:not([data-stagger-bound])').forEach(function (parent) {
      parent.setAttribute('data-stagger-bound', '');
      var idx = 0;
      Array.prototype.forEach.call(parent.children, function (child) {
        if (child.hasAttribute('data-reveal') || child.querySelector('[data-reveal]')) {
          child.style.setProperty('--stagger-index', idx++);
        }
      });
    });
  }

  // ----------------------------------------------------------------------
  // accordion — keyboard-accessible vertical accordion. Single instance
  // can have multiple expandable items; only one open at a time unless
  // [data-glaze-accordion="multiple"] is set.
  //
  // Markup:
  //   <div data-glaze-accordion>
  //     <button data-acc-trigger aria-expanded="false" aria-controls="p1">…</button>
  //     <div id="p1" data-acc-panel hidden>…</div>
  //     …
  //   </div>
  // ----------------------------------------------------------------------
  function initAccordion(root) {
    (root || document).querySelectorAll('[data-glaze-accordion]:not([data-glaze-accordion-bound])').forEach(function (acc) {
      acc.setAttribute('data-glaze-accordion-bound', '');
      var multiple = acc.getAttribute('data-glaze-accordion') === 'multiple';
      var triggers = acc.querySelectorAll('[data-acc-trigger]');
      triggers.forEach(function (trigger) {
        trigger.addEventListener('click', function () {
          var panelId = trigger.getAttribute('aria-controls');
          var panel = panelId ? document.getElementById(panelId) : trigger.nextElementSibling;
          var isOpen = trigger.getAttribute('aria-expanded') === 'true';
          if (!multiple) {
            triggers.forEach(function (t) {
              if (t === trigger) return;
              t.setAttribute('aria-expanded', 'false');
              var pid = t.getAttribute('aria-controls');
              var p = pid ? document.getElementById(pid) : t.nextElementSibling;
              if (p) p.hidden = true;
            });
          }
          trigger.setAttribute('aria-expanded', String(!isOpen));
          if (panel) panel.hidden = isOpen;
        });
        trigger.addEventListener('keydown', function (e) {
          var arr = Array.prototype.slice.call(triggers);
          var i = arr.indexOf(trigger);
          if (e.key === 'ArrowDown') { e.preventDefault(); (arr[i + 1] || arr[0]).focus(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); (arr[i - 1] || arr[arr.length - 1]).focus(); }
          else if (e.key === 'Home') { e.preventDefault(); arr[0].focus(); }
          else if (e.key === 'End') { e.preventDefault(); arr[arr.length - 1].focus(); }
        });
      });
    });
  }

  // ----------------------------------------------------------------------
  // tabsIndicator — smoothly slides an underline / pill between active
  // tab buttons. Caller styles the indicator element; we just animate
  // its transform + width.
  //
  // Markup:
  //   <div data-glaze-tabs>
  //     <button data-tab="0" aria-selected="true">A</button>
  //     <button data-tab="1">B</button>
  //     <span data-tab-indicator></span>   ← positioned by JS
  //   </div>
  //
  // The indicator inherits position:absolute; bottom:0; left:0 from the
  // caller's CSS. We set transform translateX and width via CSS vars
  // (--tab-x, --tab-w) so the transition lives in the section's CSS.
  // ----------------------------------------------------------------------
  function initTabsIndicator(root) {
    (root || document).querySelectorAll('[data-glaze-tabs]:not([data-glaze-tabs-bound])').forEach(function (group) {
      group.setAttribute('data-glaze-tabs-bound', '');
      var indicator = group.querySelector('[data-tab-indicator]');
      if (!indicator) return;
      var tabs = group.querySelectorAll('[data-tab]');

      function move(toTab) {
        if (!toTab) return;
        var rect = toTab.getBoundingClientRect();
        var parentRect = group.getBoundingClientRect();
        indicator.style.setProperty('--tab-x', (rect.left - parentRect.left) + 'px');
        indicator.style.setProperty('--tab-w', rect.width + 'px');
      }

      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
          move(tab);
        });
      });

      // Initial position — on the currently selected tab, or first.
      var initial = group.querySelector('[data-tab][aria-selected="true"]') || tabs[0];
      // Wait one frame so layout has settled.
      requestAnimationFrame(function () { move(initial); });

      // Reposition on resize so the indicator stays aligned.
      var onResize = debounce(function () {
        var active = group.querySelector('[data-tab][aria-selected="true"]') || tabs[0];
        move(active);
      }, 120);
      window.addEventListener('resize', onResize);
    });
  }

  // ----------------------------------------------------------------------
  // hero — editorial slideshow controller for [data-glaze-hero] sections.
  //
  // Crossfade transitions, autoplay with pause-on-hover / pause-on-focus /
  // pause-out-of-viewport, keyboard ArrowLeft/Right, touch swipe with
  // horizontal-dominant gesture detection, per-slide colour theme mirroring,
  // and active-slide video playback control. Multiple hero sections per page
  // are supported — each is initialised independently.
  // ----------------------------------------------------------------------
  function initHero(root) {
    if (!root || root.hasAttribute('data-glaze-hero-bound')) return;
    root.setAttribute('data-glaze-hero-bound', '');

    var stage = root.querySelector('[data-hero-stage]');
    var slides = stage ? stage.querySelectorAll('.glaze-hero__slide') : [];
    if (slides.length === 0) return;

    var dots = root.querySelectorAll('.glaze-hero__dot');
    var toggle = root.querySelector('[data-hero-toggle]');
    var live = root.querySelector('[data-hero-live]');
    var autoplay = root.getAttribute('data-autoplay') === 'true';
    var speed = (parseInt(root.getAttribute('data-speed'), 10) || 6) * 1000;
    var current = 0;
    var timer = null;
    var paused = !autoplay;
    var inViewport = true;
    var prefersReduce = prefersReducedMotion();
    if (prefersReduce) { autoplay = false; paused = true; }

    function applyThemeFromActive() {
      var active = slides[current];
      if (!active) return;
      var theme = active.getAttribute('data-theme') || 'cream';
      root.setAttribute('data-active-theme', theme);
      if (theme === 'custom') {
        var bg = active.style.getPropertyValue('--hero-surface');
        var fg = active.style.getPropertyValue('--hero-ink');
        if (bg) root.style.setProperty('--hero-surface', bg);
        if (fg) root.style.setProperty('--hero-ink', fg);
      } else {
        root.style.removeProperty('--hero-surface');
        root.style.removeProperty('--hero-ink');
      }
    }

    // Active slide video always plays. Inactive ones pause so only one
    // decoder runs. Reduced-motion pauses everything (a11y requirement).
    function pauseAllVideos() {
      root.querySelectorAll('video').forEach(function (v) { v.pause(); });
    }
    function syncActiveVideo() {
      var active = slides[current];
      if (!active) return;
      var video = active.querySelector('video');
      if (!video) return;
      if (prefersReduce) { video.pause(); return; }
      var p = video.play();
      if (p && typeof p.then === 'function') p.catch(function () {});
    }

    function goTo(idx) {
      if (idx === current) return;
      var n = slides.length;
      idx = ((idx % n) + n) % n;

      var oldVideo = slides[current] && slides[current].querySelector('video');
      if (oldVideo) oldVideo.pause();

      slides[current].classList.remove('is-active');
      slides[current].setAttribute('aria-hidden', 'true');
      if (dots[current]) {
        dots[current].classList.remove('is-active');
        dots[current].setAttribute('aria-selected', 'false');
      }

      current = idx;
      slides[current].classList.add('is-active');
      slides[current].removeAttribute('aria-hidden');
      if (dots[current]) {
        dots[current].classList.add('is-active');
        dots[current].setAttribute('aria-selected', 'true');
      }

      applyThemeFromActive();
      syncActiveVideo();
      if (live) live.textContent = 'Slide ' + (current + 1) + ' of ' + n;
      restartProgress();
      if (!paused) scheduleNext();
    }

    function restartProgress() {
      if (!dots[current]) return;
      var bar = dots[current].querySelector('.glaze-hero__progress-bar');
      if (!bar) return;
      bar.style.animation = 'none';
      bar.getBoundingClientRect();
      bar.style.animation = '';
    }

    function scheduleNext() {
      clearTimeout(timer);
      if (paused || !autoplay || !inViewport || slides.length <= 1) return;
      timer = setTimeout(function () { goTo(current + 1); }, speed);
    }

    function setPaused(p) {
      paused = p;
      root.setAttribute('data-paused', String(p));
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(p));
        toggle.setAttribute('aria-label', p ? 'Play slideshow' : 'Pause slideshow');
      }
      if (p) clearTimeout(timer);
      else scheduleNext();
      syncActiveVideo();
    }

    root.style.setProperty('--speed', (speed / 1000) + 's');

    Array.prototype.forEach.call(dots, function (dot) {
      dot.addEventListener('click', function () {
        goTo(parseInt(dot.getAttribute('data-go-to'), 10));
      });
    });

    if (toggle) {
      toggle.addEventListener('click', function () { setPaused(!paused); });
    }

    root.addEventListener('pointerenter', function () { if (autoplay) clearTimeout(timer); });
    root.addEventListener('pointerleave', function () { if (autoplay && !paused) scheduleNext(); });
    root.addEventListener('focusin',  function () { clearTimeout(timer); });
    root.addEventListener('focusout', function () { if (autoplay && !paused) scheduleNext(); });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
    });

    // Touch swipe — only treat as a slide gesture when horizontal motion
    // dominates vertical motion, so a scroll-down attempt doesn't accidentally
    // advance slides. 50px threshold for sensitivity on small screens.
    var startX = null, startY = null;
    root.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      startX = e.clientX;
      startY = e.clientY;
    });
    root.addEventListener('pointerup', function (e) {
      if (startX == null) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      startX = startY = null;
      if (Math.abs(dx) < 50) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (dx > 0) goTo(current - 1);
      else goTo(current + 1);
    });
    root.addEventListener('pointercancel', function () { startX = startY = null; });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          inViewport = entry.isIntersecting;
          if (inViewport && !paused) scheduleNext();
          else clearTimeout(timer);
          syncActiveVideo();
        });
      }, { threshold: 0.25 });
      io.observe(root);
    }

    pauseAllVideos();
    applyThemeFromActive();
    if (autoplay) { setPaused(false); }
    else { restartProgress(); syncActiveVideo(); }
  }

  function initHeroes(root) {
    var scope = root || document;
    var heroes = scope.querySelectorAll('[data-glaze-hero]');
    Array.prototype.forEach.call(heroes, initHero);
    // shopify:section:load fires with e.target === the section itself,
    // which may BE the hero rather than contain one.
    if (scope.matches && scope.matches('[data-glaze-hero]')) initHero(scope);
  }

  // ----------------------------------------------------------------------
  // <product-recommendations> custom element
  //
  // Server-side-render guard: if the section already includes the
  // recommendations markup (Liquid evaluated `recommendations.performed`),
  // skip the AJAX fetch. Otherwise fetch the section by URL stored on
  // `data-url` and inject the inner HTML.
  // ----------------------------------------------------------------------
  if (window.customElements && !customElements.get('product-recommendations')) {
    customElements.define('product-recommendations', class GlazeProductRecommendations extends HTMLElement {
      connectedCallback() {
        if (this.querySelector('.glaze-recs__inner')) return;
        var url = this.dataset.url;
        if (!url) return;
        var self = this;
        fetch(url, { headers: { 'Accept': 'text/html' } })
          .then(function (r) { return r.text(); })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var fresh = doc.querySelector('product-recommendations');
            if (fresh && fresh.innerHTML.trim()) self.innerHTML = fresh.innerHTML;
          })
          .catch(function () {});
      }
    });
  }

  // ----------------------------------------------------------------------
  // highlight-text-image — reveals the inline statement once the section
  // crosses 15% into the viewport. Adds .is-visible on [data-hti-wrap]
  // which triggers the staggered character animation defined in S8.
  // ----------------------------------------------------------------------
  function initHti(root) {
    if (!root || root.hasAttribute('data-glaze-hti-bound')) return;
    root.setAttribute('data-glaze-hti-bound', '');
    var wrap = root.querySelector('[data-hti-wrap]');
    if (!wrap) return;
    if (!('IntersectionObserver' in window)) {
      wrap.classList.add('is-visible');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          wrap.classList.add('is-visible');
          io.unobserve(wrap);
        }
      });
    }, { threshold: 0.15 });
    io.observe(wrap);
  }
  function initHtis(root) {
    var scope = root || document;
    var els = scope.querySelectorAll('[data-glaze-hti]');
    Array.prototype.forEach.call(els, initHti);
    if (scope.matches && scope.matches('[data-glaze-hti]')) initHti(scope);
  }

  // ----------------------------------------------------------------------
  // shoppable-tabs — sticky left tabs + product grid panels on right.
  // Tab activation also drives a mobile <select> mirror + a description
  // pulled from the selected tab's hidden .st-tab-desc child. The bag
  // button delegates ATC to Glaze.addToCart (lives in cart.js).
  // ----------------------------------------------------------------------
  function initShoppableTabs(root) {
    if (!root || root.hasAttribute('data-glaze-st-bound')) return;
    root.setAttribute('data-glaze-st-bound', '');

    var tabs = root.querySelectorAll('[data-st-tab]');
    var panels = root.querySelectorAll('[data-st-panel]');
    var select = root.querySelector('[data-st-select]');
    var mobileDesc = root.querySelector('[data-st-mobile-desc]');

    var descriptions = Array.prototype.map.call(tabs, function (t) {
      var d = t.querySelector('.st-tab-desc');
      return d ? d.innerHTML : '';
    });

    function setActive(idx) {
      tabs.forEach(function (t, i) {
        var active = i === idx;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach(function (p, i) {
        p.classList.toggle('is-active', i === idx);
      });
      if (mobileDesc) mobileDesc.innerHTML = descriptions[idx] || '';
      if (select && select.value != String(idx)) select.value = String(idx);
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        var idx = parseInt(t.getAttribute('data-st-tab'), 10);
        if (!isNaN(idx)) setActive(idx);
      });
    });

    if (select) {
      select.addEventListener('change', function () {
        var idx = parseInt(select.value, 10);
        if (!isNaN(idx)) setActive(idx);
      });
    }

    root.querySelectorAll('[data-st-goto]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        window.location.href = btn.getAttribute('data-st-goto');
      });
    });

    root.querySelectorAll('[data-st-atc]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var id = btn.getAttribute('data-st-atc');
        if (!id) return;
        btn.setAttribute('disabled', 'disabled');
        btn.classList.add('is-loading');
        cartAdd(id, 1, btn, 'shoppable-tabs').catch(function (err) {
          console.error('[shoppable-tabs]', err);
        }).finally(function () {
          btn.removeAttribute('disabled');
          btn.classList.remove('is-loading');
        });
      });
    });
  }
  function initShoppableTabsAll(root) {
    var scope = root || document;
    var els = scope.querySelectorAll('[data-glaze-st]');
    Array.prototype.forEach.call(els, initShoppableTabs);
    if (scope.matches && scope.matches('[data-glaze-st]')) initShoppableTabs(scope);
  }

  // ----------------------------------------------------------------------
  // collection-list — horizontal card carousel with prev/next arrows,
  // touch swipe, resize handling. --scl-per-view CSS var (set per
  // breakpoint) tells JS how many cards are visible at once.
  // ----------------------------------------------------------------------
  function initCollectionList(root) {
    if (!root || root.hasAttribute('data-glaze-cl-bound')) return;
    root.setAttribute('data-glaze-cl-bound', '');

    var track = root.querySelector('[data-scl-track]');
    var cards = track ? track.querySelectorAll('.scl-card') : [];
    var prev  = root.querySelector('[data-scl-prev]');
    var next  = root.querySelector('[data-scl-next]');
    var total = cards.length;
    if (!track || total === 0) return;

    var current = 0;

    function getPerView() {
      return parseFloat(getComputedStyle(root).getPropertyValue('--scl-per-view')) || 1;
    }
    function computeStep() {
      if (!cards.length) return 0;
      var rect = cards[0].getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0') || 0;
      return rect.width + gap;
    }
    function maxIndex() {
      return Math.max(0, total - Math.floor(getPerView()));
    }
    function applyTransform(animate) {
      var step = computeStep();
      if (animate === false) track.style.transition = 'none';
      track.style.transform = 'translateX(' + (-current * step) + 'px)';
      if (animate === false) {
        track.getBoundingClientRect();
        track.style.transition = '';
      }
    }
    function updateNav() {
      if (prev) prev.disabled = current <= 0;
      if (next) next.disabled = current >= maxIndex();
    }
    function goTo(idx) {
      var mx = maxIndex();
      current = Math.max(0, Math.min(mx, idx));
      applyTransform(true);
      updateNav();
    }

    if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
    if (next) next.addEventListener('click', function () { goTo(current + 1); });

    var startX = 0, dx = 0, dragging = false;
    track.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches[0]) return;
      startX = e.touches[0].clientX;
      dragging = true;
    }, { passive: true });
    track.addEventListener('touchmove', function (e) {
      if (!dragging || !e.touches || !e.touches[0]) return;
      dx = e.touches[0].clientX - startX;
    }, { passive: true });
    track.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(dx) > 40) { dx < 0 ? goTo(current + 1) : goTo(current - 1); }
      dx = 0;
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var mx = maxIndex();
        if (current > mx) current = mx;
        applyTransform(false);
        updateNav();
      }, 80);
    });

    applyTransform(false);
    updateNav();
  }
  function initCollectionLists(root) {
    var scope = root || document;
    var els = scope.querySelectorAll('[data-glaze-cl]');
    Array.prototype.forEach.call(els, initCollectionList);
    if (scope.matches && scope.matches('[data-glaze-cl]')) initCollectionList(scope);
  }

  // ----------------------------------------------------------------------
  // main-product — gallery thumb switcher + variant picker + qty stepper.
  // Variant data is embedded as JSON inside [data-mp-variant-data]; ATC
  // labels come from data-atc-label / data-sold-out-label on the root.
  // ----------------------------------------------------------------------
  function initMainProduct(root) {
    if (!root || root.hasAttribute('data-glaze-mp-bound')) return;
    root.setAttribute('data-glaze-mp-bound', '');

    var atcAvailableLabel = root.getAttribute('data-atc-label') || 'Add to Cart';
    var atcSoldOutLabel   = root.getAttribute('data-sold-out-label') || 'Sold out';

    function showMedia(mediaId) {
      var idStr = String(mediaId);
      root.querySelectorAll('[data-mp-media-id]').forEach(function (el) {
        var match = el.getAttribute('data-mp-media-id') === idStr;
        if (match) { el.removeAttribute('hidden'); el.classList.add('is-active'); }
        else { el.setAttribute('hidden', ''); el.classList.remove('is-active'); }
      });
      root.querySelectorAll('[data-mp-thumb-id]').forEach(function (btn) {
        var match = btn.getAttribute('data-mp-thumb-id') === idStr;
        btn.classList.toggle('is-active', match);
        btn.setAttribute('aria-selected', match ? 'true' : 'false');
      });
    }
    root.querySelectorAll('[data-mp-thumb-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showMedia(btn.getAttribute('data-mp-thumb-id'));
      });
    });

    var variantData = [];
    var dataEl = root.querySelector('[data-mp-variant-data]');
    if (dataEl) {
      try { variantData = JSON.parse(dataEl.textContent); } catch (e) { variantData = []; }
    }
    var idInput = root.querySelector('[data-mp-id-input]');
    var priceCurrentEl = root.querySelector('[data-mp-price-current]');
    var priceCompareEl = root.querySelector('[data-mp-price-compare]');
    var atcBtn = root.querySelector('.mp__atc');

    function getSelectedOptions() {
      var opts = [];
      root.querySelectorAll('[data-mp-option]:checked').forEach(function (radio) {
        var pos = parseInt(radio.getAttribute('data-option-position'), 10) - 1;
        opts[pos] = radio.value;
      });
      return opts;
    }
    function findVariant(opts) {
      for (var i = 0; i < variantData.length; i++) {
        var v = variantData[i];
        var match = true;
        for (var j = 0; j < opts.length; j++) {
          if (v.options[j] !== opts[j]) { match = false; break; }
        }
        if (match) return v;
      }
      return null;
    }
    function updateForVariant(v) {
      if (!v) {
        if (atcBtn) { atcBtn.setAttribute('disabled', ''); atcBtn.textContent = atcSoldOutLabel; }
        if (idInput) idInput.value = '';
        return;
      }
      if (idInput) idInput.value = v.id;
      if (priceCurrentEl) priceCurrentEl.textContent = v.price;
      if (priceCompareEl) priceCompareEl.textContent = v.compare_at_price || '';
      if (atcBtn) {
        if (v.available) { atcBtn.removeAttribute('disabled'); atcBtn.textContent = atcAvailableLabel; }
        else { atcBtn.setAttribute('disabled', ''); atcBtn.textContent = atcSoldOutLabel; }
      }
      if (v.featured_media_id) showMedia(v.featured_media_id);
      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', v.id);
        window.history.replaceState({}, '', url.toString());
      }
      root.dispatchEvent(new CustomEvent('mp:variant-change', { bubbles: true, detail: { variantId: v.id } }));
    }
    function onOptionChange(e) {
      var radio = e.target;
      var pos = radio.getAttribute('data-option-position');
      var group = radio.closest('.mp__option-group');
      if (group) {
        group.querySelectorAll('.mp__variant-option').forEach(function (l) { l.classList.remove('is-active'); });
        var lbl = radio.closest('.mp__variant-option');
        if (lbl) lbl.classList.add('is-active');
        var curLabel = group.querySelector('[data-mp-option-current="' + pos + '"]');
        if (curLabel) curLabel.textContent = radio.value;
      }
      updateForVariant(findVariant(getSelectedOptions()));
    }
    root.querySelectorAll('[data-mp-option]').forEach(function (radio) {
      radio.addEventListener('change', onOptionChange);
    });

    var qtyInput = root.querySelector('[data-mp-qty-input]');
    if (qtyInput) {
      root.querySelectorAll('[data-mp-qty-step]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var step = parseInt(btn.getAttribute('data-mp-qty-step'), 10);
          var next = Math.max(1, (parseInt(qtyInput.value, 10) || 1) + step);
          qtyInput.value = next;
        });
      });
    }
  }
  function initMainProducts(root) {
    var scope = root || document;
    var els = scope.querySelectorAll('[data-glaze-mp]');
    Array.prototype.forEach.call(els, initMainProduct);
    if (scope.matches && scope.matches('[data-glaze-mp]')) initMainProduct(scope);
  }

  // ----------------------------------------------------------------------
  // product-bundle — synced hover dot/item highlight, per-item variant
  // select with price refresh, and Add-All-To-Cart that sequences ATC
  // calls (drawer opens once at the end, not per item).
  // ----------------------------------------------------------------------
  function initProductBundle(root) {
    if (!root || root.hasAttribute('data-glaze-pb-bound')) return;
    root.setAttribute('data-glaze-pb-bound', '');

    var items = root.querySelectorAll('.pb-item');
    var dots  = root.querySelectorAll('.pb-dot');
    var btn   = root.querySelector('[data-pb-add-all]');

    function setHover(idx, active) {
      items.forEach(function (it, i) {
        it.classList.toggle('is-dimmed', active && i !== idx);
        it.classList.toggle('is-active', active && i === idx);
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('is-dimmed', active && i !== idx);
        d.classList.toggle('is-active', active && i === idx);
      });
    }
    items.forEach(function (it, i) {
      it.addEventListener('mouseenter', function () { setHover(i, true); });
      it.addEventListener('mouseleave', function () { setHover(i, false); });
    });
    dots.forEach(function (d, i) {
      d.addEventListener('mouseenter', function () { setHover(i, true); });
      d.addEventListener('mouseleave', function () { setHover(i, false); });
    });

    root.querySelectorAll('[data-pb-variant]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var opt = sel.options[sel.selectedIndex];
        var idx = parseInt(sel.getAttribute('data-pb-variant'), 10);
        var item = items[idx];
        if (!item || !opt) return;
        var priceEl = item.querySelector('[data-pb-price]');
        if (!priceEl) return;
        var price   = parseInt(opt.getAttribute('data-price'), 10);
        var compare = parseInt(opt.getAttribute('data-compare'), 10) || 0;
        var html = money(price);
        if (compare > price) {
          html += ' <span class="pb-item-price-compare">' + money(compare) + '</span>';
        }
        priceEl.innerHTML = html;
      });
    });

    function getSelectedVariants() {
      var ids = [];
      items.forEach(function (item) {
        var select = item.querySelector('select[data-pb-variant]:not([disabled])');
        if (select && select.value) {
          var id = parseInt(select.value, 10);
          if (!isNaN(id) && id > 0) { ids.push(id); return; }
        }
        var fallback = item.getAttribute('data-pb-variant-id');
        if (fallback) {
          var fid = parseInt(fallback, 10);
          if (!isNaN(fid) && fid > 0) ids.push(fid);
        }
      });
      return ids;
    }

    if (btn) {
      btn.addEventListener('click', function () {
        var variantIds = getSelectedVariants();
        if (!variantIds.length) {
          console.warn('[product-bundle] No variant IDs collected — check that blocks have products selected.');
          return;
        }
        btn.setAttribute('disabled', 'disabled');
        btn.classList.add('is-loading');

        // Sequence the adds so the drawer only opens on the FINAL one.
        var promise = Promise.resolve(null);
        variantIds.forEach(function (id, idx) {
          var isLast = idx === variantIds.length - 1;
          promise = promise.then(function () {
            if (window.GlazeCart && typeof window.GlazeCart.addToCart === 'function') {
              return window.GlazeCart.addToCart(id, {
                quantity: 1,
                sourceButton: isLast ? btn : null,
                openDrawer: isLast,
                source: 'product-bundle'
              });
            }
            var url = (window.routes && window.routes.cart_add_url) || '/cart/add.js';
            return fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({ id: id, quantity: 1 })
            }).then(function (r) { return r.json(); });
          });
        });
        promise.catch(function (err) {
          console.error('[product-bundle]', err);
        }).finally(function () {
          btn.removeAttribute('disabled');
          btn.classList.remove('is-loading');
        });
      });
    }
  }
  function initProductBundles(root) {
    var scope = root || document;
    var els = scope.querySelectorAll('[data-glaze-pb]');
    Array.prototype.forEach.call(els, initProductBundle);
    if (scope.matches && scope.matches('[data-glaze-pb]')) initProductBundle(scope);
  }

  // ----------------------------------------------------------------------
  // (Quick-view modal renderer moved to assets/quick-view.js — accessed
  // via window.GlazeQuickView. Two sections use it: sticky-collections
  // and featured-product. See quick-view.js for the contract.)
  // ----------------------------------------------------------------------

  // ----------------------------------------------------------------------
  // sticky-collections — multi-collection slider with shared quick-view
  // modal. Each [data-stc-coll] is its own card carousel; clicking a card
  // ATC adds the variant; the magnifying-glass button opens the modal.
  // ----------------------------------------------------------------------
  function initStickyCollections(root) {
    if (!root || root.hasAttribute('data-glaze-stc-bound')) return;
    root.setAttribute('data-glaze-stc-bound', '');

    root.querySelectorAll('[data-stc-coll]').forEach(function (coll) {
      var track = coll.querySelector('[data-stc-track]');
      var cards = track ? track.querySelectorAll('.stc-card') : [];
      var prev  = coll.querySelector('[data-stc-prev]');
      var next  = coll.querySelector('[data-stc-next]');
      var currentEl = coll.querySelector('[data-stc-current]');
      var totalEl   = coll.querySelector('[data-stc-total]');
      if (!track || cards.length === 0) return;
      var current = 0;

      function stepPx() {
        if (!cards.length) return 0;
        var rect = cards[0].getBoundingClientRect();
        var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0') || 0;
        return rect.width + gap;
      }
      function perView() {
        var viewport = coll.querySelector('.stc-coll-viewport');
        if (!viewport || !cards.length) return 1;
        return Math.max(1, Math.round(viewport.clientWidth / stepPx()));
      }
      function maxIndex()  { return Math.max(0, cards.length - perView()); }
      function totalPages(){ return maxIndex() + 1; }
      function apply(animate) {
        var step = stepPx();
        if (animate === false) track.style.transition = 'none';
        track.style.transform = 'translateX(' + (-current * step) + 'px)';
        if (animate === false) { track.getBoundingClientRect(); track.style.transition = ''; }
      }
      function updateNav() {
        if (prev) prev.disabled = current <= 0;
        if (next) next.disabled = current >= maxIndex();
        if (currentEl) currentEl.textContent = (current + 1);
        if (totalEl)   totalEl.textContent = totalPages();
      }
      function go(i) {
        current = Math.max(0, Math.min(maxIndex(), i));
        apply(true);
        updateNav();
      }

      if (prev) prev.addEventListener('click', function () { go(current - 1); });
      if (next) next.addEventListener('click', function () { go(current + 1); });

      var sx = 0, dx = 0, dragging = false;
      track.addEventListener('touchstart', function (e) {
        if (!e.touches || !e.touches[0]) return;
        sx = e.touches[0].clientX; dragging = true;
      }, { passive: true });
      track.addEventListener('touchmove', function (e) {
        if (!dragging || !e.touches || !e.touches[0]) return;
        dx = e.touches[0].clientX - sx;
      }, { passive: true });
      track.addEventListener('touchend', function () {
        if (!dragging) return;
        dragging = false;
        if (Math.abs(dx) > 40) { dx < 0 ? go(current + 1) : go(current - 1); }
        dx = 0;
      });

      var rt = null;
      window.addEventListener('resize', function () {
        if (rt) clearTimeout(rt);
        rt = setTimeout(function () {
          if (current > maxIndex()) current = maxIndex();
          apply(false);
          updateNav();
        }, 80);
      });

      apply(false);
      updateNav();
    });

    // Shared modal (one instance per section)
    var modal     = root.querySelector('[data-stc-modal]');
    var overlay   = root.querySelector('.stc-modal-overlay');
    var modalBody = root.querySelector('[data-stc-modal-body]');

    function openModal() {
      modal.classList.add('is-open');
      overlay.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeModal() {
      modal.classList.remove('is-open');
      overlay.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    if (modal) {
      root.querySelectorAll('[data-stc-modal-close]').forEach(function (el) { el.addEventListener('click', closeModal); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });
    }

    function getProductData(handle) {
      var node = root.querySelector('script[data-stc-product="' + handle + '"]');
      if (!node) return null;
      try { return JSON.parse(node.textContent); } catch (e) { return null; }
    }

    root.querySelectorAll('[data-stc-quickview]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var p = getProductData(btn.getAttribute('data-stc-quickview'));
        if (!p || !modalBody || !window.GlazeQuickView) return;
        modalBody.innerHTML = window.GlazeQuickView.render(p, 'stc');
        openModal();
        window.GlazeQuickView.bind(modalBody, p, { cls: 'stc', source: 'sticky-collections', onClose: closeModal });
      });
    });

    root.querySelectorAll('[data-stc-atc]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var id = btn.getAttribute('data-stc-atc');
        if (!id) return;
        btn.classList.add('is-loading');
        btn.setAttribute('disabled', 'disabled');
        cartAdd(id, 1, btn, 'sticky-collections').catch(function (err) {
          console.error('[sticky-collections]', err);
        }).finally(function () {
          btn.classList.remove('is-loading');
          btn.removeAttribute('disabled');
        });
      });
    });
  }
  function initStickyCollectionsAll(root) {
    var scope = root || document;
    var els = scope.querySelectorAll('[data-glaze-stc]');
    Array.prototype.forEach.call(els, initStickyCollections);
    if (scope.matches && scope.matches('[data-glaze-stc]')) initStickyCollections(scope);
  }

  // ----------------------------------------------------------------------
  // featured-product — tabbed product grid (collection per tab) with the
  // same shared quick-view modal as sticky-collections (sfp- class prefix),
  // plus an "in-stock" indicator + shipping note that get injected into
  // the modal via the QuickView extras hook.
  // ----------------------------------------------------------------------
  function initFeaturedProduct(root) {
    if (!root || root.hasAttribute('data-glaze-fp-bound')) return;
    root.setAttribute('data-glaze-fp-bound', '');

    // Tabs
    var tabs   = root.querySelectorAll('[data-sfp-tab]');
    var panels = root.querySelectorAll('[data-sfp-panel]');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        var idx = t.getAttribute('data-sfp-tab');
        tabs.forEach(function (x) {
          var act = x.getAttribute('data-sfp-tab') === idx;
          x.classList.toggle('is-active', act);
          x.setAttribute('aria-selected', act ? 'true' : 'false');
        });
        panels.forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-sfp-panel') === idx);
        });
      });
    });

    // Modal shell
    var modal     = root.querySelector('[data-sfp-modal]');
    var overlay   = root.querySelector('.sfp-modal-overlay');
    var modalBody = root.querySelector('[data-sfp-modal-body]');

    function openModal() {
      modal.classList.add('is-open');
      overlay.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeModal() {
      modal.classList.remove('is-open');
      overlay.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    if (modal) {
      root.querySelectorAll('[data-sfp-modal-close]').forEach(function (el) { el.addEventListener('click', closeModal); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });
    }

    function getProductData(handle) {
      var node = root.querySelector('script[data-sfp-product="' + handle + '"]');
      if (!node) return null;
      try { return JSON.parse(node.textContent); } catch (e) { return null; }
    }

    // Stock + shipping extras — computed per product, injected between
    // the price and the description by the shared QuickView renderer.
    function buildExtras(p) {
      var stockAvail = false;
      var stockCount = 0;
      (p.variants || []).forEach(function (v) {
        if (v.available) {
          stockAvail = true;
          if (typeof v.inventory_quantity === 'number') stockCount += v.inventory_quantity;
        }
      });
      var stockHtml = stockAvail
        ? '<p class="sfp-modal-stock"><span class="sfp-modal-stock-dot"></span>' + (stockCount > 0 ? stockCount + ' in stock' : 'In stock') + '</p>'
        : '<p class="sfp-modal-stock is-out"><span class="sfp-modal-stock-dot"></span>Out of stock</p>';
      var shippingHtml = '<p class="sfp-modal-shipping"><a href="/policies/shipping-policy">Shipping</a> calculated at checkout.</p>';
      return { afterPriceHtml: shippingHtml + stockHtml };
    }

    root.querySelectorAll('[data-sfp-quickview]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var handle = btn.getAttribute('data-sfp-quickview');
        var p = getProductData(handle);
        if (!p || !modalBody || !window.GlazeQuickView) return;
        modalBody.innerHTML = window.GlazeQuickView.render(p, 'sfp', buildExtras(p));
        openModal();
        window.GlazeQuickView.bind(modalBody, p, { cls: 'sfp', source: 'featured-product', onClose: closeModal });
      });
    });

    // Direct card ATC (no variants)
    root.querySelectorAll('[data-sfp-atc]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var id = btn.getAttribute('data-sfp-atc');
        if (!id) return;
        btn.classList.add('is-loading');
        btn.setAttribute('disabled', 'disabled');
        cartAdd(id, 1, btn, 'featured-product').catch(function (err) {
          console.error('[featured-product]', err);
        }).finally(function () {
          btn.classList.remove('is-loading');
          btn.removeAttribute('disabled');
        });
      });
    });
  }
  function initFeaturedProducts(root) {
    var scope = root || document;
    var els = scope.querySelectorAll('[data-glaze-fp]');
    Array.prototype.forEach.call(els, initFeaturedProduct);
    if (scope.matches && scope.matches('[data-glaze-fp]')) initFeaturedProduct(scope);
  }

  // ----------------------------------------------------------------------
  // Shared ATC delegate — every card-style ATC across sections funnels
  // through here. Calls window.GlazeCart.addToCart when cart.js is loaded;
  // otherwise falls back to a native POST + redirect to /cart.
  // ----------------------------------------------------------------------
  function cartAdd(id, quantity, sourceBtn, source) {
    if (window.GlazeCart && typeof window.GlazeCart.addToCart === 'function') {
      return window.GlazeCart.addToCart(id, {
        quantity: quantity,
        sourceButton: sourceBtn || null,
        source: source || 'glaze'
      });
    }
    var url = (window.routes && window.routes.cart_add_url) || '/cart/add.js';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: parseInt(id, 10), quantity: parseInt(quantity, 10) || 1 })
    }).then(function () { window.location.href = (window.routes && window.routes.cart_url) || '/cart'; });
  }

  // ----------------------------------------------------------------------
  // Auto-initialize on DOMContentLoaded + observe future DOM (sections
  // injected by the theme editor or by AJAX cart updates).
  // ----------------------------------------------------------------------
  function initAll(root) {
    initStagger(root);   // assign --stagger-index BEFORE reveal observes
    initReveal(root);
    initAccordion(root);
    initTabsIndicator(root);
    initHeroes(root);
    initHtis(root);
    initShoppableTabsAll(root);
    initCollectionLists(root);
    initMainProducts(root);
    initProductBundles(root);
    initStickyCollectionsAll(root);
    initFeaturedProducts(root);
  }

  ready(function () {
    initAll(document);

    // Re-init when the theme editor swaps a section in/out of the page.
    document.addEventListener('shopify:section:load', function (e) { initAll(e.target); });
    document.addEventListener('shopify:section:select', function (e) { initAll(e.target); });
  });

  // Expose the API for section code that needs ad-hoc bindings.
  window.Glaze = {
    utils: { debounce: debounce, throttle: throttle, ready: ready, money: money, prefersReducedMotion: prefersReducedMotion },
    reveal: initReveal,
    stagger: initStagger,
    accordion: initAccordion,
    tabsIndicator: initTabsIndicator,
    hero: initHero,
    hti: initHti,
    shoppableTabs: initShoppableTabs,
    collectionList: initCollectionList,
    mainProduct: initMainProduct,
    productBundle: initProductBundle,
    stickyCollections: initStickyCollections,
    featuredProduct: initFeaturedProduct,
    cartAdd: cartAdd,
    initAll: initAll
  };
})();
