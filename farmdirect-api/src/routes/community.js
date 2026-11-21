/** Reviews, disputes and notifications. */
const router = require('express').Router();
const env = require('../config/env');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { Review, Dispute, Notification } = require('../models/misc');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');
const { asyncHandler, badRequest, notFound, conflict, forbidden } = require('../utils/errors');
const { refundOrder } = require('../services/payments');
const { notify } = require('../services/notify');

// ---------------- Reviews ----------------
router.get(
  '/reviews/product/:id',
  asyncHandler(async (req, res) => {
    const items = await Review.find({ product: req.params.id }).sort({ createdAt: -1 }).limit(50).select('rating comment buyerName createdAt');
    res.json({ items });
  })
);

/** Only the buyer of a DELIVERED order can review a product in that order — no fake reviews. */
router.post(
  '/reviews',
  authenticate,
  requireRole('customer', 'retailer'),
  validate(s.review),
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.body.orderId, buyer: req.user._id });
    if (!order) throw notFound('Order not found');
    if (order.status !== 'delivered') throw badRequest('You can review only after delivery');
    if (!order.items.some((i) => String(i.product) === req.body.productId)) throw badRequest('That product is not in this order');

    const review = await Review.create({
      order: order._id,
      product: req.body.productId,
      supplier: order.supplier,
      buyer: req.user._id,
      buyerName: req.user.name.split(' ')[0],
      rating: req.body.rating,
      comment: req.body.comment,
    });
    const [agg] = await Review.aggregate([{ $match: { product: review.product } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
    await Product.updateOne({ _id: review.product }, { $set: { ratingAvg: Math.round(agg.avg * 10) / 10, ratingCount: agg.n } });
    await Order.updateOne({ _id: order._id }, { $set: { reviewed: true } });
    res.status(201).json({ review });
  })
);

// ---------------- Disputes ----------------
router.post(
  '/disputes',
  authenticate,
  requireRole('customer', 'retailer'),
  validate(s.dispute),
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.body.orderId, buyer: req.user._id });
    if (!order) throw notFound('Order not found');
    const okStatus = order.status === 'delivered' || (req.body.reason === 'not_delivered' && ['out_for_delivery', 'ready_for_pickup'].includes(order.status));
    if (!okStatus) throw badRequest('Disputes can be raised after delivery (or for a delivery that never arrived)');
    if (order.deliveredAt && Date.now() - order.deliveredAt.getTime() > env.disputeWindowHours * 3600000) {
      throw badRequest(`Disputes must be raised within ${env.disputeWindowHours} hours of delivery`);
    }
    const exists = await Dispute.exists({ order: order._id });
    if (exists) throw conflict('A dispute is already open for this order');
    const dispute = await Dispute.create({ ...req.body, order: order._id, buyer: req.user._id, supplier: order.supplier });
    await notify(order.supplier, 'dispute_new', `Complaint on order ${order.orderNumber}`, 'Please respond within 24 hours.', `/disputes/${dispute._id}`);
    res.status(201).json({ dispute });
  })
);

router.get(
  '/disputes',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin' ? {} : req.user.isSupplier ? { supplier: req.user._id } : { buyer: req.user._id };
    if (req.query.status) filter.status = String(req.query.status);
    const items = await Dispute.find(filter).sort({ createdAt: -1 }).limit(100).populate('order', 'orderNumber total');
    res.json({ items });
  })
);

async function loadDispute(user, id) {
  const d = await Dispute.findById(id).populate('order');
  if (!d) throw notFound('Dispute not found');
  const isParty = [String(d.buyer), String(d.supplier)].includes(String(user._id));
  if (!isParty && user.role !== 'admin') throw notFound('Dispute not found');
  return d;
}

router.get(
  '/disputes/:id',
  authenticate,
  asyncHandler(async (req, res) => res.json({ dispute: await loadDispute(req.user, req.params.id) }))
);

router.post(
  '/disputes/:id/respond',
  authenticate,
  requireRole('farmer', 'trader'),
  validate(s.disputeRespond),
  asyncHandler(async (req, res) => {
    const d = await loadDispute(req.user, req.params.id);
    if (String(d.supplier) !== String(req.user._id)) throw forbidden();
    if (!['open', 'supplier_responded'].includes(d.status)) throw conflict('This dispute is already closed');
    d.supplierResponse = req.body.response;
    d.status = 'supplier_responded';
    await d.save();
    await notify(d.buyer, 'dispute_update', 'Seller responded to your complaint', req.body.response.slice(0, 120), `/disputes/${d._id}`);
    res.json({ dispute: d });
  })
);

/** Only admins decide. The liable party is recorded so payouts can be adjusted. */
router.post(
  '/disputes/:id/resolve',
  authenticate,
  requireRole('admin'),
  validate(s.disputeResolve),
  asyncHandler(async (req, res) => {
    const d = await loadDispute(req.user, req.params.id);
    if (['resolved', 'rejected'].includes(d.status)) throw conflict('Already resolved');
    const b = req.body;
    let refund = null;
    if (b.outcome === 'full_refund') refund = await refundOrder(d.order._id, d.order.total, `Dispute: ${d.reason}`);
    if (b.outcome === 'partial_refund') {
      if (!b.refundAmount) throw badRequest('Enter the refund amount');
      if (b.refundAmount > d.order.total) throw badRequest('Refund cannot exceed the order total');
      refund = await refundOrder(d.order._id, b.refundAmount, `Dispute: ${d.reason}`);
    }
    d.status = b.outcome === 'rejected' ? 'rejected' : 'resolved';
    d.resolution = { outcome: b.outcome, refundAmount: refund?.amount, note: b.note, by: req.user._id, at: new Date(), liableParty: b.liableParty };
    await d.save();
    for (const u of [d.buyer, d.supplier]) await notify(u, 'dispute_resolved', `Complaint ${d.status}`, b.note, `/disputes/${d._id}`);
    res.json({ dispute: d, refund });
  })
);

// ---------------- Notifications ----------------
router.get(
  '/notifications',
  authenticate,
  asyncHandler(async (req, res) => {
    const [items, unread] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ items, unread });
  })
);

router.post(
  '/notifications/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  })
);

module.exports = router;
