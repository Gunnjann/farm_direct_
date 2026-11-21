const mongoose = require('mongoose');

/**
 * Order lifecycle (one order = one supplier):
 *
 *  pending_payment ──pay──▶ placed ──supplier──▶ accepted ─▶ packed ─▶ out_for_delivery ─▶ delivered
 *        │                    │  └──supplier──▶ rejected (auto refund)        └─▶ ready_for_pickup ─┘
 *        │                    └──buyer──▶ cancelled (auto refund)
 *        └──timeout──▶ expired (stock released)
 *
 *  Group orders: pending_payment ─pay─▶ awaiting_group ─group confirmed─▶ placed …
 *                                                     └─group failed──▶ cancelled (refund)
 */
const STATUSES = [
  'pending_payment',
  'awaiting_group',
  'placed',
  'accepted',
  'packed',
  'out_for_delivery',
  'ready_for_pickup',
  'delivered',
  'rejected',
  'cancelled',
  'expired',
];

// Which status can move to which, and who may trigger it.
const TRANSITIONS = {
  placed: { accepted: ['supplier'], rejected: ['supplier', 'admin'], cancelled: ['buyer', 'admin'] },
  accepted: { packed: ['supplier'], cancelled: ['admin'] },
  packed: { out_for_delivery: ['supplier'], ready_for_pickup: ['supplier'], cancelled: ['admin'] },
  out_for_delivery: { delivered: ['supplier', 'admin'] },
  ready_for_pickup: { delivered: ['supplier', 'admin'] },
};

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unit: { type: String, required: true },
    image: String,
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }, // paise, frozen at order time
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    checkoutId: { type: String, required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['standard', 'group'], default: 'standard' },
    groupOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupOrder' },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    fulfilment: { type: String, enum: ['delivery', 'pickup'], required: true },
    deliveryAddress: {
      name: String,
      phone: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
    },
    pickupAddress: String,
    etaDays: Number,
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: STATUSES, required: true, index: true },
    statusHistory: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
        _id: false,
      },
    ],
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refund_pending', 'refunded'],
      default: 'pending',
    },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    expiresAt: { type: Date, index: true },
    // Guards against double-restocking when an order is cancelled twice by racing requests.
    stockReleased: { type: Boolean, default: false },
    deliveredAt: Date,
    note: { type: String, maxlength: 300 },
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ supplier: 1, status: 1, createdAt: -1 });
orderSchema.index({ buyer: 1, createdAt: -1 });

orderSchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = STATUSES;
module.exports.TRANSITIONS = TRANSITIONS;
