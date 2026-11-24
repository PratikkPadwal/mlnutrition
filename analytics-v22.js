/* ML Nutrition Phase 4: optional GA4 analytics with explicit opt-in.
 * Only a real owner-provided G-... ID activates tagging.
 * No marketing trackers, purchases, phone numbers or messages are sent.
 */
(function (win, doc) {
  'use strict';
  const id = String(win.MLAnalyticsConfig?.ga4MeasurementId || '').trim().toUpperCase();
  const configured = /^G-[A-Z0-9]{6,16}$/.test(id) && id !== 'G-XXXXXXXXXX';
  const KEY = 'mlnutrition-analytics-consent-v1';
  const events = new Set([
    'view_item', 'add_to_cart', 'begin_checkout', 'search',
    'select_item', 'whatsapp_enquiry_click'
  ]);
  let consent = null;
  let loaded = false;
  let panel = null;
  let pending = [];
  let lastSearch = '';
  let lastSearchAt = 0;
  let searchTimer = null;

  try {
    const saved = win.localStorage.getItem(KEY);
    if (saved === 'granted' || saved === 'denied') consent = saved;
  } catch (_) { /* storage may be disabled */ }

  function amount(value) {
    const raw = String(value == null ? '' : value).trim()
      .replace(/(?:\bINR\b|\bRs\.?)/gi, '').replace(/[₹,\s]/g, '').replace(/\/-$/, '');
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function item(product, qty, variant) {
    if (!product || product.id == null || !product.name) return null;
    const quantity = Math.max(1, Math.min(99, Number(qty) || 1));
    const result = {
      item_id: String(product.id).slice(0, 90),
      item_name: String(product.name).slice(0, 120),
      item_brand: String(product.brand || '').slice(0, 90),
      item_category: String(product.category || '').slice(0, 90),
      quantity
    };
    const price = amount(product.price_range);
    if (price !== null) result.price = price;
    if (variant) result.item_variant = String(variant).slice(0, 90);
    return result;
  }
  function ecommerce(product, qty, variant) {
    const i = item(product, qty, variant);
    if (!i) return null;
    const payload = { currency: 'INR', items: [i] };
    if (i.price != null) payload.value = i.price * i.quantity;
    return payload;
  }
  function submit(name, fields) {
    if (!configured || !events.has(name) || consent === 'denied') return false;
    if (consent !== 'granted') {
      // Memory only, never transmitted or stored before explicit permission.
      if (pending.length < 20) pending.push([name, fields || {}]);
      return false;
    }
    if (!loaded) activate();
    if (typeof win.gtag !== 'function') return false;
    win.gtag('event', name, fields || {});
    return true;
  }
  function activate() {
    if (!configured || loaded || consent !== 'granted') return;
    loaded = true;
    win.dataLayer = win.dataLayer || [];
    win.gtag = win.gtag || function () { win.dataLayer.push(arguments); };
    win.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    win.gtag('consent', 'update', { analytics_storage: 'granted' });
    win.gtag('js', new Date());
    win.gtag('config', id, { send_page_view: true });
    const script = doc.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    doc.head.appendChild(script);
    const queue = pending;
    pending = [];
    queue.forEach(entry => submit(entry[0], entry[1]));
  }
  function storeConsent(value) {
    consent = value;
    try { win.localStorage.setItem(KEY, value); } catch (_) { /* ignore */ }
    pending = value === 'granted' ? pending : [];
    hideConsent();
    if (value === 'granted') activate();
    else if (loaded) {
      win.gtag?.('consent', 'update', { analytics_storage: 'denied' });
      // Ensure the previously loaded Google tag is absent on future pages.
      win.location.reload();
    }
  }
  function hideConsent() {
    if (panel) panel.hidden = true;
  }
  function showConsent() {
    if (!configured || !panel) return;
    panel.hidden = false;
  }
  function buildConsent() {
    panel = doc.createElement('section');
    panel.className = 'ml-analytics-consent';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Optional website analytics');
    panel.hidden = true;
    const copy = doc.createElement('div');
    const label = doc.createElement('strong');
    label.textContent = 'Optional website analytics';
    const description = doc.createElement('p');
    description.textContent = 'We use Google Analytics only with your permission to understand visits, product interest and enquiries. Shopping works without it.';
    const policy = doc.createElement('a');
    policy.href = '/privacy-policy.html';
    policy.textContent = 'Privacy policy';
    copy.append(label, description, policy);
    const actions = doc.createElement('div');
    actions.className = 'ml-analytics-actions';
    const reject = doc.createElement('button');
    reject.type = 'button';
    reject.className = 'ml-analytics-reject';
    reject.textContent = 'No thanks';
    reject.addEventListener('click', () => storeConsent('denied'));
    const accept = doc.createElement('button');
    accept.type = 'button';
    accept.className = 'ml-analytics-accept';
    accept.textContent = 'Allow analytics';
    accept.addEventListener('click', () => storeConsent('granted'));
    actions.append(reject, accept);
    panel.append(copy, actions);
    doc.body.appendChild(panel);
    if (consent === null) showConsent();
    if (consent === 'granted') activate();
  }
  function cleanSearch(value) {
    const term = String(value || '').trim().replace(/\s+/g, ' ');
    // Don't send email addresses, phone numbers or arbitrary PII in search.
    if (term.length < 2 || term.length > 64 ||
        !/^[a-zA-Z0-9 .+/-]+$/.test(term) ||
        /\b\d{8,}\b/.test(term)) return '';
    return term;
  }
  function trackSearch(value) {
    const term = cleanSearch(value);
    if (!term) return false;
    const now = Date.now();
    if (term.toLowerCase() === lastSearch && now - lastSearchAt < 8000) return false;
    lastSearch = term.toLowerCase();
    lastSearchAt = now;
    return submit('search', { search_term: term });
  }
  function setup() {
    if (!configured) return;
    buildConsent();
    const preference = doc.getElementById('mlAnalyticsPreferences');
    if (preference) {
      preference.hidden = false;
      preference.addEventListener('click', showConsent);
    }
    doc.addEventListener('submit', event => {
      const form = event.target;
      if (form?.matches?.('form[role="search"], form.search-bar, form.mln-header-search')) {
        const input = form.querySelector('input[name="q"]');
        if (input) trackSearch(input.value);
      }
    }, true);
    const catalogueInput = doc.getElementById('searchInput');
    if (catalogueInput) {
      const params = new URLSearchParams(win.location.search);
      const original = params.get('q') || params.get('brand');
      if (original) trackSearch(original);
      catalogueInput.addEventListener('input', () => {
        win.clearTimeout(searchTimer);
        const text = catalogueInput.value;
        searchTimer = win.setTimeout(() => trackSearch(text), 900);
      });
    }
    doc.addEventListener('click', event => {
      const anchor = event.target.closest?.('a[href^="https://wa.me/"]');
      if (anchor) submit('whatsapp_enquiry_click', { channel: 'whatsapp', source: 'website_link' });
    });
  }
  win.MLAnalytics = {
    enabled: configured,
    track: submit, item, ecommerce, trackSearch,
    openPreferences: showConsent
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})(window, document);
