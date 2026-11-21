const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['customer', 'retailer', 'farmer', 'trader', 'broker', 'admin'];
const SUPPLIER_ROLES = ['farmer', 'trader'];
const BUYER_ROLES = ['customer', 'retailer'];

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 40, default: 'Home' },
    name: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
    line1: { type: String, trim: true, required: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, required: true, maxlength: 80 },
    state: { type: String, trim: true, required: true, maxlength: 80 },
    pincode: { type: String, required: true, match: /^\d{6}$/ },
  },
  { _id: true }
);

const serviceAreaSchema = new mongoose.Schema(
  {
    pincode: { type: String, required: true, match: /^\d{6}$/ },
    deliveryFee: { type: Number, required: true, min: 0 }, // paise
    etaDays: { type: Number, min: 0, max: 14, default: 1 },
  },
  { _id: false }
);

const supplierProfileSchema = new mongoose.Schema(
  {
    displayName: { type: String, trim: true, maxlength: 80 },
    bio: { type: String, trim: true, maxlength: 600 },
    village: { type: String, trim: true, maxlength: 80 },
    district: { type: String, trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80 },
    pincode: { type: String, match: /^\d{6}$/ },
    // Verification is done by an admin after checking documents/visit.
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    serviceAreas: { type: [serviceAreaSchema], default: [] },
    freeDeliveryAbove: { type: Number, min: 0, default: 0 }, // paise, 0 = never free
    minOrderValue: { type: Number, min: 0, default: 0 }, // paise
    pickupAvailable: { type: Boolean, default: false },
    pickupAddress: { type: String, trim: true, maxlength: 300 },
    farmState: { type: String, enum: ['Madhya Pradesh', 'Maharashtra'] },
    farmDistrict: { type: String, trim: true, maxlength: 60 },
    upiId: { type: String, trim: true, maxlength: 80 },
  },
  { _id: false }
);

// Broker / bulk buyer who buys crops from farmers at the farm gate.
const brokerProfileSchema = new mongoose.Schema(
  {
    businessName: { type: String, trim: true, maxlength: 120 },
    licenseNumber: { type: String, trim: true, maxlength: 60 }, // APMC / mandi trader licence
    gstin: { type: String, trim: true, uppercase: true, match: /^[0-9A-Z]{15}$/ },
    district: { type: String, trim: true, maxlength: 60 },
    state: { type: String, enum: ['Madhya Pradesh', 'Maharashtra'] },
    lat: Number,
    lng: Number,
    crops: { type: [String], default: [] },
    about: { type: String, trim: true, maxlength: 500 },
    verified: { type: Boolean, default: false }, // set by admin after checking licence + phone call
    verifiedAt: Date,
  },
  { _id: false }
);

const businessProfileSchema = new mongoose.Schema(
  {
    businessName: { type: String, trim: true, maxlength: 120 },
    businessType: { type: String, enum: ['retail_shop', 'restaurant', 'wholesaler', 'hotel', 'other'] },
    gstin: { type: String, trim: true, uppercase: true, match: /^[0-9A-Z]{15}$/ },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, match: /^[6-9]\d{9}$/, unique: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'customer' },
    isActive: { type: Boolean, default: true },
    preferredLanguage: { type: String, enum: ['en', 'hi'], default: 'en' },
    addresses: { type: [addressSchema], default: [] },
    supplierProfile: supplierProfileSchema,
    brokerProfile: brokerProfileSchema,
    businessProfile: businessProfileSchema,
    // Incrementing this invalidates every JWT issued before (logout everywhere).
    tokenVersion: { type: Number, default: 0, select: false },
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.index({ 'supplierProfile.serviceAreas.pincode': 1, role: 1 });

userSchema.virtual('isSupplier').get(function () {
  return SUPPLIER_ROLES.includes(this.role);
});

userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

userSchema.methods.checkPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.failedLogins;
    delete ret.lockUntil;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.SUPPLIER_ROLES = SUPPLIER_ROLES;
module.exports.BUYER_ROLES = BUYER_ROLES;
