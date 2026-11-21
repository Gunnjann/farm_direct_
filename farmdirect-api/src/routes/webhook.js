const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const { verifyWebhookSignature, applySuccessfulPayment } = require('../services/payments');

/**
 * Razorpay webhook. Configure in Razorpay Dashboard → Webhooks:
 *   URL:    https://<your-api>/api/payments/webhook
 *   Events: payment.captured, payment.failed
 *   Secret: same as RAZORPAY_WEBHOOK_SECRET
 *
 * This is the source of truth if the buyer closes the browser right after paying.
 * Must be mounted BEFORE express.json() so we can hash the exact raw bytes.
 */
router.post('/', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  const signature = req.get('X-Razorpay-Signature');
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(400).json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid webhook signature' } });
  }
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Invalid JSON' } });
  }
  try {
    const p = event?.payload?.payment?.entity;
    if (event.event === 'payment.captured' && p) {
      const payment = await Payment.findOne({ providerOrderId: p.order_id });
      if (payment && Number(p.amount) === payment.amount) {
        await applySuccessfulPayment({ providerOrderId: p.order_id, providerPaymentId: p.id, method: p.method });
      } else if (payment) {
        console.error('Webhook amount mismatch', p.order_id, p.amount, payment.amount);
      }
    } else if (event.event === 'payment.failed' && p) {
      await Payment.updateOne({ providerOrderId: p.order_id, status: 'created' }, { $set: { failureReason: p.error_description || 'Payment failed' } });
    }
    res.json({ ok: true });
  } catch (err) {
    // Duplicate-payment conflicts are handled inside; anything else => 500 so Razorpay retries.
    if (err.status === 409) return res.json({ ok: true });
    console.error('Webhook processing failed', err);
    res.status(500).json({ error: { code: 'WEBHOOK_FAILED' } });
  }
});

module.exports = router;
