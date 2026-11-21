const mongoose = require('mongoose');

const CATEGORIES = ['vegetables', 'fruits', 'grains', 'pulses', 'spices', 'others'];
const UNITS = ['kg', 'quintal', 'dozen', 'piece', 'bundle'];
const GRADES = ['A', 'B', 'C', 'ungraded'];

const tierSchema = new mongoose.Schema(
  {
    minQty: { type: Number, required: true, min: 1 },
    pricePerUnit: { type: Number, required: true, min: 1 }, // paise
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supplierRole: { type: String, enum: ['farmer', 'trader'], required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    variety: { type: String, trim: true, maxlength: 60 },
    // Local-language name shown when the buyer switches to Hindi (e.g. "टमाटर").
    nameHi: { type: String, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1500 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    unit: { type: String, enum: UNITS, required: true, default: 'kg' },
    pricePerUnit: { type: Number, required: true, min: 1 }, // paise
    bulkTiers: { type: [tierSchema], default: [] },
    minOrderQty: { type: Number, min: 1, default: 1 },
    stock: { type: Number, required: true, min: 0 },
    grade: { type: String, enum: GRADES, default: 'ungraded' },
    gradeNote: { type: String, trim: true, maxlength: 200 },
    harvestDate: Date,
    // Self-declared by the supplier. The UI labels it as such — FarmDirect does
    // not certify organic produce unless certificationVerified is true.
    organicClaim: { type: Boolean, default: false },
    certificationVerified: { type: Boolean, default: false },
    images: { type: [String], default: [], validate: (v) => v.length <= 6 },
    audience: { type: String, enum: ['all', 'business'], default: 'all' },
    isActive: { type: Boolean, default: true, index: true },
    groupBuy: {
      enabled: { type: Boolean, default: false },
      pricePerUnit: { type: Number, min: 1 }, // paise, must be below normal price
      minMemberQty: { type: Number, min: 1, default: 1 },
      targetQty: { type: Number, min: 1 },
      maxQty: { type: Number, min: 1 },
    },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    soldQty: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', variety: 'text', description: 'text' });
productSchema.index({ isActive: 1, category: 1, pricePerUnit: 1 });

productSchema.pre('validate', function () {
  const g = this.groupBuy;
  if (g && g.enabled) {
    if (!g.pricePerUnit || !g.targetQty || !g.maxQty) {
      this.invalidate('groupBuy', 'Group buying needs a group price, target quantity and maximum quantity');
    } else if (g.pricePerUnit >= this.pricePerUnit) {
      this.invalidate('groupBuy.pricePerUnit', 'Group price must be lower than the regular price');
    } else if (g.targetQty > g.maxQty) {
      this.invalidate('groupBuy.targetQty', 'Target quantity cannot exceed maximum quantity');
    }
  }
  if (this.bulkTiers?.length) {
    const sorted = [...this.bulkTiers].sort((a, b) => a.minQty - b.minQty);
    this.bulkTiers = sorted;
  }
});

/** Price per unit for a given quantity, applying the best bulk tier. */
productSchema.methods.unitPriceFor = function (qty) {
  let price = this.pricePerUnit;
  for (const t of this.bulkTiers || []) {
    if (qty >= t.minQty && t.pricePerUnit < price) price = t.pricePerUnit;
  }
  return price;
};

productSchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('Product', productSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.UNITS = UNITS;
module.exports.GRADES = GRADES;
