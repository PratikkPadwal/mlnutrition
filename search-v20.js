/* ML Nutrition Smart Search V20
   Pure product matching + accessible shared autocomplete.
   Source: live Google Sheets catalogue. No external search service. */
(function (root) {
  'use strict';
  const SHEET = 'https://docs.google.com/spreadsheets/d/17h4gGSIbSJZ6qMA0Xjt-2aLoxRT4ZTikjPdaaM6a_S4/gviz/tq?tqx=out:json';
  const ALIAS = [
    [/^(on|optimum nutrition)$/i, 'on optimum nutrition'],
    [/^(mb|muscleblaze|muscle blaze)$/i, 'mb muscleblaze muscle blaze'],
    [/^(rc|ronnie coleman|ronnie coleman signature series)$/i, 'rc ronnie coleman'],
    [/^(r1|rule 1|rule one|rule 1 proteins)$/i, 'r1 rule one'],
    [/^(gnc)$/i, 'gnc'],
    [/^(pre workout|preworkout)$/i, 'preworkout pre workout'],
    [/^(mass gainer|massgainer)$/i, 'massgainer mass gainer'],
    [/^(health food|health foods)$/i, 'healthfood health food']
  ];
  function normalize(value) {
    return String(value == null ? '' : value).normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function words(value) {
    return normalize(value).split(' ').filter(Boolean);
  }
  function synonymText(brand, category) {
    const result = [];
    for (const value of [brand, category]) {
      const n = normalize(value);
      for (const [pattern, synonym] of ALIAS) {
        if (pattern.test(n)) result.push(synonym);
      }
      if (n.includes('optimum nutrition')) result.push('on');
      if (n.includes('muscleblaze')) result.push('mb');
      if (n.includes('ronnie coleman')) result.push('rc');
      if (n.includes('rule one') || n.includes('rule 1')) result.push('r1');
      if (n.includes('pre workout')) result.push('preworkout');
      if (n.includes('mass gainer')) result.push('massgainer');
    }
    return result.join(' ');
  }
  // Bound edit distance to prevent unrelated suggestions and quadratic work.
  function editDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      let best = next[0];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const v = Math.min(next[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        next.push(v);
        if (v < best) best = v;
      }
      if (best > limit) return limit + 1;
      previous = next;
    }
    return previous[b.length];
  }
  function matchQuality(term, source) {
    if (!source) return 0;
    const tokens = source.split(' ').filter(Boolean);
    if (tokens.includes(term)) return 1;
    if (term.length >= 2 && tokens.some(t => t.startsWith(term))) return 0.78;
    if (term.length >= 3 && tokens.some(t => t.includes(term))) return 0.53;
    if (term.length >= 4) {
      const limit = term.length >= 7 ? 2 : 1;
      for (const token of tokens) {
        if (Math.abs(token.length - term.length) <= limit &&
            editDistance(term, token, limit) <= limit) return 0.39;
      }
    }
    return 0;
  }
  function scoreProduct(product, query) {
    const q = normalize(query);
    if (!q) return 0;
    const qTokens = q.split(' ');
    const name = normalize(product.name);
    const brand = normalize(product.brand);
    const category = normalize(product.category);
    const aliases = normalize(synonymText(product.brand, product.category));
    const description = normalize(product.description).slice(0, 350);
    if (!name) return 0;
    let score = 0;
    for (const term of qTokens) {
      const best = Math.max(
        24 * matchQuality(term, name),
        22 * matchQuality(term, brand),
        18 * matchQuality(term, aliases),
        11 * matchQuality(term, category),
        3 * matchQuality(term, description)
      );
      if (!best) return 0; // All query terms must be accounted for.
      score += best;
    }
    const joined = brand + ' ' + name;
    if (name === q) score += 65;
    else if (name.includes(q)) score += 28;
    if (brand === q) score += 35;
    else if (joined.includes(q)) score += 18;
    if (aliases.split(' ').includes(q)) score += 17;
    if (String(product.in_stock || '').trim().toLowerCase() === 'yes') score += 6;
    else score -= 4;
    return Math.max(0, score);
  }
  function rankProducts(products, query, limit) {
    const q = normalize(query);
    if (!q) return [];
    const matches = (Array.isArray(products) ? products : []).map((product, index) => ({
      product, index, score: scoreProduct(product, q)
    })).filter(item => item.score > 0);
    matches.sort((a, b) => b.score - a.score || a.index - b.index);
    return matches.slice(0, limit == null ? matches.length : Math.max(0, limit)).map(item => item.product);
  }
  function formatPrice(price) {
    const raw = String(price == null ? '' : price).trim()
      .replace(/(?:\bINR\b|\bRs\.?)/gi, '')
      .replace(/[₹,\s]/g, '').replace(/\/-$/, '');
    const m = raw.match(/^(\d+(?:\.\d{1,2})?)(?:(?:-|–|—|to)(\d+(?:\.\d{1,2})?))?$/i);
    if (!m) return 'Ask for price';
    const a = Number(m[1]), b = Number(m[2] == null ? m[1] : m[2]);
    if (a <= 0 || b <= 0) return 'Ask for price';
    const money = v => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return a === b ? money(a) : money(Math.min(a, b)) + ' – ' + money(Math.max(a, b));
  }
  function parseGviz(text) {
    const raw = String(text || '');
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw Error('Unexpected catalogue response');
    const data = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(data.table && data.table.rows)) throw Error('Missing catalogue rows');
    const cell = (row, index) => row && row.c && row.c[index] && row.c[index].v != null ? row.c[index].v : '';
    return data.table.rows.map(row => ({
      id: cell(row, 0), name: String(cell(row, 1) || '').trim(),
      brand: String(cell(row, 2) || '').trim(),
      category: String(cell(row, 3) || '').trim(),
      description: String(cell(row, 4) || '').trim(),
      price_range: String(cell(row, 5) || '').trim(),
      image_url: String(cell(row, 6) || '').trim(),
      in_stock: String(cell(row, 7) || '').trim()
    })).filter(p => p.id !== '' && p.name && normalize(p.name) !== 'name');
  }
  const api = { normalize, words, rankProducts, scoreProduct, formatPrice, parseGviz };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root || !root.document) return;

  const doc = root.document;
  let catalogue = [];
  let ready = false;
  let loading = null;
  let currentController = null;
  const controllers = [];
  let counter = 0;
  function make(tag, className, label) {
    const e = doc.createElement(tag);
    if (className) e.className = className;
    if (label !== undefined) e.textContent = String(label);
    return e;
  }
  function safeImageSource(value) {
    const raw = String(value || '').split(/,(?=\s*https?:\/\/)/)[0].trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, root.location.origin);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (err) { return ''; }
  }
  function setProducts(items) {
    if (!Array.isArray(items) || !items.length) return;
    catalogue = items.filter(p => p && p.id != null && String(p.name || '').trim());
    ready = true;
    controllers.forEach(controller => {
      if (controller.input.value.trim().length >= 2 && doc.activeElement === controller.input) controller.render();
    });
  }
  function loadCatalogue() {
    if (ready) return Promise.resolve(catalogue);
    if (!loading) {
      loading = root.fetch(SHEET, { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw Error('Unable to load catalogue');
          return response.text();
        })
        .then(raw => {
          const products = parseGviz(raw);
          if (!products.length) throw Error('Empty catalogue');
          setProducts(products);
          return catalogue;
        }).catch(err => {
          loading = null; // Retry on a later interaction.
          throw err;
        });
    }
    return loading;
  }
  function openAll(query) {
    return '/products.html?q=' + encodeURIComponent(query);
  }
  function setup(input) {
    if (input.dataset.mlSearchReady) return;
    input.dataset.mlSearchReady = '1';
    const id = 'ml-smart-results-' + (++counter);
    const panel = make('div', 'ml-smart-results');
    panel.id = id;
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('aria-label', 'Supplement search suggestions');
    panel.hidden = true;
    doc.body.appendChild(panel);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', id);
    input.setAttribute('aria-expanded', 'false');
    let activeIndex = -1, timer = null;
    function hide() {
      panel.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activeIndex = -1;
      if (currentController === controller) currentController = null;
    }
    function position() {
      const rect = input.getBoundingClientRect();
      const vw = root.innerWidth || doc.documentElement.clientWidth;
      const vh = root.visualViewport ? root.visualViewport.height + root.visualViewport.offsetTop : root.innerHeight;
      const width = Math.min(490, vw - 24, Math.max(320, rect.width + 40));
      const left = Math.min(Math.max(12, rect.left), Math.max(12, vw - width - 12));
      const roomBelow = vh - rect.bottom - 12;
      const roomAbove = rect.top - 12;
      const above = roomBelow < 250 && roomAbove > roomBelow;
      const height = Math.min(420, Math.max(140, above ? roomAbove : roomBelow));
      panel.style.width = Math.max(220, width) + 'px';
      panel.style.left = left + 'px';
      panel.style.maxHeight = height + 'px';
      panel.style.top = above ? 'auto' : Math.max(8, rect.bottom + 6) + 'px';
      panel.style.bottom = above ? Math.max(8, vh - rect.top + 6) + 'px' : 'auto';
    }
    function addViewAll(query) {
      const link = make('a', 'ml-smart-all', 'VIEW ALL RESULTS FOR “' + query + '”  →');
      link.href = openAll(query);
      panel.appendChild(link);
    }
    function showMessage(message, query) {
      panel.replaceChildren(make('div', 'ml-smart-message', message));
      if (query) addViewAll(query);
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      position();
    }
    function render() {
      const query = input.value.trim();
      activeIndex = -1;
      input.removeAttribute('aria-activedescendant');
      if (query.length < 2) { hide(); return; }
      if (!ready) { showMessage('Searching the ML Nutrition catalogue…', query); return; }
      const results = rankProducts(catalogue, query, 6);
      panel.replaceChildren();
      if (!results.length) {
        panel.appendChild(make('div', 'ml-smart-message', 'No matching products found. Try a brand or category.'));
      } else {
        panel.appendChild(make('div', 'ml-smart-heading', 'MATCHING PRODUCTS'));
        results.forEach((product, index) => {
          const link = make('a', 'ml-smart-result');
          link.href = '/product.html?id=' + encodeURIComponent(product.id);
          link.setAttribute('role', 'option');
          link.setAttribute('aria-selected', 'false');
          link.id = id + '-item-' + index;
          const photo = make('span', 'ml-smart-photo');
          const fallback = make('span', 'ml-smart-fallback', words(product.name).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'ML');
          photo.appendChild(fallback);
          const src = safeImageSource(product.image_url);
          if (src) {
            const img = make('img');
            img.alt = '';
            img.loading = index < 3 ? 'eager' : 'lazy';
            img.decoding = 'async';
            img.onerror = () => img.remove();
            img.onload = () => { if (img.naturalWidth) fallback.hidden = true; };
            img.src = src;
            photo.appendChild(img);
          }
          const copy = make('span', 'ml-smart-copy');
          copy.appendChild(make('span', 'ml-smart-title', product.name));
          copy.appendChild(make('span', 'ml-smart-brand', product.brand || 'ML Nutrition'));
          const side = make('span', 'ml-smart-side');
          const isAvailable = String(product.in_stock || '').trim().toLowerCase() === 'yes';
          side.appendChild(make('strong', 'ml-smart-price', formatPrice(product.price_range)));
          side.appendChild(make('span', 'ml-smart-stock' + (isAvailable ? ' available' : ''), isAvailable ? 'IN STOCK' : (String(product.in_stock || '').trim() ? 'OUT OF STOCK' : 'CHECK STOCK')));
          link.append(photo, copy, side);
          panel.appendChild(link);
        });
      }
      addViewAll(query);
      panel.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      position();
    }
    function activate(index) {
      const results = Array.from(panel.querySelectorAll('.ml-smart-result'));
      if (!results.length) return;
      activeIndex = (index + results.length) % results.length;
      results.forEach((link, i) => {
        link.classList.toggle('is-active', i === activeIndex);
        link.setAttribute('aria-selected', String(i === activeIndex));
      });
      input.setAttribute('aria-activedescendant', results[activeIndex].id);
      results[activeIndex].scrollIntoView({ block: 'nearest' });
    }
    function schedule() {
      root.clearTimeout(timer);
      const query = input.value.trim();
      if (query.length < 2) { hide(); return; }
      if (currentController && currentController !== controller) currentController.hide();
      currentController = controller;
      timer = root.setTimeout(() => {
        render();
        if (!ready) {
          loadCatalogue().then(() => {
            if (doc.activeElement === input) render();
          }).catch(() => {
            if (doc.activeElement === input) showMessage('Suggestions are temporarily unavailable.', query);
          });
        }
      }, 110);
    }
    input.addEventListener('input', schedule);
    input.addEventListener('focus', schedule);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { if (!panel.hidden) { event.preventDefault(); hide(); } return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (input.value.trim().length < 2) return;
        if (panel.hidden) render();
        event.preventDefault();
        const count = panel.querySelectorAll('.ml-smart-result').length;
        if (count) activate(event.key === 'ArrowDown' ? activeIndex + 1 : activeIndex - 1);
      }
      if (event.key === 'Enter' && !panel.hidden && activeIndex >= 0) {
        const result = panel.querySelectorAll('.ml-smart-result')[activeIndex];
        if (result) { event.preventDefault(); root.location.assign(result.href); }
      }
    });
    input.addEventListener('blur', () => root.setTimeout(hide, 175));
    const controller = { input, panel, hide, render, position };
    controllers.push(controller);
    doc.addEventListener('pointerdown', event => {
      if (event.target !== input && !panel.contains(event.target)) hide();
    });
    root.addEventListener('resize', () => { if (!panel.hidden) position(); });
    root.addEventListener('scroll', () => { if (!panel.hidden) position(); }, true);
    // iOS virtual keyboard resizes the visual viewport without always
    // emitting window.resize. Keep the panel next to the focused input.
    if (root.visualViewport) {
      root.visualViewport.addEventListener('resize', () => { if (!panel.hidden) position(); });
      root.visualViewport.addEventListener('scroll', () => { if (!panel.hidden) position(); });
    }
  }
  function init() {
    doc.querySelectorAll(
      'form.search-bar input[name="q"], form.mobile-search input[name="q"], ' +
      'form.mln-header-search input[name="q"], form.mln-mobile-search input[name="q"], #searchInput'
    ).forEach(setup);
  }
  api.setProducts = setProducts;
  api.getProducts = () => catalogue.slice();
  api.init = init;
  root.MLSearch = api;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(typeof window === 'undefined' ? null : window);
