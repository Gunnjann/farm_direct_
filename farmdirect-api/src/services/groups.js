const crypto = require('crypto');
const env = require('../config/env');
const GroupOrder = require('../models/GroupOrder');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { reserveStock, releaseStock } = require('./stock');
const { createGatewayOrder, refundOrder } = require('./payments');
const { notify } = require('./notify');
const { percentOf } = require('../utils/money');
const { badRequest, conflict, forbidden, notFound } = require('../utils/errors');

const ACTIVE_MEMBER = ['reserved', 'paid'];

function newCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. 9F3A1C0B
}

async function createGroup(owner, { productId, qty, dropPoint, deadlineHours, title }) {
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw notFound('Product not found');
  const g = product.groupBuy || {};
  if (!g.enabled) throw badRequest('Group buying is not enabled for this product');
  if (product.audience === 'business' && owner.role !== 'retailer') throw forbidden('This product is for business buyers only');

  const supplier = await User.findById(product.supplier);
  const serves = supplier?.isActive && (supplier.supplierProfile?.serviceAreas || []).some((a) => a.pincode === dropPoint.pincode);
  if (!serves) throw badRequest(`This seller does not deliver to ${dropPoint.pincode}`);

  const already = await GroupOrder.exists({ owner: owner._id, product: product._id, status: { $in: ['open', 'full'] } });
  if (already) throw conflict('You already have an open group for this product. Share that one instead.');

  // Reserve the group's capacity from stock up front so a "full" group can always be fulfilled.
  const capacity = Math.min(g.maxQty, product.stock);
  if (capacity < g.targetQty) throw conflict(`Not enough stock for a group right now (need at least ${g.targetQty} ${product.unit})`);
  const reserved = await reserveStock(product._id, capacity);
  if (!reserved) throw conflict('Stock changed while creating the group. Please try again.');

  let group;
  try {
    group = await GroupOrder.create({
      code: newCode(),
      product: product._id,
      supplier: product.supplier,
      owner: owner._id,
      title: title || `${product.name} group · ${dropPoint.label || dropPoint.pincode}`,
      productName: product.variety ? `${product.name} (${product.variety})` : product.name,
      unit: product.unit,
      pricePerUnit: g.pricePerUnit,
      regularPrice: product.pricePerUnit,
      minMemberQty: g.minMemberQty || 1,
      targetQty: g.targetQty,
      maxQty: capacity,
      dropPoint,
      deadline: new Date(Date.now() + deadlineHours * 3600 * 1000),
      stockReserved: capacity,
    });
  } catch (err) {
    await releaseStock(product._id, capacity);
    throw err;
  }

  const joined = await joinGroup(owner, group._id, qty);
  return { group: joined.group, checkout: joined.checkout };
}

/**
 * THE critical rule: a closed or full group can never accept more people.
 *
 * Everything is checked inside ONE atomic findOneAndUpdate:
 *   status must be 'open', deadline in the future, user not already a member,
 *   and joinedQty + qty <= maxQty.
 * MongoDB applies single-document updates atomically, so if 50 people press
 * "Join" at the same moment for the last 5 kg, exactly the ones that fit succeed
 * and the rest get a 409 — no locks, no transaction needed.
 */
async function joinGroup(user, groupId, qty) {
  if (!['customer', 'retailer'].includes(user.role)) throw forbidden('Only buyers can join group orders');
  if (!Number.isInteger(qty) || qty < 1) throw badRequest('Quantity must be a whole number');

  const now = new Date();
  const group = await GroupOrder.findOneAndUpdate(
    {
      _id: groupId,
      status: 'open',
      deadline: { $gt: now },
      minMemberQty: { $lte: qty },
      members: { $not: { $elemMatch: { user: user._id, status: { $in: ACTIVE_MEMBER } } } },
      $expr: { $lte: [{ $add: ['$joinedQty', qty] }, '$maxQty'] },
    },
    {
      $inc: { joinedQty: qty },
      $push: { members: { user: user._id, name: user.name, qty, status: 'reserved' } },
    },
    { new: true }
  );

  if (!group) throw await explainJoinFailure(groupId, user, qty, now);

  // Mark full if this join filled it (conditional, so only one request flips it).
  if (group.joinedQty >= group.maxQty) {
    await GroupOrder.updateOne({ _id: group._id, status: 'open', $expr: { $gte: ['$joinedQty', '$maxQty'] } }, { $set: { status: 'full' } });
    group.status = 'full';
  }

  const member = group.members.find((m) => String(m.user) === String(user._id) && m.status === 'reserved');
  try {
    const checkout = await createMemberOrder(user, group, member);
    return { group: await GroupOrder.findById(group._id), checkout };
  } catch (err) {
    await releaseMember(group._id, member._id, 'reserved', 'left');
    throw err;
  }
}

async function explainJoinFailure(groupId, user, qty, now) {
  const g = await GroupOrder.findById(groupId);
  if (!g) return notFound('Group not found');
  if (g.status === 'full') return conflict('This group is full. No more members can join.', 'GROUP_FULL');
  if (g.status !== 'open' || g.deadline <= now) return conflict('This group is closed. No more members can join.', 'GROUP_CLOSED');
  if (g.members.some((m) => String(m.user) === String(user._id) && ACTIVE_MEMBER.includes(m.status))) {
    return conflict('You are already in this group', 'ALREADY_MEMBER');
  }
  if (qty < g.minMemberQty) return badRequest(`Minimum ${g.minMemberQty} ${g.unit} per member`);
  const left = g.maxQty - g.joinedQty;
  return conflict(left > 0 ? `Only ${left} ${g.unit} left in this group` : 'This group is full.', 'GROUP_CAPACITY');
}

async function createMemberOrder(user, group, member) {
  const { newOrderNumber, paymentView } = require('./orders');
  const subtotal = group.pricePerUnit * member.qty;
  const platformFee = percentOf(subtotal, env.platformFeePercent);
  const checkoutId = `co_${crypto.randomBytes(10).toString('hex')}`;
  const order = await Order.create({
    orderNumber: newOrderNumber(),
    checkoutId,
    buyer: user._id,
    supplier: group.supplier,
    type: 'group',
    groupOrder: group._id,
    items: [{ product: group.product, name: group.productName, unit: group.unit, qty: member.qty, unitPrice: group.pricePerUnit, lineTotal: subtotal }],
    fulfilment: 'delivery',
    deliveryAddress: { name: group.dropPoint.label, line1: group.dropPoint.line1, city: group.dropPoint.city, state: group.dropPoint.state, pincode: group.dropPoint.pincode },
    subtotal,
    deliveryFee: 0, // Group orders ship to ONE drop point; supplier's group price includes it.
    platformFee,
    total: subtotal + platformFee,
    status: 'pending_payment',
    statusHistory: [{ status: 'pending_payment', by: user._id, note: `Joined group ${group.code}` }],
    expiresAt: new Date(Math.min(Date.now() + env.paymentWindowMinutes * 60000, group.deadline.getTime())),
    stockReleased: true, // stock belongs to the group's reservation until confirmation
  });
  const gw = await createGatewayOrder({ amount: order.total, checkoutId });
  const payment = await Payment.create({ checkoutId, buyer: user._id, orders: [order._id], amount: order.total, ...gw });
  await Order.updateOne({ _id: order._id }, { $set: { payment: payment._id } });
  await GroupOrder.updateOne({ _id: group._id, 'members._id': member._id }, { $set: { 'members.$.order': order._id } });
  return { payment: paymentView(payment), orders: [order] };
}

/** Atomically remove a member's quantity from the group (only if their status is still `fromStatus`). */
async function releaseMember(groupId, memberId, fromStatus, toStatus) {
  const g = await GroupOrder.findById(groupId);
  const m = g?.members.id(memberId);
  if (!m || m.status !== fromStatus) return false;
  const res = await GroupOrder.updateOne(
    { _id: groupId, members: { $elemMatch: { _id: memberId, status: fromStatus } } },
    { $set: { 'members.$.status': toStatus }, $inc: { joinedQty: -m.qty, paidQty: fromStatus === 'paid' ? -m.qty : 0 } }
  );
  if (!res.modifiedCount) return false;
  // Space freed up before the deadline => reopen a full group.
  await GroupOrder.updateOne(
    { _id: groupId, status: 'full', deadline: { $gt: new Date() }, $expr: { $lt: ['$joinedQty', '$maxQty'] } },
    { $set: { status: 'open' } }
  );
  return true;
}

async function releaseMemberForOrder(order, toStatus) {
  const g = await GroupOrder.findById(order.groupOrder);
  const m = g?.members.find((x) => String(x.order) === String(order._id));
  if (m) await releaseMember(g._id, m._id, m.status, toStatus);
}

async function onMemberPaid(order) {
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: 'pending_payment' },
    {
      $set: { status: 'awaiting_group', paymentStatus: 'paid' },
      $unset: { expiresAt: 1 },
      $push: { statusHistory: { status: 'awaiting_group', note: 'Payment received. Waiting for group to complete.' } },
    },
    { new: true }
  );
  if (!updated) {
    // Paid after their slot expired / group closed: refund rather than oversell.
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'paid', status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', note: 'Group slot expired before payment' } } });
    await refundOrder(order._id, undefined, 'Group slot expired before payment completed');
    return;
  }
  const g = await GroupOrder.findOne({ _id: order.groupOrder });
  const m = g.members.find((x) => String(x.order) === String(order._id));
  await GroupOrder.updateOne(
    { _id: g._id, members: { $elemMatch: { _id: m._id, status: 'reserved' } } },
    { $set: { 'members.$.status': 'paid' }, $inc: { paidQty: m.qty } }
  );
  await notify(g.owner, 'group_join', `${m.name} joined your group`, `${m.qty} ${g.unit} · ${g.title}`, `/groups/${g._id}`);
  // Everyone in a full group has paid → no reason to wait for the deadline.
  const fresh = await GroupOrder.findById(g._id);
  if (fresh.status === 'full' && fresh.paidQty >= fresh.maxQty) await closeGroup(fresh._id);
}

async function leaveGroup(user, groupId) {
  const g = await GroupOrder.findById(groupId);
  if (!g) throw notFound('Group not found');
  if (!['open', 'full'].includes(g.status) || g.deadline <= new Date()) throw conflict('This group is closed; you can no longer leave it.');
  const m = g.members.find((x) => String(x.user) === String(user._id) && ACTIVE_MEMBER.includes(x.status));
  if (!m) throw notFound('You are not in this group');

  const ok = await releaseMember(g._id, m._id, m.status, 'left');
  if (!ok) throw conflict('Your membership just changed. Please refresh.');
  await Order.updateOne(
    { _id: m.order, status: { $in: ['pending_payment', 'awaiting_group'] } },
    { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', by: user._id, note: 'Left the group' } } }
  );
  if (m.status === 'paid') await refundOrder(m.order, undefined, 'Left group order');
  return GroupOrder.findById(g._id);
}

/**
 * Close a group (deadline reached, or full & fully paid).
 * - Unpaid reservations are dropped.
 * - paidQty >= targetQty → confirmed: member orders go to the supplier, unused stock returns.
 * - otherwise → failed: everyone is refunded, all stock returns.
 * The final status flip is conditional on status ∈ {open, full}, so even if two
 * server instances run this at once, only one applies the side effects.
 */
async function closeGroup(groupId) {
  let g = await GroupOrder.findById(groupId);
  if (!g || !['open', 'full'].includes(g.status)) return null;

  for (const m of g.members.filter((x) => x.status === 'reserved')) {
    const exp = await Order.findOneAndUpdate(
      { _id: m.order, status: 'pending_payment' },
      { $set: { status: 'expired' }, $push: { statusHistory: { status: 'expired', note: 'Group closed before payment' } } }
    );
    if (exp || !m.order) await releaseMember(g._id, m._id, 'reserved', 'expired');
  }

  g = await GroupOrder.findById(groupId);
  const success = g.paidQty >= g.targetQty;
  const closed = await GroupOrder.findOneAndUpdate(
    { _id: g._id, status: { $in: ['open', 'full'] } },
    { $set: { status: success ? 'confirmed' : 'failed', closedAt: new Date(), closeReason: success ? 'Target reached' : `Only ${g.paidQty}/${g.targetQty} ${g.unit} paid by deadline` } },
    { new: true }
  );
  if (!closed) return null; // another worker closed it

  const paidMembers = closed.members.filter((m) => m.status === 'paid');
  if (success) {
    await releaseStock(closed.product, closed.stockReserved - closed.paidQty);
    await GroupOrder.updateOne({ _id: closed._id }, { $set: { stockReserved: closed.paidQty } });
    await Product.updateOne({ _id: closed.product }, { $inc: { soldQty: closed.paidQty } });
    await Order.updateMany(
      { groupOrder: closed._id, status: 'awaiting_group' },
      { $set: { status: 'placed', stockReleased: false }, $push: { statusHistory: { status: 'placed', note: 'Group confirmed' } } }
    );
    await notify(closed.supplier, 'group_confirmed', `Group order confirmed: ${closed.paidQty} ${closed.unit}`, `${closed.productName} to ${closed.dropPoint.label || closed.dropPoint.pincode}. ${paidMembers.length} buyers.`, `/seller/orders`);
    for (const m of paidMembers) await notify(m.user, 'group_confirmed', 'Your group order is confirmed', `${closed.title} reached its target.`, `/orders/${m.order}`);
  } else {
    await releaseStock(closed.product, closed.stockReserved);
    await GroupOrder.updateOne({ _id: closed._id }, { $set: { stockReserved: 0 } });
    for (const m of paidMembers) {
      await Order.updateOne({ _id: m.order, status: 'awaiting_group' }, { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', note: 'Group did not reach its target' } } });
      await refundOrder(m.order, undefined, 'Group did not reach its target');
      await GroupOrder.updateOne({ _id: closed._id, 'members._id': m._id }, { $set: { 'members.$.status': 'refunded' } });
    }
  }
  return GroupOrder.findById(closed._id);
}

async function cancelGroup(user, groupId) {
  const g = await GroupOrder.findById(groupId);
  if (!g) throw notFound('Group not found');
  if (String(g.owner) !== String(user._id) && user.role !== 'admin') throw forbidden();
  if (g.paidQty > 0) throw conflict('Members have already paid. The group will close automatically at the deadline and refund if it fails.');
  const res = await GroupOrder.findOneAndUpdate(
    { _id: g._id, status: { $in: ['open', 'full'] }, paidQty: 0 },
    { $set: { status: 'cancelled', closedAt: new Date(), closeReason: 'Cancelled by organiser' } },
    { new: true }
  );
  if (!res) throw conflict('Group can no longer be cancelled');
  await Order.updateMany({ groupOrder: g._id, status: 'pending_payment' }, { $set: { status: 'cancelled' }, $push: { statusHistory: { status: 'cancelled', note: 'Group cancelled' } } });
  await releaseStock(g.product, g.stockReserved);
  await GroupOrder.updateOne({ _id: g._id }, { $set: { stockReserved: 0, 'members.$[m].status': 'left' } }, { arrayFilters: [{ 'm.status': 'reserved' }] });
  return GroupOrder.findById(g._id);
}

async function closeDueGroups(now = new Date()) {
  const due = await GroupOrder.find({ status: { $in: ['open', 'full'] }, deadline: { $lte: now } }).select('_id').limit(200);
  for (const g of due) {
    try {
      await closeGroup(g._id);
    } catch (e) {
      console.error('closeGroup failed', String(g._id), e);
    }
  }
  return due.length;
}

module.exports = { createGroup, joinGroup, leaveGroup, closeGroup, cancelGroup, closeDueGroups, onMemberPaid, releaseMemberForOrder, releaseMember };
