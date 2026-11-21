/** Shared pieces for the farmer–broker screens. */
import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n';
import { cropName, districtName } from '../../lib/market';
import ProduceArt from '../../components/art/Produce';
import { Icon } from '../../components/ui';

export const DEAL_STATUS = {
  proposed: ['Proposed', 'प्रस्ताव'],
  agreed: ['Agreed', 'तय हुआ'],
  vehicle_assigned: ['Vehicle coming', 'गाड़ी आ रही'],
  completed: ['Paid & done', 'भुगतान पूरा'],
  cancelled: ['Cancelled', 'रद्द'],
  disputed: ['Problem reported', 'शिकायत'],
};
const DEAL_CLASS = { proposed: 'placed', agreed: 'accepted', vehicle_assigned: 'out_for_delivery', completed: 'delivered', cancelled: 'cancelled', disputed: 'rejected' };

export function DealStatus({ value }) {
  const { tr } = useT();
  const [en, hi] = DEAL_STATUS[value] || [value, value];
  return <span className={`status ${DEAL_CLASS[value]}`}>{tr(en, hi)}</span>;
}

export function CropBadge({ meta, crop, size = 44 }) {
  const c = meta?.crops.find((x) => x.key === crop);
  return (
    <span className="crop-badge" style={{ width: size, height: size }} aria-hidden="true">
      <ProduceArt name={c?.en || crop} category={c?.group === 'grain' ? 'grains' : c?.group === 'fruit' ? 'fruits' : 'vegetables'} />
    </span>
  );
}

export function CallButtons({ phone, name, small }) {
  const { tr } = useT();
  if (!phone) return null;
  const msg = encodeURIComponent(tr(`Namaste ${name}, I found you on FarmDirect.`, `नमस्ते ${name}, आपका नंबर FarmDirect पर मिला।`));
  return (
    <div className="row" style={{ '--gap': '8px' }}>
      <a className={`btn leaf ${small ? 'sm' : ''}`} href={`tel:+91${phone}`}>
        📞 {tr('Call', 'कॉल करें')} <span className="mono">{phone}</span>
      </a>
      <a className={`btn ${small ? 'sm' : ''}`} href={`https://wa.me/91${phone}?text=${msg}`} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
    </div>
  );
}

/** Broker trust card: verification + record built from farmer-confirmed deals. */
export function BrokerTrust({ b, meta, compact }) {
  const { tr, lang } = useT();
  const s = b.stats || {};
  const risky = s.paymentIssues > 0 && (s.paidAtPickupPct ?? 100) < 80;
  return (
    <div className="stack" style={{ '--gap': '8px' }}>
      <div className="row between" style={{ '--gap': '8px' }}>
        <Link to={`/vyapar/brokers/${b._id}`} style={{ fontWeight: 700 }}>
          {b.businessName || b.name}
        </Link>
        {b.verified ? <span className="badge leaf">✓ {tr('Verified', 'सत्यापित')}</span> : <span className="badge turmeric">{tr('Not verified', 'असत्यापित')}</span>}
      </div>
      <div className="tiny muted">
        {b.name} · {districtName(meta, b.district, lang)}
        {b.distanceKm != null && ` · ${b.distanceKm} km`}
      </div>
      <div className="trust-row">
        <span>
          <strong className="mono">{s.completed ?? 0}</strong> {tr('deals done', 'सौदे पूरे')}
        </span>
        <span style={{ color: risky ? 'var(--chili)' : undefined }}>
          <strong className="mono">{s.paidAtPickupPct == null ? '—' : `${s.paidAtPickupPct}%`}</strong> {tr('paid at pickup', 'मौके पर भुगतान')}
        </span>
        <span>
          <strong className="mono">{s.rating ?? '—'}</strong>★ ({s.ratingCount ?? 0})
        </span>
      </div>
      {risky && (
        <div className="alert error tiny">
          <Icon name="alert" size={16} /> {tr(`${s.paymentIssues} farmer(s) reported payment problems`, `${s.paymentIssues} किसानों ने भुगतान की शिकायत की`)}
        </div>
      )}
      {!compact && b.phone && <CallButtons phone={b.phone} name={b.name} small />}
    </div>
  );
}

export function OfferCheck({ check, bench, meta, crop }) {
  const { tr } = useT();
  if (!check || !bench) return null;
  const cls = check.verdict === 'good' ? 'ok' : check.verdict === 'fair' ? 'warn' : 'error';
  const label =
    check.verdict === 'good'
      ? tr(`Good offer: ₹${check.diffPerKg.toFixed(2)}/kg above your best mandi option`, `अच्छा ऑफ़र: आपकी सबसे अच्छी मंडी से ₹${check.diffPerKg.toFixed(2)}/kg ज़्यादा`)
      : check.verdict === 'fair'
        ? tr('Fair offer: about the same as taking it to the mandi yourself', 'ठीक ऑफ़र: लगभग मंडी ले जाने जितना')
        : tr(`Low offer: ₹${Math.abs(check.diffPerKg).toFixed(2)}/kg below your best mandi option`, `कम ऑफ़र: आपकी सबसे अच्छी मंडी से ₹${Math.abs(check.diffPerKg).toFixed(2)}/kg कम`);
  return (
    <div className={`alert ${cls} small`}>
      <span>
        <strong>{label}</strong>
        {tr('Fair farm-gate price for you', 'आपके लिए सही खेत-भाव')}: ₹{bench.minFairFarmGatePerKg}/kg ·{' '}
        <Link to={`/mandi/calculator?crop=${crop}`}>{tr('see calculation', 'हिसाब देखें')}</Link>
      </span>
    </div>
  );
}

export const kg = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/kg`;
export const qtl = (paise) => `₹${Math.round(paise).toLocaleString('en-IN')}/qtl`; // paise per kg × 100 kg ÷ 100 = paise numerically
export { cropName };
