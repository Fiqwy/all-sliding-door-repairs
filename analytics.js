/* ==========================================================================
 * All Sliding Door Repairs — first-party visitor beacon
 * Cookieless. Reports a pageview on load and Call/Text/Book taps to the
 * Applied Intelligence backend, so Lachlan sees visitor stats in his dashboard.
 * Plain script (NOT a module) — dependency-free, isolated, and must NEVER
 * throw or block the page. Loaded before the module script on index.html and
 * on the area pages.
 * ========================================================================== */
(function () {
  'use strict';

  var ENDPOINT = 'https://donny.appliedintelligence.biz/api/beacon';
  var SLUG = 'all-sliding-door-repairs';

  // The specific booking-intent buttons. They all resolve to an SMS to Lachlan,
  // but carry an explicit "book / quote / build" intent, so we count them as the
  // more specific 'book' rather than a generic 'sms' tap.
  var BOOK_SELECTOR = '#heroSms, #problemSms, #valueSms, #workSms, #contactSms, #contactForm button[type="submit"]';

  // De-dupe rapid double-fires (a fast double-tap, a synthetic + real click).
  var lastType = '', lastAt = 0;

  // Fire one beacon. Wrapped so it can never surface an error to the page.
  function beacon(type) {
    try {
      var payload = JSON.stringify({
        slug: SLUG,
        type: type,
        path: location.pathname,
        ref: document.referrer
      });
      // sendBeacon of a JSON STRING is a "simple" (text/plain) request — no CORS
      // preflight, survives page unload. Preferred path.
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, payload)) return;
      // Fallback 1: keepalive POST, no-cors (also text/plain for a string body).
      if (window.fetch) {
        fetch(ENDPOINT, { method: 'POST', body: payload, keepalive: true, mode: 'no-cors' })
          .catch(function () {});
        return;
      }
      // Fallback 2 (very old browsers): a pixel with the payload on the query string.
      new Image().src = ENDPOINT + '?d=' + encodeURIComponent(payload) + '&t=' + Date.now();
    } catch (e) { /* a beacon must never break the site */ }
  }

  // Send, but swallow a same-type repeat inside a 600ms window.
  function fire(type) {
    var now = Date.now();
    if (type === lastType && (now - lastAt) < 600) return;
    lastType = type; lastAt = now;
    beacon(type);
  }

  // ONE delegated listener, capture phase, so it catches CTAs that script.js
  // injects dynamically. Most specific intent wins (tel → book → sms).
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('a[href^="tel:"]')) { fire('call'); return; }
      if (t.closest(BOOK_SELECTOR)) { fire('book'); return; }
      if (t.closest('a[href^="sms:"], [data-sms-body]')) { fire('sms'); return; }
      // Anything else is a non-CTA click — never beaconed.
    } catch (e2) { /* never throw from a click */ }
  }, true);

  // Pageview once on load (defer means the DOM is already parsed).
  fire('pageview');
})();
