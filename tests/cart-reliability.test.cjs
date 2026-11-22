// Run with: node --test tests/cart-reliability.test.cjs
// No external services are contacted. The Google Sheets response is mocked.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const script = readFileSync(join(__dirname, '..', 'cart.js'), 'utf8');

function productRow(price, stock = 'Yes', flavours = 'Chocolate, Vanilla', stockQty = 20) {
  const c = Array.from({ length: 13 }, () => ({ v: '' }));
  for (const [index, value] of [[0, 'p'], [1, 'Whey'], [2, 'Brand'], [5, price], [7, stock], [9, flavours], [12, stockQty]]) c[index] = { v: value };
  return { c };
}

function fixture() {
  const data = new Map();
  let rows = [];
  let offline = false;
  const links = [], tabs = [];
  const localStorage = {
    getItem: key => data.get(key) || null,
    setItem: (key, val) => data.set(key, val)
  };
  const document = {
    readyState: 'loading',
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; },
    getElementById() { return null; }
  };
  const window = {
    location: { href: '' },
    open() {
      const tab = {
        closed: false,
        document: { title: '', body: { textContent: '' } },
        location: { replace(url) { links.push(url); } },
        close() { this.closed = true; }
      };
      tabs.push(tab);
      return tab;
    }
  };
  const fetch = async () => {
    if (offline) throw Error('Simulated offline response');
    return {
      ok: true,
      text: async () => '/*O_o*/google.visualization.Query.setResponse(' + JSON.stringify({ table: { rows } }) + ');'
    };
  };
  runInNewContext(script, { window, document, localStorage, fetch, setTimeout: fn => fn(), console: { error() {} } });
  const shop = window.MLStore;
  shop.registerProducts([{ id: 'p', name: 'Whey', brand: 'Brand', price_range: '₹10,700', in_stock: 'Yes', flavours: 'Chocolate, Vanilla' }]);
  return {
    shop, links, tabs,
    cart: () => JSON.parse(data.get('mlnutrition-cart') || '[]'),
    sheet: value => { rows = value; },
    offline: () => { offline = true; }
  };
}

test('variant cannot be added without a valid flavour', () => {
  const f = fixture();
  assert.equal(f.shop.addToCart('p'), false);
  assert.equal(f.shop.addToCart('p', 'Strawberry'), false);
  assert.equal(f.cart().length, 0);
  assert.equal(f.shop.addToCart('p', 'Chocolate', 2), true);
  assert.equal(f.cart()[0].flavour, 'Chocolate');
  assert.equal(f.cart()[0].qty, 2);
});

test('unknown or out-of-stock product cannot be added', () => {
  const f = fixture();
  assert.equal(f.shop.addToCart('unknown'), false);
  f.shop.registerProducts([{ id: 'p', name: 'Whey', brand: 'Brand', price_range: '₹10,700', in_stock: 'No', flavours: 'Chocolate, Vanilla' }]);
  assert.equal(f.shop.addToCart('p', 'Chocolate'), false);
  assert.equal(f.cart().length, 0);
});

test('₹10,700 remains ₹10,700 in checkout and multiplies by quantity', async () => {
  const f = fixture();
  f.shop.addToCart('p', 'Chocolate', 2);
  f.sheet([productRow('₹10,700')]);
  await f.shop.checkout();
  assert.equal(f.links.length, 1);
  assert.match(decodeURIComponent(f.links[0]), /₹21,400/);
  assert.doesNotMatch(decodeURIComponent(f.links[0]), /₹10 - ₹700/);
});

test('price change refreshes the cart and blocks WhatsApp until re-reviewed', async () => {
  const f = fixture();
  f.shop.addToCart('p', 'Vanilla');
  f.sheet([productRow('₹10,900')]);
  await f.shop.checkout();
  assert.equal(f.links.length, 0);
  assert.equal(f.cart()[0].price_range, '₹10,900');
  assert.equal(f.tabs[0].closed, true);
});

test('a recently sold-out product blocks checkout', async () => {
  const f = fixture();
  f.shop.addToCart('p', 'Chocolate');
  f.sheet([productRow('₹10,700', 'No')]);
  await f.shop.checkout();
  assert.equal(f.links.length, 0);
});

test('an explicit quantity of zero in the sheet blocks checkout', async () => {
  const f = fixture();
  f.shop.addToCart('p', 'Chocolate');
  f.sheet([productRow('₹10,700', 'Yes', 'Chocolate, Vanilla', 0)]);
  await f.shop.checkout();
  assert.equal(f.links.length, 0);
});

test('quantity greater than known stock blocks checkout', async () => {
  const f = fixture();
  f.shop.addToCart('p', 'Chocolate', 5);
  f.sheet([productRow('₹10,700', 'Yes', 'Chocolate, Vanilla', 2)]);
  await f.shop.checkout();
  assert.equal(f.links.length, 0);
});

test('a removed flavour blocks checkout', async () => {
  const f = fixture();
  f.shop.addToCart('p', 'Chocolate');
  f.sheet([productRow('₹10,700', 'Yes', 'Vanilla')]);
  await f.shop.checkout();
  assert.equal(f.links.length, 0);
});

test('network or catalogue errors block checkout instead of sending unverified orders', async () => {
  const f = fixture();
  f.shop.addToCart('p', 'Chocolate');
  f.offline();
  await f.shop.checkout();
  assert.equal(f.links.length, 0);
  assert.equal(f.tabs[0].closed, true);
});
