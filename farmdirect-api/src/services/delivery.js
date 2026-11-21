/**
 * Delivery pricing — deliberately simple and transparent:
 *
 *   Each supplier lists the PINCODES they actually deliver to, with a flat fee
 *   and an ETA per pincode. No pincode => no delivery promise. Optional
 *   "free delivery above ₹X" and minimum order value. Pickup from farm is free
 *   if the supplier offers it.
 *
 * Why not distance-based pricing? It needs geocoding for every address (paid API,
 * often wrong for rural addresses) and suppliers can't predict their own costs.
 * Pincode zones are what farmers and local traders already think in.
 */
function quoteDelivery(supplier, { pincode, subtotal, fulfilment }) {
  const sp = supplier.supplierProfile || {};
  const name = sp.displayName || supplier.name;

  if (sp.minOrderValue && subtotal < sp.minOrderValue) {
    return {
      ok: false,
      reason: `${name} has a minimum order of ₹${sp.minOrderValue / 100}`,
      code: 'BELOW_MIN_ORDER',
    };
  }

  if (fulfilment === 'pickup') {
    if (!sp.pickupAvailable) return { ok: false, reason: `${name} does not offer pickup`, code: 'NO_PICKUP' };
    return { ok: true, fee: 0, etaDays: 0, pickupAddress: sp.pickupAddress };
  }

  const area = (sp.serviceAreas || []).find((a) => a.pincode === pincode);
  if (!area) {
    return { ok: false, reason: `${name} does not deliver to ${pincode}`, code: 'NOT_SERVICEABLE' };
  }
  const free = sp.freeDeliveryAbove > 0 && subtotal >= sp.freeDeliveryAbove;
  return { ok: true, fee: free ? 0 : area.deliveryFee, etaDays: area.etaDays ?? 1, freeApplied: free };
}

module.exports = { quoteDelivery };
