const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { Review } = require('../models/misc');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');
const { asyncHandler, notFound } = require('../utils/errors');

const supplierOnly = [authenticate, requireRole('farmer', 'trader')];

router.patch(
  '/settings',
  ...supplierOnly,
  validate(s.supplierSettings),
  asyncHandler(async (req, res) => {
    const current = req.user.supplierProfile?.toObject?.() || {};
    // `verified` is intentionally NOT accepted here — only admins can set it.
    req.user.supplierProfile = { ...current, ...req.body, verified: current.verified, verifiedAt: current.verifiedAt };
    await req.user.save();
    res.json({ user: req.user });
  })
);

router.get(
  '/stats',
  ...supplierOnly,
  asyncHandler(async (req, res) => {
    const sid = new mongoose.Types.ObjectId(String(req.user._id));
    const since = new Date(Date.now() - 30 * 86400000);
    const [byStatus, earnings30, daily, lowStock, products, rating] = await Promise.all([
      Order.aggregate([{ $match: { supplier: sid } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      // Supplier earnings = goods + delivery fee they handle. Platform fee is FarmDirect's.
      Order.aggregate([
        { $match: { supplier: sid, status: 'delivered', deliveredAt: { $gte: since } } },
        { $group: { _id: null, gross: { $sum: { $add: ['$subtotal', '$deliveryFee'] } }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { supplier: sid, status: { $in: ['placed', 'accepted', 'packed', 'out_for_delivery', 'ready_for_pickup', 'delivered'] }, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, sales: { $sum: '$subtotal' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Product.find({ supplier: sid, isActive: true, stock: { $lte: 10 } }).select('name stock unit').limit(10),
      Product.countDocuments({ supplier: sid, isActive: true }),
      Review.aggregate([{ $match: { supplier: sid } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
    ]);
    const counts = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
    res.json({
      counts,
      newOrders: counts.placed || 0,
      activeOrders: (counts.accepted || 0) + (counts.packed || 0) + (counts.out_for_delivery || 0) + (counts.ready_for_pickup || 0),
      earnings30: earnings30[0]?.gross || 0,
      delivered30: earnings30[0]?.orders || 0,
      daily,
      lowStock,
      products,
      rating: rating[0] ? { avg: Math.round(rating[0].avg * 10) / 10, count: rating[0].n } : null,
      verified: !!req.user.supplierProfile?.verified,
    });
  })
);

/** Public seller page. */
router.get(
  '/:id/public',
  asyncHandler(async (req, res) => {
    const u = await User.findOne({ _id: req.params.id, role: { $in: ['farmer', 'trader'] }, isActive: true }).select(
      'name role createdAt supplierProfile.displayName supplierProfile.bio supplierProfile.village supplierProfile.district supplierProfile.state supplierProfile.verified supplierProfile.pickupAvailable supplierProfile.serviceAreas.pincode'
    );
    if (!u) throw notFound('Seller not found');
    const [products, rating] = await Promise.all([
      Product.find({ supplier: u._id, isActive: true, stock: { $gt: 0 } }).sort({ soldQty: -1 }).limit(48),
      Review.aggregate([{ $match: { supplier: u._id } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
    ]);
    res.json({ seller: u, products, rating: rating[0] ? { avg: Math.round(rating[0].avg * 10) / 10, count: rating[0].n } : null });
  })
);

module.exports = router;
