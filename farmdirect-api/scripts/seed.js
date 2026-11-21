/**
 * Demo data for local development.  Usage:  npm run seed
 * Refuses to run against production. WIPES the FarmDirect collections in the target DB.
 */
const env = require('../src/config/env');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const GroupOrder = require('../src/models/GroupOrder');
const { Review, Dispute, Notification } = require('../src/models/misc');
const { MandiPrice, CropListing, BuyRequest, Deal } = require('../src/models/Market');
const { generateSample } = require('../src/services/mandiData');
const { findLocation } = require('../src/data/agri');

const PASSWORD = 'Farm@1234';
const PUNE = ['411001', '411004', '411038', '411045', '411057'];

async function mkUser(data) {
  const u = new User(data);
  await u.setPassword(data.password || PASSWORD);
  await u.save();
  return u;
}

const area = (pins, fee, eta = 1) => pins.map((pincode) => ({ pincode, deliveryFee: fee * 100, etaDays: eta }));
const daysAgo = (d) => new Date(Date.now() - d * 86400000);

async function main() {
  if (env.isProd) throw new Error('Refusing to seed a production database');
  await connectDB();
  await Promise.all([User, Product, Order, Payment, GroupOrder, Review, Dispute, Notification, CropListing, BuyRequest, Deal].map((m) => m.deleteMany({})));
  // Only sample prices are replaced; real AGMARKNET / admin prices are kept.
  await MandiPrice.deleteMany({ source: 'sample' });

  await mkUser({ name: 'Platform Admin', email: 'admin@farmdirect.test', role: 'admin', password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345' });

  const ramesh = await mkUser({
    name: 'Ramesh Patil', email: 'ramesh@farmdirect.test', phone: '9876500001', role: 'farmer',
    supplierProfile: {
      displayName: 'Patil Organic Farm', bio: 'Three generations growing vegetables in Junnar. Harvested the morning of dispatch.',
      village: 'Narayangaon', district: 'Pune', state: 'Maharashtra', pincode: '410504', verified: true, verifiedAt: new Date(),
      serviceAreas: area(PUNE, 40), freeDeliveryAbove: 50000, minOrderValue: 15000, pickupAvailable: true,
      pickupAddress: 'Patil Farm, Narayangaon–Junnar Road, Pune 410504', upiId: 'ramesh@upi', farmState: 'Maharashtra', farmDistrict: 'Pune',
    },
  });
  const sunita = await mkUser({
    name: 'Sunita Jadhav', email: 'sunita@farmdirect.test', phone: '9876500002', role: 'farmer',
    supplierProfile: {
      displayName: 'Jadhav Fruit Orchards', bio: 'Pomegranates and seasonal fruit from Baramati.',
      village: 'Baramati', district: 'Pune', state: 'Maharashtra', pincode: '413102', verified: true, verifiedAt: new Date(),
      serviceAreas: area(PUNE.slice(0, 3), 60, 2), freeDeliveryAbove: 0, minOrderValue: 20000, pickupAvailable: false,
    },
  });
  const anil = await mkUser({
    name: 'Anil Shinde', email: 'anil@farmdirect.test', phone: '9876500003', role: 'farmer',
    supplierProfile: {
      displayName: 'Shinde Farms', village: 'Shirur', district: 'Pune', state: 'Maharashtra', pincode: '412210', verified: false,
      serviceAreas: area(['411045', '411057'], 30), minOrderValue: 10000, pickupAvailable: true, pickupAddress: 'Shirur market yard gate 2',
    },
  });
  const trader = await mkUser({
    name: 'Mahesh Agarwal', email: 'trader@farmdirect.test', phone: '9876500004', role: 'trader',
    supplierProfile: {
      displayName: 'Agarwal Grain Traders', bio: 'Wholesale grains and pulses. Market Yard, Gultekdi. Bulk orders welcome.',
      district: 'Pune', state: 'Maharashtra', pincode: '411037', verified: true, verifiedAt: new Date(),
      serviceAreas: area(PUNE, 120, 2), freeDeliveryAbove: 500000, minOrderValue: 50000, pickupAvailable: true, pickupAddress: 'Shop 14, Market Yard, Gultekdi, Pune 411037',
    },
  });

  await mkUser({
    name: 'Priya Deshmukh', email: 'customer@farmdirect.test', phone: '9876500010', role: 'customer',
    addresses: [{ label: 'Home', name: 'Priya Deshmukh', phone: '9876500010', line1: 'Flat 302, Green Park Society, Baner Road', city: 'Pune', state: 'Maharashtra', pincode: '411045' }],
  });
  await mkUser({
    name: 'Kiran Mehta', email: 'retailer@farmdirect.test', phone: '9876500011', role: 'retailer',
    businessProfile: { businessName: 'Mehta Fresh Mart', businessType: 'retail_shop' },
    addresses: [{ label: 'Shop', name: 'Mehta Fresh Mart', phone: '9876500011', line1: 'Shop 4, FC Road', city: 'Pune', state: 'Maharashtra', pincode: '411004' }],
  });

  const P = (supplier, d) => ({ supplier: supplier._id, supplierRole: supplier.role, ...d, pricePerUnit: d.price * 100, bulkTiers: (d.tiers || []).map(([minQty, p]) => ({ minQty, pricePerUnit: p * 100 })), groupBuy: d.group ? { enabled: true, pricePerUnit: d.group[0] * 100, minMemberQty: d.group[1], targetQty: d.group[2], maxQty: d.group[3] } : { enabled: false } });

  const products = await Product.create([
    P(ramesh, { name: 'Tomato', nameHi: 'टमाटर', variety: 'Desi', category: 'vegetables', unit: 'kg', price: 32, stock: 400, grade: 'A', gradeNote: 'Firm, 60–80 g, no cracks', harvestDate: daysAgo(1), organicClaim: false, minOrderQty: 2, tiers: [[10, 28], [50, 24]], group: [24, 2, 40, 80], description: 'Vine-ripened desi tomatoes. Tangy, great for curries and chutney.' }),
    P(ramesh, { name: 'Onion', nameHi: 'प्याज़', variety: 'Red Nashik', category: 'vegetables', unit: 'kg', price: 38, stock: 900, grade: 'A', harvestDate: daysAgo(6), minOrderQty: 2, tiers: [[25, 33], [100, 29]], group: [30, 5, 100, 200], description: 'Dry, well-cured red onions with long shelf life.' }),
    P(ramesh, { name: 'Spinach', nameHi: 'पालक', variety: 'Palak', category: 'vegetables', unit: 'bundle', price: 20, stock: 120, grade: 'A', harvestDate: daysAgo(0), organicClaim: true, minOrderQty: 2, description: 'Tender leaves, washed at farm. Grown without synthetic pesticides (self-declared).' }),
    P(ramesh, { name: 'Green Chilli', nameHi: 'हरी मिर्च', category: 'vegetables', unit: 'kg', price: 60, stock: 60, grade: 'B', harvestDate: daysAgo(1), minOrderQty: 1, description: 'Medium-hot Jwala chillies.' }),
    P(ramesh, { name: 'Potato', nameHi: 'आलू', variety: 'Jyoti', category: 'vegetables', unit: 'kg', price: 28, stock: 700, grade: 'A', harvestDate: daysAgo(10), minOrderQty: 3, tiers: [[50, 23]] }),
    P(sunita, { name: 'Pomegranate', nameHi: 'अनार', variety: 'Bhagwa', category: 'fruits', unit: 'kg', price: 140, stock: 250, grade: 'A', gradeNote: '250–300 g per fruit, deep red arils', harvestDate: daysAgo(2), minOrderQty: 2, group: [115, 2, 30, 60], description: 'Export-grade Bhagwa pomegranates from Baramati.' }),
    P(sunita, { name: 'Banana', nameHi: 'केला', variety: 'Robusta', category: 'fruits', unit: 'dozen', price: 55, stock: 150, grade: 'B', harvestDate: daysAgo(3), minOrderQty: 2 }),
    P(sunita, { name: 'Guava', nameHi: 'अमरूद', variety: 'Lalit', category: 'fruits', unit: 'kg', price: 80, stock: 90, grade: 'A', harvestDate: daysAgo(1), minOrderQty: 2 }),
    P(anil, { name: 'Cauliflower', nameHi: 'फूलगोभी', category: 'vegetables', unit: 'piece', price: 35, stock: 140, grade: 'B', harvestDate: daysAgo(1), minOrderQty: 2 }),
    P(anil, { name: 'Brinjal', nameHi: 'बैंगन', variety: 'Bharit', category: 'vegetables', unit: 'kg', price: 40, stock: 80, grade: 'ungraded', harvestDate: daysAgo(1), minOrderQty: 2 }),
    P(trader, { name: 'Wheat', nameHi: 'गेहूँ', variety: 'Sharbati (MP)', category: 'grains', unit: 'kg', price: 46, stock: 8000, grade: 'A', gradeNote: 'Cleaned, machine-sorted, <1% foreign matter', minOrderQty: 10, tiers: [[100, 42], [500, 39]], group: [40, 10, 300, 600], description: 'Premium Sharbati wheat, ideal for soft chapatis.' }),
    P(trader, { name: 'Rice', nameHi: 'चावल', variety: 'Indrayani', category: 'grains', unit: 'kg', price: 68, stock: 5000, grade: 'A', minOrderQty: 5, tiers: [[100, 62]], description: 'Aromatic short-grain rice from Maval.' }),
    P(trader, { name: 'Toor Dal', nameHi: 'तूर दाल', variety: 'Unpolished', category: 'pulses', unit: 'kg', price: 155, stock: 1200, grade: 'A', minOrderQty: 5, tiers: [[50, 145]] }),
    P(trader, { name: 'Jowar', nameHi: 'ज्वार', variety: 'Maldandi', category: 'grains', unit: 'quintal', price: 4200, stock: 40, grade: 'A', minOrderQty: 1, audience: 'business', description: 'Bulk Maldandi jowar for retailers and mills. Sold per quintal.' }),
    P(trader, { name: 'Turmeric', nameHi: 'हल्दी', variety: 'Rajapuri (whole)', category: 'spices', unit: 'kg', price: 180, stock: 300, grade: 'A', minOrderQty: 2 }),
  ]);

  // ------------------------------------------------ farmer ↔ broker market
  const samples = generateSample(21);
  await MandiPrice.insertMany(samples, { ordered: false });

  const loc = (state, district, village) => ({ ...findLocation(state, district), village });
  const suresh = await mkUser({
    name: 'Suresh Patel', email: 'suresh@farmdirect.test', phone: '9876500021', role: 'farmer',
    supplierProfile: { displayName: 'Patel Farm, Sonkatch', village: 'Sonkatch', district: 'Dewas', state: 'Madhya Pradesh', verified: true, verifiedAt: new Date(), farmState: 'Madhya Pradesh', farmDistrict: 'Dewas' },
  });
  const mkBroker = (name, email, phone, business, state, district, verified, licence, about) => {
    const l = findLocation(state, district);
    return mkUser({ name, email, phone, role: 'broker', brokerProfile: { businessName: business, licenseNumber: licence, state, district, lat: l.lat, lng: l.lng, verified, verifiedAt: verified ? new Date() : undefined, crops: ['cauliflower', 'cabbage', 'onion', 'wheat'], about } });
  };
  const bIndore = await mkBroker('Rakesh Jain', 'broker@farmdirect.test', '9876500031', 'Jain Sabzi Traders, Indore', 'Madhya Pradesh', 'Indore', true, 'IND/APMC/F-2291', 'Supplying Indore & Bhopal mandis and hotel chains for 12 years. Own trucks.');
  const bMumbai = await mkBroker('Imran Shaikh', 'imran@farmdirect.test', '9876500032', 'Shaikh Fresh Logistics (Vashi)', 'Maharashtra', 'Nashik', true, 'VASHI/APMC/7781', 'Collects from Nashik–Ahilyanagar belt for Vashi APMC, Mumbai.');
  const bNew = await mkBroker('Vikas Rathore', 'vikas@farmdirect.test', '9876500033', 'Rathore Traders', 'Madhya Pradesh', 'Ujjain', false, undefined, 'New on FarmDirect.');

  const days = (n) => new Date(Date.now() + n * 86400000);
  await CropListing.create([
    { farmer: suresh._id, crop: 'cauliflower', variety: 'Snowball', quantityQtl: 60, expectedPricePerKg: 500, readyFrom: days(1), quality: 'White, tight curds, 700 g–1 kg each', location: loc('Madhya Pradesh', 'Dewas', 'Sonkatch'), expiresAt: days(15) },
    { farmer: suresh._id, crop: 'wheat', variety: 'Sharbati', quantityQtl: 45, readyFrom: days(5), quality: 'Cleaned, sun-dried', location: loc('Madhya Pradesh', 'Dewas', 'Sonkatch'), expiresAt: days(30) },
    { farmer: ramesh._id, crop: 'onion', variety: 'Red', quantityQtl: 80, expectedPricePerKg: 2200, readyFrom: days(2), quality: 'Cured 3 weeks, 45–60 mm', location: loc('Maharashtra', 'Pune', 'Narayangaon'), expiresAt: days(20) },
    { farmer: ramesh._id, crop: 'cauliflower', quantityQtl: 25, readyFrom: days(0), location: loc('Maharashtra', 'Pune', 'Narayangaon'), expiresAt: days(10) },
  ]);
  const [rqIndore] = await BuyRequest.create([
    { broker: bIndore._id, crop: 'cauliflower', minQtyQtl: 20, maxQtyQtl: 150, offerPricePerKg: 550, paymentTerms: 'Full cash/UPI payment at the farm when loading', quality: 'White curds, no yellowing', base: loc('Madhya Pradesh', 'Indore'), radiusKm: 150, neededBy: days(7) },
    { broker: bMumbai._id, crop: 'cauliflower', minQtyQtl: 30, maxQtyQtl: 100, offerPricePerKg: 700, paymentTerms: 'UPI at loading. Crates provided by us.', base: loc('Maharashtra', 'Nashik'), radiusKm: 250, neededBy: days(5) },
    { broker: bNew._id, crop: 'cauliflower', minQtyQtl: 10, maxQtyQtl: 80, offerPricePerKg: 200, paymentTerms: 'Payment in 7 days', base: loc('Madhya Pradesh', 'Ujjain'), radiusKm: 120, neededBy: days(4) },
    { broker: bIndore._id, crop: 'wheat', minQtyQtl: 50, maxQtyQtl: 500, offerPricePerKg: 2650, paymentTerms: 'Bank transfer same day after weighing', base: loc('Madhya Pradesh', 'Indore'), radiusKm: 200, neededBy: days(20) },
    { broker: bMumbai._id, crop: 'onion', minQtyQtl: 50, maxQtyQtl: 300, offerPricePerKg: 2100, base: loc('Maharashtra', 'Nashik'), radiusKm: 200, neededBy: days(10) },
  ]);

  // Track record: past deals confirmed by farmers (amounts in paise).
  const past = (farmer, broker, crop, qtl, perKg, extra) => ({
    farmer, broker, proposedBy: 'farmer', crop, quantityQtl: qtl, pricePerKg: perKg, pickupDate: days(-20), weighedQtl: qtl,
    amountReceived: qtl * 100 * perKg, paymentMode: 'upi', status: 'completed', farmerRating: 5, farmerReview: 'Truck came on time, paid on the spot.', ...extra,
  });
  await Deal.create([
    past(suresh._id, bIndore._id, 'onion', 40, 1800),
    past(ramesh._id, bIndore._id, 'cabbage', 30, 600, { farmerRating: 4, farmerReview: 'Good rate, came 2 hours late.' }),
    past(ramesh._id, bMumbai._id, 'onion', 60, 2000),
    past(suresh._id, bNew._id, 'cabbage', 20, 500, { status: 'disputed', issue: 'paid_less', issueNote: 'Agreed ₹5/kg, paid ₹3.5/kg saying quality was low', amountReceived: 20 * 100 * 350, farmerRating: 1, farmerReview: 'Cut the price at loading.' }),
  ]);

  console.log(`Seeded ${await User.countDocuments()} users and ${products.length} products.`);
  console.log(`Market: ${samples.length} SAMPLE mandi prices, ${await CropListing.countDocuments()} crop listings, ${await BuyRequest.countDocuments()} buy requests.`);
  console.log('\nDemo logins (password for all except admin: Farm@1234)');
  console.log('  customer@farmdirect.test   – household buyer, pincode 411045');
  console.log('  retailer@farmdirect.test   – business buyer, pincode 411004');
  console.log('  ramesh@farmdirect.test     – verified farmer');
  console.log('  anil@farmdirect.test       – unverified farmer');
  console.log('  trader@farmdirect.test     – grain trader');
  console.log('  suresh@farmdirect.test     – farmer in Dewas (MP) with 60 qtl cauliflower');
  console.log('  broker@farmdirect.test     – verified broker, Indore (MP)');
  console.log('  imran@farmdirect.test      – verified broker, Nashik → Vashi (MH)');
  console.log('  vikas@farmdirect.test      – unverified broker (bad track record)');
  console.log('  admin@farmdirect.test      – admin (password Admin@12345 unless SEED_ADMIN_PASSWORD set)');
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
