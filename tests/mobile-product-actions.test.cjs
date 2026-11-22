// Run with: node --test tests/mobile-product-actions.test.cjs
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const script = readFileSync(join(__dirname, '..', 'internal-v14.js'), 'utf8');

function harness({ inStock = true, flavours = true, selected = false } = {}) {
  const registered = {};
  const original = { disabled: !inStock, clicks: 0, click() { this.clicks++; } };
  const whatsapp = { clicks: 0, click() { this.clicks++; } };
  const price = { textContent: '₹10,700' };
  const state = { inStock, flavours, selected };
  const root = {
    querySelector(selector) {
      if (selector === '#addCartBtn') return original;
      if (selector === '#buyWaBtn') return whatsapp;
      if (selector === '.detail-price') return price;
      if (selector === '.badge.out') return state.inStock ? null : {};
      if (selector === '.flavour-chip') return state.flavours ? {} : null;
      if (selector === '.flavour-chip.active') return state.flavours && state.selected ? {} : null;
      return null;
    }
  };
  const el = () => ({
    hidden: true, disabled: false, textContent: '', attrs: {},
    addEventListener(type, fn) { this.handlers = this.handlers || {}; this.handlers[type] = fn; },
    setAttribute(name, value) { this.attrs[name] = value; },
    click() { this.handlers && this.handlers.click && this.handlers.click(); }
  });
  const bar = el(), buyPrice = el(), add = el(), wa = el();
  const elements = {
    mlnMobileBuy: bar, mlnBuyPrice: buyPrice, mlnBuyAdd: add,
    mlnBuyWhatsApp: wa, detailRoot: root
  };
  const document = {
    readyState: 'complete',
    body: { classList: { contains: name => name === 'mln-product-page' } },
    getElementById: key => elements[key] || null,
    querySelector: () => null
  };
  const observers = [];
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
  }
  runInNewContext(script, { document, MutationObserver, window: {} });
  return { bar, add, wa, original, whatsapp, state, sync: () => observers.forEach(o => o.callback()) };
}

test('in-stock item with no selected flavour has an actionable Choose Flavour CTA', () => {
  const ui = harness();
  assert.equal(ui.bar.hidden, false);
  assert.equal(ui.add.disabled, false);
  assert.equal(ui.add.textContent, 'CHOOSE FLAVOUR');
  ui.add.click();
  assert.equal(ui.original.clicks, 1);
});

test('after selecting a flavour, the CTA becomes Add to Cart', () => {
  const ui = harness();
  ui.state.selected = true;
  ui.sync();
  assert.equal(ui.add.disabled, false);
  assert.equal(ui.add.textContent, 'ADD TO CART');
  ui.add.click();
  assert.equal(ui.original.clicks, 1);
});

test('a product without variants immediately offers Add to Cart', () => {
  const ui = harness({ flavours: false });
  assert.equal(ui.add.disabled, false);
  assert.equal(ui.add.textContent, 'ADD TO CART');
});

test('only truly out-of-stock items show a disabled Out of Stock CTA', () => {
  const ui = harness({ inStock: false });
  assert.equal(ui.add.disabled, true);
  assert.equal(ui.add.textContent, 'OUT OF STOCK');
});

test('WhatsApp button asks for flavour before opening unselected variant', () => {
  const ui = harness();
  ui.wa.click();
  assert.equal(ui.original.clicks, 1);
  assert.equal(ui.whatsapp.clicks, 0);
  ui.state.selected = true;
  ui.sync();
  ui.wa.click();
  assert.equal(ui.whatsapp.clicks, 1);
});
