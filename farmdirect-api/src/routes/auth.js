const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { SUPPLIER_ROLES } = require('../models/User');
const { signToken, authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');
const { asyncHandler, unauthorized, notFound, AppError } = require('../utils/errors');
const { findLocation } = require('../data/agri');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 10000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many attempts. Please wait a few minutes.' } },
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

router.post(
  '/register',
  authLimiter,
  validate(s.register),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const user = new User({ name: b.name, email: b.email, phone: b.phone, role: b.role });
    if (SUPPLIER_ROLES.includes(b.role)) {
      user.supplierProfile = {
        displayName: b.businessName || b.name,
        village: b.village,
        district: b.district,
        state: b.state,
        pincode: b.pincode,
        verified: false,
      };
    }
    if (b.role === 'retailer') user.businessProfile = { businessName: b.businessName, businessType: b.businessType };
    if (b.role === 'broker') {
      const loc = findLocation(b.state, b.district);
      if (!loc) throw new AppError(400, 'Choose a district in Madhya Pradesh or Maharashtra', 'BAD_LOCATION');
      user.brokerProfile = { businessName: b.businessName || b.name, licenseNumber: b.licenseNumber, district: loc.district, state: loc.state, lat: loc.lat, lng: loc.lng, verified: false };
    }
    if (b.role === 'farmer') {
      const loc = findLocation(b.state, b.district);
      if (loc) Object.assign(user.supplierProfile, { farmState: loc.state, farmDistrict: loc.district });
    }
    await user.setPassword(b.password);
    await user.save();
    res.status(201).json({ token: signToken(user), user });
  })
);

router.post(
  '/login',
  authLimiter,
  validate(s.login),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+passwordHash +tokenVersion +failedLogins +lockUntil');
    // Same message for unknown email and wrong password => no account enumeration.
    const invalid = unauthorized('Incorrect email or password');
    if (!user) throw invalid;
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new AppError(429, 'Too many failed attempts. Try again in a few minutes.', 'LOCKED');
    }
    if (!(await user.checkPassword(req.body.password))) {
      const failed = (user.failedLogins || 0) + 1;
      const update = failed >= MAX_FAILED ? { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } : { failedLogins: failed };
      await User.updateOne({ _id: user._id }, { $set: update });
      throw invalid;
    }
    if (!user.isActive) throw unauthorized('This account has been disabled. Contact support.');
    await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0 }, $unset: { lockUntil: 1 } });
    res.json({ token: signToken(user), user });
  })
);

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

router.patch(
  '/me',
  authenticate,
  validate(s.updateMe),
  asyncHandler(async (req, res) => {
    const u = req.user;
    const { businessName, businessType, gstin, ...rest } = req.body;
    Object.assign(u, rest);
    if (u.role === 'retailer' && (businessName || businessType || gstin)) {
      u.businessProfile = { ...(u.businessProfile?.toObject?.() || {}), ...(businessName && { businessName }), ...(businessType && { businessType }), ...(gstin && { gstin }) };
    }
    await u.save();
    res.json({ user: u });
  })
);

router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    res.json({ ok: true });
  })
);

router.post(
  '/me/addresses',
  authenticate,
  validate(s.address),
  asyncHandler(async (req, res) => {
    if (req.user.addresses.length >= 10) throw new AppError(400, 'You can save up to 10 addresses', 'LIMIT');
    req.user.addresses.push(req.body);
    await req.user.save();
    res.status(201).json({ user: req.user });
  })
);

router.delete(
  '/me/addresses/:addressId',
  authenticate,
  asyncHandler(async (req, res) => {
    const a = req.user.addresses.id(req.params.addressId);
    if (!a) throw notFound('Address not found');
    a.deleteOne();
    await req.user.save();
    res.json({ user: req.user });
  })
);

module.exports = router;
