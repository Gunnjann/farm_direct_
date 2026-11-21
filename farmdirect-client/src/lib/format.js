/** Money arrives from the API in PAISE (integers). Format only at the edge. */
export const rupees = (paise, { decimals } = {}) => {
  const r = (paise || 0) / 100;
  const d = decimals ?? (Number.isInteger(r) ? 0 : 2);
  return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
};

export const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

export function freshness(harvestDate, lang = 'en') {
  if (!harvestDate) return null;
  const days = Math.floor((Date.now() - new Date(harvestDate).getTime()) / 86400000);
  if (lang === 'hi') return days <= 0 ? 'आज तोड़ा गया' : days === 1 ? 'कल तोड़ा गया' : `${days} दिन पहले तोड़ा गया`;
  if (days <= 0) return 'Harvested today';
  if (days === 1) return 'Harvested yesterday';
  return `Harvested ${days} days ago`;
}

export function timeLeft(deadline) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export const STATUS_LABEL = {
  pending_payment: 'Awaiting payment',
  awaiting_group: 'Waiting for group',
  placed: 'Placed',
  accepted: 'Accepted',
  packed: 'Packed',
  out_for_delivery: 'Out for delivery',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  expired: 'Expired',
  open: 'Open',
  full: 'Full',
  confirmed: 'Confirmed',
  failed: 'Failed',
  supplier_responded: 'Seller responded',
  resolved: 'Resolved',
};

export const CATEGORIES = [
  { id: 'vegetables', label: 'Vegetables', hi: 'सब्ज़ियाँ' },
  { id: 'fruits', label: 'Fruits', hi: 'फल' },
  { id: 'grains', label: 'Grains', hi: 'अनाज' },
  { id: 'pulses', label: 'Pulses', hi: 'दालें' },
  { id: 'spices', label: 'Spices', hi: 'मसाले' },
  { id: 'others', label: 'Others', hi: 'अन्य' },
];

export const isSupplier = (u) => u && ['farmer', 'trader'].includes(u.role);
export const isBuyer = (u) => u && ['customer', 'retailer'].includes(u.role);
