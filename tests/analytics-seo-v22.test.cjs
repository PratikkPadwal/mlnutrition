// Run with: node --test tests/analytics-seo-v22.test.cjs
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const analyticsSource = readFileSync(join(__dirname, '..', 'analytics-v22.js'), 'utf8');
const sitemapSource = readFileSync(join(__dirname, '..', 'api', 'products-sitemap.js'), 'utf8');

function createAnalytics(id, preset = null) {
  const storage = new Map(preset ? [['mlnutrition-analytics-consent-v1', preset]] : []);
  const loads = [];
  const listeners = {};
  let reloadCount = 0;
  function element(tag) {
    return {
      tag, children: [], hidden: false, style: {},
      listeners: {}, attrs: {},
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.children.push(child); },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      setAttribute(key, value) { this.attrs[key] = value; },
      getAttribute(key) { return this.attrs[key]; }
    };
  }
  const head = element('head');
  head.appendChild = e => { loads.push(e); };
  const body = element('body');
  const document = {
    head, body, readyState: 'loading', activeElement: null,
    createElement: element,
    addEventListener(name, callback) { listeners[name] = callback; },
    getElementById() { return null; }
  };
  const window = {
    MLAnalyticsConfig: { ga4MeasurementId: id },
    localStorage: {
      getItem(k) { return storage.get(k) || null; },
      setItem(k, value) { storage.set(k, value); }
    },
    location: { search: '', reload() { reloadCount++; } },
    setTimeout(fn) { fn(); return 1; },
    clearTimeout() {},
    innerWidth: 400
  };
  runInNewContext(analyticsSource, { window, document, URLSearchParams, Date, console });
  if (listeners.DOMContentLoaded) listeners.DOMContentLoaded();
  return {
    window, document, loads, storage,
    get banner() { return body.children[0]; },
    get reloads() { return reloadCount; },
    accept() { body.children[0].children[1].children[1].listeners.click(); },
    reject() { body.children[0].children[1].children[0].listeners.click(); },
    events() { return (window.dataLayer || []).map(value => Array.from(value)); }
  };
}

test('no Google tag or consent notice without a real measurement ID', () => {
  const t = createAnalytics('');
  assert.equal(t.window.MLAnalytics.enabled, false);
  assert.equal(t.banner, undefined);
  assert.equal(t.loads.length, 0);
  t.window.MLAnalytics.track('view_item', { items: [{ item_id: '12' }] });
  assert.equal(t.loads.length, 0);
});

test('real GA4 ID displays explicit choice but does not load Google before opt-in', () => {
  const t = createAnalytics('G-AB12345Z9');
  assert.equal(t.window.MLAnalytics.enabled, true);
  assert.equal(t.banner.hidden, false);
  t.window.MLAnalytics.track('view_item', { items: [{ item_id: '12' }] });
  assert.equal(t.loads.length, 0);
  t.reject();
  assert.equal(t.storage.get('mlnutrition-analytics-consent-v1'), 'denied');
  assert.equal(t.loads.length, 0);
});

test('granting permission loads Google once and sends queued event', () => {
  const t = createAnalytics('G-AB12345Z9');
  const api = t.window.MLAnalytics;
  api.track('view_item', { currency: 'INR', items: [{ item_id: '10' }] });
  t.accept();
  assert.equal(t.loads.length, 1);
  assert.equal(t.loads[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-AB12345Z9');
  assert.ok(t.events().some(event => event[0] === 'config' && event[1] === 'G-AB12345Z9'));
  assert.ok(t.events().some(event => event[0] === 'event' && event[1] === 'view_item'));
  api.track('add_to_cart', { items: [{ item_id: '10' }] });
  assert.ok(t.events().some(event => event[0] === 'event' && event[1] === 'add_to_cart'));
});

test('existing opt-out stays off and no non-analytics names are sent', () => {
  const t = createAnalytics('G-AB12345Z9', 'denied');
  assert.equal(t.banner.hidden, true);
  assert.equal(t.loads.length, 0);
  assert.equal(t.window.MLAnalytics.track('purchase', { value: 100 }), false);
  assert.equal(t.window.MLAnalytics.track('view_item', {}), false);
  assert.equal(t.loads.length, 0);
});

test('revoking permission reloads the page to unload the tag', () => {
  const t = createAnalytics('G-AB12345Z9');
  t.accept();
  t.reject();
  assert.equal(t.reloads, 1);
  assert.equal(t.storage.get('mlnutrition-analytics-consent-v1'), 'denied');
});

test('only fixed numeric INR amounts are reported as ecommerce values', () => {
  const t = createAnalytics('');
  const item = t.window.MLAnalytics.item({
    id: 42, name: 'Whey', brand: 'Optimum Nutrition', category: 'Protein', price_range: '₹10,700'
  }, 2, 'Chocolate');
  assert.equal(item.price, 10700);
  assert.equal(item.quantity, 2);
  assert.equal(item.item_variant, 'Chocolate');
  const ranged = t.window.MLAnalytics.ecommerce({
    id: 43, name: 'Whey B', price_range: '₹7,000 - ₹9,500'
  }, 1);
  assert.equal(ranged.items[0].price, undefined);
  assert.equal(ranged.value, undefined);
});

test('search analytics excludes arbitrary text and possible personal data', () => {
  const t = createAnalytics('G-AB12345Z9');
  t.accept();
  assert.equal(t.window.MLAnalytics.trackSearch('sample@example.com'), false);
  assert.equal(t.window.MLAnalytics.trackSearch('9876543210'), false);
  t.window.MLAnalytics.trackSearch('ON whey');
  t.window.MLAnalytics.trackSearch('ON whey');
  assert.equal(t.events().filter(e => e[0] === 'event' && e[1] === 'search').length, 1);
});

function sheetRow(id, name) {
  return { c: [{ v: id }, { v: name }] };
}
function sitemapModule(fetchRows = async () => []) {
  const module = { exports: {} };
  const require = path => {
    if (path !== './_sheet') throw Error('Unexpected import');
    return { fetchRows, COL: { id: 0, name: 1 } };
  };
  runInNewContext(sitemapSource, { module, require, console, encodeURIComponent });
  return module.exports;
}

test('product sitemap uses real IDs, dedupes and escapes URLs', () => {
  const handler = sitemapModule();
  const xml = handler.generateSitemap([
    sheetRow('100', 'Whey'), sheetRow('100', 'Whey Duplicate'),
    sheetRow('200&x', 'Creatine'), sheetRow('', 'Missing'),
    sheetRow('Name', 'name')
  ]);
  assert.match(xml, /<loc>https:\/\/www\.mlnutrition\.in\/product\.html\?id=100<\/loc>/);
  assert.match(xml, /id=200%26x/);
  assert.equal((xml.match(/id=100<\/loc>/g) || []).length, 1);
  assert.doesNotMatch(xml, /<lastmod>/);
});

test('sitemap returns success only for a working catalogue and 503 on outage', async () => {
  async function request(module) {
    const res = {
      code: null, headers: {}, body: '',
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.code = c; return this; },
      send(text) { this.body = text; return this; }
    };
    await module({ method: 'GET' }, res);
    return res;
  }
  const good = await request(sitemapModule(async () => [sheetRow(1, 'Whey')]));
  assert.equal(good.code, 200);
  assert.match(good.headers['Content-Type'], /application\/xml/);
  const bad = await request(sitemapModule(async () => { throw Error('offline'); }));
  assert.equal(bad.code, 503);
  assert.match(bad.body, /temporarily unavailable/);
});
