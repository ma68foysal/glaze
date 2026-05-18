/**
 * Glaze cart system — drawer + product-form ATC interceptor.
 *
 * Custom elements:
 *   <glaze-cart-drawer>   — the drawer panel (open/close, focus trap, Escape, refresh)
 *   <glaze-cart-items>    — items wrapper, syncs across drawer + page when cart updates
 *   <glaze-cart-remove>   — wraps each line's remove button → quantity 0
 *   <glaze-cart-note>     — wraps the cart note textarea → debounced /cart/update.js
 *   <glaze-product-form>  — wraps the product page <form 'product'> → AJAX add to /cart/add.js
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
  function applyCartSections(sectionsObj) {
    if (!sectionsObj) return;
    if (sectionsObj['cart-drawer']) {
      var drawer = document.querySelector('glaze-cart-drawer');
      if (drawer) {
        var doc = new DOMParser().parseFromString(sectionsObj['cart-drawer'], 'text/html');
        var freshDrawer = doc.querySelector('glaze-cart-drawer');
        if (freshDrawer) drawer.innerHTML = freshDrawer.innerHTML;
      }
    }
    if (sectionsObj['cart-icon-bubble']) {
      var bubbleSection = document.getElementById('shopify-section-cart-icon-bubble') || document.querySelector('[id$="cart-icon-bubble"]');
      if (bubbleSection) {
        var doc2 = new DOMParser().parseFromString(sectionsObj['cart-icon-bubble'], 'text/html');
        var fresh = doc2.getElementById('shopify-section-cart-icon-bubble') || doc2.querySelector('[id$="cart-icon-bubble"]');
        if (fresh) bubbleSection.innerHTML = fresh.innerHTML;
      } else {
        // Fallback: header anchor wraps the section content directly
        var iconLink = document.getElementById('cart-icon-bubble');
        if (iconLink) {
          var doc3 = new DOMParser().parseFromString(sectionsObj['cart-icon-bubble'], 'text/html');
          // Take the inner of the shopify-section wrapper if present
          var wrap = doc3.querySelector('.shopify-section') || doc3.body;
          if (wrap) iconLink.innerHTML = wrap.innerHTML;
        }
      }
    }
  }

  // The fixed list of sections we want re-rendered on every cart mutation.
  function sectionsToRender() {
    return ['cart-drawer', 'cart-icon-bubble'];
  }

  // ----------------------------------------------------------------------
  // <glaze-cart-drawer>
  // ----------------------------------------------------------------------
  if (!customElements.get('glaze-cart-drawer')) {
    customElements.define('glaze-cart-drawer', class GlazeCartDrawer extends HTMLElement {
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
        this.querySelectorAll('[data-glaze-cart-close]').forEach(function (el) {
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
        if (!anchor || anchor.dataset.glazeCartBound === '1') return;
        anchor.dataset.glazeCartBound = '1';
        anchor.setAttribute('role', 'button');
        anchor.setAttribute('aria-haspopup', 'dialog');
        anchor.setAttribute('aria-controls', 'glaze-cart-drawer');
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
        this.querySelectorAll('[data-glaze-cart-qty-step]').forEach(function (btn) {
          if (btn.dataset.bound === '1') return;
          btn.dataset.bound = '1';
          btn.addEventListener('click', function () {
            var step = parseInt(btn.getAttribute('data-glaze-cart-qty-step'), 10);
            var input = self.querySelector('#' + btn.getAttribute('data-target'));
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
        var panel = this.querySelector('.glaze-cart-drawer__panel');
        var focusEl = this.querySelector('.glaze-cart-drawer__close') || panel;
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
    });
  }

  // ----------------------------------------------------------------------
  // <glaze-cart-items>
  // ----------------------------------------------------------------------
  if (!customElements.get('glaze-cart-items')) {
    customElements.define('glaze-cart-items', class GlazeCartItems extends HTMLElement {
      connectedCallback() {
        this.onChange = debounce(this.handleChange.bind(this), 300);
        this.addEventListener('change', this.onChange);
        this._unsub = subscribe('cart:update', this.refresh.bind(this));
      }
      disconnectedCallback() { if (this._unsub) this._unsub(); }
      handleChange(e) {
        var input = e.target;
        if (!input || !input.matches('[data-glaze-cart-qty-input]')) return;
        var key = input.getAttribute('data-key');
        var qty = Math.max(0, parseInt(input.value, 10) || 0);
        this.updateLine(key, qty, input);
      }
      updateLine(key, quantity, sourceInput) {
        var item = sourceInput ? sourceInput.closest('.glaze-cart-drawer__item') : null;
        if (item) item.classList.add('is-loading');
        fetchJSON((window.routes && window.routes.cart_change_url) || '/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity: quantity, sections: sectionsToRender().join(',') })
        }).then(function (res) {
          applyCartSections(res.sections);
          publish('cart:update', { source: 'cart-items', data: res });
        }).catch(function (err) {
          if (item) item.classList.remove('is-loading');
          console.error('[glaze-cart] update failed', err);
        });
      }
      refresh(payload) {
        // Skip our own publish so we don't refetch what we just rendered
        if (payload && payload.source === 'cart-items') return;
        refreshSection('cart-drawer', 'glaze-cart-drawer');
      }
    });
  }

  // ----------------------------------------------------------------------
  // <glaze-cart-remove>
  // ----------------------------------------------------------------------
  if (!customElements.get('glaze-cart-remove')) {
    customElements.define('glaze-cart-remove', class GlazeCartRemove extends HTMLElement {
      connectedCallback() {
        var self = this;
        var btn = this.querySelector('button');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var key = self.getAttribute('data-key');
          var items = self.closest('glaze-cart-items');
          if (items) items.updateLine(key, 0, null);
        });
      }
    });
  }

  // ----------------------------------------------------------------------
  // <glaze-cart-note>
  // ----------------------------------------------------------------------
  if (!customElements.get('glaze-cart-note')) {
    customElements.define('glaze-cart-note', class GlazeCartNote extends HTMLElement {
      connectedCallback() {
        var textarea = this.querySelector('textarea');
        if (!textarea) return;
        textarea.addEventListener('input', debounce(function (e) {
          fetchJSON((window.routes && window.routes.cart_update_url) || '/cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: e.target.value })
          }).catch(function () {});
        }, 400));
      }
    });
  }

  // ----------------------------------------------------------------------
  // <glaze-product-form>
  // ----------------------------------------------------------------------
  if (!customElements.get('glaze-product-form')) {
    customElements.define('glaze-product-form', class GlazeProductForm extends HTMLElement {
      connectedCallback() {
        this.form = this.querySelector('form');
        this.submitBtn = this.form ? this.form.querySelector('[type="submit"]') : null;
        if (!this.form) return;
        this.cartMailbox = document.querySelector('glaze-cart-drawer');
        // Only intercept when drawer is mounted (cart_type == 'drawer')
        if (!this.cartMailbox) return;
        this.form.addEventListener('submit', this.onSubmit.bind(this));
      }
      onSubmit(e) {
        if (!this.cartMailbox) return; // fall through to native submit (page mode)
        e.preventDefault();
        if (this.submitBtn) { this.submitBtn.setAttribute('aria-disabled', 'true'); this.submitBtn.classList.add('is-loading'); }
        var formData = new FormData(this.form);
        formData.append('sections', sectionsToRender().join(','));
        formData.append('sections_url', window.location.pathname);

        var self = this;
        fetch((window.routes && window.routes.cart_add_url) || '/cart/add.js', {
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
            }
            self.cartMailbox.open(self.submitBtn);
          })
          .catch(function (err) {
            console.error('[glaze-cart] add failed', err);
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

  // Expose minimal API for other theme code that may want to react.
  window.GlazeCart = { subscribe: subscribe, publish: publish, refreshSection: refreshSection, applyCartSections: applyCartSections };
})();
