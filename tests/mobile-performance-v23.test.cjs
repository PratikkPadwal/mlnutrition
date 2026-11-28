// Run: node --test tests/mobile-performance-v23.test.cjs
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const storefront = readFileSync(join(__dirname, '..', 'storefront-v13.js'), 'utf8');
const product = readFileSync(join(__dirname, '..', 'product.html'), 'utf8');
const catalogue = readFileSync(join(__dirname, '..', 'products.html'), 'utf8');
const vercel = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf8'));

const cart = readFileSync(join(__dirname, '..', 'cart.js'), 'utf8');
function scripts(html) {
  return [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(m => m[1].trim()).filter(Boolean).filter(x => !x.startsWith('{'));
}

test('all edited JavaScript parses', () => {
  assert.doesNotThrow(() => new Function(storefront));
  scripts(product).forEach(code => assert.doesNotThrow(() => new Function(code)));
});

test('homepage keeps hero loading eager, prioritizing only centre product image', () => {
  const hero = storefront.slice(storefront.indexOf('function fillHero()'), storefront.indexOf('function fillCategories()'));
  assert.match(hero, /img\.loading='eager'/);
  assert.match(hero, /img\.fetchPriority=i===1\?'high':'low'/);
  assert.match(hero, /showImage\(img,fallback,primaryPhoto\(p\),p\.name\)/);
});

test('category product photos are lazy and low priority', () => {
  const source = storefront.slice(storefront.indexOf('function fillCategories()'), storefront.indexOf('function fillBrands()'));
  assert.match(source, /img\.loading='lazy'/);
  assert.match(source, /img\.fetchPriority='low'/);
});

test('brand logos only start remote requests once near viewport', () => {
  const source = storefront.slice(storefront.indexOf('function fillBrands()'), storefront.indexOf('function buildFeaturedPool()'));
  assert.match(source, /image\.loading='lazy'/);
  assert.match(source, /new IntersectionObserver\(/);
  assert.match(source, /observer\.observe\(link\)/);
  assert.match(source, /rootMargin:'180px'/);
  assert.match(source, /if\('IntersectionObserver' in window\)/);
  assert.match(source, /else\s*\{\s*\/\/ Older browsers/);
});

test('featured product images are lazy without modifying cart event delegation', () => {
  const source = storefront.slice(storefront.indexOf('function productCard('), storefront.indexOf('function setupShowcase()'));
  assert.match(source, /img\.loading='lazy'/);
  assert.match(source, /img\.fetchPriority='low'/);
  assert.match(source, /'feature-wishlist'/);
});

test('product gallery prioritizes the displayed primary image', () => {
  assert.match(product, /loading="\$\{i === 0 \? 'eager' : 'lazy'\}"/);
  assert.match(product, /fetchpriority="\$\{i === 0 \? 'high' : 'low'\}"/);
  assert.match(product, /<img src="\$\{esc\(src\)\}" alt="" loading="lazy" fetchpriority="low"/);
});

test('swiping to a deferred gallery slide still forces it to load', () => {
  const source = product.slice(product.indexOf('function goToSlide('), product.indexOf('function wireGallery()'));
  assert.match(source, /const activeImage = track\?\.querySelectorAll\('\.gallery-slide img'\)\[galleryIndex\]/);
  assert.match(source, /activeImage\.loading = 'eager'/);
});

test('shared cart and WhatsApp stock verification are untouched', () => {
  assert.match(cart, /async function fetchFreshCatalogue\(\)/);
  assert.match(cart, /async function checkout\(\)/);
  assert.match(product, /id="addCartBtn"/);
  assert.match(product, /id="buyWaBtn"/);
});


test('catalogue image rendering and optimizer compile with existing scripts', () => {
  scripts(catalogue).forEach(code => assert.doesNotThrow(() => new Function(code)));
});

test('Vercel image optimizer allows only known Avvatar product-image host and fixed thumbnails', () => {
  assert.deepEqual(vercel.images.sizes, [384]);
  assert.deepEqual(vercel.images.qualities, [70]);
  assert.equal(vercel.images.remotePatterns.length, 1);
  assert.equal(vercel.images.remotePatterns[0].hostname, 'www.avvatarindia.com');
  assert.match(vercel.images.remotePatterns[0].pathname, /product_images/);
});

test('catalogue renders small Avvatar image thumbnails with original image fallback', () => {
  assert.match(catalogue, /function catalogueThumbnailUrl\(original\)/);
  assert.match(catalogue, /hostname === 'www.avvatarindia.com'/);
  assert.match(catalogue, /\/_vercel\/image\?url=/);
  assert.match(catalogue, /data-original-src="\$\{safeHTML\(imageUrl\)\}"/);
  assert.match(catalogue, /this\.dataset\.originalSrc/);
});

test('first two catalogue product images are eagerly fetched at high priority', () => {
  assert.match(catalogue, /products\.map\(\(product, index\) =>/);
  assert.match(catalogue, /loading="\$\{index < 2 \? 'eager' : 'lazy'\}"/);
  assert.match(catalogue, /fetchpriority="\$\{index < 2 \? 'high' : 'low'\}"/);
});
