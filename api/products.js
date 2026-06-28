// Shiprocket Checkout — Fetch Products
// GET /api/products?page=1&limit=100
// Returns the full product catalog in Shiprocket's required format.

const { getAllProducts, paginate } = require('./_sheet');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const { page = 1, limit = 100 } = req.query || {};
    const all = await getAllProducts();
    const products = paginate(all, page, limit);

    res.status(200).json({
      data: {
        total: all.length,
        products,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build product catalog', message: String(err && err.message || err) });
  }
};
