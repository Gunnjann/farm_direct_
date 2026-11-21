const crypto = require('crypto');
const env = require('../config/env');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { TRANSITIONS } = require('../models/Order');
const { reserveStock, releaseStock } = require('./stock');
const { quoteDelivery } = require('./delivery');
const { createGatewayOrder, refundOrder } = require('./payments');
const { notify } = require('./notify');
const { percentOf } = require('../utils/money');
const { badRequest, conflict, forbidden, notFound, AppError } = require('../utils/errors');

const rand = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();

function newOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `FD-${ymd}-${rand(3)}`;
}

function checkoutIdFor(buyerId, idempotencyKey) {
  if (!idempotencyKey) return `co_${rand(10).toLowerCase()}`;
  const h = crypto.createHash('sha256').update(`${buyerId}:${idempotencyKey}`).digest('hex').slice(0, 24);
  return `co_${h}`;
}

function paymentView(payment) {
  return {
    checkoutId: payment.checkoutId,
    provider: payment.provider,
    providerOrderId: payment.providerOrderId,
    amount: payment.amount,
    currency: payment.currency,
    keyId: payment.provider === 'razorpay' ? env.razorpay.keyId : undefined,
    status: payment.status,
  };
}

/**
 * Builds a priced cart WITHOUT side effects. Used for the checkout preview
 * (so the buyer sees every rupee before paying) and again inside createCheckout.
 * Prices always come from the database — the client never sends prices.
 */
async function priceCart(buyer, { items, fulfilment, pincode }) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest('Your cart is empty');

  // Merge duplicate lines for the same product.
  const qtyById = new Map();
  for (const it of items) qtyById.set(String(it.productId), (qtyById.get(String(it.productId)) || 0) + it.qty);

  const products = await Product.find({ _id: { $in: [...qtyById.keys()] } });
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const problems = [];

  const groups = new Map(); // supplierId -> { lines, subtotal }
  for (const [pid, qty] of qtyById) {
    const p = byId.get(pid);
    if (!p || !p.isActive) {
      problems.push({ productId: pid, message: 'This product is no longer available' });
      continue;
    }
    if (p.audience === 'business' && buyer.role !== 'retailer') {
      problems.push({ productId: pid, message: `${p.name} is sold to business buyers only` });
      continue;
    }
    if (qty < p.minOrderQty) {
      problems.push({ productId: pid, message: `Minimum order for ${p.name} is ${p.minOrderQty} ${p.unit}` });
      continue;
    }
    if (qty > p.stock) {
      problems.push({ productId: pid, message: `Only ${p.stock} ${p.unit} of ${p.name} left` });
      continue;
    }
    const unitPrice = p.unitPriceFor(qty);
    const key = String(p.supplier);
    if (!groups.has(key)) groups.set(key, { lines: [], subtotal: 0 });
    const g = groups.get(key);
    g.lines.push({
      product: p._id,
      name: p.variety ? `${p.name} (${p.variety})` : p.name,
      unit: p.unit,
      image: p.images[0],
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
    });
    g.subtotal += unitPrice * qty;
  }

  const suppliers = await User.find({ _id: { $in: [...groups.keys()] }, isActive: true });
  const supplierById = new Map(suppliers.map((s) => [String(s._id), s]));

  const orders = [];
  for (const [sid, g] of groups) {
    const s = supplierById.get(sid);
    if (!s) {
      problems.push({ supplierId: sid, message: 'This seller is not accepting orders right now' });
      continue;
    }
    const quote = quoteDelivery(s, { pincode, subtotal: g.subtotal, fulfilment });
    if (!quote.ok) {
      problems.push({ supplierId: sid, message: quote.reason, code: quote.code });
      continue;
    }
    const platformFee = percentOf(g.subtotal, env.platformFeePercent);
    orders.push({
      supplier: s._id,
      supplierName: s.supplierProfile?.displayName || s.name,
      items: g.lines,
      subtotal: g.subtotal,
      deliveryFee: quote.fee,
      freeDeliveryApplied: !!quote.freeApplied,
      platformFee,
      total: g.subtotal + quote.fee + platformFee,
      etaDays: quote.etaDays,
      pickupAddress: quote.pickupAddress,
    });
  }

  const totals = orders.reduce(
    (t, o) => ({
      subtotal: t.subtotal + o.subtotal,
      deliveryFee: t.deliveryFee + o.deliveryFee,
      platformFee: t.platformFee + o.platformFee,
      total: t.total + o.total,
    }),
    { subtotal: 0, deliveryFee: 0, platformFee: 0, total: 0 }
  );

  return { orders, totals, problems, platformFeePercent: env.platformFeePercent };
}

async function createCheckout(buyer, { items, fulfilment, address, note }, idempotencyKey) {
  const checkoutId = checkoutIdFor(buyer._id, idempotencyKey);
  const existing = await Payment.findOne({ checkoutId, buyer: buyer._id });
  if (existing) {
    const orders = await Order.find({ _id: { $in: existing.orders } });
    return { payment: paymentView(existing), orders, replayed: true };
  }

  const pincode = address?.pincode || null;
  if (fulfilment === 'delivery' && !address) throw badRequest('Delivery address is required');

  const priced = await priceCart(buyer, { items, fulfilment, pincode });
  if (priced.problems.length) {
    throw new AppError(400, priced.problems[0].message, 'CART_PROBLEMS', priced.problems);
  }

  // ---- Reserve stock (all or nothing) ----
  const reserved = [];
  try {
    for (const o of priced.orders) {
      for (const line of o.items) {
        const ok = await reserveStock(line.product, line.qty);
        if (!ok) throw conflict(`${line.name} just sold out or has less stock now. Please update your cart.`, 'OUT_OF_STOCK');
        reserved.push(line);
      }
    }
  } catch (err) {
    await Promise.all(reserved.map((l) => releaseStock(l.product, l.qty)));
    throw err;
  }

  const expiresAt = new Date(Date.now() + env.paymentWindowMinutes * 60 * 1000);
  let created = [];
  try {
    created = await Order.insertMany(
      priced.orders.map((o) => ({
        orderNumber: newOrderNumber(),
        checkoutId,
        buyer: buyer._id,
        supplier: o.supplier,
        items: o.items,
        fulfilment,
        deliveryAddress: fulfilment === 'delivery' ? address : undefined,
        pickupAddress: o.pickupAddress,
        etaDays: o.etaDays,
        subtotal: o.subtotal,
        deliveryFee: o.deliveryFee,
        platformFee: o.platformFee,
        total: o.total,
        status: 'pending_payment',
        statusHistory: [{ status: 'pending_payment', by: buyer._id }],
        expiresAt,
        note,
      }))
    );
    const gw = await createGatewayOrder({ amount: priced.totals.total, checkoutId });
    const payment = await Payment.create({
      checkoutId,
      buyer: buyer._id,
      orders: created.map((o) => o._id),
      amount: priced.totals.total,
      ...gw,
    });
    await Order.updateMany({ _id: { $in: payment.orders } }, { $set: { payment: payment._id } });
    created.forEach((o) => (o.payment = payment._id));
    return { payment: paymentView(payment), orders: created, replayed: false };
  } catch (err) {
    // Compensate: give stock back, remove half-created orders.
    await Promise.all(reserved.map((l) => releaseStock(l.product, l.qty)));
    if (created.length) await Order.deleteMany({ _id: { $in: created.map((o) => o._id) } });
    if (err && err.code === 11000 && idempotencyKey) {
      // A concurrent request with the same idempotency key won the race — return its result.
      const winner = await Payment.findOne({ checkoutId });
      if (winner) {
        const orders = await Order.find({ _id: { $in: winner.orders } });
        return { payment: paymentView(winner), orders, replayed: true };
      }
    }
    throw err;
  }
}

/** Give stock back exactly once for an order (flag flip is atomic). */
async function releaseOrderStock(orderId, { wasSold = false } = {}) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, stockReleased: false },
    { $set: { stockReleased: true } },
    { new: true }
  );
  if (!order) return;
  await Promise.all(order.items.map((i) => releaseStock(i.product, i.qty)));
  if (wasSold) {
    await Promise.all(order.items.map((i) => Product.updateOne({ _id: i.product, soldQty: { $gte: i.qty } }, { $inc: { soldQty: -i.qty } })));
  }
}

/** Called once per successful payment (see payments.applySuccessfulPayment). */
async function onOrdersPaid(payment) {
  const groups = require('./groups');
  const orders = await Order.find({ _id: { $in: payment.orders } });
  for (const order of orders) {
    if (order.type === 'group') {
      await groups.onMemberPaid(order, payment);
      continue;
    }
    let placed = await Order.findOneAndUpdate(
      { _id: order._id, status: 'pending_payment' },
      {
        $set: { status: 'placed', paymentStatus: 'paid' },
        $unset: { expiresAt: 1 },
        $push: { statusHistory: { status: 'placed', note: 'Payment received' } },
      },
      { new: true }
    );

    if (!placed && order.status === 'expired') {
      // Payment arrived after the hold expired. Try to grab the stock again.
      const got = [];
      for (const i of order.items) {
        if (await reserveStock(i.product, i.qty)) got.push(i);
        else break;
      }
      if (got.length === order.items.length) {
        placed = await Order.findOneAndUpdate(
          { _id: order._id, status: 'expired' },
          {
            $set: { status: 'placed', paymentStatus: 'paid', stockReleased: false },
            $push: { statusHistory: { status: 'placed', note: 'Late payment accepted' } },
          },
          { new: true }
        );
      } else {
        await Promise.all(got.map((i) => releaseStock(i.product, i.qty)));
        await Order.updateOne(
          { _id: order._id },
          {
            $set: { status: 'cancelled', paymentStatus: 'paid', stockReleased: true },
            $push: { statusHistory: { status: 'cancelled', note: 'Stock sold out before payment completed' } },
          }
        );
        await refundOrder(order._id, undefined, 'Stock sold out before payment completed');
        continue;
      }
    }

    if (placed) {
      await Promise.all(placed.items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { soldQty: i.qty } })));
      await notify(placed.supplier, 'order_new', `New order ${placed.orderNumber}`, `₹${placed.subtotal / 100} · ${placed.items.length} item(s). Please accept or reject.`, `/seller/orders/${placed._id}`);
      await notify(placed.buyer, 'order_placed', `Order ${placed.orderNumber} placed`, 'Waiting for the seller to accept.', `/orders/${placed._id}`);
    }
  }
}

/** Expire unpaid orders and release their stock. Runs from the background sweeper. */
async function expireStaleOrders(now = new Date()) {
  const groups = require('./groups');
  const stale = await Order.find({ status: 'pending_payment', expiresAt: { $lte: now } }).limit(500);
  let count = 0;
  for (const o of stale) {
    const updated = await Order.findOneAndUpdate(
      { _id: o._id, status: 'pending_payment' },
      { $set: { status: 'expired' }, $push: { statusHistory: { status: 'expired', note: 'Payment not completed in time' } } },
      { new: true }
    );
    if (!updated) continue;
    count++;
    if (updated.type === 'group') await groups.releaseMemberForOrder(updated, 'expired');
    else await releaseOrderStock(updated._id);
  }
  if (count) await Payment.updateMany({ status: 'created', createdAt: { $lte: new Date(now - env.paymentWindowMinutes * 60000) } }, { $set: { status: 'expired' } });
  return count;
}

function actorFor(order, user) {
  if (user.role === 'admin') return 'admin';
  if (String(order.supplier) === String(user._id)) return 'supplier';
  if (String(order.buyer) === String(user._id)) return 'buyer';
  return null;
}

async function getOrderFor(user, orderId) {
  const order = await Order.findById(orderId)
    .populate('supplier', 'name supplierProfile.displayName supplierProfile.verified phone')
    .populate('buyer', 'name phone businessProfile.businessName');
  if (!order) throw notFound('Order not found');
  const plain = { ...order.toObject(), supplier: order.supplier?._id, buyer: order.buyer?._id };
  if (!actorFor(plain, user)) throw notFound('Order not found'); // don't reveal it exists
  return order;
}

async function transitionOrder(user, orderId, to, note) {
  const order = await Order.findById(orderId);
  if (!order) throw notFound('Order not found');
  const actor = actorFor(order, user);
  if (!actor) throw notFound('Order not found');

  const allowed = TRANSITIONS[order.status]?.[to];
  if (!allowed) throw conflict(`Cannot change an order from "${order.status}" to "${to}"`, 'BAD_TRANSITION');
  if (!allowed.includes(actor)) throw forbidden(`Only the ${allowed.join(' or ')} can do this`);
  if (to === 'out_for_delivery' && order.fulfilment !== 'delivery') throw badRequest('This is a pickup order');
  if (to === 'ready_for_pickup' && order.fulfilment !== 'pickup') throw badRequest('This is a delivery order');
  if ((to === 'rejected' || to === 'cancelled') && !note) throw badRequest('Please give a reason');

  const set = { status: to };
  if (to === 'delivered') set.deliveredAt = new Date();
  // Precondition on the current status => two racing clicks can't both apply.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { statusHistory: { status: to, by: user._id, note } } },
    { new: true }
  );
  if (!updated) throw conflict('This order was just updated by someone else. Please refresh.', 'STALE');

  if (to === 'rejected' || to === 'cancelled') {
    await releaseOrderStock(updated._id, { wasSold: true });
    await refundOrder(updated._id, undefined, `Order ${to}: ${note}`);
  }

  const labels = {
    accepted: 'accepted by the seller',
    rejected: 'rejected by the seller',
    packed: 'packed',
    out_for_delivery: 'out for delivery',
    ready_for_pickup: 'ready for pickup',
    delivered: 'delivered',
    cancelled: 'cancelled',
  };
  const target = actor === 'buyer' ? updated.supplier : updated.buyer;
  await notify(target, `order_${to}`, `Order ${updated.orderNumber} ${labels[to] || to}`, note, actor === 'buyer' ? `/seller/orders/${updated._id}` : `/orders/${updated._id}`);
  return updated;
}

module.exports = {
  priceCart,
  createCheckout,
  onOrdersPaid,
  expireStaleOrders,
  releaseOrderStock,
  transitionOrder,
  getOrderFor,
  paymentView,
  newOrderNumber,
  actorFor,
};
