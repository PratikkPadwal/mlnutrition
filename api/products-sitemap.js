/* Dynamic product sitemap for www.mlnutrition.in.
 * Source: the same public Google Sheet already powering product.html.
 * Only real Sheet IDs are included; never invent URLs or lastmod dates.
 */
'use strict';
const { fetchRows, COL } = require('./_sheet');

const ORIGIN = 'https://www.mlnutrition.in';
function cell(row, index) {
  const value = row && row.c && row.c[index];
  return value && value.v != null ? String(value.v).trim() : '';
}
function escapeXML(value) {
  return String(value).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function generateSitemap(rows) {
  const urls = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = cell(row, COL.id);
    const name = cell(row, COL.name);
    if (!id || id.length > 120 || /[\u0000-\u001f\u007f]/.test(id) ||
        !name || name.toLowerCase() === 'name' || seen.has(id)) continue;
    seen.add(id);
    urls.push('  <url><loc>' + escapeXML(
      ORIGIN + '/product.html?id=' + encodeURIComponent(id)
    ) + '</loc></url>');
    // Google allows 50,000 URLs/sitemap. Leave room for catalogue growth.
    if (urls.length >= 45000) break;
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + '\n</urlset>\n';
}
async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }
  try {
    const rows = await fetchRows();
    const sitemap = generateSitemap(rows);
    if (!Array.isArray(rows) || !rows.length ||
        !sitemap.includes('<url><loc>')) {
      throw new Error('No valid catalogue products to list');
    }
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).send(req.method === 'HEAD' ? '' : sitemap);
  } catch (err) {
    // Never turn a temporary Sheet outage into a misleading empty sitemap.
    console.error('Product sitemap unavailable', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send('Product sitemap temporarily unavailable');
  }
}
module.exports = handler;
module.exports.generateSitemap = generateSitemap;
