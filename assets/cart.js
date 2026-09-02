/* eslint-disable no-console */
// Diagnostic warnings only. These fire when the cart markup or a Section
// Rendering response is not what the theme expects — i.e. a real fault worth
// seeing in a merchant console. No verbose request tracing ships.
function cwarn() {
  var args = ['[skinova-cart]'].concat(Array.prototype.slice.call(arguments));
  try { console.warn.apply(console, args); } catch (e) {}
}

/**
 * Skinova cart system — drawer + product-form ATC interceptor.
 *
 * Custom elements:
 *   <skinova-cart-drawer>   — the drawer panel (open/close, focus trap, Escape, refresh)
 *   <skinova-cart-items>    — items wrapper, syncs across drawer + page when cart updates
 *   <skinova-cart-remove>   — wraps each line's remove button → quantity 0
 *   <skinova-cart-note>     — wraps the cart note textarea → debounced /cart/update.js
 *   <skinova-product-form>  — wraps the product page <form 'product'> → AJAX add to /cart/add.js
 *
 * Section Rendering API:
 *   On every cart mutation we POST `sections=cart-drawer,cart-icon-bubble` so
 *   Shopify renders those two sections server-side against the new cart and
 *   returns the HTML in the JSON response. We then swap innerHTML on both DOM
 *   nodes. No manual DOM construction, no double source of truth.
 *
 * Globals expected (set by layout/theme.liquid):
 *   window.routes      = { cart_url, cart_add_url, cart_change_url, cart_update_url }
 *   window.cartStrings = { error, addError }
 */
(function () {
  'use strict';

  // ----------------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------------
  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  // Shopify exposes routes.cart_* as the HTML form endpoints (e.g. "/cart/change"),
  // not the JSON endpoints. POSTing to the form endpoint returns a 302 → /cart with
  // a Clear-Site-Data header instead of JSON, so we always force ".js".
  function cartJsUrl(routeUrl, fallback) {
    var u = routeUrl || fallback;
    if (!u) return fallback;
    // Strip query/hash for the suffix check, then re-append.
    var qIdx = u.search(/[?#]/);
    var path = qIdx === -1 ? u : u.slice(0, qIdx);
    var rest = qIdx === -1 ? '' : u.slice(qIdx);
    if (!/\.js$/.test(path)) path += '.js';
    return path + rest;
  }

  function fetchJSON(url, opts) {
    return fetch(url, Object.assign({
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    }, opts || {})).then(function (r) {
      return r.text().then(function (txt) {
        var data; try { data = JSON.parse(txt); } catch (e) { data = {}; }
        if (!r.ok) {
          var err = new Error((data && data.description) || (window.cartStrings && window.cartStrings.error) || 'Cart error');
          err.data = data; err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  // PubSub mailbox so multiple components can react to cart updates without coupling.
  var subscribers = {};
  function publish(eventName, payload) {
    (subscribers[eventName] || []).forEach(function (cb) {
      try { cb(payload); } catch (e) { console.error(e); }
    });
  }
  function subscribe(eventName, cb) {
    (subscribers[eventName] = subscribers[eventName] || []).push(cb);
    return function () {
      subscribers[eventName] = (subscribers[eventName] || []).filter(function (f) { return f !== cb; });
    };
  }

  // Focus trap — cycles Tab/Shift+Tab within `el`.
  function trapFocus(el) {
    function onKey(e) {
      if (e.key !== 'Tab') return;
      var focusables = el.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    el.addEventListener('keydown', onKey);
    return function release() { el.removeEventListener('keydown', onKey); };
  }

  // Section Rendering API: refetch + swap a section's innerHTML in-place.
  // `sectionId` is the bare section name (e.g. 'cart-drawer'), `selector` is
  // the element to find both in the response HTML and the current document.
  function refreshSection(sectionId, selector) {
    return fetch((window.routes && window.routes.cart_url || '/cart') + '?section_id=' + sectionId, {
      headers: { 'Accept': 'text/html' }
    })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var fresh = doc.querySelector(selector);
        var current = document.querySelector(selector);
        if (fresh && current) current.innerHTML = fresh.innerHTML;
      })
      .catch(function () {});
  }

  // Apply a full /cart/add.js or /cart/change.js response that included
  // `sections: { 'cart-drawer': '...', 'cart-icon-bubble': '...' }` HTML strings.
  // Returns true if at least one section was successfully swapped — callers
  // use this to know whether they need a manual is-loading cleanup fallback.
  function applyCartSections(sectionsObj) {
    if (!sectionsObj) {
      cwarn('applyCartSections: no sections in response — Section Rendering API likely missing sections_url param OR Shopify error');
      return false;
    }
    var anySwapped = false;

    if (sectionsObj['cart-drawer']) {
      // Absent when cart_type is "page" — no drawer is mounted by design.
      var drawer = document.querySelector('skinova-cart-drawer');
      if (drawer) {
        var doc = new DOMParser().parseFromString(sectionsObj['cart-drawer'], 'text/html');
        var freshDrawer = doc.querySelector('skinova-cart-drawer');
        if (freshDrawer) {
          drawer.innerHTML = freshDrawer.innerHTML;
          // Mirror the empty/non-empty class flag from the freshly rendered server HTML
          if (freshDrawer.classList.contains('is-empty')) drawer.classList.add('is-empty');
          else drawer.classList.remove('is-empty');
          anySwapped = true;
        } else {
          cwarn('cart-drawer section HTML had no <skinova-cart-drawer> element inside');
        }
      }
    }

    if (sectionsObj['cart-icon-bubble']) {
      // The header anchor renders the snippet directly (no section wrapper), so we
      // always swap the anchor's innerHTML with the inner of the fetched section.
      var iconLink = document.getElementById('cart-icon-bubble');
      if (iconLink) {
        var doc3 = new DOMParser().parseFromString(sectionsObj['cart-icon-bubble'], 'text/html');
        var wrap = doc3.querySelector('.shopify-section') || doc3.body;
        if (wrap) {
          iconLink.innerHTML = wrap.innerHTML;
          anySwapped = true;
        }
      } else {
        cwarn('#cart-icon-bubble anchor not found in DOM');
      }
    }

    return anySwapped;
  }

  // The fixed list of sections we want re-rendered on every cart mutation.
  function sectionsToRender() {
    return ['cart-drawer', 'cart-icon-bubble'];
  }

  // ----------------------------------------------------------------------
  // <skinova-cart-drawer>
  // ----------------------------------------------------------------------
  if (!customElements.get('skinova-cart-drawer')) {
    customElements.define('skinova-cart-drawer', class SkinovaCartDrawer extends HTMLElement {
      connectedCallback() {
        this._releaseFocusTrap = null;
        this.bindCloseHandlers();
        this.bindHeaderIconHijack();
        this.bindQuantityStepper();
        this.bindEscape();
        // Re-bind when the drawer's innerHTML is replaced via Section Rendering
        var self = this;
        this._observer = new MutationObserver(function () {
          self.bindCloseHandlers();
          self.bindQuantityStepper();
        });
        this._observer.observe(this, { childList: true, subtree: true });
      }
      disconnectedCallback() {
        if (this._observer) this._observer.disconnect();
        if (this._releaseFocusTrap) this._releaseFocusTrap();
      }
      bindCloseHandlers() {
        var self = this;
        this.querySelectorAll('[data-skinova-cart-close]').forEach(function (el) {
          el.addEventListener('click', function (e) {
            // Don't intercept the empty-state "continue shopping" link's navigation
            if (el.tagName === 'A' && el.getAttribute('href')) {
              self.close();
              return;
            }
            e.preventDefault();
            self.close();
          });
        });
      }
      bindHeaderIconHijack() {
        // When in drawer mode, clicking the cart icon opens this drawer
        var anchor = document.getElementById('cart-icon-bubble');
        if (!anchor || anchor.dataset.skinovaCartBound === '1') return;
        anchor.dataset.skinovaCartBound = '1';
        anchor.setAttribute('role', 'button');
        anchor.setAttribute('aria-haspopup', 'dialog');
        anchor.setAttribute('aria-controls', 'skinova-cart-drawer');
        var self = this;
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          self.open(anchor);
        });
        anchor.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            self.open(anchor);
          }
        });
      }
      bindEscape() {
        var self = this;
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && self.hasAttribute('open')) self.close();
        });
      }
      bindQuantityStepper() {
        var self = this;
        this.querySelectorAll('[data-skinova-cart-qty-step]').forEach(function (btn) {
          if (btn.dataset.bound === '1') return;
          btn.dataset.bound = '1';
          btn.addEventListener('click', function () {
            var step = parseInt(btn.getAttribute('data-skinova-cart-qty-step'), 10);
            // getElementById tolerates colons + other special chars in IDs (cart item keys
            // are formatted like "62760579727731:2d7174f57f7e6281…" which break #id selectors).
            var input = document.getElementById(btn.getAttribute('data-target'));
            if (!input) return;
            var next = Math.max(0, (parseInt(input.value, 10) || 0) + step);
            input.value = next;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          });
        });
      }
      open(triggeredBy) {
        this._triggeredBy = triggeredBy || null;
        this.setAttribute('open', '');
        this.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (window.lenis && typeof window.lenis.stop === 'function') window.lenis.stop();
        var panel = this.querySelector('.skinova-cart-drawer__panel');
        var focusEl = this.querySelector('.skinova-cart-drawer__close') || panel;
        if (panel) this._releaseFocusTrap = trapFocus(panel);
        setTimeout(function () { if (focusEl) focusEl.focus(); }, 30);
      }
      close() {
        this.removeAttribute('open');
        this.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start();
        if (this._releaseFocusTrap) { this._releaseFocusTrap(); this._releaseFocusTrap = null; }
        if (this._triggeredBy) this._triggeredBy.focus();
      }
      renderFromSections(sectionsObj) {
        applyCartSections(sectionsObj);
        this.bindCloseHandlers();
        this.bindQuantityStepper();
      }
      // ============ Dawn-compatible API ============
      // Legacy code (featured-product, product-bundle, shoppable-tabs, sticky-collections)
      // calls document.querySelector('cart-drawer') and expects Dawn's API: getSectionsToRender(),
      // renderContents(data), setActiveElement(el). Exposing these aliases means the legacy
      // sections find Skinova's drawer and work without modification.
      getSectionsToRender() {
        return [
          { id: 'cart-drawer', selector: 'skinova-cart-drawer' },
          { id: 'cart-icon-bubble' }
        ];
      }
      renderContents(data) {
        if (data && data.sections) {
          this.renderFromSections(data.sections);
        }
        this.classList.remove('is-empty');
        this.open();
      }
      setActiveElement(el) { this._triggeredBy = el || null; }
    });

  }

  // ----------------------------------------------------------------------
  // <skinova-cart-items>
  // ----------------------------------------------------------------------
  if (!customElements.get('skinova-cart-items')) {
    customElements.define('skinova-cart-items', class SkinovaCartItems extends HTMLElement {
      connectedCallback() {
        this.onChange = debounce(this.handleChange.bind(this), 300);
        this.addEventListener('change', this.onChange);
        this._unsub = subscribe('cart:update', this.refresh.bind(this));
      }
      disconnectedCallback() { if (this._unsub) this._unsub(); }
      handleChange(e) {
        var input = e.target;
        if (!input || !input.matches('[data-skinova-cart-qty-input]')) return;
        var key = input.getAttribute('data-key');
        var qty = Math.max(0, parseInt(input.value, 10) || 0);
        this.updateLine(key, qty, input);
      }
      updateLine(key, quantity, sourceInput) {
        var self = this;
        var isOnCartPage = !this.closest('skinova-cart-drawer');

        // Find the item being mutated. Could be either the drawer-styled element
        // or the cart-page-styled element — both carry data-key.
        var item = sourceInput
          ? sourceInput.closest('.skinova-cart-drawer__item, .skinova-cart__item')
          : this.querySelector('[data-key="' + key + '"]');
        if (item) item.classList.add('is-loading');

        var stuckTimer = setTimeout(function () {
          if (item) item.classList.remove('is-loading');
          cwarn('updateLine timed out — cleared is-loading after 8s');
        }, 8000);

        fetchJSON(cartJsUrl(window.routes && window.routes.cart_change_url, '/cart/change.js'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: key,
            quantity: quantity,
            sections: sectionsToRender().join(','),
            sections_url: window.location.pathname
          })
        }).then(function (res) {
          var swapped = applyCartSections(res.sections);
          if (!swapped && item && !isOnCartPage) item.classList.remove('is-loading');
          publish('cart:update', { source: 'cart-items', data: res });
          // The drawer section sync above doesn't include the cart page's own
          // items + summary, so when we're rendered on the cart page we refetch
          // /cart and swap the inner container.
          if (isOnCartPage) return self.refreshCartPage(res);
        }).catch(function (err) {
          if (item) item.classList.remove('is-loading');
          console.error('[skinova-cart] updateLine failed', err);
        }).finally(function () {
          clearTimeout(stuckTimer);
        });
      }
      refreshCartPage(res) {
        return fetch((window.routes && window.routes.cart_url) || '/cart', {
          headers: { 'Accept': 'text/html' }
        })
          .then(function (r) { return r.text(); })
          .then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            // .skinova-cart__inner wraps both the populated form AND the empty state,
            // so swapping it covers the transition when the user removes the last item.
            var fresh = doc.querySelector('.skinova-cart__inner');
            var current = document.querySelector('.skinova-cart__inner');
            if (fresh && current) {
              current.innerHTML = fresh.innerHTML;
            } else {
              cwarn('cart page swap: .skinova-cart__inner not found, reloading');
              window.location.reload();
            }
          })
          .catch(function (err) {
            cwarn('cart page refresh failed', err);
          });
      }
      refresh(payload) {
        // Skip our own publish so we don't refetch what we just rendered
        if (payload && payload.source === 'cart-items') return;
        refreshSection('cart-drawer', 'skinova-cart-drawer');
      }
    });
  }

  // ----------------------------------------------------------------------
  // <skinova-cart-remove>
  // ----------------------------------------------------------------------
  if (!customElements.get('skinova-cart-remove')) {
    customElements.define('skinova-cart-remove', class SkinovaCartRemove extends HTMLElement {
      connectedCallback() {
        var self = this;
        var btn = this.querySelector('button');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var key = self.getAttribute('data-key');
          var items = self.closest('skinova-cart-items');
          // Add .is-loading to the item immediately so the user sees feedback before fetch
          var item = self.closest('.skinova-cart-drawer__item');
          if (item) item.classList.add('is-loading');
          if (items) items.updateLine(key, 0, null);
        });
      }
    });
  }

  // ----------------------------------------------------------------------
  // <skinova-cart-note>
  // ----------------------------------------------------------------------
  if (!customElements.get('skinova-cart-note')) {
    customElements.define('skinova-cart-note', class SkinovaCartNote extends HTMLElement {
      connectedCallback() {
        var textarea = this.querySelector('textarea');
        if (!textarea) return;
        textarea.addEventListener('input', debounce(function (e) {
          fetchJSON(cartJsUrl(window.routes && window.routes.cart_update_url, '/cart/update.js'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: e.target.value, sections_url: window.location.pathname })
          }).catch(function () {});
        }, 400));
      }
    });
  }

  // ----------------------------------------------------------------------
  // <skinova-product-form>
  // ----------------------------------------------------------------------
  if (!customElements.get('skinova-product-form')) {
    customElements.define('skinova-product-form', class SkinovaProductForm extends HTMLElement {
      connectedCallback() {
        this.form = this.querySelector('form');
        this.submitBtn = this.form ? this.form.querySelector('[type="submit"]') : null;
        if (!this.form) return;
        this.cartMailbox = document.querySelector('skinova-cart-drawer');
        // Only intercept when drawer is mounted (cart_type == 'drawer')
        if (!this.cartMailbox) return;
        this.form.addEventListener('submit', this.onSubmit.bind(this));
      }
      onSubmit(e) {
        if (!this.cartMailbox) {
          return; // fall through to native submit (page mode)
        }
        e.preventDefault();
        if (this.submitBtn) { this.submitBtn.setAttribute('aria-disabled', 'true'); this.submitBtn.classList.add('is-loading'); }
        var formData = new FormData(this.form);
        formData.append('sections', sectionsToRender().join(','));
        formData.append('sections_url', window.location.pathname);

        var self = this;
        fetch(cartJsUrl(window.routes && window.routes.cart_add_url, '/cart/add.js'), {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
          body: formData
        })
          .then(function (r) {
            return r.json().then(function (data) {
              if (!r.ok) {
                var msg = (data && data.description) || (window.cartStrings && window.cartStrings.addError) || 'Could not add to cart.';
                throw new Error(msg);
              }
              return data;
            });
          })
          .then(function (data) {
            // Shopify response: { id, key, quantity, ..., sections: { 'cart-drawer': '...', 'cart-icon-bubble': '...' } }
            if (data.sections) {
              self.cartMailbox.renderFromSections(data.sections);
              publish('cart:update', { source: 'product-form', data: data });
            } else {
              cwarn('product-form: response had no sections — drawer content will be stale until next refresh');
            }
            self.cartMailbox.open(self.submitBtn);
          })
          .catch(function (err) {
            console.error('[skinova-cart] add failed', err);
            // Fall back to a native form submit so the user still gets to /cart
            // with the line item added (or sees a Shopify error page).
            self.form.removeEventListener('submit', self.onSubmit.bind(self));
            self.form.submit();
          })
          .finally(function () {
            if (self.submitBtn) { self.submitBtn.removeAttribute('aria-disabled'); self.submitBtn.classList.remove('is-loading'); }
          });
      }
    });
  }

  // ----------------------------------------------------------------------
  // Universal add-to-cart helper — call from anywhere in the theme.
  //
  //   SkinovaCart.addToCart(123456789)
  //   SkinovaCart.addToCart(123456789, { quantity: 2, sourceButton: btn })
  //   SkinovaCart.addToCart({ id: 123, quantity: 2, properties: {...} })
  //   SkinovaCart.addToCart({ items: [{ id: 1, quantity: 1 }, { id: 2, quantity: 1 }] })
  //
  // The items[] form adds every line in ONE /cart/add.js call. Prefer it over
  // chaining single adds: in page mode each call redirects to /cart, so a chain
  // would navigate away before the later adds were sent.
  //
  // Options:
  //   sourceButton        — element clicked (used for focus return + setActiveElement)
  //   openDrawer          — default true; pass false for bulk adds, true on the final call
  //   redirectIfNoDrawer  — default true; when cart_type == 'page', redirects to /cart
  //
  // Returns a Promise that resolves with the /cart/add.js response.
  // The caller manages the source button's .is-loading class — different
  // sections want different timing (clear immediately vs after drawer opens).
  // ----------------------------------------------------------------------
  function addToCartUniversal(payload, options) {
    options = options || {};
    var drawer = document.querySelector('skinova-cart-drawer');
    var sourceButton = options.sourceButton || null;

    var body;
    if (typeof payload === 'number' || typeof payload === 'string') {
      body = { id: parseInt(payload, 10), quantity: parseInt(options.quantity, 10) || 1 };
    } else {
      body = Object.assign({}, payload);
      if (body.id != null) body.id = parseInt(body.id, 10);
      if (body.quantity != null) body.quantity = parseInt(body.quantity, 10) || 1;
    }

    // Section Rendering: include sections + sections_url so /cart/add.js
    // returns rendered HTML for the drawer + icon bubble in one round trip.
    body.sections = sectionsToRender().join(',');
    body.sections_url = window.location.pathname;


    var cartAddUrl = cartJsUrl(window.routes && window.routes.cart_add_url, '/cart/add.js');
    return fetch(cartAddUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.text().then(function (txt) {
          var data; try { data = JSON.parse(txt); } catch (e) { data = {}; }
          if (!r.ok || data.status) {
            var err = new Error((data && data.description) || (window.cartStrings && window.cartStrings.addError) || 'Could not add to cart.');
            err.data = data; err.status = r.status;
            throw err;
          }
          return data;
        });
      })
      .then(function (data) {

        if (drawer) {
          if (data.sections) drawer.renderFromSections(data.sections);
          else cwarn('SkinovaCart.addToCart: response missing sections — drawer will be stale until next refresh');

          if (options.openDrawer !== false) {
            drawer.classList.remove('is-empty');
            if (typeof drawer.setActiveElement === 'function') drawer.setActiveElement(sourceButton);
            drawer.open(sourceButton);
          }
        } else if (options.redirectIfNoDrawer !== false) {
          // Page-mode cart: hop to /cart so the user sees their addition
          window.location.href = (window.routes && window.routes.cart_url) || '/cart';
          return data;
        }

        publish('cart:update', { source: options.source || 'SkinovaCart.addToCart', data: data });
        document.dispatchEvent(new CustomEvent('cart:refresh', { detail: data }));
        return data;
      });
  }

  // Expose API for other theme code.
  window.SkinovaCart = {
    addToCart: addToCartUniversal,
    subscribe: subscribe,
    publish: publish,
    refreshSection: refreshSection,
    applyCartSections: applyCartSections,
    getDrawer: function () { return document.querySelector('skinova-cart-drawer'); }
  };
})();
