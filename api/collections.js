// Shiprocket Checkout — Fetch Collections
// GET /api/collections?page=1&limit=100
// Returns all collections (product categories) in Shiprocket's required format.

const { getAllCollections, paginate } = require('./_sheet');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const { page = 1, limit = 100 } = req.query || {};
    const all = await getAllCollections();
    const collections = paginate(all, page, limit);

    res.status(200).json({
      data: {
        total: all.length,
        collections,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build collections', message: String(err && err.message || err) });
  }
};
