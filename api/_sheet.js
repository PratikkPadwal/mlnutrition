// Shared helper for Shiprocket Checkout catalog APIs.
// Fetches the ML Nutrition product catalog from the Google Sheet (gviz JSON)
// and transforms it into the exact shape Shiprocket Checkout expects.
//
// Files beginning with "_" inside /api are treated as helpers by Vercel,
// NOT as routable serverless endpoints.

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/17h4gGSIbSJZ6qMA0Xjt-2aLoxRT4ZTikjPdaaM6a_S4/gviz/tq?tqx=out:json';

// Defaults used when the Sheet does not yet have these columns.
// IMPORTANT: weight drives shipping cost — update the Sheet with real
// per-product weights as soon as possible.
const DEFAULT_WEIGHT_GRAMS = 1000; // 1 kg incl. packaging
const DEFAULT_STOCK_QTY = 100;
const ISO_CREATED = '2024-01-01T00:00:00Z';

// Column index map for the Sheet (0-based).
const COL = {
  id: 0,
  name: 1,
  brand: 2,
  category: 3,
  description: 4,
  price: 5,
  image_url: 6,
  in_stock: 7,
  featured: 8,
  flavours: 9,
  // Column G (image_url) already holds all images, comma-separated.
  // Optional future columns — read if present, else fall back to defaults.
  weight_grams: 10, // Column K
  sku: 11, // Column L
  stock_qty: 12, // Column M
};

function cell(row, idx) {
  const c = row && row.c && row.c[idx];
  return c && c.v != null ? c.v : '';
}

// Split a value on commas that begin a new URL, preserving commas inside a URL.
function splitImages(value) {
  if (value == null || value === '') return [];
  return String(value)
    .split(/,(?=\s*https?:\/\/)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Split a flavours cell (comma/pipe separated) into an array.
function splitFlavours(value) {
  if (value == null || value === '') return [];
  return String(value)
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Deterministic positive 32-bit-ish numeric id from a string (for collections).
function hashId(text) {
  let h = 5381;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  // Keep it a positive integer.
  return Math.abs(h >>> 0);
}

// Parse the gviz response text into rows.
function parseGviz(text) {
  // gviz wraps JSON like: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Unexpected gviz response format');
  }
  const json = JSON.parse(text.slice(start, end + 1));
  return (json.table && json.table.rows) || [];
}

async function fetchRows() {
  const res = await fetch(SHEET_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch sheet: ' + res.status);
  }
  const text = await res.text();
  return parseGviz(text);
}

// Build a numeric, unique variant id from product id + variant index.
function variantId(productId, index) {
  const base = Number(productId) || hashId(String(productId));
  return base * 1000 + index;
}

// Transform a single Sheet row into a Shiprocket product object.
function rowToProduct(row) {
  const rawId = cell(row, COL.id);
  if (rawId === '' ) return null;

  const id = Number(rawId) || hashId(String(rawId));
  const name = String(cell(row, COL.name) || '');
  const brand = String(cell(row, COL.brand) || '');
  const category = String(cell(row, COL.category) || '');
  const description = String(cell(row, COL.description) || '');
  const priceRaw = cell(row, COL.price);
  const price = priceRaw === '' ? '0' : String(priceRaw);
  const allImages = splitImages(cell(row, COL.image_url));
  const mainImage = allImages[0] || '';
  const inStock = String(cell(row, COL.in_stock)).trim().toLowerCase() === 'yes';

  const weightGrams = Number(cell(row, COL.weight_grams)) || DEFAULT_WEIGHT_GRAMS;
  const stockQty = inStock
    ? Number(cell(row, COL.stock_qty)) || DEFAULT_STOCK_QTY
    : 0;
  const baseSku = String(cell(row, COL.sku) || '') || `MLN-${id}`;

  const flavours = splitFlavours(cell(row, COL.flavours));
  const handle = slugify(name) || `product-${id}`;

  // Build variants — one per flavour, or a single default variant.
  let variants;
  let options;
  if (flavours.length > 0) {
    variants = flavours.map((flavour, i) => ({
      id: variantId(id, i + 1),
      title: flavour,
      price: price,
      compare_at_price: '',
      sku: `${baseSku}-${slugify(flavour).toUpperCase() || i + 1}`,
      quantity: stockQty,
      created_at: ISO_CREATED,
      updated_at: ISO_CREATED,
      taxable: true,
      option_values: { Flavour: flavour },
      grams: weightGrams,
      image: { src: mainImage },
      weight: weightGrams / 1000,
      weight_unit: 'kg',
    }));
    options = [{ name: 'Flavour', values: flavours }];
  } else {
    variants = [
      {
        id: variantId(id, 1),
        title: 'Default',
        price: price,
        compare_at_price: '',
        sku: baseSku,
        quantity: stockQty,
        created_at: ISO_CREATED,
        updated_at: ISO_CREATED,
        taxable: true,
        option_values: {},
        grams: weightGrams,
        image: { src: mainImage },
        weight: weightGrams / 1000,
        weight_unit: 'kg',
      },
    ];
    options = [];
  }

  return {
    id: id,
    title: name,
    body_html: description ? `<p>${description}</p>` : '',
    vendor: brand,
    product_type: category,
    created_at: ISO_CREATED,
    handle: handle,
    updated_at: ISO_CREATED,
    tags: [brand, category].filter(Boolean).join(', '),
    status: inStock ? 'active' : 'draft',
    variants: variants,
    image: { src: mainImage },
    options: options,
  };
}

// Build the list of collections (categories) from the rows.
function rowsToCollections(rows) {
  const seen = new Map();
  for (const row of rows) {
    const category = String(cell(row, COL.category) || '').trim();
    if (!category) continue;
    if (!seen.has(category.toLowerCase())) {
      seen.set(category.toLowerCase(), category);
    }
  }
  return [...seen.values()].map((title) => ({
    id: hashId(title.toLowerCase()),
    updated_at: ISO_CREATED,
    body_html: '',
    handle: slugify(title),
    image: { src: '' },
    title: title,
    created_at: ISO_CREATED,
  }));
}

// Apply page/limit pagination to an array.
function paginate(items, page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, parseInt(limit, 10) || 100);
  const start = (p - 1) * l;
  return items.slice(start, start + l);
}

async function getAllProducts() {
  const rows = await fetchRows();
  return rows.map(rowToProduct).filter(Boolean);
}

// Get products that belong to a given collection id (category hash).
async function getProductsByCollection(collectionId) {
  const rows = await fetchRows();
  const target = String(collectionId);
  return rows
    .filter((row) => {
      const category = String(cell(row, COL.category) || '').trim();
      if (!category) return false;
      return String(hashId(category.toLowerCase())) === target;
    })
    .map(rowToProduct)
    .filter(Boolean);
}

async function getAllCollections() {
  const rows = await fetchRows();
  return rowsToCollections(rows);
}

module.exports = {
  COL,
  hashId,
  slugify,
  paginate,
  fetchRows,
  rowToProduct,
  rowsToCollections,
  getAllProducts,
  getAllCollections,
  getProductsByCollection,
};
