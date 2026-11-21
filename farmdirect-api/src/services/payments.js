const crypto = require('crypto');
const env = require('../config/env');
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { badRequest, conflict, notFound } = require('../utils/errors');
const { notify } = require('./notify');

let razorpayClient = null;
function rzp() {
  if (!razorpayClient) {
    const Razorpay = require('razorpay');
    razorpayClient = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  }
  return razorpayClient;
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Razorpay checkout signature = HMAC_SHA256(order_id|payment_id, key_secret). */
function verifyCheckoutSignature(orderId, paymentId, signature, secret = env.razorpay.keySecret) {
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

/** Webhook signature = HMAC_SHA256(raw request body, webhook_secret). */
function verifyWebhookSignature(rawBody, signature, secret = env.razorpay.webhookSecret) {
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}

/** Creates the gateway-side order. The amount is ALWAYS computed by our server. */
async function createGatewayOrder({ amount, checkoutId }) {
  if (env.paymentMode === 'razorpay') {
    const o = await rzp().orders.create({ amount, currency: 'INR', receipt: checkoutId.slice(0, 40) });
    return { provider: 'razorpay', providerOrderId: o.id };
  }
  return { provider: 'mock', providerOrderId: `mock_order_${crypto.randomBytes(8).toString('hex')}` };
}

/**
 * Marks a payment as paid exactly once and moves its orders forward.
 * Safe to call from BOTH the browser callback and the webhook, in any order,
 * any number of times — only the first call changes anything.
 */
async function applySuccessfulPayment({ providerOrderId, providerPaymentId, method }) {
  const payment = await Payment.findOneAndUpdate(
    { providerOrderId, status: { $in: ['created', 'failed', 'expired'] } },
    { $set: { status: 'paid', providerPaymentId, method, paidAt: new Date() } },
    { new: true }
  );

  if (!payment) {
    const existing = await Payment.findOne({ providerOrderId });
    if (!existing) throw notFound('Payment not found');
    if (existing.providerPaymentId === providerPaymentId) return { payment: existing, alreadyProcessed: true };
    // A *different* gateway payment for an already-paid order => customer paid twice.
    await refundDuplicatePayment(existing, providerPaymentId);
    throw conflict('This order was already paid. The duplicate payment will be refunded.', 'DUPLICATE_PAYMENT');
  }

  // Lazy require avoids a circular import (orders service uses payments service for refunds).
  const { onOrdersPaid } = require('./orders');
  await onOrdersPaid(payment);
  return { payment, alreadyProcessed: false };
}

async function refundDuplicatePayment(payment, providerPaymentId) {
  console.warn(`Duplicate payment ${providerPaymentId} for ${payment.providerOrderId}`);
  if (env.paymentMode === 'razorpay') {
    try {
      await rzp().payments.refund(providerPaymentId, { notes: { reason: 'duplicate payment' } });
    } catch (e) {
      console.error('Duplicate refund failed — needs manual action', e?.error || e);
    }
  }
}

/**
 * Refund (part of) a payment for one order. Idempotent per order: an order
 * already refunded / refund-pending is not refunded again.
 */
async function refundOrder(orderId, amount, reason) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: 'paid' },
    { $set: { paymentStatus: 'refund_pending' } },
    { new: true }
  );
  if (!order) return null; // never paid, or already refunded
  const payment = await Payment.findById(order.payment);
  if (!payment || payment.status !== 'paid') return null;

  const refundAmount = Math.min(amount ?? order.total, order.total);
  if (refundAmount < 100) throw badRequest('Refund amount must be at least ₹1');

  let providerRefundId = `mock_rfnd_${crypto.randomBytes(6).toString('hex')}`;
  let status = 'processed';
  if (env.paymentMode === 'razorpay') {
    try {
      const r = await rzp().payments.refund(payment.providerPaymentId, {
        amount: refundAmount,
        notes: { order: order.orderNumber, reason: String(reason).slice(0, 200) },
      });
      providerRefundId = r.id;
      status = r.status === 'processed' ? 'processed' : 'pending';
    } catch (e) {
      console.error('Refund failed', e?.error || e);
      status = 'failed';
    }
  }

  await Payment.updateOne(
    { _id: payment._id },
    { $push: { refunds: { order: order._id, amount: refundAmount, providerRefundId, status, reason } } }
  );
  // 'failed' stays refund_pending so an admin can see and retry it.
  if (status !== 'failed') await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'refunded' } });
  await notify(
    order.buyer,
    'refund',
    status === 'failed' ? 'Refund needs attention' : 'Refund initiated',
    `₹${refundAmount / 100} for order ${order.orderNumber}. Banks usually take 5–7 working days.`,
    `/orders/${order._id}`
  );
  return { amount: refundAmount, status };
}

module.exports = {
  verifyCheckoutSignature,
  verifyWebhookSignature,
  createGatewayOrder,
  applySuccessfulPayment,
  refundOrder,
  rzp,
};
