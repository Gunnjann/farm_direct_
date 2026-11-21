import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../../context/AppContext';
import { useT } from '../../lib/i18n';
import { useMarketMeta, cropName } from '../../lib/market';
import { ErrorBox, Loading, Stars } from '../../components/ui';
import { BrokerTrust, CropBadge, kg } from './parts';

export default function BrokerProfile() {
  const { id } = useParams();
  const { tr, lang } = useT();
  const { meta } = useMarketMeta();
  const { data, error, loading, reload } = useFetch(`/connect/brokers/${id}`);
  if (loading || !meta) return <Loading />;
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>;
  const { broker: b, requests, reviews } = data;
  return (
    <div className="container page stack" style={{ '--gap': '20px', maxWidth: 900 }}>
      <Link to="/vyapar?tab=brokers" className="small">← {tr('Brokers', 'व्यापारी')}</Link>
      <div className="card stack">
        <span className="eyebrow">{tr('Broker', 'व्यापारी')} · {tr('on FarmDirect since', 'FarmDirect पर')} {new Date(b.memberSince).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short', year: 'numeric' })}</span>
        <BrokerTrust b={b} meta={meta} />
        {b.about && <p style={{ margin: 0 }}>{b.about}</p>}
        <div className="small muted">
          {b.licenseOnFile ? tr('Mandi licence on file with FarmDirect.', 'मंडी लाइसेंस FarmDirect के पास दर्ज है।') : tr('No licence on file.', 'लाइसेंस दर्ज नहीं।')}{' '}
          {tr('Record is built only from deals that farmers confirmed.', 'रिकॉर्ड सिर्फ़ किसानों द्वारा पुष्टि किए गए सौदों से बनता है।')}
        </div>
      </div>
      <div className="card">
        <div className="panel-title">{tr('Currently buying', 'अभी ख़रीद रहे हैं')}</div>
        {requests.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>{tr('No open requirements.', 'कोई खुली माँग नहीं।')}</p>
        ) : (
          requests.map((r) => (
            <div key={r._id} className="list-item">
              <CropBadge meta={meta} crop={r.crop} size={36} />
              <span className="grow">
                {cropName(meta, r.crop, lang)} · {r.minQtyQtl}–{r.maxQtyQtl} {tr('qtl', 'क्विं.')}
              </span>
              <strong className="mono">{kg(r.offerPricePerKg)}</strong>
            </div>
          ))
        )}
      </div>
      <div className="card">
        <div className="panel-title">{tr('What farmers say', 'किसान क्या कहते हैं')}</div>
        {reviews.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>{tr('No reviews yet.', 'अभी कोई समीक्षा नहीं।')}</p>
        ) : (
          reviews.map((r, i) => (
            <div key={i} className="list-item" style={{ display: 'block' }}>
              <div className="row between">
                <strong>
                  {r.farmer} · {cropName(meta, r.crop, lang)}
                </strong>
                <Stars value={r.rating} />
              </div>
              {r.review && <p className="small" style={{ margin: '4px 0 0' }}>{r.review}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
