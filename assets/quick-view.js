/* eslint-disable no-console */
/**
 * Glaze quick-view — shared product quick-view modal renderer.
 *
 * Two sections currently use it: sticky-collections (cls: "stc") and
 * featured-product (cls: "sfp"). Each section provides its own modal
 * SHELL (overlay + container + close button) in its Liquid markup; this
 * file just renders the modal CONTENT (image slider + title + price +
 * variant picker + qty + ATC + buy-now) and wires the interactions.
 *
 * The class-name prefix is parameterised so the same renderer works with
 * each section's existing CSS (base.css already styles `.stc-modal-*` and
 * `.sfp-modal-*` etc. under their respective S12/S13 blocks).
 *
 * Exposes:
 *   window.GlazeQuickView = {
 *     render(productJson, cls)         → string of HTML
 *     bind(modalBodyEl, productJson, { cls, source, onClose })
 *   }
 *
 * Depends on window.Glaze.utils.money + window.Glaze.cartAdd from
 * assets/global.js — both are accessed at click time, so load order is:
 *   <script defer src="global.js"></script>
 *   <script defer src="quick-view.js"></script>
 */
(function () {
  'use strict';

  function money(cents) {
    if (window.Glaze && window.Glaze.utils && window.Glaze.utils.money) {
      return window.Glaze.utils.money(cents);
    }
    var n = parseInt(cents, 10) || 0;
    return '$' + (n / 100).toFixed(2);
  }

  function cartAdd(id, qty, btn, source) {
    if (window.Glaze && typeof window.Glaze.cartAdd === 'function') {
      return window.Glaze.cartAdd(id, qty, btn, source);
    }
    return Promise.reject(new Error('Glaze.cartAdd not loaded'));
  }

  function render(p, cls, extras) {
    extras = extras || {};
    var images = (p.images && p.images.length) ? p.images : (p.featured_image ? [p.featured_image] : []);
    var imagesHtml = images.map(function (src, i) {
      var url = (typeof src === 'string') ? src : (src.src || '');
      var display = url.indexOf('?') > -1 ? url.replace(/width=\d+/, 'width=800') : url + '?width=800';
      return '<div class="' + cls + '-mslide"><img src="' + display + '" alt="' + (p.title || '') + ' ' + (i + 1) + '"></div>';
    }).join('');

    var priceHtml = money(p.price);
    var compareHtml = '';
    if (p.compare_at_price && p.compare_at_price > p.price) {
      compareHtml = '<span class="' + cls + '-modal-price-compare">' + money(p.compare_at_price) + '</span>';
    }

    var options = p.options || [];
    var optionsHtml = '';
    options.forEach(function (opt, oi) {
      var optName = (typeof opt === 'string') ? opt : opt.name;
      if (options.length === 1 && optName === 'Title') {
        var v0 = p.variants && p.variants[0];
        if (v0 && v0.title === 'Default Title') return;
      }
      var values = [];
      (p.variants || []).forEach(function (v) {
        var val = v.options ? v.options[oi] : v['option' + (oi + 1)];
        if (val && values.indexOf(val) === -1) values.push(val);
      });
      optionsHtml += '<div class="' + cls + '-modal-opt"><p class="' + cls + '-modal-opt-label">' + optName + ': <span data-qv-opt-val="' + oi + '">' + (values[0] || '') + '</span></p><div class="' + cls + '-modal-opt-list" data-qv-opt-list="' + oi + '">';
      values.forEach(function (val, vi) {
        optionsHtml += '<button type="button" class="' + cls + '-modal-opt-btn' + (vi === 0 ? ' is-active' : '') + '" data-qv-opt="' + oi + '" data-qv-val="' + val + '">' + val + '</button>';
      });
      optionsHtml += '</div></div>';
    });

    var descHtml = p.description ? '<div class="' + cls + '-modal-desc">' + p.description + '</div>' : '';

    return ''
      + '<div class="' + cls + '-mslider" data-qv-mslider>'
      +   '<div class="' + cls + '-mslider-viewport"><div class="' + cls + '-mslider-track" data-qv-mtrack>' + imagesHtml + '</div></div>'
      +   (images.length > 1 ? ''
          + '<div class="' + cls + '-mslider-nav">'
          +   '<button type="button" class="' + cls + '-mslider-btn" data-qv-mprev aria-label="Previous"><svg viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
          +   '<span class="' + cls + '-mslider-count"><span data-qv-mcurrent>1</span>/<span data-qv-mtotal>' + images.length + '</span></span>'
          +   '<button type="button" class="' + cls + '-mslider-btn" data-qv-mnext aria-label="Next"><svg viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
          + '</div>' : '')
      + '</div>'
      + '<h2 class="' + cls + '-modal-title">' + (p.title || '') + '</h2>'
      + '<p class="' + cls + '-modal-price">' + priceHtml + compareHtml + '</p>'
      + (extras.afterPriceHtml || '')
      + descHtml
      + optionsHtml
      + '<div class="' + cls + '-modal-actions">'
      +   '<div class="' + cls + '-modal-qty"><button type="button" class="' + cls + '-modal-qty-btn" data-qv-qty-minus aria-label="Decrease">-</button><input type="number" class="' + cls + '-modal-qty-input" value="1" min="1" data-qv-qty><button type="button" class="' + cls + '-modal-qty-btn" data-qv-qty-plus aria-label="Increase">+</button></div>'
      +   '<button type="button" class="' + cls + '-modal-atc" data-qv-atc>Add To Cart</button>'
      + '</div>'
      + '<button type="button" class="' + cls + '-modal-buy" data-qv-buy>Buy It Now</button>'
      + '<a href="' + (p.url || '#') + '" class="' + cls + '-modal-full">View Full Details <svg viewBox="0 0 14 14" fill="none" width="14" height="14"><path d="M5 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>';
  }

  function bind(modalBody, p, opts) {
    opts = opts || {};
    var cls = opts.cls || 'qv';
    var sourceLabel = opts.source || 'quick-view';
    var onClose = opts.onClose || function () {};

    var state = {
      selected: (p.options || []).map(function (opt, oi) {
        var first = p.variants && p.variants[0];
        return first && first.options ? first.options[oi] : (first && first['option' + (oi + 1)]);
      }),
      qty: 1
    };

    function findVariant() {
      var vs = p.variants || [];
      for (var i = 0; i < vs.length; i++) {
        var v = vs[i]; var match = true;
        for (var j = 0; j < state.selected.length; j++) {
          var got = v.options ? v.options[j] : v['option' + (j + 1)];
          if (got !== state.selected[j]) { match = false; break; }
        }
        if (match) return v;
      }
      return null;
    }

    var sliderEl = modalBody.querySelector('[data-qv-mslider]');
    if (sliderEl) {
      var track = sliderEl.querySelector('[data-qv-mtrack]');
      var total = track.children.length;
      var cur = 0;
      var mprev = sliderEl.querySelector('[data-qv-mprev]');
      var mnext = sliderEl.querySelector('[data-qv-mnext]');
      var mcurEl = sliderEl.querySelector('[data-qv-mcurrent]');
      var mGo = function (i) {
        i = Math.max(0, Math.min(total - 1, i));
        cur = i;
        track.style.transform = 'translateX(' + (-cur * 100) + '%)';
        if (mcurEl) mcurEl.textContent = cur + 1;
        if (mprev) mprev.disabled = cur <= 0;
        if (mnext) mnext.disabled = cur >= total - 1;
      };
      if (mprev) mprev.addEventListener('click', function () { mGo(cur - 1); });
      if (mnext) mnext.addEventListener('click', function () { mGo(cur + 1); });
      mGo(0);
    }

    modalBody.querySelectorAll('[data-qv-opt-list]').forEach(function (list) {
      var oi = parseInt(list.getAttribute('data-qv-opt-list'), 10);
      list.querySelectorAll('[data-qv-val]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.selected[oi] = b.getAttribute('data-qv-val');
          list.querySelectorAll('[data-qv-val]').forEach(function (x) { x.classList.remove('is-active'); });
          b.classList.add('is-active');
          var lab = modalBody.querySelector('[data-qv-opt-val="' + oi + '"]');
          if (lab) lab.textContent = state.selected[oi];
          refresh();
        });
      });
    });

    function refresh() {
      var v = findVariant();
      var priceEl = modalBody.querySelector('.' + cls + '-modal-price');
      var atc = modalBody.querySelector('[data-qv-atc]');
      if (v && priceEl) {
        var cmp = (v.compare_at_price && v.compare_at_price > v.price) ? '<span class="' + cls + '-modal-price-compare">' + money(v.compare_at_price) + '</span>' : '';
        priceEl.innerHTML = money(v.price) + cmp;
      }
      if (atc) {
        if (!v || !v.available) { atc.textContent = 'Sold out'; atc.setAttribute('disabled', 'disabled'); }
        else { atc.textContent = 'Add To Cart'; atc.removeAttribute('disabled'); }
      }
    }

    var qtyInput = modalBody.querySelector('[data-qv-qty]');
    modalBody.querySelector('[data-qv-qty-minus]').addEventListener('click', function () { var n = Math.max(1, parseInt(qtyInput.value, 10) - 1); qtyInput.value = n; state.qty = n; });
    modalBody.querySelector('[data-qv-qty-plus]').addEventListener('click', function () { var n = parseInt(qtyInput.value, 10) + 1; qtyInput.value = n; state.qty = n; });
    qtyInput.addEventListener('input', function () { var n = Math.max(1, parseInt(qtyInput.value, 10) || 1); qtyInput.value = n; state.qty = n; });

    var atcBtn = modalBody.querySelector('[data-qv-atc]');
    atcBtn.addEventListener('click', function () {
      var v = findVariant(); if (!v || !v.available) return;
      atcBtn.classList.add('is-loading');
      atcBtn.setAttribute('disabled', 'disabled');
      cartAdd(v.id, state.qty, atcBtn, sourceLabel)
        .then(function () { onClose(); })
        .catch(function (err) { console.error('[' + sourceLabel + ']', err); })
        .finally(function () { atcBtn.classList.remove('is-loading'); atcBtn.removeAttribute('disabled'); });
    });

    var buyBtn = modalBody.querySelector('[data-qv-buy]');
    buyBtn.addEventListener('click', function () {
      var v = findVariant(); if (!v || !v.available) return;
      buyBtn.classList.add('is-loading');
      if (window.GlazeCart && typeof window.GlazeCart.addToCart === 'function') {
        window.GlazeCart.addToCart(v.id, { quantity: state.qty, sourceButton: buyBtn, openDrawer: false, source: sourceLabel + ':buy-now' })
          .then(function () { window.location.href = '/checkout'; })
          .catch(function (err) { console.error('[' + sourceLabel + ']', err); buyBtn.classList.remove('is-loading'); });
      } else {
        cartAdd(v.id, state.qty, buyBtn, sourceLabel + ':buy-now')
          .then(function () { window.location.href = '/checkout'; })
          .catch(function (err) { console.error('[' + sourceLabel + ']', err); buyBtn.classList.remove('is-loading'); });
      }
    });

    refresh();
  }

  window.GlazeQuickView = { render: render, bind: bind };
})();
