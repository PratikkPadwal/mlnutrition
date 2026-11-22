// Run: node --test tests/search-v20.test.cjs
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const search = require('../search-v20.js');

const catalogue = [
  { id: 1, name: 'Gold Standard 100% Whey', brand: 'Optimum Nutrition', category: 'Protein', in_stock: 'Yes', price_range: '₹10,700' },
  { id: 2, name: 'Biozyme Whey Protein', brand: 'MuscleBlaze', category: 'Protein', in_stock: 'Yes', price_range: '₹5,600' },
  { id: 3, name: 'King Whey', brand: 'Ronnie Coleman', category: 'Protein', in_stock: 'No', price_range: '₹4,200' },
  { id: 4, name: 'Critical Whey', brand: 'Applied Nutrition', category: 'Protein', in_stock: 'Yes', price_range: '₹5,900' },
  { id: 5, name: 'Creatine Monohydrate', brand: 'Wellcore', category: 'Creatine', in_stock: 'Yes', price_range: '₹699' },
  { id: 6, name: 'Gold Standard Isolate', brand: 'ON', category: 'Protein', in_stock: 'Yes', price_range: '₹11,500' },
  { id: 7, name: 'Pre-Workout', brand: 'MuscleBlaze', category: 'Pre-Workout', in_stock: 'Yes', price_range: '₹1,999' }
];

test('brand abbreviations ON, MB and RC map to real catalogue brands', () => {
  assert.equal(search.rankProducts(catalogue, 'ON whey')[0].id, 1);
  assert.equal(search.rankProducts(catalogue, 'MB whey')[0].id, 2);
  assert.equal(search.rankProducts(catalogue, 'rc whey')[0].id, 3);
  assert.deepEqual(search.rankProducts(catalogue, 'ON').map(p => p.id), [6, 1]);
});

test('multi-term search matches across brand, name and category', () => {
  assert.deepEqual(search.rankProducts(catalogue, 'applied whey').map(p => p.id), [4]);
  assert.deepEqual(search.rankProducts(catalogue, 'wellcore creatine').map(p => p.id), [5]);
  assert.deepEqual(search.rankProducts(catalogue, 'MB preworkout').map(p => p.id), [7]);
});

test('limited common typos are tolerated', () => {
  assert.equal(search.rankProducts(catalogue, 'creatin')[0].id, 5);
  assert.ok(search.rankProducts(catalogue, 'protien').length > 0);
  assert.equal(search.rankProducts(catalogue, 'wellcore creatin')[0].id, 5);
});

test('unrelated products do not appear in precise multi-term searches', () => {
  assert.deepEqual(search.rankProducts(catalogue, 'ON creatine'), []);
  assert.deepEqual(search.rankProducts(catalogue, 'brand-does-not-exist'), []);
});

test('result limit and ranking retain original product records', () => {
  const results = search.rankProducts(catalogue, 'whey', 2);
  assert.equal(results.length, 2);
  assert.equal(results[0], catalogue[0]);
});

test('Indian comma-separated prices and ranges display correctly', () => {
  assert.equal(search.formatPrice('₹10,700'), '₹10,700');
  assert.equal(search.formatPrice('Rs. 1,299'), '₹1,299');
  assert.equal(search.formatPrice('₹2,000-₹3,000'), '₹2,000 – ₹3,000');
  assert.equal(search.formatPrice('₹5,600/-'), '₹5,600');
  assert.equal(search.formatPrice('Price on request'), 'Ask for price');
});

test('Google Sheets parser rejects invalid responses and reads catalogue columns', () => {
  assert.throws(() => search.parseGviz('bad data'));
  const row = { c: [{ v: 25 }, { v: 'Creatine' }, { v: 'Wellcore' },
    { v: 'Creatine' }, { v: 'Micronized' }, { v: '₹1,299' },
    { v: 'https://example.com/image.png' }, { v: 'Yes' }] };
  const input = '/*O_o*/ google.visualization.Query.setResponse(' + JSON.stringify({
    table: { rows: [row] }
  }) + ');';
  const out = search.parseGviz(input);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 25);
  assert.equal(out[0].name, 'Creatine');
  assert.equal(out[0].price_range, '₹1,299');
});

test('HTML-like names are normalized as data, not executable markup', () => {
  const data = [{ id: 8, name: '<img src=x onerror=alert(1)>', brand: 'Test Brand', category: 'Misc' }];
  assert.deepEqual(search.rankProducts(data, 'alert').map(p => p.id), [8]);
});
