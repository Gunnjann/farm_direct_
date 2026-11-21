const router = require('express').Router();
const Order = require('../models/Order');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');
const { asyncHandler } = require('../utils/errors');
const { transitionOrder, getOrderFor } = require('../services/orders');

router.use(authenticate);

const page = (req) => Math.max(1, Math.min(200, Number(req.query.page) || 1));
const ACTIVE = ['placed', 'accepted', 'packed', 'out_for_delivery', 'ready_for_pickup'];

/** Buyer's own orders. Unpaid abandoned checkouts are hidden unless asked for. */
router.get(
  '/',
  requireRole('customer', 'retailer'),
  asyncHandler(async (req, res) => {
    const filter = { buyer: req.user._id };
    if (req.query.status === 'active') filter.status = { $in: [...ACTIVE, 'awaiting_group', 'pending_payment'] };
    else if (req.query.status === 'past') filter.status = { $in: ['delivered', 'rejected', 'cancelled'] };
    else filter.status = { $ne: 'expired' };
    const items = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page(req) - 1) * 20)
      .limit(20)
      .populate('supplier', 'name supplierProfile.displayName');
    res.json({ items });
  })
);

/** Supplier's incoming orders. */
router.get(
  '/seller',
  requireRole('farmer', 'trader'),
  asyncHandler(async (req, res) => {
    const filter = { supplier: req.user._id, status: { $nin: ['pending_payment', 'expired', 'awaiting_group'] } };
    if (req.query.status === 'new') filter.status = 'placed';
    else if (req.query.status === 'active') filter.status = { $in: ['accepted', 'packed', 'out_for_delivery', 'ready_for_pickup'] };
    else if (req.query.status === 'done') filter.status = { $in: ['delivered', 'rejected', 'cancelled'] };
    const items = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page(req) - 1) * 30)
      .limit(30)
      .populate('buyer', 'name phone role businessProfile.businessName');
    res.json({ items });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await getOrderFor(req.user, req.params.id);
    res.json({ order });
  })
);

router.post(
  '/:id/status',
  validate(s.orderStatus),
  asyncHandler(async (req, res) => {
    const order = await transitionOrder(req.user, req.params.id, req.body.to, req.body.note);
    res.json({ order });
  })
);

module.exports = router;
