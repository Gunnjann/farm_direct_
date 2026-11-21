import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFetch } from '../../context/AppContext';
import { qs } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { useMarketMeta, STATES, inr, districtName } from '../../lib/market';
import ProduceArt from '../../components/art/Produce';
import { ErrorBox, Icon, Loading } from '../../components/ui';

export function SourceBadge({ source }) {
  const { tr } = useT();
  if (source === 'agmarknet') return <span className="badge leaf" title="AGMARKNET, Govt. of India">{tr('Govt data', 'सरकारी डेटा')}</span>;
  if (source === 'admin') return <span className="badge sky">{tr('Verified by FarmDirect', 'FarmDirect द्वारा')}</span>;
  return <span className="badge soft" title="Demo data, not real prices">{tr('Sample', 'नमूना')}</span>;
}

export function CropPicker({ meta, value, onChange }) {
  const { lang } = useT();
  return (
    <div className="chips" role="group" aria-label="Crop">
      {meta.crops.map((c) => (
        <button key={c.key} className="chip crop-chip" aria-pressed={value === c.key} onClick={() => onChange(c.key)}>
          <span className="crop-chip-art" aria-hidden="true">
            <ProduceArt name={c.en} category={c.group === 'grain' ? 'grains' : c.group === 'fruit' ? 'fruits' : 'vegetables'} />
          </span>
          {lang === 'hi' ? c.hi : c.en}
        </button>
      ))}
    </div>
  );
}

function Sparkline({ crop, market }) {
  const { data } = useFetch(`/market/history${qs({ crop, market })}`);
  const pts = data?.items || [];
  if (pts.length < 2) return <span className="tiny muted">…</span>;
  const vals = pts.map((p) => p.modalPrice);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const W = 260;
  const H = 54;
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => H - 4 - ((v - min) / Math.max(1, max - min)) * (H - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.modalPrice).toFixed(1)}`).join(' ');
  const up = vals[vals.length - 1] >= vals[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Trend from ${inr(vals[0])} to ${inr(vals[vals.length - 1])} per quintal`}>
      <path d={`${d} L${W} ${H} L0 ${H}Z`} fill={up ? '#d7e8d3' : '#f7d6cc'} />
      <path d={d} fill="none" stroke="#141414" strokeWidth="2" />
      <circle cx={x(pts.length - 1)} cy={y(vals[vals.length - 1])} r="4" fill={up ? '#1E5E3A' : '#C8381F'} stroke="#141414" strokeWidth="2" />
    </svg>
  );
}

export default function MandiBhav() {
  const { lang, tr } = useT();
  const { meta, error: metaErr } = useMarketMeta();
  const [sp, setSp] = useSearchParams();
  const crop = sp.get('crop') || 'cauliflower';
  const state = sp.get('state') || '';
  const [open, setOpen] = useState(null);
  const { data, error, loading, reload } = useFetch(meta ? `/market/prices${qs({ crop, state })}` : null);

  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    v ? n.set(k, v) : n.delete(k);
    setSp(n, { replace: true });
  };

  if (metaErr) return <div className="container page"><ErrorBox error={metaErr} /></div>;
  if (!meta) return <Loading />;
  const c = meta.crops.find((x) => x.key === crop);
  const s = data?.summary;

  return (
    <div className="container page stack" style={{ '--gap': '18px' }}>
      <div className="row between">
        <div>
          <span className="eyebrow">{tr('Wholesale mandi prices · Madhya Pradesh & Maharashtra', 'थोक मंडी भाव · मध्य प्रदेश और महाराष्ट्र')}</span>
          <h1 style={{ marginTop: 6 }}>{tr('Mandi Bhav', 'मंडी भाव')}</h1>
        </div>
        <Link to={`/mandi/calculator?crop=${crop}`} className="btn accent lg">
          {tr('Where should I sell?', 'कहाँ बेचूँ?')} <Icon name="arrow" />
        </Link>
      </div>

      <CropPicker meta={meta} value={crop} onChange={(k) => set('crop', k)} />
      <div className="segmented" role="group" aria-label="State">
        <button aria-pressed={!state} onClick={() => set('state', '')}>{tr('Both states', 'दोनों राज्य')}</button>
        {STATES.map((st) => (
          <button key={st.value} aria-pressed={state === st.value} onClick={() => set('state', st.value)}>
            {lang === 'hi' ? st.hi : st.value}
          </button>
        ))}
      </div>

      {data?.sources?.includes('sample') && (
        <div className="alert warn small">
          <Icon name="alert" />
          <span>
            <strong>{tr('Some prices are SAMPLE data', 'कुछ भाव नमूना (सैंपल) डेटा हैं')}</strong>
            {tr(
              'Sample rows are for demonstration only. Connect the government AGMARKNET feed (data.gov.in key) or enter today’s prices from the mandi board before relying on them.',
              'सैंपल भाव सिर्फ़ दिखाने के लिए हैं। असली फ़ैसले से पहले सरकारी AGMARKNET डेटा जोड़ें या आज के भाव मंडी बोर्ड से डालें।'
            )}
          </span>
        </div>
      )}
      <ErrorBox error={error} onRetry={reload} />

      {loading ? (
        <Loading />
      ) : s ? (
        <>
          <div className="grid" style={{ '--min': '170px' }}>
            <div className="stat" style={{ background: 'var(--leaf-2)' }}>
              <div className="label">{tr('Highest', 'सबसे ज़्यादा')}</div>
              <div className="value">{inr(s.highest.modalPrice / 100, 2)}<small className="tiny">/kg</small></div>
              <div className="small">{lang === 'hi' ? s.highest.nameHi || s.highest.market : s.highest.market}</div>
            </div>
            <div className="stat" style={{ background: 'var(--chili-2)' }}>
              <div className="label">{tr('Lowest', 'सबसे कम')}</div>
              <div className="value">{inr(s.lowest.modalPrice / 100, 2)}<small className="tiny">/kg</small></div>
              <div className="small">{lang === 'hi' ? s.lowest.nameHi || s.lowest.market : s.lowest.market}</div>
            </div>
            <div className="stat">
              <div className="label">{tr('Average', 'औसत')}</div>
              <div className="value">{inr(s.average / 100, 2)}<small className="tiny">/kg</small></div>
              <div className="small">{s.markets} {tr('mandis', 'मंडियाँ')}</div>
            </div>
            <div className="stat hl">
              <div className="label">{tr('Gap', 'अंतर')}</div>
              <div className="value">{Math.round(s.highest.modalPrice / Math.max(1, s.lowest.modalPrice))}×</div>
              <div className="small">{tr('Same crop, different mandi', 'एक ही फ़सल, अलग मंडी')}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>{tr('Mandi', 'मंडी')}</th>
                  <th className="num">{tr('Modal ₹/qtl', 'मॉडल ₹/क्विं.')}</th>
                  <th className="num">₹/kg</th>
                  <th className="num desk-cell">{tr('Min – Max', 'न्यूनतम – अधिकतम')}</th>
                  <th className="desk-cell">{tr('Date', 'तारीख़')}</th>
                  <th>{tr('Source', 'स्रोत')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r, i) => (
                  <Fragment key={r._id}>
                    <tr onClick={() => setOpen(open === r.market ? null : r.market)} style={{ cursor: 'pointer', background: i === 0 ? 'var(--leaf-2)' : undefined }}>
                      <td>
                        <strong>{lang === 'hi' ? r.nameHi || r.market : r.market}</strong>
                        <div className="tiny muted">
                          {districtName(meta, r.district, lang)}, {r.state === 'Maharashtra' ? tr('MH', 'महा.') : tr('MP', 'म.प्र.')}
                        </div>
                      </td>
                      <td className="num">{inr(r.modalPrice)}</td>
                      <td className="num">
                        <strong>{(r.modalPrice / 100).toFixed(2)}</strong>
                      </td>
                      <td className="num desk-cell">
                        {inr(r.minPrice)} – {inr(r.maxPrice)}
                      </td>
                      <td className="desk-cell small">{new Date(r.date).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td>
                        <SourceBadge source={r.source} />
                      </td>
                    </tr>
                    {open === r.market && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--paper)' }}>
                          <div className="small" style={{ marginBottom: 4 }}>{tr('Last 3 weeks (modal price)', 'पिछले 3 हफ़्ते (मॉडल भाव)')}</div>
                          <Sparkline crop={crop} market={r.market} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ margin: 0 }}>
            {tr(
              'Modal price = the price at which most of the crop was sold that day. Tap a row to see its trend. Prices are wholesale per quintal (100 kg).',
              'मॉडल भाव = वह भाव जिस पर उस दिन सबसे ज़्यादा माल बिका। ट्रेंड देखने के लिए पंक्ति पर टैप करें। भाव थोक, प्रति क्विंटल (100 किलो) हैं।'
            )}
          </p>
        </>
      ) : (
        <div className="empty">{tr(`No recent prices for ${c?.en}`, `${c?.hi} के हाल के भाव नहीं मिले`)}</div>
      )}
    </div>
  );
}
