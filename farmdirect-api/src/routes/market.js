/** Mandi bhav (prices) + "Kahan bechun?" calculator. Public: farmers shouldn't need an account to check prices. */
const router = require('express').Router();
const { z } = require('zod');
const { MandiPrice } = require('../models/Market');
const { CROPS, CROP_KEYS, VEHICLES, MANDIS, LOCATIONS, findLocation, mandiByKey } = require('../data/agri');
const { latestPrices, priceHistory, syncFromDataGov, API_KEY } = require('../services/mandiData');
const { calculate } = require('../services/calculator');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler, badRequest } = require('../utils/errors');

const STATE = z.enum(['Madhya Pradesh', 'Maharashtra']);

let lastSync = null;
router.get(
  '/meta',
  asyncHandler(async (_req, res) => {
    const latestReal = await MandiPrice.findOne({ source: { $in: ['agmarknet', 'admin'] } }).sort({ date: -1 }).select('date source').lean();
    res.json({
      crops: CROPS,
      vehicles: VEHICLES,
      locations: LOCATIONS,
      mandis: MANDIS.map(({ key, name, nameHi, district, state }) => ({ key, name, nameHi, district, state })),
      data: { apiConfigured: !!API_KEY, lastSync, latestRealDate: latestReal?.date || null },
    });
  })
);

router.get(
  '/prices',
  validate(z.object({ crop: z.enum(CROP_KEYS), state: STATE.optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const rows = await latestPrices(req.validQuery.crop, { state: req.validQuery.state });
    const modal = rows.map((r) => r.modalPrice);
    res.json({
      crop: req.validQuery.crop,
      items: rows,
      summary: rows.length
        ? { highest: rows[0], lowest: rows[rows.length - 1], average: Math.round(modal.reduce((a, b) => a + b, 0) / modal.length), markets: rows.length }
        : null,
      sources: [...new Set(rows.map((r) => r.source))],
    });
  })
);

router.get(
  '/history',
  validate(z.object({ crop: z.enum(CROP_KEYS), market: z.string().min(2).max(120) }), 'query'),
  asyncHandler(async (req, res) => {
    res.json({ items: await priceHistory(req.validQuery.crop, req.validQuery.market) });
  })
);

const calcSchema = z
  .object({
    crop: z.enum(CROP_KEYS),
    quantityQtl: z.coerce.number().min(1, 'Enter at least 1 quintal').max(10000),
    state: STATE.optional(),
    district: z.string().max(60).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    vehicle: z.enum(VEHICLES.map((v) => v.key)).default('tempo'),
    sellIn: z.enum(['both', 'Madhya Pradesh', 'Maharashtra']).default('both'),
    overrides: z
      .object({
        ratePerKm: z.coerce.number().min(0).max(500).optional(),
        commissionPct: z.coerce.number().min(0).max(20).optional(),
        marketFeePct: z.coerce.number().min(0).max(10).optional(),
        hamaliPerQtl: z.coerce.number().min(0).max(500).optional(),
        packagingPerQtl: z.coerce.number().min(0).max(2000).optional(),
        labourPerQtl: z.coerce.number().min(0).max(2000).optional(),
        perishPer100Km: z.coerce.number().min(0).max(30).optional(),
      })
      .default({}),
  })
  .refine((v) => (v.lat != null && v.lng != null) || (v.state && v.district), { message: 'Choose your district or use your location', path: ['district'] });

router.post(
  '/calculate',
  validate(calcSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    let origin;
    if (b.lat != null && b.lng != null) origin = { lat: b.lat, lng: b.lng };
    else {
      const loc = findLocation(b.state, b.district);
      if (!loc) throw badRequest('Unknown district');
      origin = loc;
    }
    const prices = await latestPrices(b.crop, { state: b.sellIn === 'both' ? undefined : b.sellIn });
    if (!prices.length) throw badRequest('No recent mandi prices for this crop yet');
    const result = calculate({ crop: b.crop, quantityQtl: b.quantityQtl, origin, vehicle: b.vehicle, prices, overrides: b.overrides });
    res.json({ ...result, origin: { ...origin, district: b.district, state: b.state }, sources: [...new Set(prices.map((p) => p.source))] });
  })
);

// ---------------- admin: manual entry + sync
const manualSchema = z.object({
  crop: z.enum(CROP_KEYS),
  mandiKey: z.string().max(40),
  date: z.coerce.date(),
  minPrice: z.coerce.number().min(0).max(1000000),
  maxPrice: z.coerce.number().min(0).max(1000000),
  modalPrice: z.coerce.number().min(1).max(1000000),
  variety: z.string().trim().max(60).optional(),
});

router.post(
  '/prices',
  authenticate,
  requireRole('admin'),
  validate(manualSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const m = mandiByKey(b.mandiKey);
    if (!m) throw badRequest('Unknown mandi');
    if (!(b.minPrice <= b.modalPrice && b.modalPrice <= b.maxPrice)) throw badRequest('Modal price must be between min and max');
    const d = new Date(Date.UTC(b.date.getFullYear(), b.date.getMonth(), b.date.getDate()));
    const doc = await MandiPrice.findOneAndUpdate(
      { crop: b.crop, market: m.name, variety: b.variety || 'Other', date: d, source: 'admin' },
      { $set: { crop: b.crop, mandiKey: m.key, market: m.name, district: m.district, state: m.state, variety: b.variety || 'Other', date: d, minPrice: b.minPrice, maxPrice: b.maxPrice, modalPrice: b.modalPrice, source: 'admin', enteredBy: req.user._id } },
      { upsert: true, new: true }
    );
    res.status(201).json({ price: doc });
  })
);

router.post(
  '/sync',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const r = await syncFromDataGov();
    lastSync = new Date();
    res.json(r);
  })
);

module.exports = router;
module.exports.markSynced = () => (lastSync = new Date());
