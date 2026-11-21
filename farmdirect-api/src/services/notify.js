const { Notification } = require('../models/misc');

/**
 * In-app notifications. Never throws: a failed notification must not fail an order.
 * Extension point: add SMS / WhatsApp (e.g. MSG91, Gupshup) here — farmers respond
 * to SMS/WhatsApp far more reliably than to in-app bells.
 */
async function notify(user, type, title, body, link) {
  try {
    await Notification.create({ user, type, title, body, link });
  } catch (err) {
    console.error('notify failed', err.message);
  }
}

module.exports = { notify };
