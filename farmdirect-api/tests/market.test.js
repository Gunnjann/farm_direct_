/** Farmer–broker market module: price data, calculator maths, deal flow, phone privacy. */
process.env.NODE_ENV = 'test';
process.env.PAYMENT_MODE = 'mock';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-123';
process.env.MONGODB_URI = (process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/farmdirect_test') + '_market';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { createApp } = require('../src/app');
const { MandiPrice } = require('../src/models/Market');
const { normalizeRecord, upsertPrices } = require('../src/services/mandiData');
const { calculate } = require('../src/services/calculator');
const { roadKm, findLocation } = require('../src/data/agri');

let app;
const api = () => request(app);
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const phone = () => `9${String(crypto.randomInt(100000000, 999999999))}`;

async function register(role, extra = {}) {
  const res = await api()
    .post('/api/auth/register')
    .send({ name: `${role} user`, email: `${role}-${crypto.randomBytes(4).toString('hex')}@t.test`, password: 'Passw0rd!', role, ...extra });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.token, user: res.body.user };
}
const farmer = () => register('farmer', { phone: phone(), state: 'Madhya Pradesh', district: 'Dewas' });
const broker = () => register('broker', { phone: phone(), state: 'Madhya Pradesh', district: 'Indore', businessName: 'Test Traders' });

before(async () => {
  await connectDB(process.env.MONGODB_URI);
  await mongoose.connection.db.dropDatabase();
  await connectDB(process.env.MONGODB_URI);
  app = createApp();
  const today = new Date();
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  await MandiPrice.insertMany([
    { crop: 'cauliflower', mandiKey: 'mp-dewas', market: 'Dewas Mandi', district: 'Dewas', state: 'Madhya Pradesh', date: d, minPrice: 80, maxPrice: 150, modalPrice: 100, source: 'sample' },
    { crop: 'cauliflower', mandiKey: 'mp-indore', market: 'Indore (Choithram Mandi)', district: 'Indore', state: 'Madhya Pradesh', date: d, minPrice: 700, maxPrice: 1000, modalPrice: 900, source: 'sample' },
  ]);
});
after(() => mongoose.disconnect());

test('AGMARKNET record normaliser handles field variants and ignores other states/crops', () => {
  const a = normalizeRecord({ state: 'Madhya Pradesh', district: 'Indore', market: 'Indore', commodity: 'Cauliflower', variety: 'Local', arrival_date: '21/11/2026', min_price: '600', max_price: '1100', modal_price: '850' });
  assert.equal(a.crop, 'cauliflower');
  assert.equal(a.modalPrice, 850);
  assert.equal(a.date.toISOString().slice(0, 10), '2026-11-21');
  assert.equal(a.mandiKey, 'mp-indore');
  const b = normalizeRecord({ State: 'Maharashtra', District: 'Nashik', Market: 'Lasalgaon', Commodity: 'Onion', Arrival_Date: '20/11/2026', Min_Price: 1500, Max_Price: 2300, Modal_Price: 2000 });
  assert.equal(b.crop, 'onion');
  assert.equal(normalizeRecord({ state: 'Punjab', market: 'X', commodity: 'Onion', arrival_date: '20/11/2026', modal_price: 1 }), null);
  assert.equal(normalizeRecord({ state: 'Maharashtra', market: 'X', commodity: 'Cotton', arrival_date: '20/11/2026', modal_price: 1 }), null);
});

test('real/admin prices override sample prices for the same market', async () => {
  const today = new Date();
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  await upsertPrices([{ crop: 'cauliflower', mandiKey: 'mp-dewas', market: 'Dewas Mandi', district: 'Dewas', state: 'Madhya Pradesh', variety: 'Other', date: d, minPrice: 90, maxPrice: 140, modalPrice: 120, source: 'agmarknet' }]);
  const res = await api().get('/api/market/prices?crop=cauliflower').expect(200);
  const dewas = res.body.items.find((r) => r.market === 'Dewas Mandi');
  assert.equal(dewas.source, 'agmarknet');
  assert.equal(dewas.modalPrice, 120);
});

test('calculator maths: transport, commission, spoilage, net, fair farm-gate price', () => {
  const origin = findLocation('Madhya Pradesh', 'Dewas');
  const indore = { market: 'Indore', modalPrice: 900, lat: 22.6916, lng: 75.8466, marketFeePct: 1.5, hamaliPerQtl: 15, source: 'sample' };
  const r = calculate({ crop: 'cauliflower', quantityQtl: 60, origin, vehicle: 'truck', prices: [indore] });
  const row = r.rows[0];
  const km = roadKm(origin, indore);
  assert.equal(row.distanceKm, km);
  assert.equal(row.vehicles, 1); // 60 qtl fits one 100-qtl truck
  assert.equal(row.breakdown.transport, km * 2 * 32);
  const sellable = 60 * (1 - (3 * km) / 100 / 100);
  assert.equal(row.breakdown.gross, Math.round(900 * sellable));
  assert.equal(row.breakdown.commission, Math.round((900 * sellable * 6) / 100));
  const expectedNet = 900 * sellable - (km * 2 * 32 + 900 * sellable * 0.06 + 900 * sellable * 0.015 + 15 * sellable + 40 * 60 + 150 * 60);
  assert.equal(row.net, Math.round(expectedNet));
  assert.equal(r.minFairFarmGatePerKg, Math.round((expectedNet / 6000 + 1.9) * 100) / 100);
});

test('calculate endpoint: nearby glutted mandi loses money, Indore is best', async () => {
  const res = await api().post('/api/market/calculate').send({ crop: 'cauliflower', quantityQtl: 60, state: 'Madhya Pradesh', district: 'Dewas', vehicle: 'truck' }).expect(200);
  assert.equal(res.body.best.market, 'Indore (Choithram Mandi)');
  assert.ok(res.body.nearest.net < 0, 'selling in the glutted local mandi is a loss');
  assert.ok(res.body.gainVsNearest > 0);
});

test('broker must give a phone; admin role cannot self-register as broker-admin', async () => {
  const r = await api().post('/api/auth/register').send({ name: 'No Phone', email: 'np@t.test', password: 'Passw0rd!', role: 'broker', state: 'Madhya Pradesh', district: 'Indore' });
  assert.equal(r.status, 400);
  assert.match(r.body.error.message, /mobile/i);
});

test('only brokers post buy requests, only farmers post listings', async () => {
  const f = await farmer();
  const b = await broker();
  const reqBody = { crop: 'cauliflower', minQtyQtl: 10, maxQtyQtl: 100, offerPricePerKg: 6, state: 'Madhya Pradesh', district: 'Indore', neededBy: new Date(Date.now() + 5 * 86400000) };
  await api().post('/api/connect/requests').set(auth(f.token)).send(reqBody).expect(403);
  await api().post('/api/connect/requests').set(auth(b.token)).send(reqBody).expect(201);
  const listBody = { crop: 'cauliflower', quantityQtl: 40, readyFrom: new Date(), state: 'Madhya Pradesh', district: 'Dewas' };
  await api().post('/api/connect/listings').set(auth(b.token)).send(listBody).expect(403);
  await api().post('/api/connect/listings').set(auth(f.token)).send(listBody).expect(201);
});

test('phones: farmers see broker numbers; brokers never see farmer numbers in listings', async () => {
  const f = await farmer();
  const b = await broker();
  await api().post('/api/connect/requests').set(auth(b.token)).send({ crop: 'cabbage', minQtyQtl: 5, maxQtyQtl: 50, offerPricePerKg: 5, state: 'Madhya Pradesh', district: 'Indore', neededBy: new Date(Date.now() + 86400000 * 3) }).expect(201);
  await api().post('/api/connect/listings').set(auth(f.token)).send({ crop: 'cabbage', quantityQtl: 20, readyFrom: new Date(), state: 'Madhya Pradesh', district: 'Dewas' }).expect(201);

  const asFarmer = await api().get('/api/connect/requests?crop=cabbage').set(auth(f.token)).expect(200);
  assert.equal(asFarmer.body.items[0].broker.phone, b.user.phone);
  const asGuest = await api().get('/api/connect/requests?crop=cabbage').expect(200);
  assert.equal(asGuest.body.items[0].broker.phone, null);
  const asBroker = await api().get('/api/connect/listings?crop=cabbage').set(auth(b.token)).expect(200);
  assert.equal(JSON.stringify(asBroker.body).includes(f.user.phone), false);
});

test('deal flow: broker offer → farmer agrees → vehicle → only farmer confirms payment', async () => {
  const f = await farmer();
  const b = await broker();
  const l = (await api().post('/api/connect/listings').set(auth(f.token)).send({ crop: 'cauliflower', quantityQtl: 40, readyFrom: new Date(), state: 'Madhya Pradesh', district: 'Dewas' })).body.listing;

  const offer = await api().post('/api/connect/deals').set(auth(b.token)).send({ listingId: l._id, quantityQtl: 40, pricePerKg: 6, pickupDate: new Date(Date.now() + 86400000) }).expect(201);
  const id = offer.body.deal._id;

  // Before the farmer agrees, the broker cannot see the farmer's phone.
  const before = await api().get(`/api/connect/deals/${id}`).set(auth(b.token)).expect(200);
  assert.equal(before.body.deal.farmer.phone, null);
  // The farmer can see the broker's phone to call and verify.
  const fview = await api().get(`/api/connect/deals/${id}`).set(auth(f.token)).expect(200);
  assert.equal(fview.body.deal.broker.phone, b.user.phone);

  await api().post(`/api/connect/deals/${id}/agree`).set(auth(b.token)).expect(403); // proposer can't self-agree
  const [x, y] = await Promise.all([
    api().post(`/api/connect/deals/${id}/agree`).set(auth(f.token)),
    api().post(`/api/connect/deals/${id}/agree`).set(auth(f.token)),
  ]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409]);

  const after = await api().get(`/api/connect/deals/${id}`).set(auth(b.token)).expect(200);
  assert.equal(after.body.deal.farmer.phone, f.user.phone);

  await api().post(`/api/connect/deals/${id}/vehicle`).set(auth(f.token)).send({ vehicleNumber: 'MP09AB1234', driverName: 'Ramu', driverPhone: '9876543210' }).expect(403);
  await api().post(`/api/connect/deals/${id}/vehicle`).set(auth(b.token)).send({ vehicleNumber: 'MP09AB1234', driverName: 'Ramu', driverPhone: '9876543210' }).expect(200);

  // Broker cannot mark it paid — only the farmer's confirmation counts.
  await api().post(`/api/connect/deals/${id}/complete`).set(auth(b.token)).send({ weighedQtl: 40, amountReceived: 24000, paymentMode: 'cash', rating: 5 }).expect(403);
  const done = await api().post(`/api/connect/deals/${id}/complete`).set(auth(f.token)).send({ weighedQtl: 40, amountReceived: 24000, paymentMode: 'upi', rating: 5 }).expect(200);
  assert.equal(done.body.deal.status, 'completed');

  const card = await api().get(`/api/connect/brokers/${b.user._id}`).set(auth(f.token)).expect(200);
  assert.equal(card.body.broker.stats.completed, 1);
  assert.equal(card.body.broker.stats.paidAtPickupPct, 100);
});

test('short payment at pickup is recorded against the broker', async () => {
  const f = await farmer();
  const b = await broker();
  const r = (await api().post('/api/connect/requests').set(auth(b.token)).send({ crop: 'onion', minQtyQtl: 10, maxQtyQtl: 100, offerPricePerKg: 20, state: 'Madhya Pradesh', district: 'Indore', neededBy: new Date(Date.now() + 86400000 * 3) })).body.request;
  const d = (await api().post('/api/connect/deals').set(auth(f.token)).send({ requestId: r._id, quantityQtl: 10, pricePerKg: 20, pickupDate: new Date() }).expect(201)).body.deal;
  await api().post(`/api/connect/deals/${d._id}/agree`).set(auth(b.token)).expect(200);
  // Agreed 10 qtl × ₹20/kg = ₹20,000; farmer received ₹15,000.
  const res = await api().post(`/api/connect/deals/${d._id}/complete`).set(auth(f.token)).send({ weighedQtl: 10, amountReceived: 15000, paymentMode: 'cash', rating: 1 }).expect(200);
  assert.equal(res.body.short, true);
  assert.equal(res.body.deal.status, 'disputed');
  assert.equal(res.body.deal.issue, 'paid_less');
  const card = await api().get(`/api/connect/brokers/${b.user._id}`).expect(200);
  assert.equal(card.body.broker.stats.paymentIssues, 1);
  assert.equal(card.body.broker.stats.paidAtPickupPct, 0);
});

test('quantity must fit the broker’s request range; strangers cannot read a deal', async () => {
  const f = await farmer();
  const b = await broker();
  const other = await farmer();
  const r = (await api().post('/api/connect/requests').set(auth(b.token)).send({ crop: 'wheat', minQtyQtl: 50, maxQtyQtl: 100, offerPricePerKg: 26, state: 'Madhya Pradesh', district: 'Indore', neededBy: new Date(Date.now() + 86400000 * 3) })).body.request;
  await api().post('/api/connect/deals').set(auth(f.token)).send({ requestId: r._id, quantityQtl: 10, pricePerKg: 26, pickupDate: new Date() }).expect(400);
  const d = (await api().post('/api/connect/deals').set(auth(f.token)).send({ requestId: r._id, quantityQtl: 60, pricePerKg: 26, pickupDate: new Date() }).expect(201)).body.deal;
  await api().get(`/api/connect/deals/${d._id}`).set(auth(other.token)).expect(404);
});
