/**
 * Integration tests against a REAL MongoDB (no mocks for the database), because
 * the bugs that matter here — overselling, double joins, duplicate payments —
 * only show up with real concurrent writes.
 *
 * Run:  MONGODB_URI_TEST=mongodb://127.0.0.1:27017/farmdirect_test npm test
 */
process.env.NODE_ENV = 'test';
process.env.PAYMENT_MODE = 'mock';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-123';
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/farmdirect_test';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const GroupOrder = require('../src/models/GroupOrder');
const Payment = require('../src/models/Payment');
const { expireStaleOrders } = require('../src/services/orders');
const { closeDueGroups } = require('../src/services/groups');
const { verifyCheckoutSignature, verifyWebhookSignature } = require('../src/services/payments');

let app;
const api = () => request(app);
const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function register(role, extra = {}) {
  const email = `${role}-${crypto.randomBytes(4).toString('hex')}@t.test`;
  const res = await api().post('/api/auth/register').send({ name: `${role} user`, email, password: 'Passw0rd!', role, ...extra });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { token: res.body.token, user: res.body.user };
}

async function makeFarmer(pins = ['411045']) {
  const f = await register('farmer');
  await api()
    .patch('/api/seller/settings')
    .set(auth(f.token))
    .send({ serviceAreas: pins.map((p) => ({ pincode: p, deliveryFee: 40, etaDays: 1 })), minOrderValue: 0, freeDeliveryAbove: 1000, pickupAvailable: true, pickupAddress: 'Farm gate' })
    .expect(200);
  return f;
}

async function makeProduct(farmer, over = {}) {
  const res = await api()
    .post('/api/products')
    .set(auth(farmer.token))
    .send({ name: 'Tomato', category: 'vegetables', unit: 'kg', pricePerUnit: 30, stock: 100, minOrderQty: 1, ...over });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.product;
}

const ADDRESS = { name: 'Priya', phone: '9876543210', line1: 'Flat 1, Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045' };

async function checkout(buyer, items, extra = {}) {
  return api().post('/api/checkout').set(auth(buyer.token)).send({ items, fulfilment: 'delivery', address: ADDRESS, ...extra });
}
async function pay(buyer, providerOrderId) {
  return api().post('/api/checkout/mock/complete').set(auth(buyer.token)).send({ providerOrderId, outcome: 'success' });
}

before(async () => {
  await connectDB(process.env.MONGODB_URI);
  await mongoose.connection.db.dropDatabase();
  await connectDB(process.env.MONGODB_URI); // recreate indexes after drop
  app = createApp();
});
after(async () => {
  await mongoose.disconnect();
});

// ------------------------------------------------------------------ AUTH
test('cannot self-register as admin; cannot self-verify', async () => {
  const r = await api().post('/api/auth/register').send({ name: 'Evil', email: 'evil@t.test', password: 'Passw0rd!', role: 'admin' });
  assert.equal(r.status, 400);

  const f = await register('farmer', { verified: true, supplierProfile: { verified: true } });
  assert.equal(f.user.supplierProfile.verified, false);
  const s = await api().patch('/api/seller/settings').set(auth(f.token)).send({ verified: true, displayName: 'X' });
  assert.equal(s.status, 200);
  assert.equal(s.body.user.supplierProfile.verified, false);
});

test('login: same error for unknown email and wrong password; NoSQL injection blocked', async () => {
  const c = await register('customer');
  const a = await api().post('/api/auth/login').send({ email: c.user.email, password: 'wrong' });
  const b = await api().post('/api/auth/login').send({ email: 'nobody@t.test', password: 'wrong' });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.error.message, b.body.error.message);
  const inj = await api().post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
  assert.equal(inj.status, 400);
});

test('logout-all revokes old tokens', async () => {
  const c = await register('customer');
  await api().post('/api/auth/logout-all').set(auth(c.token)).expect(200);
  await api().get('/api/auth/me').set(auth(c.token)).expect(401);
});

// ------------------------------------------------------------------ ROLES
test('role separation: buyers cannot list products; suppliers cannot touch others\' products or buy', async () => {
  const c = await register('customer');
  await api().post('/api/products').set(auth(c.token)).send({ name: 'X', category: 'vegetables', unit: 'kg', pricePerUnit: 1, stock: 1 }).expect(403);

  const f1 = await makeFarmer();
  const f2 = await makeFarmer();
  const p = await makeProduct(f1);
  await api().patch(`/api/products/${p._id}`).set(auth(f2.token)).send({ pricePerUnit: 1 }).expect(404);
  await api().delete(`/api/products/${p._id}`).set(auth(f2.token)).expect(404);
  await api().post('/api/checkout').set(auth(f2.token)).send({ items: [{ productId: p._id, qty: 1 }], fulfilment: 'pickup' }).expect(403);
  await api().get('/api/admin/stats').set(auth(f1.token)).expect(403);
});

test('a buyer cannot read another buyer\'s order', async () => {
  const f = await makeFarmer();
  const p = await makeProduct(f);
  const a = await register('customer');
  const b = await register('customer');
  const r = await checkout(a, [{ productId: p._id, qty: 2 }]);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  await api().get(`/api/orders/${r.body.orders[0]._id}`).set(auth(b.token)).expect(404);
  await api().get(`/api/orders/${r.body.orders[0]._id}`).set(auth(a.token)).expect(200);
});

// ------------------------------------------------------------------ PRICING & DELIVERY
test('server computes prices (client price ignored), bulk tier, delivery fee, platform fee', async () => {
  const f = await makeFarmer();
  const p = await makeProduct(f, { pricePerUnit: 30, bulkTiers: [{ minQty: 10, pricePerUnit: 25 }] });
  const c = await register('customer');
  const q = await api().post('/api/checkout/quote').set(auth(c.token)).send({ items: [{ productId: p._id, qty: 4, price: 1 }], fulfilment: 'delivery', pincode: '411045' });
  assert.equal(q.status, 200);
  const o = q.body.orders[0];
  assert.equal(o.subtotal, 4 * 3000);
  assert.equal(o.deliveryFee, 4000);
  assert.equal(o.platformFee, Math.round(12000 * 0.02));
  assert.equal(o.total, 12000 + 4000 + 240);

  const bulk = await api().post('/api/checkout/quote').set(auth(c.token)).send({ items: [{ productId: p._id, qty: 40 }], fulfilment: 'delivery', pincode: '411045' });
  assert.equal(bulk.body.orders[0].subtotal, 40 * 2500);
  assert.equal(bulk.body.orders[0].deliveryFee, 0, 'free delivery above ₹1000');
});

test('unserviceable pincode is rejected — no false delivery promise', async () => {
  const f = await makeFarmer(['411045']);
  const p = await makeProduct(f);
  const c = await register('customer');
  const r = await checkout(c, [{ productId: p._id, qty: 2 }], { address: { ...ADDRESS, pincode: '110001' } });
  assert.equal(r.status, 400);
  assert.match(r.body.error.message, /does not deliver/);
  const list = await api().get('/api/products?pincode=110001');
  assert.ok(!list.body.items.some((x) => x._id === p._id));
});

// ------------------------------------------------------------------ STOCK
test('concurrent checkouts never oversell the last units', async () => {
  const f = await makeFarmer();
  const p = await makeProduct(f, { stock: 5 });
  const buyers = await Promise.all(Array.from({ length: 10 }, () => register('customer')));
  const results = await Promise.all(buyers.map((b) => checkout(b, [{ productId: p._id, qty: 2 }])));
  const ok = results.filter((r) => r.status === 201).length;
  assert.equal(ok, 2, 'only 2 × 2 kg fit into 5 kg');
  const fresh = await Product.findById(p._id);
  assert.equal(fresh.stock, 1);
});

test('unpaid checkout expires and releases stock', async () => {
  const f = await makeFarmer();
  const p = await makeProduct(f, { stock: 10 });
  const c = await register('customer');
  const r = await checkout(c, [{ productId: p._id, qty: 4 }]);
  assert.equal((await Product.findById(p._id)).stock, 6);
  await Order.updateOne({ _id: r.body.orders[0]._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await expireStaleOrders();
  assert.equal((await Product.findById(p._id)).stock, 10);
  assert.equal((await Order.findById(r.body.orders[0]._id)).status, 'expired');
});

test('Idempotency-Key: retrying a checkout does not create a second order', async () => {
  const f = await makeFarmer();
  const p = await makeProduct(f, { stock: 50 });
  const c = await register('customer');
  const send = () => api().post('/api/checkout').set(auth(c.token)).set('Idempotency-Key', 'retry-key-123456').send({ items: [{ productId: p._id, qty: 3 }], fulfilment: 'delivery', address: ADDRESS });
  const [a, b] = await Promise.all([send(), send()]);
  assert.ok([a.status, b.status].includes(201));
  assert.equal(a.body.payment.checkoutId, b.body.payment.checkoutId);
  assert.equal(await Order.countDocuments({ buyer: c.user._id }), 1);
  assert.equal((await Product.findById(p._id)).stock, 47);
});

// ------------------------------------------------------------------ PAYMENTS
test('payment is applied exactly once (browser + webhook + retries)', async () => {
  const f = await makeFarmer();
  const p = await makeProduct(f);
  const c = await register('customer');
  const r = await checkout(c, [{ productId: p._id, qty: 2 }]);
  const oid = r.body.payment.providerOrderId;
  const results = await Promise.all([pay(c, oid), pay(c, oid), pay(c, oid)]);
  assert.ok(results.every((x) => x.status === 200));
  assert.equal(results.filter((x) => x.body.alreadyProcessed === false).length, 1);
  const order = await Order.findById(r.body.orders[0]._id);
  assert.equal(order.status, 'placed');
  assert.equal(order.paymentStatus, 'paid');
  assert.equal((await Product.findById(p._id)).soldQty, 2);
});

test('another buyer cannot complete my payment', async () => {
  const f = await makeFarmer();
  const p = await makeProduct(f);
  const a = await register('customer');
  const b = await register('customer');
  const r = await checkout(a, [{ productId: p._id, qty: 2 }]);
  const res = await pay(b, r.body.payment.providerOrderId);
  assert.equal(res.status, 403);
});

test('Razorpay signature checks reject tampering', () => {
  const secret = 'rzp_secret';
  const sig = crypto.createHmac('sha256', secret).update('order_1|pay_1').digest('hex');
  assert.equal(verifyCheckoutSignature('order_1', 'pay_1', sig, secret), true);
  assert.equal(verifyCheckoutSignature('order_1', 'pay_2', sig, secret), false);
  assert.equal(verifyCheckoutSignature('order_1', 'pay_1', 'deadbeef', secret), false);
  const body = Buffer.from('{"event":"payment.captured"}');
  const wsig = crypto.createHmac('sha256', 'wh').update(body).digest('hex');
  assert.equal(verifyWebhookSignature(body, wsig, 'wh'), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"x"}'), wsig, 'wh'), false);
});

test('webhook rejects unsigned requests', async () => {
  await api().post('/api/payments/webhook').set('Content-Type', 'application/json').send('{"event":"payment.captured"}').expect(400);
});

// ------------------------------------------------------------------ ORDER LIFECYCLE
test('order status machine: roles, invalid jumps, double clicks, rejection refunds + restocks', async () => {
  const f = await makeFarmer();
  const p = await makeProduct(f, { stock: 20 });
  const c = await register('customer');
  const r = await checkout(c, [{ productId: p._id, qty: 5 }]);
  await pay(c, r.body.payment.providerOrderId);
  const id = r.body.orders[0]._id;

  await api().post(`/api/orders/${id}/status`).set(auth(c.token)).send({ to: 'accepted' }).expect(403);
  await api().post(`/api/orders/${id}/status`).set(auth(f.token)).send({ to: 'delivered' }).expect(409);

  const [x, y] = await Promise.all([
    api().post(`/api/orders/${id}/status`).set(auth(f.token)).send({ to: 'accepted' }),
    api().post(`/api/orders/${id}/status`).set(auth(f.token)).send({ to: 'accepted' }),
  ]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409]);

  // Second order gets rejected → refund + stock back
  const r2 = await checkout(c, [{ productId: p._id, qty: 5 }]);
  await pay(c, r2.body.payment.providerOrderId);
  assert.equal((await Product.findById(p._id)).stock, 10);
  await api().post(`/api/orders/${r2.body.orders[0]._id}/status`).set(auth(f.token)).send({ to: 'rejected' }).expect(400); // reason required
  await api().post(`/api/orders/${r2.body.orders[0]._id}/status`).set(auth(f.token)).send({ to: 'rejected', note: 'Rain damaged the crop' }).expect(200);
  const o2 = await Order.findById(r2.body.orders[0]._id);
  assert.equal(o2.paymentStatus, 'refunded');
  assert.equal((await Product.findById(p._id)).stock, 15);
});

test('reviews only after delivery, once per product per order', async () => {
  const f = await makeFarmer();
  const p = await makeProduct(f);
  const c = await register('customer');
  const r = await checkout(c, [{ productId: p._id, qty: 2 }]);
  await pay(c, r.body.payment.providerOrderId);
  const id = r.body.orders[0]._id;
  const body = { orderId: id, productId: p._id, rating: 5, comment: 'Fresh' };
  await api().post('/api/reviews').set(auth(c.token)).send(body).expect(400);
  for (const to of ['accepted', 'packed', 'out_for_delivery', 'delivered']) {
    await api().post(`/api/orders/${id}/status`).set(auth(f.token)).send({ to }).expect(200);
  }
  await api().post('/api/reviews').set(auth(c.token)).send(body).expect(201);
  await api().post('/api/reviews').set(auth(c.token)).send(body).expect(409);
  assert.equal((await Product.findById(p._id)).ratingAvg, 5);
});

// ------------------------------------------------------------------ GROUP ORDERS
async function groupProduct(f, over = {}) {
  return makeProduct(f, { stock: 1000, pricePerUnit: 40, groupBuy: { enabled: true, pricePerUnit: 30, minMemberQty: 5, targetQty: 20, maxQty: 50 }, ...over });
}
const DROP = { label: 'Green Park gate', line1: 'Baner Road', city: 'Pune', state: 'Maharashtra', pincode: '411045' };

test('group: creating reserves capacity; owner joins automatically', async () => {
  const f = await makeFarmer();
  const p = await groupProduct(f);
  const owner = await register('customer');
  const r = await api().post('/api/groups').set(auth(owner.token)).send({ productId: p._id, qty: 10, deadlineHours: 24, dropPoint: DROP });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.group.joinedQty, 10);
  assert.equal(r.body.group.maxQty, 50);
  assert.equal(r.body.checkout.orders[0].subtotal, 10 * 3000, 'group price applied');
  assert.equal((await Product.findById(p._id)).stock, 950);
});

test('CRITICAL: 40 simultaneous joins never exceed group maximum; full group rejects joins', async () => {
  const f = await makeFarmer();
  const p = await groupProduct(f);
  const owner = await register('customer');
  const g = (await api().post('/api/groups').set(auth(owner.token)).send({ productId: p._id, qty: 5, deadlineHours: 24, dropPoint: DROP })).body.group;

  const buyers = await Promise.all(Array.from({ length: 40 }, () => register('customer')));
  const results = await Promise.all(buyers.map((b) => api().post(`/api/groups/${g._id}/join`).set(auth(b.token)).send({ qty: 5 })));
  const ok = results.filter((r) => r.status === 201).length;
  assert.equal(ok, 9, '45 kg free / 5 kg each = 9 joins');
  assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409));

  const fresh = await GroupOrder.findById(g._id);
  assert.equal(fresh.joinedQty, 50);
  assert.equal(fresh.status, 'full');
  const active = fresh.members.filter((m) => ['reserved', 'paid'].includes(m.status));
  assert.equal(active.reduce((s, m) => s + m.qty, 0), 50, 'joinedQty matches member sum');

  const late = await register('customer');
  const lr = await api().post(`/api/groups/${g._id}/join`).set(auth(late.token)).send({ qty: 5 });
  assert.equal(lr.status, 409);
  assert.equal(lr.body.error.code, 'GROUP_FULL');
});

test('group: same user cannot join twice, even concurrently', async () => {
  const f = await makeFarmer();
  const p = await groupProduct(f);
  const owner = await register('customer');
  const g = (await api().post('/api/groups').set(auth(owner.token)).send({ productId: p._id, qty: 5, deadlineHours: 24, dropPoint: DROP })).body.group;
  const u = await register('customer');
  const rs = await Promise.all(Array.from({ length: 5 }, () => api().post(`/api/groups/${g._id}/join`).set(auth(u.token)).send({ qty: 5 })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
});

test('group: closed after deadline — joins rejected; success confirms & returns unused stock', async () => {
  const f = await makeFarmer();
  const p = await groupProduct(f);
  const owner = await register('customer');
  const cr = await api().post('/api/groups').set(auth(owner.token)).send({ productId: p._id, qty: 10, deadlineHours: 24, dropPoint: DROP });
  const g = cr.body.group;
  await pay(owner, cr.body.checkout.payment.providerOrderId);
  const m2 = await register('customer');
  const j2 = await api().post(`/api/groups/${g._id}/join`).set(auth(m2.token)).send({ qty: 10 });
  await pay(m2, j2.body.checkout.payment.providerOrderId);
  const m3 = await register('customer'); // joins but never pays
  await api().post(`/api/groups/${g._id}/join`).set(auth(m3.token)).send({ qty: 5 }).expect(201);

  await GroupOrder.updateOne({ _id: g._id }, { $set: { deadline: new Date(Date.now() - 1000) } });
  const late = await register('customer');
  const lr = await api().post(`/api/groups/${g._id}/join`).set(auth(late.token)).send({ qty: 5 });
  assert.equal(lr.status, 409);
  assert.equal(lr.body.error.code, 'GROUP_CLOSED');

  await closeDueGroups();
  const closed = await GroupOrder.findById(g._id);
  assert.equal(closed.status, 'confirmed');
  assert.equal(closed.paidQty, 20);
  assert.equal(closed.joinedQty, 20, 'unpaid member dropped');
  assert.equal((await Product.findById(p._id)).stock, 980, 'only paid 20 kg leave stock');
  const orders = await Order.find({ groupOrder: g._id }).sort({ createdAt: 1 });
  assert.deepEqual(orders.map((o) => o.status), ['placed', 'placed', 'expired']);
});

test('group: missing target by deadline → failed, everyone refunded, all stock back', async () => {
  const f = await makeFarmer();
  const p = await groupProduct(f);
  const owner = await register('customer');
  const cr = await api().post('/api/groups').set(auth(owner.token)).send({ productId: p._id, qty: 5, deadlineHours: 24, dropPoint: DROP });
  await pay(owner, cr.body.checkout.payment.providerOrderId);
  await GroupOrder.updateOne({ _id: cr.body.group._id }, { $set: { deadline: new Date(Date.now() - 1000) } });
  await closeDueGroups();
  await closeDueGroups(); // running twice must be harmless
  const g = await GroupOrder.findById(cr.body.group._id);
  assert.equal(g.status, 'failed');
  const o = await Order.findOne({ groupOrder: g._id });
  assert.equal(o.status, 'cancelled');
  assert.equal(o.paymentStatus, 'refunded');
  assert.equal((await Product.findById(p._id)).stock, 1000);
  const pay1 = await Payment.findById(o.payment);
  assert.equal(pay1.refunds.length, 1, 'refunded exactly once');
});

test('group: leaving a full group reopens it', async () => {
  const f = await makeFarmer();
  const p = await groupProduct(f, { groupBuy: { enabled: true, pricePerUnit: 30, minMemberQty: 5, targetQty: 10, maxQty: 10 } });
  const owner = await register('customer');
  const g = (await api().post('/api/groups').set(auth(owner.token)).send({ productId: p._id, qty: 5, deadlineHours: 24, dropPoint: DROP })).body.group;
  const m = await register('customer');
  await api().post(`/api/groups/${g._id}/join`).set(auth(m.token)).send({ qty: 5 }).expect(201);
  assert.equal((await GroupOrder.findById(g._id)).status, 'full');
  await api().post(`/api/groups/${g._id}/leave`).set(auth(m.token)).expect(200);
  const fresh = await GroupOrder.findById(g._id);
  assert.equal(fresh.status, 'open');
  assert.equal(fresh.joinedQty, 5);
});
