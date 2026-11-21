const router = require('express').Router();
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const GroupOrder = require('../models/GroupOrder');
const { Dispute } = require('../models/misc');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');
const { asyncHandler, notFound, badRequest } = require('../utils/errors');
const { notify } = require('../services/notify');

router.use(authenticate, requireRole('admin'));

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const since = new Date(Date.now() - 30 * 86400000);
    const [users, pendingVerification, products, orders30, gmv, openDisputes, openGroups, refundsStuck] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
      User.countDocuments({ isActive: true, $or: [{ role: { $in: ['farmer', 'trader'] }, 'supplierProfile.verified': false }, { role: 'broker', 'brokerProfile.verified': false }] }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments({ createdAt: { $gte: since }, paymentStatus: { $in: ['paid', 'refunded', 'refund_pending'] } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: since }, status: { $in: ['placed', 'accepted', 'packed', 'out_for_delivery', 'ready_for_pickup', 'delivered'] } } },
        { $group: { _id: null, gmv: { $sum: '$total' }, fees: { $sum: '$platformFee' } } },
      ]),
      Dispute.countDocuments({ status: { $in: ['open', 'supplier_responded'] } }),
      GroupOrder.countDocuments({ status: { $in: ['open', 'full'] } }),
      Order.countDocuments({ paymentStatus: 'refund_pending' }),
    ]);
    res.json({
      users: Object.fromEntries(users.map((u) => [u._id, u.n])),
      pendingVerification,
      products,
      orders30,
      gmv30: gmv[0]?.gmv || 0,
      platformFees30: gmv[0]?.fees || 0,
      openDisputes,
      openGroups,
      refundsStuck,
    });
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.role) filter.role = String(req.query.role);
    if (req.query.unverified === 'true') filter.$or = [{ role: { $in: ['farmer', 'trader'] }, 'supplierProfile.verified': false }, { role: 'broker', 'brokerProfile.verified': false }];
    if (req.query.q) {
      const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$and = [{ $or: [{ name: rx }, { email: rx }, { phone: rx }] }];
    }
    const items = await User.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ items });
  })
);

router.patch(
  '/users/:id',
  validate(s.adminUserUpdate),
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.params.id).select('+tokenVersion');
    if (!u) throw notFound('User not found');
    if (String(u._id) === String(req.user._id)) throw badRequest('You cannot change your own admin account here');
    if (req.body.isActive !== undefined) {
      u.isActive = req.body.isActive;
      if (!req.body.isActive) u.tokenVersion = (u.tokenVersion || 0) + 1; // force logout
    }
    if (req.body.verified !== undefined && u.role === 'broker') {
      if (!u.brokerProfile) throw badRequest('Broker profile missing');
      u.brokerProfile.verified = req.body.verified;
      u.brokerProfile.verifiedAt = req.body.verified ? new Date() : undefined;
      if (req.body.verified) await notify(u._id, 'verified', 'Your broker account is verified', 'Farmers now see a Verified badge next to your name.', '/vyapar');
    } else if (req.body.verified !== undefined) {
      if (!u.supplierProfile) throw badRequest('Only farmers, traders and brokers can be verified');
      u.supplierProfile.verified = req.body.verified;
      u.supplierProfile.verifiedAt = req.body.verified ? new Date() : undefined;
      if (req.body.verified) await notify(u._id, 'verified', 'Your seller account is verified', 'Buyers now see a Verified badge on your listings.', '/seller');
    }
    await u.save();
    res.json({ user: u });
  })
);

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.paymentStatus) filter.paymentStatus = String(req.query.paymentStatus);
    const items = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('buyer', 'name email')
      .populate('supplier', 'name supplierProfile.displayName');
    res.json({ items });
  })
);

router.get(
  '/payments',
  asyncHandler(async (_req, res) => {
    const items = await Payment.find().sort({ createdAt: -1 }).limit(100).populate('buyer', 'name email');
    res.json({ items });
  })
);

module.exports = router;
