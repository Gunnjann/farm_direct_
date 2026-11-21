const router = require('express').Router();
const GroupOrder = require('../models/GroupOrder');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');
const { asyncHandler, notFound } = require('../utils/errors');
const groups = require('../services/groups');

const buyer = [authenticate, requireRole('customer', 'retailer')];

/** Public: hide other members' identities; show only first names and quantities. */
function publicView(g, viewerId) {
  const o = g.toObject ? g.toObject() : g;
  const mine = o.members.find((m) => viewerId && String(m.user) === String(viewerId) && ['reserved', 'paid'].includes(m.status));
  return {
    ...o,
    members: o.members.filter((m) => ['reserved', 'paid'].includes(m.status)).map((m) => ({ name: (m.name || 'Member').split(' ')[0], qty: m.qty, status: m.status })),
    memberCount: o.members.filter((m) => ['reserved', 'paid'].includes(m.status)).length,
    remainingQty: Math.max(0, o.maxQty - o.joinedQty),
    isOwner: viewerId ? String(o.owner) === String(viewerId) : false,
    myMembership: mine ? { qty: mine.qty, status: mine.status, order: mine.order } : null,
  };
}

// Optional auth: attach the user if a token is present, otherwise continue as guest.
const optionalAuth = (req, res, next) => (req.headers.authorization ? authenticate(req, res, next) : next());

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { status: 'open', deadline: { $gt: new Date() } };
    if (/^\d{6}$/.test(req.query.pincode || '')) filter['dropPoint.pincode'] = req.query.pincode;
    if (/^[a-f\d]{24}$/i.test(req.query.product || '')) filter.product = req.query.product;
    const items = await GroupOrder.find(filter).sort({ deadline: 1 }).limit(50);
    res.json({ items: items.map((g) => publicView(g)) });
  })
);

router.get(
  '/mine',
  ...buyer,
  asyncHandler(async (req, res) => {
    const items = await GroupOrder.find({ 'members.user': req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ items: items.map((g) => publicView(g, req.user._id)) });
  })
);

router.get(
  '/:idOrCode',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const key = req.params.idOrCode;
    const g = /^[a-f\d]{24}$/i.test(key) ? await GroupOrder.findById(key) : await GroupOrder.findOne({ code: key.toUpperCase() });
    if (!g) throw notFound('Group not found');
    res.json({ group: publicView(g, req.user?._id) });
  })
);

router.post(
  '/',
  ...buyer,
  validate(s.createGroup),
  asyncHandler(async (req, res) => {
    const { group, checkout } = await groups.createGroup(req.user, req.body);
    res.status(201).json({ group: publicView(group, req.user._id), checkout });
  })
);

router.post(
  '/:id/join',
  ...buyer,
  validate(s.joinGroup),
  asyncHandler(async (req, res) => {
    const { group, checkout } = await groups.joinGroup(req.user, req.params.id, req.body.qty);
    res.status(201).json({ group: publicView(group, req.user._id), checkout });
  })
);

router.post(
  '/:id/leave',
  ...buyer,
  asyncHandler(async (req, res) => {
    const g = await groups.leaveGroup(req.user, req.params.id);
    res.json({ group: publicView(g, req.user._id) });
  })
);

router.post(
  '/:id/cancel',
  authenticate,
  asyncHandler(async (req, res) => {
    const g = await groups.cancelGroup(req.user, req.params.id);
    res.json({ group: publicView(g, req.user._id) });
  })
);

module.exports = router;
