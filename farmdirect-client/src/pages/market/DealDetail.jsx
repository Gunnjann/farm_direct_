import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, useFetch, useToast } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { useMarketMeta, cropName, districtName } from '../../lib/market';
import { HappyBasket } from '../../components/art/Stickers';
import { Button, ErrorBox, Icon, Input, Loading, Modal, Select, Textarea } from '../../components/ui';
import { BrokerTrust, CallButtons, CropBadge, DealStatus, kg } from './parts';

const STEPS = [
  ['proposed', 'Proposed', 'प्रस्ताव'],
  ['agreed', 'Both agreed', 'दोनों राज़ी'],
  ['vehicle_assigned', 'Vehicle on the way', 'गाड़ी रवाना'],
  ['completed', 'Loaded & paid', 'माल उठा, पैसा मिला'],
];

export default function DealDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { tr, lang } = useT();
  const toast = useToast();
  const { meta } = useMarketMeta();
  const { data, error, loading, reload } = useFetch(`/connect/deals/${id}`);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actErr, setActErr] = useState(null);
  const [form, setForm] = useState({});

  if (loading || !meta) return <Loading />;
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>;
  const d = data.deal;
  const isFarmer = String(d.farmer._id) === String(user._id);
  const isBroker = String(d.broker._id) === String(user._id);
  const me = isFarmer ? 'farmer' : isBroker ? 'broker' : 'admin';
  const value = Math.round(d.quantityQtl * 100 * d.pricePerKg) / 100;
  const stepIdx = STEPS.findIndex(([s]) => s === d.status);

  const act = async (path, body, msg) => {
    setBusy(true);
    setActErr(null);
    try {
      await api(`/connect/deals/${d._id}/${path}`, { method: 'POST', body });
      toast(msg, 'ok');
      setModal(null);
      reload();
    } catch (e) {
      setActErr(e);
    } finally {
      setBusy(false);
    }
  };
  const up = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const open = (name, init = {}) => {
    setForm(init);
    setActErr(null);
    setModal(name);
  };

  const canAgree = d.status === 'proposed' && ((d.proposedBy === 'farmer' && isBroker) || (d.proposedBy === 'broker' && isFarmer));
  const live = ['proposed', 'agreed', 'vehicle_assigned'].includes(d.status);

  return (
    <div className="container page stack" style={{ '--gap': '20px', maxWidth: 980 }}>
      <Link to="/vyapar?tab=deals" className="small">← {tr('All deals', 'सभी सौदे')}</Link>
      <div className="row between">
        <div className="row" style={{ '--gap': '14px', flexWrap: 'nowrap' }}>
          <CropBadge meta={meta} crop={d.crop} size={64} />
          <div>
            <span className="eyebrow">{tr('Deal', 'सौदा')}</span>
            <h1 style={{ margin: '4px 0' }}>
              {d.quantityQtl} {tr('qtl', 'क्विंटल')} {cropName(meta, d.crop, lang)}
            </h1>
            <div className="mono">
              {kg(d.pricePerKg)} · ₹{value.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
        <DealStatus value={d.status} />
      </div>

      {d.status !== 'cancelled' && d.status !== 'disputed' && (
        <ol className="deal-steps">
          {STEPS.map(([s, en, hi], i) => (
            <li key={s} className={i < stepIdx || d.status === 'completed' ? 'done' : i === stepIdx ? 'current' : ''}>
              <span className="mono">{i + 1}</span>
              {tr(en, hi)}
            </li>
          ))}
        </ol>
      )}

      {d.status === 'completed' && (
        <div className="card tint-leaf row" style={{ '--gap': '14px', flexWrap: 'nowrap' }}>
          <div className="sticker-wrap" style={{ flex: 'none' }}>
            <HappyBasket size={90} />
          </div>
          <div>
            <strong>
              {tr('Paid', 'भुगतान')} ₹{(d.amountReceived / 100).toLocaleString('en-IN')} · {d.paymentMode?.toUpperCase()} · {d.weighedQtl} {tr('qtl weighed', 'क्विंटल तौला')}
            </strong>
            <div className="small">{tr('Confirmed by the farmer. This counts toward the broker’s public record.', 'किसान ने पुष्टि की। यह व्यापारी के रिकॉर्ड में जुड़ गया।')}</div>
          </div>
        </div>
      )}
      {d.status === 'disputed' && (
        <div className="alert error">
          <Icon name="alert" />
          <span>
            <strong>{tr('Problem reported', 'शिकायत दर्ज')}: {d.issue?.replace(/_/g, ' ')}</strong>
            {d.issueNote}
            <br />
            <span className="small">{tr('The FarmDirect team will call both parties. This is visible on the broker’s record.', 'FarmDirect टीम दोनों से बात करेगी। यह व्यापारी के रिकॉर्ड में दिखेगा।')}</span>
          </span>
        </div>
      )}

      {/* Next-step panel */}
      {live && me !== 'admin' && (
        <div className="card tint-turmeric stack">
          <strong>{tr('What to do now', 'अब क्या करें')}</strong>
          {d.status === 'proposed' && canAgree && isFarmer && (
            <p className="small" style={{ margin: 0 }}>
              {tr('1) Call the broker and check: rate, date, who brings crates, and that full payment is made when loading. 2) Then agree.', '1) व्यापारी को कॉल करें: भाव, तारीख़, क्रेट कौन लाएगा, और लोडिंग पर पूरा भुगतान — पक्का करें। 2) फिर राज़ी हों।')}
            </p>
          )}
          {d.status === 'proposed' && !canAgree && <p className="small" style={{ margin: 0 }}>{tr('Waiting for the other side to agree.', 'दूसरे पक्ष की हाँ का इंतज़ार।')}</p>}
          {d.status === 'agreed' && isBroker && <p className="small" style={{ margin: 0 }}>{tr('Add the vehicle and driver so the farmer knows who is coming.', 'गाड़ी और ड्राइवर की जानकारी डालें, ताकि किसान को पता रहे कौन आ रहा है।')}</p>}
          {['agreed', 'vehicle_assigned'].includes(d.status) && isFarmer && (
            <p className="small" style={{ margin: 0 }}>
              <strong>{tr('Weigh in front of you. Take the full payment before the vehicle leaves.', 'तौल अपने सामने कराएँ। गाड़ी जाने से पहले पूरा भुगतान लें।')}</strong> {tr('Then tap “Loaded & paid”.', 'फिर “माल उठा, पैसा मिला” दबाएँ।')}
            </p>
          )}
          <div className="row">
            {canAgree && (
              <Button variant="leaf" loading={busy} onClick={() => act('agree', undefined, tr('Deal agreed', 'सौदा तय'))}>
                {tr('Agree', 'राज़ी हूँ')}
              </Button>
            )}
            {isBroker && ['agreed', 'vehicle_assigned'].includes(d.status) && (
              <Button variant="primary" onClick={() => open('vehicle', { vehicleNumber: d.vehicleNumber || '', driverName: d.driverName || '', driverPhone: d.driverPhone || '', pickupDate: d.pickupDate?.slice(0, 10) })}>
                🚚 {d.vehicleNumber ? tr('Update vehicle', 'गाड़ी बदलें') : tr('Add vehicle & driver', 'गाड़ी और ड्राइवर डालें')}
              </Button>
            )}
            {isFarmer && ['agreed', 'vehicle_assigned'].includes(d.status) && (
              <Button variant="leaf" size="lg" onClick={() => open('complete', { weighedQtl: d.quantityQtl, amountReceived: value, paymentMode: 'upi', rating: 5, review: '' })}>
                ✔ {tr('Loaded & paid', 'माल उठा, पैसा मिला')}
              </Button>
            )}
            {['agreed', 'vehicle_assigned'].includes(d.status) && (
              <Button variant="ghost" onClick={() => open('issue', { issue: isFarmer ? 'broker_no_show' : 'farmer_no_show', note: '' })}>
                {tr('Report a problem', 'समस्या बताएँ')}
              </Button>
            )}
            {['proposed', 'agreed'].includes(d.status) && (
              <Button variant="ghost" onClick={() => open('cancel', { note: '' })}>
                {tr('Cancel', 'रद्द करें')}
              </Button>
            )}
          </div>
        </div>
      )}
      <ErrorBox error={actErr && !modal ? actErr : null} />

      <div className="grid" style={{ '--min': '300px' }}>
        <div className="card stack">
          <div className="panel-title">{tr('Broker', 'व्यापारी')}</div>
          <BrokerTrust b={d.broker} meta={meta} />
        </div>
        <div className="card stack" style={{ '--gap': '8px' }}>
          <div className="panel-title">{tr('Farmer', 'किसान')}</div>
          <strong>
            {d.farmer.name} {d.farmer.supplierProfile?.verified && <span className="badge leaf">✓</span>}
          </strong>
          <span className="small muted">{districtName(meta, d.farmer.supplierProfile?.farmDistrict, lang)}</span>
          {d.farmer.phone ? <CallButtons phone={d.farmer.phone} name={d.farmer.name} small /> : <span className="small muted">{tr('Number shown after the farmer agrees.', 'किसान के राज़ी होने पर नंबर दिखेगा।')}</span>}
        </div>
        <div className="card stack" style={{ '--gap': '6px' }}>
          <div className="panel-title">{tr('Pickup', 'उठान')}</div>
          <span>📅 {new Date(d.pickupDate).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          {d.pickupPlace && <span>📍 {d.pickupPlace}</span>}
          {d.vehicleNumber ? (
            <>
              <span>
                🚚 <strong className="mono">{d.vehicleNumber}</strong> · {d.driverName}
              </span>
              <CallButtons phone={d.driverPhone} name={d.driverName} small />
            </>
          ) : (
            <span className="small muted">{tr('Vehicle details not added yet.', 'गाड़ी की जानकारी अभी नहीं डाली।')}</span>
          )}
          {d.message && <p className="small" style={{ margin: 0 }}>“{d.message}”</p>}
        </div>
      </div>

      <div className="card">
        <div className="panel-title">{tr('History', 'इतिहास')}</div>
        <ul className="timeline">
          {d.history.map((h, i) => (
            <li key={i} className="done">
              <span className="node" />
              <div>
                <strong>{h.status.replace(/_/g, ' ')}</strong>
                {h.note && <div className="small">{h.note}</div>}
                <div className="tiny muted">{new Date(h.at).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ---------- modals ---------- */}
      <Modal open={modal === 'vehicle'} onClose={() => setModal(null)} title={tr('Vehicle & driver', 'गाड़ी और ड्राइवर')}>
        <div className="form-grid">
          <Input label={tr('Vehicle number', 'गाड़ी नंबर')} placeholder="MP09 AB 1234" value={form.vehicleNumber || ''} onChange={up('vehicleNumber')} />
          <Input label={tr('Driver name', 'ड्राइवर का नाम')} value={form.driverName || ''} onChange={up('driverName')} />
          <Input label={tr('Driver mobile', 'ड्राइवर मोबाइल')} inputMode="tel" maxLength={10} value={form.driverPhone || ''} onChange={up('driverPhone')} />
          <Input label={tr('Pickup date', 'उठाने की तारीख़')} type="date" value={form.pickupDate || ''} onChange={up('pickupDate')} />
          <ErrorBox error={actErr} />
          <Button variant="primary" loading={busy} onClick={() => act('vehicle', { vehicleNumber: form.vehicleNumber.replace(/\s/g, ''), driverName: form.driverName, driverPhone: form.driverPhone, pickupDate: form.pickupDate || undefined }, tr('Vehicle details sent', 'गाड़ी की जानकारी भेजी'))}>
            {tr('Save & notify farmer', 'सेव करें और किसान को बताएँ')}
          </Button>
        </div>
      </Modal>

      <Modal open={modal === 'complete'} onClose={() => setModal(null)} title={tr('Confirm: crop loaded & payment received', 'पुष्टि: माल उठा और पैसा मिला')}>
        <div className="form-grid cols-2">
          <Input label={tr('Weighed quantity (qtl)', 'तौल (क्विंटल)')} inputMode="decimal" value={form.weighedQtl ?? ''} onChange={(e) => setForm({ ...form, weighedQtl: e.target.value, amountReceived: Math.round(Number(e.target.value) * 100 * d.pricePerKg) / 100 })} />
          <Input label={tr('Amount received ₹', 'मिली रकम ₹')} inputMode="decimal" value={form.amountReceived ?? ''} onChange={up('amountReceived')} hint={tr(`Agreed: ₹${(Math.round(Number(form.weighedQtl || 0) * 100 * d.pricePerKg) / 100).toLocaleString('en-IN')}`, `तय रकम: ₹${(Math.round(Number(form.weighedQtl || 0) * 100 * d.pricePerKg) / 100).toLocaleString('en-IN')}`)} />
          <Select
            label={tr('Paid by', 'भुगतान का तरीक़ा')}
            value={form.paymentMode}
            onChange={up('paymentMode')}
            options={[
              { value: 'upi', label: 'UPI' },
              { value: 'cash', label: tr('Cash', 'नकद') },
              { value: 'bank', label: tr('Bank transfer', 'बैंक ट्रांसफ़र') },
              { value: 'cheque', label: tr('Cheque', 'चेक') },
            ]}
          />
          <div className="field">
            <label>{tr('Rate the broker', 'व्यापारी को रेटिंग दें')}</label>
            <div className="star-input">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={form.rating >= n} onClick={() => setForm({ ...form, rating: n })} aria-label={`${n}`}>
                  ★
                </button>
              ))}
            </div>
          </div>
          <Textarea className="span-2" label={tr('Comment (optional)', 'टिप्पणी (वैकल्पिक)')} value={form.review || ''} onChange={up('review')} />
          {Number(form.amountReceived) < Math.round(Number(form.weighedQtl || 0) * 100 * d.pricePerKg * 0.98) / 100 && (
            <div className="alert error small span-2">{tr('This is less than the agreed amount — it will be recorded as a payment problem against the broker.', 'यह तय रकम से कम है — इसे व्यापारी के ख़िलाफ़ भुगतान शिकायत के रूप में दर्ज किया जाएगा।')}</div>
          )}
          <ErrorBox error={actErr} />
          <Button className="span-2" variant="leaf" size="lg" loading={busy} onClick={() => act('complete', { weighedQtl: Number(form.weighedQtl), amountReceived: Number(form.amountReceived), paymentMode: form.paymentMode, rating: form.rating, review: form.review || undefined }, tr('Deal completed', 'सौदा पूरा'))}>
            {tr('Confirm', 'पुष्टि करें')}
          </Button>
        </div>
      </Modal>

      <Modal open={modal === 'issue'} onClose={() => setModal(null)} title={tr('Report a problem', 'समस्या बताएँ')}>
        <div className="form-grid">
          <Select
            label={tr('What happened?', 'क्या हुआ?')}
            value={form.issue}
            onChange={up('issue')}
            options={
              isFarmer
                ? [
                    { value: 'broker_no_show', label: tr('Broker / vehicle did not come', 'व्यापारी / गाड़ी नहीं आई') },
                    { value: 'not_paid', label: tr('Crop taken, not paid', 'माल ले गए, पैसा नहीं दिया') },
                    { value: 'paid_less', label: tr('Paid less than agreed', 'तय से कम पैसा दिया') },
                    { value: 'price_cut_at_pickup', label: tr('Cut the price at loading', 'लोडिंग पर भाव घटाया') },
                    { value: 'other', label: tr('Other', 'अन्य') },
                  ]
                : [
                    { value: 'farmer_no_show', label: tr('Crop not ready / farmer unavailable', 'फ़सल तैयार नहीं / किसान नहीं मिले') },
                    { value: 'quality_mismatch', label: tr('Quality not as described', 'क्वालिटी अलग निकली') },
                    { value: 'other', label: tr('Other', 'अन्य') },
                  ]
            }
          />
          <Textarea label={tr('Details', 'विवरण')} value={form.note || ''} onChange={up('note')} />
          <ErrorBox error={actErr} />
          <Button variant="danger" loading={busy} disabled={(form.note || '').trim().length < 5} onClick={() => act('issue', { issue: form.issue, note: form.note }, tr('Problem reported', 'शिकायत दर्ज'))}>
            {tr('Report', 'दर्ज करें')}
          </Button>
        </div>
      </Modal>

      <Modal open={modal === 'cancel'} onClose={() => setModal(null)} title={tr('Cancel deal', 'सौदा रद्द करें')}>
        <Textarea label={tr('Reason', 'कारण')} value={form.note || ''} onChange={up('note')} />
        <ErrorBox error={actErr} />
        <Button variant="danger" loading={busy} disabled={(form.note || '').trim().length < 3} onClick={() => act('cancel', { note: form.note }, tr('Deal cancelled', 'सौदा रद्द'))}>
          {tr('Cancel deal', 'सौदा रद्द करें')}
        </Button>
      </Modal>
    </div>
  );
}
