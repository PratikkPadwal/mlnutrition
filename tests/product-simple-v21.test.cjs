// Run: node --test tests/product-simple-v21.test.cjs
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const html = readFileSync(join(__dirname, '..', 'product.html'), 'utf8');
const css = readFileSync(join(__dirname, '..', 'internal-v14.css'), 'utf8');
const beginning = html.indexOf('function buyOnWhatsApp()');
const ending = html.indexOf('function shareWhatsApp()', beginning);
assert.ok(beginning >= 0 && ending > beginning, 'WhatsApp enquiry function should exist');
const logic = html.slice(beginning, ending);
// Run the real page function with a mocked product and selected options.
const createEnquiry = new Function(
  'currentProduct','selectedFlavour','quantity','currentLang','parsePriceNums',
  'priceLabel','getFlavours','T','SITE','WHATSAPP_NUMBER','window','document',
  logic + '\nreturn buyOnWhatsApp;'
);
function mockEnquiry({
  product = { id: 10, name: 'Gold Standard Whey', brand: 'Optimum Nutrition',
    price_range: '₹10,700', in_stock: 'Yes', flavours: 'Chocolate, Vanilla' },
  flavour = 'Chocolate', qty = 2, language = 'en'
} = {}) {
  const opened = [], notices = [];
  let optionClicks = 0;
  const win = { MLStore: { toast: message => notices.push(message) },
    open: url => { opened.push(url); return {}; } };
  const doc = { getElementById: id => id === 'addCartBtn'
    ? { disabled: false, click: () => { optionClicks++; } } : null };
  const selected = createEnquiry(
    product, flavour, qty, language,
    value => /[0-9]/.test(String(value || '')) ? { min: 1, max: 1 } : null,
    value => String(value),
    item => String(item.flavours || '').split(/[,|]/).filter(Boolean),
    key => key,
    'https://www.mlnutrition.in', '918329384588', win, doc
  );
  selected();
  return { opened, notices, optionClicks,
    message: opened[0] ? decodeURIComponent(opened[0].split('text=')[1] || '') : '' };
}

test('uses sheet-backed name, brand, flavour, quantity, listed price and product link', () => {
  const r = mockEnquiry();
  assert.equal(r.opened.length, 1);
  assert.match(r.message, /Product: Gold Standard Whey/);
  assert.match(r.message, /Brand: Optimum Nutrition/);
  assert.match(r.message, /Flavour: Chocolate/);
  assert.match(r.message, /Quantity: 2/);
  assert.match(r.message, /Listed price: ₹10,700/);
  assert.match(r.message, /https:\/\/www\.mlnutrition\.in\/product\.html\?id=10/);
  assert.match(r.message, /confirm availability and final price/);
  assert.ok(r.message.includes('\n'), 'WhatsApp message needs real line breaks');
});

test('no invented price or flavour for products without those fields', () => {
  const r = mockEnquiry({ product: { id: 13, name: 'Gym Shaker', brand: 'ML Nutrition',
    price_range: 'Price on request', in_stock: 'Yes', flavours: '' }, flavour: null, qty: 1 });
  assert.equal(r.opened.length, 1);
  assert.doesNotMatch(r.message, /Listed price:/);
  assert.doesNotMatch(r.message, /Flavour:/);
  assert.match(r.message, /Quantity: 1/);
});

test('blocks unavailable products before WhatsApp navigation', () => {
  const r = mockEnquiry({ product: { id: 3, name: 'Creatine', brand: 'Wellcore',
    price_range: '₹699', in_stock: 'No', flavours: '' }, flavour: null });
  assert.equal(r.opened.length, 0);
  assert.equal(r.notices.length, 1);
});

test('missing flavour triggers the existing option picker, without opening WhatsApp', () => {
  const r = mockEnquiry({ flavour: null });
  assert.equal(r.opened.length, 0);
  assert.equal(r.optionClicks, 1);
});

test('Marathi enquiry retains actual product fields and final-price caveat', () => {
  const r = mockEnquiry({ language: 'mr' });
  assert.match(r.message, /प्रॉडक्ट: Gold Standard Whey/);
  assert.match(r.message, /फ्लेवर: Chocolate/);
  assert.match(r.message, /संख्या: 2/);
  assert.match(r.message, /अंतिम किंमत/);
});

test('existing sheet description is conditional and appears after purchase controls', () => {
  const start = html.indexOf('function renderProduct()');
  const end = html.indexOf('function updateBreadcrumb()', start);
  assert.ok(start > 0 && end > start);
  const renderer = html.slice(start, end);
  assert.match(renderer, /String\(p\.description \|\| ''\)\.trim\(\)/);
  assert.match(renderer, /detail-description-block/);
  const markup = renderer.slice(renderer.indexOf('root.innerHTML'));
  const price = markup.indexOf('class="detail-price"');
  const flavour = markup.indexOf(String.fromCharCode(36) + '{flavourBlock}');
  const quantity = markup.indexOf('id="qtyMinus"');
  const actions = markup.indexOf('id="addCartBtn"');
  const whatsapp = markup.indexOf('id="buyWaBtn"');
  const description = markup.indexOf(String.fromCharCode(36) + '{descBlock}');
  assert.ok(price < flavour && flavour < quantity && quantity < actions &&
    actions < whatsapp && whatsapp < description);
  assert.match(css, /detail-description-block/);
});

test('related-product suggestions use existing category, brand and stock only', () => {
  const start = html.indexOf('function renderRelated()');
  const end = html.indexOf('function updateSchema()', start);
  const renderer = html.slice(start, end < 0 ? undefined : end);
  assert.match(renderer, /p\.category === currentProduct\.category/);
  assert.match(renderer, /p\.in_stock/);
  assert.match(renderer, /currentProduct\.brand/);
  assert.match(renderer, /\.slice\(0, 4\)/);
});
