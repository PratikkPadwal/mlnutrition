// Shiprocket Checkout — Fetch Products By Collection
// GET /api/products-by-collection?collection_id=1234&page=1&limit=100
// Returns products belonging to a specific collection (category).

const { getProductsByCollection, paginate } = require('./_sheet');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const { collection_id, page = 1, limit = 100 } = req.query || {};
    if (!collection_id) {
      res.status(400).json({ error: 'collection_id is required' });
      return;
    }
    const all = await getProductsByCollection(collection_id);
    const products = paginate(all, page, limit);

    res.status(200).json({
      data: {
        total: all.length,
        products,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build collection products', message: String(err && err.message || err) });
  }
};
