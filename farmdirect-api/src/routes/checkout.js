const router = require('express').Router();
const env = require('../config/env');
const Payment = require('../models/Payment');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const s = require('../validators/schemas');
const { asyncHandler, badRequest, forbidden, notFound } = require('../utils/errors');
const { priceCart, createCheckout, paymentView } = require('../services/orders');
const { verifyCheckoutSignature, applySuccessfulPayment, rzp } = require('../services/payments');

const buyerOnly = [authenticate, requireRole('customer', 'retailer')];

/** Price preview: subtotal, delivery and fees per seller, BEFORE any payment. */
router.post(
  '/quote',
  ...buyerOnly,
  validate(s.quote),
  asyncHandler(async (req, res) => {
    if (req.body.fulfilment === 'delivery' && !req.body.pincode) throw badRequest('Enter your delivery pincode');
    res.json(await priceCart(req.user, req.body));
  })
);

/** Reserve stock, create orders + gateway order. Send an Idempotency-Key header to make retries safe. */
router.post(
  '/',
  ...buyerOnly,
  validate(s.checkout),
  asyncHandler(async (req, res) => {
    const key = req.get('Idempotency-Key');
    if (key && !/^[\w-]{8,80}$/.test(key)) throw badRequest('Invalid Idempotency-Key');
    const result = await createCheckout(req.user, req.body, key);
    res.status(result.replayed ? 200 : 201).json(result);
  })
);

/**
 * Called by the browser after Razorpay Checkout succeeds. We trust NOTHING from
 * the browser except the three ids — the signature proves Razorpay issued them.
 */
router.post(
  '/verify',
  ...buyerOnly,
  validate(s.verifyPayment),
  asyncHandler(async (req, res) => {
    if (env.paymentMode !== 'razorpay') throw badRequest('Razorpay is not enabled on this server');
    const { razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = req.body;
    const payment = await Payment.findOne({ providerOrderId: oid });
    if (!payment) throw notFound('Payment not found');
    if (String(payment.buyer) !== String(req.user._id)) throw forbidden();
    if (!verifyCheckoutSignature(oid, pid, sig)) throw badRequest('Payment verification failed. If money was deducted it will be refunded automatically.');

    // Defence in depth: confirm with Razorpay that the payment really is for our amount.
    let method;
    try {
      const p = await rzp().payments.fetch(pid);
      if (p.order_id !== oid || Number(p.amount) !== payment.amount || !['captured', 'authorized'].includes(p.status)) {
        throw badRequest('Payment details do not match this order');
      }
      method = p.method;
    } catch (e) {
      if (e.status === 400) throw e;
      console.warn('Could not fetch payment from Razorpay; relying on signature', e?.error || e.message);
    }
    const { payment: paid, alreadyProcessed } = await applySuccessfulPayment({ providerOrderId: oid, providerPaymentId: pid, method });
    res.json({ ok: true, alreadyProcessed, payment: paymentView(paid) });
  })
);

/** Development-only fake gateway so the app runs end-to-end without Razorpay keys. */
router.post(
  '/mock/complete',
  ...buyerOnly,
  validate(s.mockComplete),
  asyncHandler(async (req, res) => {
    if (env.paymentMode !== 'mock') throw forbidden('Mock payments are disabled');
    const payment = await Payment.findOne({ providerOrderId: req.body.providerOrderId });
    if (!payment) throw notFound('Payment not found');
    if (String(payment.buyer) !== String(req.user._id)) throw forbidden();
    if (req.body.outcome === 'failure') {
      await Payment.updateOne({ _id: payment._id, status: 'created' }, { $set: { status: 'failed', failureReason: 'Simulated failure' } });
      return res.json({ ok: false, message: 'Payment failed (simulated). You can try again before the hold expires.' });
    }
    const { payment: paid, alreadyProcessed } = await applySuccessfulPayment({
      providerOrderId: payment.providerOrderId,
      providerPaymentId: payment.providerPaymentId || `mock_pay_${payment._id}`,
      method: 'mock',
    });
    res.json({ ok: true, alreadyProcessed, payment: paymentView(paid) });
  })
);

/** Lets the client resume an unpaid checkout (e.g. after closing the Razorpay popup). */
router.get(
  '/payment/:checkoutId',
  ...buyerOnly,
  asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({ checkoutId: req.params.checkoutId, buyer: req.user._id });
    if (!payment) throw notFound('Checkout not found');
    res.json({ payment: paymentView(payment) });
  })
);

module.exports = router;
