/**
 * Farmer ↔ Broker connect.
 *
 *  - Farmers post crop listings ("40 qtl gobhi ready from Monday, Dewas").
 *  - Brokers post buy requests ("need 10–50 qtl gobhi, ₹4/kg at farm gate, my truck").
 *  - Either side proposes a deal; the other agrees; broker adds vehicle & driver;
 *    payment happens IN PERSON at pickup; the FARMER confirms weight + amount received.
 *
 * Privacy: a broker's phone is shown to any logged-in farmer (farmers call to verify),
 * but a farmer's phone is only revealed to a broker once the FARMER has engaged
 * (farmer proposed the deal, or agreed to the broker's proposal).
 */
const router = require('express').Router();
const { z } = require('zod');
const mongoose = require('mongoose');
const User = require('../models/User');
const { CropListing, BuyRequest, Deal } = require('../models/Market');
const { CROP_KEYS, findLocation, roadKm } = require('../data/agri');
const { latestPrices } = require('../services/mandiData');
const { calculate, judgeOffer } = require('../services/calculator');
const { notify } = require('../services/notify');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler, badRequest, conflict, forbidden, notFound } = require('../utils/errors');

const STATE = z.enum(['Madhya Pradesh', 'Maharashtra']);
const rupeesToPaise = (r) => Math.round(r * 100);
const optionalAuth = (req, res, next) => (req.headers.authorization ? authenticate(req, res, next) : next());

/* ---------------------------------------------------------------- helpers */

function originOf(user) {
  if (!user) return null;
  if (user.role === 'broker' && user.brokerProfile?.lat != null) return { lat: user.brokerProfile.lat, lng: user.brokerProfile.lng };
  const sp = user.supplierProfile;
  if (sp?.farmState && sp?.farmDistrict) return findLocation(sp.farmState, sp.farmDistrict);
  return null;
}

function locationFrom(body) {
  const loc = findLocation(body.state, body.district);
  if (!loc) throw badRequest('Choose a district in Madhya Pradesh or Maharashtra');
  return { village: body.village, district: loc.district, state: loc.state, lat: loc.lat, lng: loc.lng };
}

/** Public reliability record for brokers, computed from deals that farmers confirmed. */
async function brokerStats(ids) {
  const oids = ids.map((i) => new mongoose.Types.ObjectId(String(i)));
  const rows = await Deal.aggregate([
    { $match: { broker: { $in: oids } } },
    {
      $group: {
        _id: '$broker',
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        paymentIssues: { $sum: { $cond: [{ $in: ['$issue', ['not_paid', 'paid_less', 'price_cut_at_pickup']] }, 1, 0] } },
        noShows: { $sum: { $cond: [{ $eq: ['$issue', 'broker_no_show'] }, 1, 0] } },
        qtlBought: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, { $ifNull: ['$weighedQtl', '$quantityQtl'] }, 0] } },
        ratingSum: { $sum: { $ifNull: ['$farmerRating', 0] } },
        ratingN: { $sum: { $cond: [{ $gt: ['$farmerRating', null] }, 1, 0] } },
      },
    },
  ]);
  const map = new Map();
  for (const r of rows) {
    const judged = r.completed + r.paymentIssues;
    map.set(String(r._id), {
      completed: r.completed,
      paymentIssues: r.paymentIssues,
      noShows: r.noShows,
      qtlBought: Math.round(r.qtlBought),
      paidAtPickupPct: judged ? Math.round((r.completed / judged) * 100) : null,
      rating: r.ratingN ? Math.round((r.ratingSum / r.ratingN) * 10) / 10 : null,
      ratingCount: r.ratingN,
    });
  }
  return (id) => map.get(String(id)) || { completed: 0, paymentIssues: 0, noShows: 0, qtlBought: 0, paidAtPickupPct: null, rating: null, ratingCount: 0 };
}

function brokerCard(u, stats, { showPhone }) {
  const bp = u.brokerProfile || {};
  return {
    _id: u._id,
    name: u.name,
    businessName: bp.businessName,
    district: bp.district,
    state: bp.state,
    verified: !!bp.verified,
    licenseOnFile: !!bp.licenseNumber,
    phone: showPhone ? u.phone : null,
    memberSince: u.createdAt,
    stats,
  };
}

/** Best-mandi benchmark per crop for a viewer's location (cached per request). */
async function benchmarkFor(crop, origin, cache) {
  if (!origin) return null;
  if (cache.has(crop)) return cache.get(crop);
  const prices = await latestPrices(crop);
  const calc = prices.length ? calculate({ crop, quantityQtl: 20, origin, vehicle: 'tempo', prices }) : null;
  const b = calc ? { minFairFarmGatePerKg: calc.minFairFarmGatePerKg, bestMarket: calc.best?.market, bestNetPerKg: calc.best?.netPerKg, nearestNetPerKg: calc.nearest?.netPerKg } : null;
  cache.set(crop, { b, calc });
  return { b, calc };
}

/* ---------------------------------------------------------------- crop listings (farmers) */

const listingSchema = z.object({
  crop: z.enum(CROP_KEYS),
  variety: z.string().trim().max(60).optional(),
  quantityQtl: z.coerce.number().min(1, 'Minimum 1 quintal').max(100000),
  expectedPricePerKg: z.coerce.number().min(0).max(100000).optional(), // rupees
  readyFrom: z.coerce.date(),
  quality: z.string().trim().max(300).optional(),
  village: z.string().trim().max(80).optional(),
  state: STATE,
  district: z.string().trim().min(2).max(60),
  validDays: z.coerce.number().int().min(1).max(60).default(15),
});

router.post(
  '/listings',
  authenticate,
  requireRole('farmer'),
  validate(listingSchema),
  asyncHandler(async (req, res) => {
    if (!req.user.phone) throw badRequest('Add your mobile number in Account first, so brokers you agree with can call you');
    const b = req.body;
    const listing = await CropListing.create({
      farmer: req.user._id,
      crop: b.crop,
      variety: b.variety,
      quantityQtl: b.quantityQtl,
      expectedPricePerKg: b.expectedPricePerKg != null ? rupeesToPaise(b.expectedPricePerKg) : undefined,
      readyFrom: b.readyFrom,
      quality: b.quality,
      location: locationFrom(b),
      expiresAt: new Date(Date.now() + b.validDays * 86400000),
    });
    // Remember the farm location for distance-based matching next time.
    if (!req.user.supplierProfile?.farmDistrict) {
      req.user.supplierProfile = { ...(req.user.supplierProfile?.toObject?.() || {}), farmState: listing.location.state, farmDistrict: listing.location.district };
      await req.user.save();
    }
    res.status(201).json({ listing });
  })
);

router.get(
  '/listings/mine',
  authenticate,
  requireRole('farmer'),
  asyncHandler(async (req, res) => {
    const items = await CropListing.find({ farmer: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ items });
  })
);

router.patch(
  '/listings/:id',
  authenticate,
  requireRole('farmer'),
  validate(z.object({ status: z.enum(['open', 'closed', 'deal_done']).optional(), quantityQtl: z.coerce.number().min(1).max(100000).optional(), expectedPricePerKg: z.coerce.number().min(0).optional() })),
  asyncHandler(async (req, res) => {
    const l = await CropListing.findOne({ _id: req.params.id, farmer: req.user._id });
    if (!l) throw notFound('Listing not found');
    if (req.body.status) l.status = req.body.status;
    if (req.body.quantityQtl) l.quantityQtl = req.body.quantityQtl;
    if (req.body.expectedPricePerKg != null) l.expectedPricePerKg = rupeesToPaise(req.body.expectedPricePerKg);
    await l.save();
    res.json({ listing: l });
  })
);

/** Brokers browse farmers' crops. Farmer phone numbers are NOT included here. */
router.get(
  '/listings',
  optionalAuth,
  validate(z.object({ crop: z.enum(CROP_KEYS).optional(), state: STATE.optional(), district: z.string().max(60).optional(), radiusKm: z.coerce.number().min(5).max(2000).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const q = req.validQuery;
    const filter = { status: 'open', expiresAt: { $gt: new Date() } };
    if (q.crop) filter.crop = q.crop;
    if (q.state) filter['location.state'] = q.state;
    if (q.district) filter['location.district'] = q.district;
    const items = await CropListing.find(filter).sort({ readyFrom: 1 }).limit(200).populate('farmer', 'name supplierProfile.verified supplierProfile.displayName createdAt').lean();
    const origin = originOf(req.user);
    let out = items.map((l) => ({
      ...l,
      farmer: { _id: l.farmer?._id, name: l.farmer?.name, verified: !!l.farmer?.supplierProfile?.verified },
      distanceKm: origin && l.location?.lat != null ? roadKm(origin, l.location) : null,
    }));
    if (origin && q.radiusKm) out = out.filter((l) => l.distanceKm == null || l.distanceKm <= q.radiusKm);
    if (origin) out.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    res.json({ items: out });
  })
);

/* ---------------------------------------------------------------- buy requests (brokers) */

const requestSchema = z
  .object({
    crop: z.enum(CROP_KEYS),
    variety: z.string().trim().max(60).optional(),
    minQtyQtl: z.coerce.number().min(1).max(100000),
    maxQtyQtl: z.coerce.number().min(1).max(100000),
    offerPricePerKg: z.coerce.number().min(0.1, 'Enter your offer price per kg').max(100000), // rupees
    paymentTerms: z.string().trim().max(200).optional(),
    quality: z.string().trim().max(300).optional(),
    state: STATE,
    district: z.string().trim().min(2).max(60),
    radiusKm: z.coerce.number().min(5).max(1000).default(100),
    neededBy: z.coerce.date(),
  })
  .refine((v) => v.minQtyQtl <= v.maxQtyQtl, { message: 'Minimum quantity cannot be more than maximum', path: ['minQtyQtl'] });

router.post(
  '/requests',
  authenticate,
  requireRole('broker'),
  validate(requestSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const r = await BuyRequest.create({
      broker: req.user._id,
      crop: b.crop,
      variety: b.variety,
      minQtyQtl: b.minQtyQtl,
      maxQtyQtl: b.maxQtyQtl,
      offerPricePerKg: rupeesToPaise(b.offerPricePerKg),
      paymentTerms: b.paymentTerms,
      quality: b.quality,
      base: locationFrom(b),
      radiusKm: b.radiusKm,
      neededBy: b.neededBy,
    });
    res.status(201).json({ request: r });
  })
);

router.get(
  '/requests/mine',
  authenticate,
  requireRole('broker'),
  asyncHandler(async (req, res) => {
    res.json({ items: await BuyRequest.find({ broker: req.user._id }).sort({ createdAt: -1 }).limit(100) });
  })
);

router.patch(
  '/requests/:id',
  authenticate,
  requireRole('broker'),
  validate(z.object({ status: z.enum(['open', 'filled', 'closed']).optional(), offerPricePerKg: z.coerce.number().min(0.1).optional() })),
  asyncHandler(async (req, res) => {
    const r = await BuyRequest.findOne({ _id: req.params.id, broker: req.user._id });
    if (!r) throw notFound('Request not found');
    if (req.body.status) r.status = req.body.status;
    if (req.body.offerPricePerKg) r.offerPricePerKg = rupeesToPaise(req.body.offerPricePerKg);
    await r.save();
    res.json({ request: r });
  })
);

/**
 * Farmers browse what brokers want. Each request carries the broker's public
 * track record and — if we know where the farmer is — a fair-price check against
 * the best mandi for that farmer.
 */
router.get(
  '/requests',
  optionalAuth,
  validate(z.object({ crop: z.enum(CROP_KEYS).optional(), state: STATE.optional(), district: z.string().max(60).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const q = req.validQuery;
    const filter = { status: 'open', neededBy: { $gte: new Date(Date.now() - 86400000) } };
    if (q.crop) filter.crop = q.crop;
    if (q.state) filter['base.state'] = q.state;
    const items = await BuyRequest.find(filter).sort({ offerPricePerKg: -1 }).limit(200).populate('broker', 'name phone brokerProfile createdAt isActive').lean();
    const live = items.filter((r) => r.broker?.isActive);
    const stats = await brokerStats(live.map((r) => r.broker._id));
    const viewer = req.user;
    const origin = q.district && q.state ? findLocation(q.state, q.district) : originOf(viewer);
    const showPhone = !!viewer && ['farmer', 'admin'].includes(viewer.role);
    const cache = new Map();
    const out = [];
    for (const r of live) {
      const distanceKm = origin ? roadKm(origin, r.base) : null;
      const bench = await benchmarkFor(r.crop, origin, cache);
      out.push({
        ...r,
        broker: brokerCard(r.broker, stats(r.broker._id), { showPhone }),
        distanceKm,
        withinReach: distanceKm == null ? null : distanceKm <= r.radiusKm,
        benchmark: bench?.b || null,
        offerCheck: bench?.calc ? judgeOffer(r.offerPricePerKg / 100, bench.calc) : null,
      });
    }
    if (origin) out.sort((a, b) => Number(b.withinReach) - Number(a.withinReach) || b.offerPricePerKg - a.offerPricePerKg);
    res.json({ items: out, originKnown: !!origin });
  })
);

/* ---------------------------------------------------------------- brokers directory */

router.get(
  '/brokers',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const filter = { role: 'broker', isActive: true };
    if (['Madhya Pradesh', 'Maharashtra'].includes(req.query.state)) filter['brokerProfile.state'] = req.query.state;
    if (req.query.district) filter['brokerProfile.district'] = String(req.query.district);
    const users = await User.find(filter).sort({ 'brokerProfile.verified': -1, createdAt: 1 }).limit(200);
    const stats = await brokerStats(users.map((u) => u._id));
    const showPhone = !!req.user && ['farmer', 'admin'].includes(req.user.role);
    const origin = originOf(req.user);
    const items = users.map((u) => ({ ...brokerCard(u, stats(u._id), { showPhone }), distanceKm: origin && u.brokerProfile?.lat != null ? roadKm(origin, u.brokerProfile) : null }));
    if (origin) items.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    res.json({ items });
  })
);

router.get(
  '/brokers/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const u = await User.findOne({ _id: req.params.id, role: 'broker' });
    if (!u) throw notFound('Broker not found');
    const stats = (await brokerStats([u._id]))(u._id);
    const showPhone = !!req.user && ['farmer', 'admin'].includes(req.user.role);
    const [requests, reviews] = await Promise.all([
      BuyRequest.find({ broker: u._id, status: 'open' }).sort({ createdAt: -1 }).limit(20),
      Deal.find({ broker: u._id, farmerRating: { $exists: true } }).sort({ updatedAt: -1 }).limit(20).select('farmerRating farmerReview crop updatedAt').populate('farmer', 'name'),
    ]);
    res.json({
      broker: { ...brokerCard(u, stats, { showPhone }), about: u.brokerProfile?.about, crops: u.brokerProfile?.crops || [] },
      requests,
      reviews: reviews.map((r) => ({ rating: r.farmerRating, review: r.farmerReview, crop: r.crop, at: r.updatedAt, farmer: (r.farmer?.name || 'Farmer').split(' ')[0] })),
    });
  })
);

/* ---------------------------------------------------------------- deals */

const proposeSchema = z
  .object({
    requestId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    listingId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    quantityQtl: z.coerce.number().min(1).max(100000),
    pricePerKg: z.coerce.number().min(0.1).max(100000), // rupees
    pickupDate: z.coerce.date(),
    pickupPlace: z.string().trim().max(200).optional(),
    message: z.string().trim().max(300).optional(),
  })
  .refine((v) => !!v.requestId !== !!v.listingId, { message: 'Choose a buy request or a crop listing' });

router.post(
  '/deals',
  authenticate,
  requireRole('farmer', 'broker'),
  validate(proposeSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const me = req.user;
    let deal;
    if (me.role === 'farmer') {
      if (!b.requestId) throw badRequest('Farmers respond to a broker’s buy request');
      if (!me.phone) throw badRequest('Add your mobile number in Account first');
      const r = await BuyRequest.findOne({ _id: b.requestId, status: 'open' });
      if (!r) throw notFound('This buy request is closed');
      if (b.quantityQtl < r.minQtyQtl || b.quantityQtl > r.maxQtyQtl) throw badRequest(`This broker wants ${r.minQtyQtl}–${r.maxQtyQtl} quintal`);
      const open = await Deal.exists({ request: r._id, farmer: me._id, status: { $in: ['proposed', 'agreed', 'vehicle_assigned'] } });
      if (open) throw conflict('You already have an active deal on this request');
      deal = await Deal.create({
        farmer: me._id, broker: r.broker, proposedBy: 'farmer', request: r._id, crop: r.crop, quantityQtl: b.quantityQtl,
        pricePerKg: rupeesToPaise(b.pricePerKg), pickupDate: b.pickupDate, pickupPlace: b.pickupPlace, message: b.message,
        history: [{ status: 'proposed', by: me._id, note: b.message }],
      });
      await notify(r.broker, 'deal_proposed', `${me.name} wants to sell ${b.quantityQtl} qtl ${r.crop}`, `₹${b.pricePerKg}/kg · pickup ${b.pickupDate.toDateString()}`, `/vyapar/deals/${deal._id}`);
    } else {
      if (!b.listingId) throw badRequest('Brokers make offers on a farmer’s crop listing');
      const l = await CropListing.findOne({ _id: b.listingId, status: 'open' });
      if (!l) throw notFound('This crop listing is closed');
      if (b.quantityQtl > l.quantityQtl) throw badRequest(`Farmer has only ${l.quantityQtl} quintal`);
      const open = await Deal.exists({ listing: l._id, broker: me._id, status: { $in: ['proposed', 'agreed', 'vehicle_assigned'] } });
      if (open) throw conflict('You already have an active offer on this crop');
      deal = await Deal.create({
        farmer: l.farmer, broker: me._id, proposedBy: 'broker', listing: l._id, crop: l.crop, quantityQtl: b.quantityQtl,
        pricePerKg: rupeesToPaise(b.pricePerKg), pickupDate: b.pickupDate, pickupPlace: b.pickupPlace || [l.location.village, l.location.district].filter(Boolean).join(', '),
        message: b.message, history: [{ status: 'proposed', by: me._id, note: b.message }],
      });
      await notify(l.farmer, 'deal_offer', `Offer: ₹${b.pricePerKg}/kg for ${b.quantityQtl} qtl ${l.crop}`, `From ${me.brokerProfile?.businessName || me.name}. Call to verify before agreeing.`, `/vyapar/deals/${deal._id}`);
    }
    res.status(201).json({ deal });
  })
);

router.get(
  '/deals',
  authenticate,
  asyncHandler(async (req, res) => {
    const filter = req.user.role === 'admin' ? {} : req.user.role === 'broker' ? { broker: req.user._id } : { farmer: req.user._id };
    const items = await Deal.find(filter).sort({ updatedAt: -1 }).limit(100).populate('farmer', 'name').populate('broker', 'name brokerProfile.businessName brokerProfile.verified');
    res.json({ items });
  })
);

async function loadDeal(req) {
  const d = await Deal.findById(req.params.id);
  if (!d) throw notFound('Deal not found');
  const isFarmer = String(d.farmer) === String(req.user._id);
  const isBroker = String(d.broker) === String(req.user._id);
  if (!isFarmer && !isBroker && req.user.role !== 'admin') throw notFound('Deal not found');
  return { d, isFarmer, isBroker };
}

function farmerEngaged(d) {
  return d.proposedBy === 'farmer' || ['agreed', 'vehicle_assigned', 'completed', 'disputed'].includes(d.status);
}

router.get(
  '/deals/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { d, isBroker } = await loadDeal(req);
    await d.populate([
      { path: 'farmer', select: 'name phone supplierProfile.farmDistrict supplierProfile.farmState supplierProfile.verified' },
      { path: 'broker', select: 'name phone brokerProfile' },
    ]);
    const stats = (await brokerStats([d.broker._id]))(d.broker._id);
    const o = d.toObject();
    if (isBroker && !farmerEngaged(d)) o.farmer.phone = null; // farmer's number stays private until they engage
    o.broker = { ...brokerCard(d.broker, stats, { showPhone: true }) };
    res.json({ deal: o });
  })
);

async function step(d, from, set, by, note, extra = {}) {
  const updated = await Deal.findOneAndUpdate(
    { _id: d._id, status: { $in: [].concat(from) } },
    { $set: set, $push: { history: { status: set.status || d.status, by, note } }, ...extra },
    { new: true }
  );
  if (!updated) throw conflict('This deal was just updated. Please refresh.', 'STALE');
  return updated;
}

router.post(
  '/deals/:id/agree',
  authenticate,
  asyncHandler(async (req, res) => {
    const { d, isFarmer, isBroker } = await loadDeal(req);
    const otherParty = d.proposedBy === 'farmer' ? isBroker : isFarmer;
    if (!otherParty) throw forbidden('Only the other party can agree');
    const u = await step(d, 'proposed', { status: 'agreed' }, req.user._id, 'Agreed');
    await notify(isFarmer ? d.broker : d.farmer, 'deal_agreed', 'Deal agreed ✔', isFarmer ? 'Farmer agreed. Add vehicle & driver details.' : 'Broker agreed. You can now call each other.', `/vyapar/deals/${d._id}`);
    res.json({ deal: u });
  })
);

router.post(
  '/deals/:id/vehicle',
  authenticate,
  requireRole('broker'),
  validate(z.object({ vehicleNumber: z.string().trim().min(6).max(15), driverName: z.string().trim().min(2).max(60), driverPhone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'), pickupDate: z.coerce.date().optional() })),
  asyncHandler(async (req, res) => {
    const { d, isBroker } = await loadDeal(req);
    if (!isBroker) throw forbidden();
    const set = { status: 'vehicle_assigned', vehicleNumber: req.body.vehicleNumber, driverName: req.body.driverName, driverPhone: req.body.driverPhone };
    if (req.body.pickupDate) set.pickupDate = req.body.pickupDate;
    const u = await step(d, ['agreed', 'vehicle_assigned'], set, req.user._id, `Vehicle ${req.body.vehicleNumber}`);
    await notify(d.farmer, 'deal_vehicle', `Vehicle ${req.body.vehicleNumber} coming for pickup`, `Driver ${req.body.driverName} · ${req.body.driverPhone}. Get paid before the truck leaves.`, `/vyapar/deals/${d._id}`);
    res.json({ deal: u });
  })
);

/** ONLY the farmer can mark a deal complete — this is the "payment received" confirmation. */
router.post(
  '/deals/:id/complete',
  authenticate,
  requireRole('farmer'),
  validate(
    z.object({
      weighedQtl: z.coerce.number().min(0.1).max(100000),
      amountReceived: z.coerce.number().min(1).max(100000000), // rupees
      paymentMode: z.enum(['cash', 'upi', 'bank', 'cheque']),
      rating: z.coerce.number().int().min(1).max(5),
      review: z.string().trim().max(400).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { d, isFarmer } = await loadDeal(req);
    if (!isFarmer) throw forbidden();
    const b = req.body;
    const expected = Math.round(b.weighedQtl * 100 * d.pricePerKg); // paise
    const received = rupeesToPaise(b.amountReceived);
    // Paid noticeably less than agreed → record it as a dispute instead of a clean completion.
    const short = received < expected * 0.98;
    const u = await step(
      d,
      ['agreed', 'vehicle_assigned'],
      {
        status: short ? 'disputed' : 'completed',
        weighedQtl: b.weighedQtl,
        amountReceived: received,
        paymentMode: b.paymentMode,
        farmerRating: b.rating,
        farmerReview: b.review,
        ...(short ? { issue: 'paid_less', issueNote: `Expected ₹${Math.round(expected / 100)}, received ₹${b.amountReceived}` } : {}),
      },
      req.user._id,
      short ? 'Paid less than agreed' : `Paid ₹${b.amountReceived} by ${b.paymentMode}`
    );
    if (d.listing) await CropListing.updateOne({ _id: d.listing }, { $set: { status: 'deal_done' } });
    await notify(d.broker, short ? 'deal_disputed' : 'deal_completed', short ? 'Farmer reported short payment' : 'Deal completed', short ? u.issueNote : `Farmer confirmed ₹${b.amountReceived} received.`, `/vyapar/deals/${d._id}`);
    res.json({ deal: u, expectedAmount: expected, short });
  })
);

router.post(
  '/deals/:id/issue',
  authenticate,
  validate(z.object({ issue: z.enum(['broker_no_show', 'not_paid', 'paid_less', 'price_cut_at_pickup', 'farmer_no_show', 'quality_mismatch', 'other']), note: z.string().trim().min(5).max(400) })),
  asyncHandler(async (req, res) => {
    const { d, isFarmer, isBroker } = await loadDeal(req);
    const farmerIssues = ['broker_no_show', 'not_paid', 'paid_less', 'price_cut_at_pickup', 'other'];
    const brokerIssues = ['farmer_no_show', 'quality_mismatch', 'other'];
    if ((isFarmer && !farmerIssues.includes(req.body.issue)) || (isBroker && !brokerIssues.includes(req.body.issue))) throw badRequest('Choose a valid problem');
    const u = await step(d, ['agreed', 'vehicle_assigned'], { status: 'disputed', issue: req.body.issue, issueNote: req.body.note }, req.user._id, req.body.note);
    await notify(isFarmer ? d.broker : d.farmer, 'deal_disputed', 'A problem was reported on your deal', req.body.note, `/vyapar/deals/${d._id}`);
    res.json({ deal: u });
  })
);

router.post(
  '/deals/:id/cancel',
  authenticate,
  validate(z.object({ note: z.string().trim().min(3).max(300) })),
  asyncHandler(async (req, res) => {
    const { d, isFarmer, isBroker } = await loadDeal(req);
    if (!isFarmer && !isBroker) throw forbidden();
    const u = await step(d, ['proposed', 'agreed'], { status: 'cancelled' }, req.user._id, req.body.note);
    await notify(isFarmer ? d.broker : d.farmer, 'deal_cancelled', 'Deal cancelled', req.body.note, `/vyapar/deals/${d._id}`);
    res.json({ deal: u });
  })
);

module.exports = router;
module.exports.brokerStats = brokerStats;
