import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useFetch, useToast } from '../../context/AppContext';
import { api, qs } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { useMarketMeta, STATES, cropName, districtName } from '../../lib/market';
import { Button, Empty, ErrorBox, Icon, Input, Loading, Modal, Select, Textarea } from '../../components/ui';
import { BrokerTrust, CropBadge, DealStatus, OfferCheck, kg, qtl } from './parts';

// Local (India) calendar date, not UTC — otherwise after midnight IST "today" shows yesterday.
const localDate = (d) => d.toLocaleDateString('en-CA');
const today = () => localDate(new Date());
const inDays = (n) => localDate(new Date(Date.now() + n * 86400000));

function Filters({ meta, crop, state, set }) {
  const { tr, lang } = useT();
  return (
    <div className="row" style={{ '--gap': '8px' }}>
      <select className="input" style={{ width: 'auto' }} value={crop} onChange={(e) => set('crop', e.target.value)} aria-label="Crop">
        <option value="">{tr('All crops', 'सभी फ़सलें')}</option>
        {meta.crops.map((c) => (
          <option key={c.key} value={c.key}>
            {lang === 'hi' ? c.hi : c.en}
          </option>
        ))}
      </select>
      <select className="input" style={{ width: 'auto' }} value={state} onChange={(e) => set('state', e.target.value)} aria-label="State">
        <option value="">{tr('Both states', 'दोनों राज्य')}</option>
        {STATES.map((s) => (
          <option key={s.value} value={s.value}>
            {lang === 'hi' ? s.hi : s.value}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------ propose deal modal */
function ProposeModal({ meta, target, kind, onClose }) {
  const { tr, lang } = useT();
  const nav = useNavigate();
  const isReq = kind === 'request';
  const [f, setF] = useState({
    quantityQtl: isReq ? target.minQtyQtl : target.quantityQtl,
    pricePerKg: isReq ? target.offerPricePerKg / 100 : target.expectedPricePerKg ? target.expectedPricePerKg / 100 : '',
    pickupDate: isReq ? today() : target.readyFrom?.slice(0, 10) || today(),
    pickupPlace: '',
    message: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const total = Number(f.quantityQtl) * 100 * Number(f.pricePerKg || 0);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api('/connect/deals', {
        method: 'POST',
        body: { [isReq ? 'requestId' : 'listingId']: target._id, quantityQtl: Number(f.quantityQtl), pricePerKg: Number(f.pricePerKg), pickupDate: f.pickupDate, pickupPlace: f.pickupPlace || undefined, message: f.message || undefined },
      });
      nav(`/vyapar/deals/${d.deal._id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={isReq ? tr('Sell to this broker', 'इस व्यापारी को बेचें') : tr('Send an offer to the farmer', 'किसान को ऑफ़र भेजें')}>
      <p className="small muted" style={{ margin: 0 }}>
        {cropName(meta, target.crop, lang)} ·{' '}
        {isReq ? tr(`wants ${target.minQtyQtl}–${target.maxQtyQtl} qtl`, `${target.minQtyQtl}–${target.maxQtyQtl} क्विंटल चाहिए`) : tr(`${target.quantityQtl} qtl available`, `${target.quantityQtl} क्विंटल उपलब्ध`)}
      </p>
      {isReq && (
        <div className="alert warn small">
          <Icon name="alert" size={18} />
          <span>{tr('Call the broker first and confirm the rate, date and that payment is made at loading.', 'पहले व्यापारी को कॉल करें — भाव, तारीख़ और लोडिंग के समय भुगतान पक्का करें।')}</span>
        </div>
      )}
      <form className="form-grid cols-2" onSubmit={submit}>
        <Input label={tr('Quantity (quintal)', 'मात्रा (क्विंटल)')} inputMode="decimal" value={f.quantityQtl} onChange={up('quantityQtl')} required />
        <Input label={tr('Price ₹ per kg', 'भाव ₹ प्रति किलो')} inputMode="decimal" value={f.pricePerKg} onChange={up('pricePerKg')} required />
        <Input label={tr('Pickup date', 'उठाने की तारीख़')} type="date" min={today()} value={f.pickupDate} onChange={up('pickupDate')} required />
        <Input label={tr('Pickup place (optional)', 'उठाने की जगह (वैकल्पिक)')} value={f.pickupPlace} onChange={up('pickupPlace')} placeholder={tr('Village / farm', 'गाँव / खेत')} />
        <Textarea className="span-2" label={tr('Message (optional)', 'संदेश (वैकल्पिक)')} value={f.message} onChange={up('message')} />
        {total > 0 && (
          <div className="span-2 sum-row total">
            <span>{tr('Deal value', 'सौदे की रकम')}</span>
            <span className="mono">₹{Math.round(total).toLocaleString('en-IN')}</span>
          </div>
        )}
        <ErrorBox error={error} />
        <Button className="span-2" variant="primary" size="lg" loading={busy} type="submit">
          {tr('Send proposal', 'प्रस्ताव भेजें')}
        </Button>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------ create listing / request */
function NewListingModal({ meta, onClose, onDone }) {
  const { tr, lang } = useT();
  const { user } = useAuth();
  const sp = user.supplierProfile || {};
  const [f, setF] = useState({ crop: 'cauliflower', variety: '', quantityQtl: '', expectedPricePerKg: '', readyFrom: today(), quality: '', state: sp.farmState || 'Madhya Pradesh', district: sp.farmDistrict || '', village: sp.village || '', validDays: 15 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const districts = meta.locations.filter((l) => l.state === f.state);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/connect/listings', { method: 'POST', body: { ...f, quantityQtl: Number(f.quantityQtl), expectedPricePerKg: f.expectedPricePerKg === '' ? undefined : Number(f.expectedPricePerKg), variety: f.variety || undefined, quality: f.quality || undefined, village: f.village || undefined, validDays: Number(f.validDays) } });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={tr('Post your crop', 'अपनी फ़सल डालें')}>
      <form className="form-grid cols-2" onSubmit={submit}>
        <Select label={tr('Crop', 'फ़सल')} value={f.crop} onChange={up('crop')} options={meta.crops.map((c) => ({ value: c.key, label: lang === 'hi' ? c.hi : c.en }))} />
        <Input label={tr('Variety (optional)', 'किस्म (वैकल्पिक)')} value={f.variety} onChange={up('variety')} />
        <Input label={tr('Quantity (quintal)', 'मात्रा (क्विंटल)')} inputMode="decimal" value={f.quantityQtl} onChange={up('quantityQtl')} required />
        <Input label={tr('Your price ₹/kg (optional)', 'आपका भाव ₹/किलो (वैकल्पिक)')} inputMode="decimal" value={f.expectedPricePerKg} onChange={up('expectedPricePerKg')} hint={tr('Leave empty for best offer', 'सबसे अच्छे ऑफ़र के लिए ख़ाली छोड़ें')} />
        <Input label={tr('Ready from', 'कब से तैयार')} type="date" value={f.readyFrom} onChange={up('readyFrom')} required />
        <Select label={tr('Listing valid for', 'कितने दिन दिखे')} value={f.validDays} onChange={up('validDays')} options={[7, 15, 30].map((d) => ({ value: d, label: tr(`${d} days`, `${d} दिन`) }))} />
        <Select label={tr('State', 'राज्य')} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value, district: '' })} options={STATES.map((s) => ({ value: s.value, label: lang === 'hi' ? s.hi : s.value }))} />
        <Select label={tr('District', 'ज़िला')} value={f.district} onChange={up('district')} options={[{ value: '', label: tr('Choose…', 'चुनें…') }, ...districts.map((d) => ({ value: d.district, label: lang === 'hi' ? d.hi : d.district }))]} />
        <Input className="span-2" label={tr('Village', 'गाँव')} value={f.village} onChange={up('village')} />
        <Textarea className="span-2" label={tr('Quality (optional)', 'क्वालिटी (वैकल्पिक)')} value={f.quality} onChange={up('quality')} placeholder={tr('Size, colour, dryness…', 'साइज़, रंग, सूखापन…')} />
        <ErrorBox error={error} />
        <Button className="span-2" variant="primary" size="lg" loading={busy} type="submit" disabled={!f.district}>
          {tr('Post crop', 'फ़सल डालें')}
        </Button>
      </form>
    </Modal>
  );
}

function NewRequestModal({ meta, onClose, onDone }) {
  const { tr, lang } = useT();
  const { user } = useAuth();
  const bp = user.brokerProfile || {};
  const [f, setF] = useState({ crop: 'cauliflower', minQtyQtl: 10, maxQtyQtl: 100, offerPricePerKg: '', paymentTerms: 'Full payment at pickup (cash / UPI)', quality: '', state: bp.state || 'Madhya Pradesh', district: bp.district || '', radiusKm: 100, neededBy: inDays(7) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const districts = meta.locations.filter((l) => l.state === f.state);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/connect/requests', { method: 'POST', body: { ...f, minQtyQtl: Number(f.minQtyQtl), maxQtyQtl: Number(f.maxQtyQtl), offerPricePerKg: Number(f.offerPricePerKg), radiusKm: Number(f.radiusKm), quality: f.quality || undefined } });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={tr('What do you want to buy?', 'आपको क्या ख़रीदना है?')}>
      <form className="form-grid cols-2" onSubmit={submit}>
        <Select className="span-2" label={tr('Crop', 'फ़सल')} value={f.crop} onChange={up('crop')} options={meta.crops.map((c) => ({ value: c.key, label: lang === 'hi' ? c.hi : c.en }))} />
        <Input label={tr('Min quintal', 'कम से कम क्विंटल')} inputMode="decimal" value={f.minQtyQtl} onChange={up('minQtyQtl')} required />
        <Input label={tr('Max quintal', 'ज़्यादा से ज़्यादा क्विंटल')} inputMode="decimal" value={f.maxQtyQtl} onChange={up('maxQtyQtl')} required />
        <Input label={tr('Your price ₹/kg at farm', 'खेत पर आपका भाव ₹/किलो')} inputMode="decimal" value={f.offerPricePerKg} onChange={up('offerPricePerKg')} required hint={tr('Farmers see how this compares with their best mandi', 'किसान इसे अपनी सबसे अच्छी मंडी से मिलाकर देखेंगे')} />
        <Input label={tr('Needed by', 'कब तक चाहिए')} type="date" min={today()} value={f.neededBy} onChange={up('neededBy')} required />
        <Select label={tr('Base state', 'राज्य')} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value, district: '' })} options={STATES.map((s) => ({ value: s.value, label: lang === 'hi' ? s.hi : s.value }))} />
        <Select label={tr('Base district', 'ज़िला')} value={f.district} onChange={up('district')} options={[{ value: '', label: tr('Choose…', 'चुनें…') }, ...districts.map((d) => ({ value: d.district, label: lang === 'hi' ? d.hi : d.district }))]} />
        <Select label={tr('Collect within', 'कितनी दूरी तक')} value={f.radiusKm} onChange={up('radiusKm')} options={[50, 100, 150, 250, 400].map((k) => ({ value: k, label: `${k} km` }))} />
        <Input label={tr('Payment terms', 'भुगतान की शर्त')} value={f.paymentTerms} onChange={up('paymentTerms')} />
        <Textarea className="span-2" label={tr('Quality needed (optional)', 'क्वालिटी (वैकल्पिक)')} value={f.quality} onChange={up('quality')} />
        <ErrorBox error={error} />
        <Button className="span-2" variant="primary" size="lg" loading={busy} type="submit" disabled={!f.district}>
          {tr('Post requirement', 'माँग डालें')}
        </Button>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------ cards */
function RequestCard({ r, meta, canDeal, onDeal }) {
  const { tr, lang } = useT();
  return (
    <div className="card stack" style={{ '--gap': '12px' }}>
      <div className="row" style={{ '--gap': '12px', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <CropBadge meta={meta} crop={r.crop} />
        <div className="grow">
          <div className="row between">
            <strong style={{ fontSize: '1.1rem' }}>
              {cropName(meta, r.crop, lang)}
              {r.variety ? ` · ${r.variety}` : ''}
            </strong>
            <span className="price">{kg(r.offerPricePerKg)}</span>
          </div>
          <div className="small">
            {r.minQtyQtl}–{r.maxQtyQtl} {tr('quintal', 'क्विंटल')} · {qtl(r.offerPricePerKg)} · {tr('by', 'तक')} {new Date(r.neededBy).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
          </div>
          <div className="tiny muted">
            {tr('Collects within', 'यहाँ से')} {r.radiusKm} km {tr('of', 'तक:')} {districtName(meta, r.base.district, lang)}
            {r.distanceKm != null && ` · ${tr('you are', 'आप')} ${r.distanceKm} km ${tr('away', 'दूर')}`}
            {r.withinReach === false && <strong style={{ color: 'var(--chili)' }}> · {tr('outside their area', 'इनके इलाक़े से बाहर')}</strong>}
          </div>
        </div>
      </div>
      <div className="small" style={{ background: 'var(--paper)', border: '1.5px dashed var(--ink)', padding: '6px 10px' }}>
        💰 {r.paymentTerms}
        {r.pickupByBroker && ` · 🚚 ${tr('broker sends vehicle', 'गाड़ी व्यापारी भेजेगा')}`}
      </div>
      <OfferCheck check={r.offerCheck} bench={r.benchmark} meta={meta} crop={r.crop} />
      <BrokerTrust b={r.broker} meta={meta} />
      {canDeal ? (
        <Button variant="primary" onClick={() => onDeal(r)}>
          {tr('I want to sell to this broker', 'मैं इस व्यापारी को बेचना चाहता हूँ')}
        </Button>
      ) : !r.broker.phone ? (
        <Link to="/login?next=/vyapar" className="btn sm">
          {tr('Log in as a farmer to see phone number', 'नंबर देखने के लिए किसान के रूप में लॉग इन करें')}
        </Link>
      ) : null}
    </div>
  );
}

function ListingCard({ l, meta, canOffer, onOffer }) {
  const { tr, lang } = useT();
  return (
    <div className="card stack" style={{ '--gap': '10px' }}>
      <div className="row" style={{ '--gap': '12px', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <CropBadge meta={meta} crop={l.crop} />
        <div className="grow">
          <div className="row between">
            <strong style={{ fontSize: '1.1rem' }}>
              {l.quantityQtl} {tr('qtl', 'क्विं.')} {cropName(meta, l.crop, lang)}
              {l.variety ? ` · ${l.variety}` : ''}
            </strong>
            <span className="price">{l.expectedPricePerKg ? kg(l.expectedPricePerKg) : tr('Best offer', 'सबसे अच्छा ऑफ़र')}</span>
          </div>
          <div className="small">
            📍 {[l.location.village, districtName(meta, l.location.district, lang)].filter(Boolean).join(', ')}
            {l.distanceKm != null && ` · ${l.distanceKm} km`}
          </div>
          <div className="tiny muted">
            {tr('Ready from', 'तैयार')} {new Date(l.readyFrom).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })} · {l.farmer.name}
            {l.farmer.verified && ` ✓ ${tr('verified farmer', 'सत्यापित किसान')}`}
          </div>
        </div>
      </div>
      {l.quality && <p className="small" style={{ margin: 0 }}>“{l.quality}”</p>}
      {canOffer && (
        <Button variant="primary" onClick={() => onOffer(l)}>
          {tr('Send offer', 'ऑफ़र भेजें')}
        </Button>
      )}
      <p className="tiny muted" style={{ margin: 0 }}>{tr('The farmer’s number is shared once they accept your offer.', 'किसान का नंबर ऑफ़र मंज़ूर होने पर दिखेगा।')}</p>
    </div>
  );
}

function DealsList({ meta }) {
  const { tr, lang } = useT();
  const { data, loading, error, reload } = useFetch('/connect/deals');
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data.items.length) return <Empty sticker title={tr('No deals yet', 'अभी कोई सौदा नहीं')} />;
  return (
    <div className="card" style={{ padding: '0 16px' }}>
      {data.items.map((d) => (
        <Link key={d._id} to={`/vyapar/deals/${d._id}`} className="list-item">
          <CropBadge meta={meta} crop={d.crop} size={40} />
          <div className="grow">
            <strong>
              {d.quantityQtl} {tr('qtl', 'क्विं.')} {cropName(meta, d.crop, lang)} · {kg(d.pricePerKg)}
            </strong>
            <div className="small muted">
              {d.farmer?.name} ↔ {d.broker?.brokerProfile?.businessName || d.broker?.name}
            </div>
            <div className="tiny muted">{new Date(d.pickupDate).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}</div>
          </div>
          <DealStatus value={d.status} />
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ page */
export default function Vyapar() {
  const { user } = useAuth();
  const { tr, lang } = useT();
  const toast = useToast();
  const { meta, error: metaErr } = useMarketMeta();
  const [sp, setSp] = useSearchParams();
  const role = user?.role;
  const isFarmer = role === 'farmer';
  const isBroker = role === 'broker';
  const tabs = isBroker
    ? [['listings', tr('Farmers’ crops', 'किसानों की फ़सल')], ['mine', tr('My requirements', 'मेरी माँग')], ['deals', tr('Deals', 'सौदे')]]
    : isFarmer
      ? [['requests', tr('Brokers buying', 'व्यापारियों की माँग')], ['mine', tr('My crops', 'मेरी फ़सल')], ['deals', tr('Deals', 'सौदे')], ['brokers', tr('Brokers', 'व्यापारी')]]
      : [['requests', tr('Brokers buying', 'व्यापारियों की माँग')], ['listings', tr('Farmers’ crops', 'किसानों की फ़सल')], ['brokers', tr('Brokers', 'व्यापारी')]];
  const tab = tabs.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : tabs[0][0];
  const crop = sp.get('crop') || '';
  const state = sp.get('state') || '';
  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n, { replace: true });
  };
  const [proposal, setProposal] = useState(null);
  const [creating, setCreating] = useState(false);

  const feedPath =
    tab === 'requests' ? `/connect/requests${qs({ crop, state })}` : tab === 'listings' ? `/connect/listings${qs({ crop, state })}` : tab === 'brokers' ? `/connect/brokers${qs({ state })}` : tab === 'mine' ? (isFarmer ? '/connect/listings/mine' : '/connect/requests/mine') : null;
  const feed = useFetch(meta && feedPath ? feedPath : null);

  if (metaErr) return <div className="container page"><ErrorBox error={metaErr} /></div>;
  if (!meta) return <Loading />;

  const closeMine = async (item) => {
    try {
      await api(isFarmer ? `/connect/listings/${item._id}` : `/connect/requests/${item._id}`, { method: 'PATCH', body: { status: 'closed' } });
      toast(tr('Closed', 'बंद किया'), 'ok');
      feed.reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="container page stack" style={{ '--gap': '18px' }}>
      <div className="row between">
        <div>
          <span className="eyebrow">{tr('Farmer ↔ Broker · bulk trade at the farm gate', 'किसान ↔ व्यापारी · खेत से थोक सौदा')}</span>
          <h1 style={{ marginTop: 6 }}>{tr('Vyapar', 'व्यापार')}</h1>
        </div>
        <div className="row">
          <Link to="/mandi" className="btn">{tr('Mandi Bhav', 'मंडी भाव')}</Link>
          <Link to="/mandi/calculator" className="btn accent">{tr('Where should I sell?', 'कहाँ बेचूँ?')}</Link>
        </div>
      </div>

      {!user && (
        <div className="card tint-turmeric row between">
          <span>
            <strong>{tr('Farmers: find genuine buyers. Brokers: find crops near you.', 'किसान: असली ख़रीदार ढूँढें। व्यापारी: पास की फ़सल ढूँढें।')}</strong>
            <br />
            <span className="small">{tr('Payment is made at the farm when the crop is loaded. Every broker’s record is public.', 'भुगतान खेत पर माल लोड होते समय। हर व्यापारी का रिकॉर्ड सबके सामने।')}</span>
          </span>
          <div className="row">
            <Link to="/register?role=farmer" className="btn primary">{tr('I’m a farmer', 'मैं किसान हूँ')}</Link>
            <Link to="/register?role=broker" className="btn">{tr('I’m a broker', 'मैं व्यापारी हूँ')}</Link>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => set('tab', k)}>
            {l}
          </button>
        ))}
      </div>

      {['requests', 'listings'].includes(tab) && <Filters meta={meta} crop={crop} state={state} set={set} />}

      {tab === 'requests' && isFarmer && !user.phone && (
        <div className="alert warn small">
          <Icon name="alert" /> <span>{tr('Add your mobile number in Account so brokers can call you back after you agree a deal.', 'खाते में अपना मोबाइल नंबर डालें, ताकि सौदा तय होने पर व्यापारी आपको कॉल कर सकें।')} <Link to="/account">{tr('Add number', 'नंबर डालें')}</Link></span>
        </div>
      )}

      {tab === 'deals' ? (
        <DealsList meta={meta} />
      ) : (
        <>
          {tab === 'mine' && (
            <Button variant="accent" size="lg" onClick={() => setCreating(true)} style={{ alignSelf: 'flex-start' }}>
              <Icon name="plus" /> {isFarmer ? tr('Post crop for sale', 'बेचने के लिए फ़सल डालें') : tr('Post what you want to buy', 'ख़रीदने की माँग डालें')}
            </Button>
          )}
          <ErrorBox error={feed.error} onRetry={feed.reload} />
          {feed.loading ? (
            <Loading />
          ) : !feed.data?.items?.length ? (
            <Empty sticker title={tr('Nothing here yet', 'अभी कुछ नहीं')}>
              {tab === 'requests' ? tr('No broker is buying this crop right now. Post your crop so brokers can find you.', 'अभी कोई व्यापारी यह फ़सल नहीं ख़रीद रहा। अपनी फ़सल डालें ताकि व्यापारी आपको ढूँढ सकें।') : ''}
            </Empty>
          ) : (
            <div className="grid" style={{ '--min': '320px' }}>
              {tab === 'requests' && feed.data.items.map((r) => <RequestCard key={r._id} r={r} meta={meta} canDeal={isFarmer} onDeal={(x) => setProposal({ kind: 'request', target: x })} />)}
              {tab === 'listings' && feed.data.items.map((l) => <ListingCard key={l._id} l={l} meta={meta} canOffer={isBroker} onOffer={(x) => setProposal({ kind: 'listing', target: x })} />)}
              {tab === 'brokers' &&
                feed.data.items.map((b) => (
                  <div key={b._id} className="card">
                    <BrokerTrust b={b} meta={meta} />
                  </div>
                ))}
              {tab === 'mine' &&
                feed.data.items.map((x) => (
                  <div key={x._id} className="card stack" style={{ '--gap': '8px', opacity: x.status === 'open' ? 1 : 0.6 }}>
                    <div className="row" style={{ '--gap': '12px', flexWrap: 'nowrap' }}>
                      <CropBadge meta={meta} crop={x.crop} />
                      <div className="grow">
                        <strong>
                          {cropName(meta, x.crop, lang)} · {isFarmer ? `${x.quantityQtl} ${tr('qtl', 'क्विं.')}` : `${x.minQtyQtl}–${x.maxQtyQtl} ${tr('qtl', 'क्विं.')}`}
                        </strong>
                        <div className="small">{isFarmer ? (x.expectedPricePerKg ? kg(x.expectedPricePerKg) : tr('Best offer', 'सबसे अच्छा ऑफ़र')) : kg(x.offerPricePerKg)}</div>
                        <div className="tiny muted">{districtName(meta, (x.location || x.base).district, lang)}</div>
                      </div>
                      <span className={`badge ${x.status === 'open' ? 'leaf' : 'soft'}`}>{x.status}</span>
                    </div>
                    {x.status === 'open' && (
                      <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => closeMine(x)}>
                        {tr('Close', 'बंद करें')}
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {proposal && <ProposeModal meta={meta} target={proposal.target} kind={proposal.kind} onClose={() => setProposal(null)} />}
      {creating && isFarmer && <NewListingModal meta={meta} onClose={() => setCreating(false)} onDone={() => (setCreating(false), toast(tr('Crop posted', 'फ़सल डाल दी'), 'ok'), feed.reload())} />}
      {creating && isBroker && <NewRequestModal meta={meta} onClose={() => setCreating(false)} onDone={() => (setCreating(false), toast(tr('Requirement posted', 'माँग डाल दी'), 'ok'), feed.reload())} />}
    </div>
  );
}
