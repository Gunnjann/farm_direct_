import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AppContext';
import { api } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { useMarketMeta, STATES, inr, perKg, cropName, districtName } from '../../lib/market';
import { Button, ErrorBox, Icon, Loading } from '../../components/ui';
import { CropPicker, SourceBadge } from './MandiBhav';

const PARTS = [
  ['transport', '#7A4B2A', 'Transport', 'भाड़ा'],
  ['commission', '#C8381F', 'Commission', 'कमीशन'],
  ['marketFee', '#E8792B', 'Mandi fee', 'मंडी शुल्क'],
  ['hamali', '#F2B632', 'Hamali', 'हमाली'],
  ['packaging', '#CFE0EA', 'Packaging', 'पैकिंग'],
  ['labour', '#9CCB5B', 'Harvest labour', 'तुड़ाई मज़दूरी'],
];

/** Where the money goes: one bar = mandi value of your full crop. */
function MoneyBar({ row }) {
  const { tr } = useT();
  const b = row.breakdown;
  const whole = b.gross + b.spoilageLoss;
  const seg = [...PARTS.map(([k, c, en, hi]) => ({ v: b[k], c, label: tr(en, hi) })), { v: b.spoilageLoss, c: '#B0466A', label: tr('Spoilage', 'ख़राबी') }];
  const net = Math.max(0, row.net);
  return (
    <div>
      <div style={{ display: 'flex', height: 22, border: 'var(--b)', background: 'var(--card)' }} role="img" aria-label={`Net ${inr(row.net)} out of ${inr(whole)}`}>
        <div style={{ width: `${(net / whole) * 100}%`, background: 'var(--leaf)' }} title={`${tr('In your hand', 'आपके हाथ में')} ${inr(row.net)}`} />
        {seg.map((s, i) => (s.v > 0 ? <div key={i} style={{ width: `${(s.v / whole) * 100}%`, background: s.c, borderLeft: '1px solid var(--ink)' }} title={`${s.label} ${inr(s.v)}`} /> : null))}
      </div>
    </div>
  );
}

function Breakdown({ row }) {
  const { tr } = useT();
  const b = row.breakdown;
  return (
    <table className="ledger small" style={{ marginTop: 10 }}>
      <tbody>
        <tr>
          <td>
            {tr('Sale value', 'बिक्री मूल्य')} <span className="muted tiny">({row.spoilPct}% {tr('lost on the way', 'रास्ते में ख़राब')})</span>
          </td>
          <td className="num">{inr(b.gross)}</td>
        </tr>
        {PARTS.map(([k, c, en, hi]) => (
          <tr key={k}>
            <td>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: c, border: '1.5px solid var(--ink)', marginRight: 6 }} />− {tr(en, hi)}
            </td>
            <td className="num">{inr(b[k])}</td>
          </tr>
        ))}
        <tr>
          <td>
            <strong>{tr('In your hand', 'आपके हाथ में')}</strong>
          </td>
          <td className="num">
            <strong style={{ color: row.net < 0 ? 'var(--chili)' : 'var(--leaf)' }}>{inr(row.net)}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default function Calculator() {
  const { lang, tr } = useT();
  const { user } = useAuth();
  const { meta, error: metaErr } = useMarketMeta();
  const [sp] = useSearchParams();
  const sp0 = user?.supplierProfile || {};
  const bp0 = user?.brokerProfile || {};
  const [f, setF] = useState({
    crop: sp.get('crop') || 'cauliflower',
    quantityQtl: Number(sp.get('qty')) || 40,
    state: sp0.farmState || bp0.state || 'Madhya Pradesh',
    district: sp0.farmDistrict || bp0.district || 'Dewas',
    vehicle: 'truck',
    sellIn: 'both',
  });
  const [geo, setGeo] = useState(null);
  const [adv, setAdv] = useState(false);
  const [ov, setOv] = useState({});
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openRow, setOpenRow] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const offer = Number(sp.get('offer')) || null;

  const run = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const overrides = Object.fromEntries(Object.entries(ov).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, Number(v)]));
      const body = { crop: f.crop, quantityQtl: Number(f.quantityQtl), vehicle: f.vehicle, sellIn: f.sellIn, overrides, ...(geo ? { lat: geo.lat, lng: geo.lng } : { state: f.state, district: f.district }) };
      setRes(await api('/market/calculate', { method: 'POST', body }));
      setOpenRow(0);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (meta) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, f.crop]);

  if (metaErr) return <div className="container page"><ErrorBox error={metaErr} /></div>;
  if (!meta) return <Loading />;
  const c = meta.crops.find((x) => x.key === f.crop);
  const districts = meta.locations.filter((l) => l.state === f.state);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const useGps = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError({ message: tr('Could not get your location. Choose your district instead.', 'आपकी लोकेशन नहीं मिली। ज़िला चुनें।') }),
      { timeout: 10000 }
    );

  const best = res?.best;
  const nearest = res?.nearest;
  const verdict = offer && res?.minFairFarmGatePerKg != null ? offer - res.minFairFarmGatePerKg : null;

  return (
    <div className="container page stack" style={{ '--gap': '18px' }}>
      <div>
        <span className="eyebrow">{tr('Profit / loss calculator', 'फ़ायदा / नुक़सान कैलकुलेटर')}</span>
        <h1 style={{ marginTop: 6 }}>{tr('Where should I sell?', 'कहाँ बेचूँ?')}</h1>
        <p className="muted" style={{ maxWidth: 680, margin: 0 }}>
          {tr(
            'We take each mandi’s latest price and subtract truck fare, commission, mandi fee, hamali, packaging, harvest labour and spoilage on the way — so you see what actually reaches your hand.',
            'हर मंडी के ताज़ा भाव में से ट्रक भाड़ा, कमीशन, मंडी शुल्क, हमाली, पैकिंग, तुड़ाई मज़दूरी और रास्ते की ख़राबी घटाकर बताते हैं कि असल में आपके हाथ में कितना आएगा।'
          )}
        </p>
      </div>

      <CropPicker meta={meta} value={f.crop} onChange={(k) => setF({ ...f, crop: k })} />

      <form className="card form-grid cols-2" onSubmit={run}>
        <div className="field">
          <label htmlFor="qty">{tr('Quantity (quintal)', 'मात्रा (क्विंटल)')}</label>
          <input id="qty" className="input" inputMode="decimal" value={f.quantityQtl} onChange={up('quantityQtl')} />
          <span className="hint">1 {tr('quintal', 'क्विंटल')} = 100 kg</span>
        </div>
        <div className="field">
          <label htmlFor="veh">{tr('Vehicle', 'गाड़ी')}</label>
          <select id="veh" className="input" value={f.vehicle} onChange={up('vehicle')}>
            {meta.vehicles.map((v) => (
              <option key={v.key} value={v.key}>
                {lang === 'hi' ? v.hi : v.en} · ₹{v.ratePerKm}/km
              </option>
            ))}
          </select>
        </div>
        {geo ? (
          <div className="field span-2">
            <label>{tr('Your farm', 'आपका खेत')}</label>
            <div className="row">
              <span className="badge leaf">📍 {tr('Using your current location', 'आपकी मौजूदा लोकेशन')}</span>
              <button type="button" className="link-btn small" onClick={() => setGeo(null)}>
                {tr('Choose district instead', 'ज़िला चुनें')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="st">{tr('Your state', 'आपका राज्य')}</label>
              <select id="st" className="input" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value, district: meta.locations.find((l) => l.state === e.target.value).district })}>
                {STATES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {lang === 'hi' ? s.hi : s.value}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dist">{tr('Your district', 'आपका ज़िला')}</label>
              <select id="dist" className="input" value={f.district} onChange={up('district')}>
                {districts.map((d) => (
                  <option key={d.district} value={d.district}>
                    {lang === 'hi' ? d.hi : d.district}
                  </option>
                ))}
              </select>
              <button type="button" className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={useGps}>
                {tr('or use my location', 'या मेरी लोकेशन लें')}
              </button>
            </div>
          </>
        )}
        <div className="field span-2">
          <label>{tr('Sell in', 'कहाँ बेचना है')}</label>
          <div className="segmented">
            <button type="button" aria-pressed={f.sellIn === 'both'} onClick={() => setF({ ...f, sellIn: 'both' })}>{tr('Both states', 'दोनों राज्य')}</button>
            {STATES.map((s) => (
              <button key={s.value} type="button" aria-pressed={f.sellIn === s.value} onClick={() => setF({ ...f, sellIn: s.value })}>
                {lang === 'hi' ? s.hi : s.value}
              </button>
            ))}
          </div>
        </div>
        <details className="span-2" open={adv} onToggle={(e) => setAdv(e.currentTarget.open)}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{tr('Change cost assumptions', 'ख़र्च के अनुमान बदलें')}</summary>
          <p className="tiny muted">{tr('Defaults are typical figures, not official rates. Put your real numbers for an exact answer.', 'ये आम अनुमान हैं, सरकारी दरें नहीं। सही जवाब के लिए अपने असली ख़र्च डालें।')}</p>
          <div className="form-grid cols-2">
            {[
              ['ratePerKm', tr('Truck fare ₹/km (both ways)', 'भाड़ा ₹/किमी (आना-जाना)'), meta.vehicles.find((v) => v.key === f.vehicle)?.ratePerKm],
              ['commissionPct', tr('Commission %', 'कमीशन %'), c?.commissionPct],
              ['marketFeePct', tr('Mandi fee %', 'मंडी शुल्क %'), '1–1.5'],
              ['hamaliPerQtl', tr('Hamali ₹/quintal', 'हमाली ₹/क्विंटल'), '10–25'],
              ['packagingPerQtl', tr('Packaging ₹/quintal', 'पैकिंग ₹/क्विंटल'), c?.packagingPerQtl],
              ['labourPerQtl', tr('Harvest labour ₹/quintal', 'तुड़ाई ₹/क्विंटल'), c?.labourPerQtl],
              ['perishPer100Km', tr('Spoilage % per 100 km', 'ख़राबी % प्रति 100 किमी'), c?.perishPer100Km],
            ].map(([k, label, ph]) => (
              <div className="field" key={k}>
                <label htmlFor={k}>{label}</label>
                <input id={k} className="input" inputMode="decimal" placeholder={String(ph ?? '')} value={ov[k] ?? ''} onChange={(e) => setOv({ ...ov, [k]: e.target.value })} />
              </div>
            ))}
          </div>
        </details>
        <div className="span-2">
          <Button variant="primary" size="lg" block loading={busy} type="submit">
            {tr('Calculate', 'हिसाब लगाएँ')}
          </Button>
        </div>
      </form>

      <ErrorBox error={error} />

      {res && best && (
        <>
          {res.sources?.includes('sample') && (
            <div className="alert warn small">
              <Icon name="alert" /> {tr('Uses SAMPLE prices for some mandis — check today’s real rate before you load the truck.', 'कुछ मंडियों के सैंपल भाव हैं — गाड़ी भरने से पहले आज का असली भाव ज़रूर जाँचें।')}
            </div>
          )}

          <div className="calc-hero">
            <div className="card ink stack" style={{ '--gap': '8px' }}>
              <span className="eyebrow" style={{ color: 'var(--turmeric)' }}>{tr('Best option', 'सबसे फ़ायदेमंद')}</span>
              <h2 style={{ margin: 0 }}>{lang === 'hi' ? best.nameHi || best.market : best.market}</h2>
              <div className="price" style={{ fontSize: '2.4rem', color: best.net < 0 ? '#ff8a73' : 'var(--turmeric)' }}>{inr(best.net)}</div>
              <div>
                {perKg(best.netPerKg)} {tr('in hand', 'हाथ में')} · {best.distanceKm} km · ~{Math.ceil(best.travelHours)} {tr('hrs', 'घंटे')}
              </div>
              {nearest && nearest.market !== best.market && (
                <div className="small" style={{ opacity: 0.85 }}>
                  {tr('vs nearest mandi', 'पास की मंडी')} ({lang === 'hi' ? nearest.nameHi || nearest.market : nearest.market}): {inr(nearest.net)} →{' '}
                  <strong style={{ color: 'var(--turmeric)' }}>+{inr(res.gainVsNearest)}</strong>
                </div>
              )}
            </div>
            <div className="card tint-turmeric stack" style={{ '--gap': '8px' }}>
              <span className="eyebrow">{tr('Selling to a broker at your farm?', 'खेत पर व्यापारी को बेच रहे हैं?')}</span>
              <div className="price" style={{ fontSize: '2rem' }}>{perKg(res.minFairFarmGatePerKg)}</div>
              <p className="small" style={{ margin: 0 }}>
                {tr(
                  `Don’t accept less than this at the farm gate (broker’s vehicle). Below this, taking your ${cropName(meta, f.crop, 'en').toLowerCase()} to ${best.market} yourself pays more.`,
                  `खेत पर (व्यापारी की गाड़ी) इससे कम दाम पर न बेचें। इससे कम में ख़ुद ${best.nameHi || best.market} ले जाना ज़्यादा फ़ायदेमंद है।`
                )}
              </p>
              {verdict != null && (
                <div className={`alert ${verdict >= 0 ? 'ok' : 'error'} small`}>
                  {tr('Broker offer', 'व्यापारी का ऑफ़र')} ₹{offer}/kg: {verdict >= 0 ? tr('fair ✔', 'ठीक है ✔') : tr(`₹${Math.abs(verdict).toFixed(2)}/kg too low`, `₹${Math.abs(verdict).toFixed(2)}/kg कम है`)}
                </div>
              )}
              <Link to={`/vyapar?crop=${f.crop}`} className="btn sm">
                {tr('See brokers buying', 'ख़रीदने वाले व्यापारी देखें')} {cropName(meta, f.crop, lang)} →
              </Link>
            </div>
          </div>

          <div className="row small" style={{ '--gap': '10px' }}>
            <span className="row" style={{ '--gap': '4px' }}><span style={{ width: 12, height: 12, background: 'var(--leaf)', border: '1.5px solid var(--ink)', display: 'inline-block' }} /> {tr('In your hand', 'आपके हाथ में')}</span>
            {PARTS.map(([k, col, en, hi]) => (
              <span key={k} className="row" style={{ '--gap': '4px' }}><span style={{ width: 12, height: 12, background: col, border: '1.5px solid var(--ink)', display: 'inline-block' }} /> {tr(en, hi)}</span>
            ))}
          </div>

          <div className="stack" style={{ '--gap': '10px' }}>
            {(showAll ? res.rows : res.rows.slice(0, 6)).map((r, i) => (
              <div key={r.market} className={`card calc-row ${i === 0 ? 'tint-leaf' : ''}`} style={{ boxShadow: i === 0 ? 'var(--shadow)' : 'none' }}>
                <button className="calc-row-head" onClick={() => setOpenRow(openRow === i ? -1 : i)} aria-expanded={openRow === i}>
                  <span className="calc-rank mono">#{i + 1}</span>
                  <span className="grow" style={{ textAlign: 'left' }}>
                    <strong>{lang === 'hi' ? r.nameHi || r.market : r.market}</strong>
                    <span className="tiny muted" style={{ display: 'block' }}>
                      {districtName(meta, r.district, lang)} · {r.distanceKm} km · {tr('price', 'भाव')} ₹{r.modalPerKg}/kg <SourceBadge source={r.source} />
                    </span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <strong className="mono" style={{ fontSize: '1.15rem', color: r.net < 0 ? 'var(--chili)' : undefined }}>{inr(r.net)}</strong>
                    <span className="tiny" style={{ display: 'block' }}>{r.net < 0 ? tr('LOSS', 'नुक़सान') : perKg(r.netPerKg)}</span>
                  </span>
                </button>
                <MoneyBar row={r} />
                {openRow === i && <Breakdown row={r} />}
              </div>
            ))}
          </div>
          {res.rows.length > 6 && (
            <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
              {showAll ? tr('Show top 6', 'टॉप 6 दिखाएँ') : tr(`Show all ${res.rows.length} mandis`, `सभी ${res.rows.length} मंडियाँ दिखाएँ`)}
            </Button>
          )}
          <p className="tiny muted" style={{ margin: 0 }}>
            {tr(
              `Assumes ${res.vehicle.count} × ${res.vehicle.en}, road distance ≈ straight line × 1.3, average 40 km/h. Fare counts the return trip.`,
              `${res.vehicle.count} × ${res.vehicle.hi}, सड़क दूरी ≈ सीधी दूरी × 1.3, औसत 40 किमी/घंटा। भाड़े में वापसी शामिल है।`
            )}
          </p>
        </>
      )}
    </div>
  );
}
