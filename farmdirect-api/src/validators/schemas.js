const { z } = require('zod');
const { CATEGORIES, UNITS, GRADES } = require('../models/Product');
const { DISPUTE_REASONS } = require('../models/misc');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const pincode = z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits');
const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
const rupees = z.coerce.number().positive().max(10_000_000);
const paise = rupees.transform((r) => Math.round(r * 100)); // API accepts rupees, stores paise
const paiseOrZero = z.coerce.number().min(0).max(10_000_000).transform((r) => Math.round(r * 100));
const qty = z.coerce.number().int('Quantity must be a whole number').positive().max(100000);
const text = (max) => z.string().trim().max(max);

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a number');

const register = z
  .object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: phone.optional(),
  password,
  // Admin can NEVER be self-registered.
  role: z.enum(['customer', 'retailer', 'farmer', 'trader', 'broker']),
  licenseNumber: text(60).optional(),
  businessName: text(120).optional(),
  businessType: z.enum(['retail_shop', 'restaurant', 'wholesaler', 'hotel', 'other']).optional(),
  village: text(80).optional(),
  district: text(80).optional(),
  state: text(80).optional(),
  pincode: pincode.optional(),
})
  // Brokers must give a phone number: farmers call them to verify before any deal.
  .refine((v) => v.role !== 'broker' || v.phone, { message: 'Brokers must add a mobile number so farmers can call you', path: ['phone'] })
  .refine((v) => v.role !== 'broker' || (v.state && v.district), { message: 'Choose your state and district', path: ['district'] });

const login = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required').max(72),
});

const address = z.object({
  label: text(40).optional(),
  name: text(80).optional(),
  phone: phone.optional(),
  line1: z.string().trim().min(3, 'Address line is required').max(200),
  line2: text(200).optional(),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'State is required').max(80),
  pincode,
});

const updateMe = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phone.optional(),
  preferredLanguage: z.enum(['en', 'hi']).optional(),
  businessName: text(120).optional(),
  businessType: z.enum(['retail_shop', 'restaurant', 'wholesaler', 'hotel', 'other']).optional(),
  gstin: z.string().trim().toUpperCase().regex(/^[0-9A-Z]{15}$/, 'GSTIN must be 15 characters').optional(),
});

const supplierSettings = z.object({
  displayName: text(80).optional(),
  bio: text(600).optional(),
  village: text(80).optional(),
  district: text(80).optional(),
  state: text(80).optional(),
  pincode: pincode.optional(),
  serviceAreas: z
    .array(z.object({ pincode, deliveryFee: paiseOrZero, etaDays: z.coerce.number().int().min(0).max(14).default(1) }))
    .max(200)
    .optional()
    .refine((a) => !a || new Set(a.map((x) => x.pincode)).size === a.length, 'Each pincode can be listed only once'),
  freeDeliveryAbove: paiseOrZero.optional(),
  minOrderValue: paiseOrZero.optional(),
  pickupAvailable: z.boolean().optional(),
  pickupAddress: text(300).optional(),
  upiId: z.string().trim().regex(/^[\w.-]{2,}@[a-zA-Z]{2,}$/, 'Enter a valid UPI ID').optional().or(z.literal('')),
});

const productBase = {
  name: z.string().trim().min(2, 'Name is too short').max(80),
  variety: text(60).optional(),
  nameHi: text(80).optional(),
  description: text(1500).optional(),
  category: z.enum(CATEGORIES),
  unit: z.enum(UNITS),
  pricePerUnit: paise,
  bulkTiers: z.array(z.object({ minQty: qty, pricePerUnit: paise })).max(5).optional(),
  minOrderQty: qty.optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  grade: z.enum(GRADES).optional(),
  gradeNote: text(200).optional(),
  harvestDate: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 86400000, 'Harvest date cannot be in the future').optional(),
  organicClaim: z.boolean().optional(),
  images: z.array(z.string().trim().max(500)).max(6).optional(),
  audience: z.enum(['all', 'business']).optional(),
  isActive: z.boolean().optional(),
  groupBuy: z
    .object({
      enabled: z.boolean(),
      pricePerUnit: paise.optional(),
      minMemberQty: qty.optional(),
      targetQty: qty.optional(),
      maxQty: qty.optional(),
    })
    .optional(),
};
const createProduct = z.object(productBase);
const updateProduct = z.object(productBase).partial();

const productQuery = z.object({
  pincode: pincode.optional(),
  category: z.enum(CATEGORIES).optional(),
  q: text(60).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'rating', 'fresh']).optional(),
  supplierType: z.enum(['farmer', 'trader']).optional(),
  groupBuy: z.enum(['true']).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  supplier: objectId.optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});

const cartItems = z.array(z.object({ productId: objectId, qty })).min(1, 'Your cart is empty').max(50);

const quote = z.object({
  items: cartItems,
  fulfilment: z.enum(['delivery', 'pickup']),
  pincode: pincode.optional(),
});

const checkout = z
  .object({
    items: cartItems,
    fulfilment: z.enum(['delivery', 'pickup']),
    address: address.optional(),
    note: text(300).optional(),
  })
  .refine((v) => v.fulfilment === 'pickup' || v.address, { message: 'Delivery address is required', path: ['address'] });

const verifyPayment = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(256),
});

const mockComplete = z.object({ providerOrderId: z.string().startsWith('mock_order_'), outcome: z.enum(['success', 'failure']) });

const orderStatus = z.object({
  to: z.enum(['accepted', 'rejected', 'packed', 'out_for_delivery', 'ready_for_pickup', 'delivered', 'cancelled']),
  note: text(300).optional(),
});

const createGroup = z.object({
  productId: objectId,
  qty,
  title: text(100).optional(),
  deadlineHours: z.coerce.number().int().min(2, 'Deadline must be at least 2 hours away').max(168, 'Deadline can be at most 7 days away'),
  dropPoint: z.object({
    label: z.string().trim().min(2, 'Name the drop point, e.g. "Green Park Society gate"').max(80),
    line1: z.string().trim().min(3).max(200),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    pincode,
  }),
});

const joinGroup = z.object({ qty });

const review = z.object({ orderId: objectId, productId: objectId, rating: z.coerce.number().int().min(1).max(5), comment: text(800).optional() });

const dispute = z.object({
  orderId: objectId,
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().trim().min(10, 'Please describe the problem (at least 10 characters)').max(1500),
  evidence: z.array(z.string().max(500)).max(6).optional(),
  requested: z.enum(['full_refund', 'partial_refund', 'replacement']),
});
const disputeRespond = z.object({ response: z.string().trim().min(5).max(1500) });
const disputeResolve = z.object({
  outcome: z.enum(['full_refund', 'partial_refund', 'replacement', 'rejected']),
  refundAmount: paise.optional(),
  note: z.string().trim().min(5).max(1000),
  liableParty: z.enum(['supplier', 'platform', 'delivery_partner', 'none']),
});

const adminUserUpdate = z.object({ isActive: z.boolean().optional(), verified: z.boolean().optional() });

module.exports = {
  objectId,
  register,
  login,
  address,
  updateMe,
  supplierSettings,
  createProduct,
  updateProduct,
  productQuery,
  quote,
  checkout,
  verifyPayment,
  mockComplete,
  orderStatus,
  createGroup,
  joinGroup,
  review,
  dispute,
  disputeRespond,
  disputeResolve,
  adminUserUpdate,
};
