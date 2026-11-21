const mongoose = require('mongoose');
const { Schema } = mongoose;
const { CROP_KEYS } = require('../data/agri');

const pointish = {
  village: { type: String, trim: true, maxlength: 80 },
  district: { type: String, trim: true, required: true, maxlength: 60 },
  state: { type: String, enum: ['Madhya Pradesh', 'Maharashtra'], required: true },
  lat: { type: Number, min: -90, max: 90 },
  lng: { type: Number, min: -180, max: 180 },
};

/* ------------------------------------------------------------------ Mandi prices
 * Prices are ₹ per QUINTAL (100 kg) — the unit AGMARKNET publishes.
 * source: agmarknet (government API) | admin (entered by FarmDirect team) | sample (demo only)
 */
const mandiPriceSchema = new Schema(
  {
    crop: { type: String, enum: CROP_KEYS, required: true },
    mandiKey: String, // set when the market is in our MANDIS list (gives coordinates)
    market: { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true, required: true },
    variety: { type: String, trim: true, default: 'Other' },
    date: { type: Date, required: true },
    minPrice: { type: Number, min: 0, required: true },
    maxPrice: { type: Number, min: 0, required: true },
    modalPrice: { type: Number, min: 0, required: true },
    arrivalsQtl: Number,
    source: { type: String, enum: ['agmarknet', 'admin', 'sample'], required: true },
    enteredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
mandiPriceSchema.index({ crop: 1, state: 1, date: -1 });
mandiPriceSchema.index({ crop: 1, market: 1, variety: 1, date: 1, source: 1 }, { unique: true });

/* ------------------------------------------------------------------ Farmer: "fasal bechni hai" */
const cropListingSchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    crop: { type: String, enum: CROP_KEYS, required: true, index: true },
    variety: { type: String, trim: true, maxlength: 60 },
    quantityQtl: { type: Number, required: true, min: 1, max: 100000 },
    expectedPricePerKg: { type: Number, min: 0 }, // paise per kg, optional ("best offer")
    readyFrom: { type: Date, required: true },
    quality: { type: String, trim: true, maxlength: 300 },
    images: { type: [String], default: [] },
    location: pointish,
    status: { type: String, enum: ['open', 'deal_done', 'closed'], default: 'open', index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ Broker: "maal chahiye" */
const buyRequestSchema = new Schema(
  {
    broker: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    crop: { type: String, enum: CROP_KEYS, required: true, index: true },
    variety: { type: String, trim: true, maxlength: 60 },
    minQtyQtl: { type: Number, min: 1, required: true },
    maxQtyQtl: { type: Number, min: 1, required: true },
    offerPricePerKg: { type: Number, min: 1, required: true }, // paise per kg, at the farm gate
    pickupByBroker: { type: Boolean, default: true }, // broker sends vehicle to the farm
    paymentTerms: { type: String, trim: true, maxlength: 200, default: 'Full payment at pickup (cash / UPI)' },
    quality: { type: String, trim: true, maxlength: 300 },
    base: pointish,
    radiusKm: { type: Number, min: 5, max: 1000, default: 100 },
    neededBy: { type: Date, required: true },
    status: { type: String, enum: ['open', 'filled', 'closed'], default: 'open', index: true },
  },
  { timestamps: true }
);

/* ------------------------------------------------------------------ Deal (payment happens OFFLINE at pickup)
 *
 *  proposed ──other party agrees──▶ agreed ──broker adds vehicle──▶ vehicle_assigned
 *     │                               │                                    │
 *     └──cancel──▶ cancelled ◀────────┴───────────── cancel ───────────────┘
 *                                                                          │
 *  vehicle_assigned ──farmer: "maal utha + paisa mila"──▶ completed  (weighed qty + amount + mode recorded)
 *  vehicle_assigned / agreed ──farmer reports problem──▶ disputed     (no-show, not paid, price cut)
 *
 * Only the FARMER can mark the deal paid/completed — that confirmation is what builds
 * a broker's public "paid at pickup" record.
 */
const DEAL_STATUSES = ['proposed', 'agreed', 'vehicle_assigned', 'completed', 'cancelled', 'disputed'];
const dealSchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    broker: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    proposedBy: { type: String, enum: ['farmer', 'broker'], required: true },
    listing: { type: Schema.Types.ObjectId, ref: 'CropListing' },
    request: { type: Schema.Types.ObjectId, ref: 'BuyRequest' },
    crop: { type: String, enum: CROP_KEYS, required: true },
    quantityQtl: { type: Number, min: 1, required: true },
    pricePerKg: { type: Number, min: 1, required: true }, // paise
    pickupDate: { type: Date, required: true },
    pickupPlace: { type: String, trim: true, maxlength: 200 },
    message: { type: String, trim: true, maxlength: 300 },
    vehicleNumber: { type: String, trim: true, uppercase: true, maxlength: 15 },
    driverName: { type: String, trim: true, maxlength: 60 },
    driverPhone: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
    weighedQtl: Number,
    amountReceived: Number, // paise, as confirmed by the farmer
    paymentMode: { type: String, enum: ['cash', 'upi', 'bank', 'cheque'] },
    status: { type: String, enum: DEAL_STATUSES, default: 'proposed', index: true },
    history: [{ status: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, note: String, at: { type: Date, default: Date.now }, _id: false }],
    issue: { type: String, enum: ['broker_no_show', 'not_paid', 'paid_less', 'price_cut_at_pickup', 'farmer_no_show', 'quality_mismatch', 'other'] },
    issueNote: String,
    farmerRating: { type: Number, min: 1, max: 5 }, // farmer rates broker
    farmerReview: { type: String, trim: true, maxlength: 400 },
    brokerRating: { type: Number, min: 1, max: 5 }, // broker rates farmer
  },
  { timestamps: true }
);
dealSchema.index({ broker: 1, status: 1 });

module.exports = {
  MandiPrice: mongoose.model('MandiPrice', mandiPriceSchema),
  CropListing: mongoose.model('CropListing', cropListingSchema),
  BuyRequest: mongoose.model('BuyRequest', buyRequestSchema),
  Deal: mongoose.model('Deal', dealSchema),
  DEAL_STATUSES,
};
