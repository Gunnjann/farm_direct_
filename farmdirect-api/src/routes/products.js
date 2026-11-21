const router = require('express').Router();
const Product = require('../models/Product');
const User = require('../models/User');
const GroupOrder = require('../models/GroupOrder');
const { Review } = require('../models/misc');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');
const { asyncHandler, notFound, badRequest } = require('../utils/errors');

const SUPPLIER_FIELDS = 'name role supplierProfile.displayName supplierProfile.verified supplierProfile.district supplierProfile.state supplierProfile.village supplierProfile.pickupAvailable';

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Public catalogue. With ?pincode=, shows only products whose seller actually delivers there (or offers pickup). */
router.get(
  '/',
  validate(s.productQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.validQuery;
    const filter = { isActive: true, stock: { $gt: 0 } };
    if (q.category) filter.category = q.category;
    if (q.supplierType) filter.supplierRole = q.supplierType;
    if (q.groupBuy) filter['groupBuy.enabled'] = true;
    if (q.supplier) filter.supplier = q.supplier;
    if (q.minPrice != null || q.maxPrice != null) {
      filter.pricePerUnit = {};
      if (q.minPrice != null) filter.pricePerUnit.$gte = Math.round(q.minPrice * 100);
      if (q.maxPrice != null) filter.pricePerUnit.$lte = Math.round(q.maxPrice * 100);
    }
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      filter.$or = [{ name: rx }, { variety: rx }, { nameHi: rx }];
    }

    let serving = null;
    if (q.pincode) {
      serving = await User.find({ isActive: true, 'supplierProfile.serviceAreas.pincode': q.pincode }).select('_id supplierProfile.serviceAreas');
      const ids = serving.map((u) => u._id);
      filter.supplier = q.supplier ? (ids.some((i) => String(i) === q.supplier) ? q.supplier : null) : { $in: ids };
    }

    const sortMap = {
      price_asc: { pricePerUnit: 1 },
      price_desc: { pricePerUnit: -1 },
      newest: { createdAt: -1 },
      rating: { ratingAvg: -1, ratingCount: -1 },
      fresh: { harvestDate: -1 },
      relevance: { soldQty: -1, createdAt: -1 },
    };
    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort(sortMap[q.sort || 'relevance'])
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .populate('supplier', SUPPLIER_FIELDS)
        .lean(),
      Product.countDocuments(filter),
    ]);

    // Attach the delivery fee for the buyer's pincode so the list shows real costs.
    if (serving) {
      const feeBySupplier = new Map(serving.map((u) => [String(u._id), u.supplierProfile.serviceAreas.find((a) => a.pincode === q.pincode)]));
      items.forEach((p) => {
        const a = feeBySupplier.get(String(p.supplier?._id));
        p.delivery = a ? { fee: a.deliveryFee, etaDays: a.etaDays } : null;
      });
    }
    res.json({ items, total, page: q.page, pages: Math.ceil(total / q.limit) });
  })
);

router.get(
  '/mine',
  authenticate,
  requireRole('farmer', 'trader'),
  asyncHandler(async (req, res) => {
    const items = await Product.find({ supplier: req.user._id }).sort({ updatedAt: -1 });
    res.json({ items });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw notFound('Product not found');
    const product = await Product.findById(req.params.id).populate('supplier', SUPPLIER_FIELDS + ' supplierProfile.bio supplierProfile.freeDeliveryAbove supplierProfile.minOrderValue');
    if (!product || !product.isActive) throw notFound('Product not found');

    let delivery = null;
    const pincode = /^\d{6}$/.test(req.query.pincode || '') ? req.query.pincode : null;
    if (pincode) {
      const supplier = await User.findById(product.supplier._id).select('supplierProfile isActive name');
      const sp = supplier?.supplierProfile || {};
      const area = supplier?.isActive && (sp.serviceAreas || []).find((a) => a.pincode === pincode);
      delivery = area
        ? { ok: true, pincode, fee: area.deliveryFee, etaDays: area.etaDays, freeDeliveryAbove: sp.freeDeliveryAbove || 0, minOrderValue: sp.minOrderValue || 0 }
        : { ok: false, pincode, reason: `This seller does not deliver to ${pincode}`, pickupAvailable: !!sp.pickupAvailable };
    }
    const [groups, reviews] = await Promise.all([
      GroupOrder.find({ product: product._id, status: 'open', deadline: { $gt: new Date() }, ...(pincode && { 'dropPoint.pincode': pincode }) })
        .select('-members.user -members.order')
        .sort({ deadline: 1 })
        .limit(10),
      Review.find({ product: product._id }).sort({ createdAt: -1 }).limit(20).select('rating comment buyerName createdAt'),
    ]);
    res.json({ product, delivery, groups, reviews });
  })
);

router.post(
  '/',
  authenticate,
  requireRole('farmer', 'trader'),
  validate(s.createProduct),
  asyncHandler(async (req, res) => {
    const count = await Product.countDocuments({ supplier: req.user._id, isActive: true });
    if (count >= 200) throw badRequest('Listing limit reached (200 active products)');
    const product = await Product.create({ ...req.body, supplier: req.user._id, supplierRole: req.user.role });
    res.status(201).json({ product });
  })
);

router.patch(
  '/:id',
  authenticate,
  requireRole('farmer', 'trader'),
  validate(s.updateProduct),
  asyncHandler(async (req, res) => {
    // Ownership check is part of the query: a supplier can only ever load their own product.
    const product = await Product.findOne({ _id: req.params.id, supplier: req.user._id });
    if (!product) throw notFound('Product not found');
    if (req.body.groupBuy) {
      req.body.groupBuy = { ...(product.groupBuy?.toObject?.() || {}), ...req.body.groupBuy };
    }
    product.set(req.body);
    await product.save();
    res.json({ product });
  })
);

router.delete(
  '/:id',
  authenticate,
  requireRole('farmer', 'trader'),
  asyncHandler(async (req, res) => {
    // Soft delete: past orders and reviews still reference the product.
    const product = await Product.findOneAndUpdate({ _id: req.params.id, supplier: req.user._id }, { $set: { isActive: false } }, { new: true });
    if (!product) throw notFound('Product not found');
    res.json({ ok: true });
  })
);

module.exports = router;
