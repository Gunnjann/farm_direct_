import { useParams } from 'react-router-dom';
import { useFetch } from '../context/AppContext';
import { date } from '../lib/format';
import ProductCard from '../components/ProductCard';
import { Empty, ErrorBox, Loading, Stars } from '../components/ui';

export default function SellerPublic() {
  const { id } = useParams();
  const { data, error, loading, reload } = useFetch(`/seller/${id}/public`);
  if (loading) return <Loading />;
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>;
  const { seller: s, products, rating } = data;
  const sp = s.supplierProfile || {};
  return (
    <div className="container page stack" style={{ '--gap': '24px' }}>
      <div className="card stack">
        <div className="row between">
          <div>
            <span className="eyebrow">{s.role === 'trader' ? 'Trader' : 'Farmer'} · on FarmDirect since {date(s.createdAt)}</span>
            <h1 style={{ margin: '6px 0' }}>{sp.displayName || s.name}</h1>
            <span className="muted">{[sp.village, sp.district, sp.state].filter(Boolean).join(', ')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            {sp.verified ? <span className="badge leaf">✓ Verified seller</span> : <span className="badge soft">Verification pending</span>}
            {rating && <Stars value={rating.avg} count={rating.count} />}
          </div>
        </div>
        {sp.bio && <p style={{ margin: 0 }}>{sp.bio}</p>}
        <div className="small">
          <strong>Delivers to:</strong> <span className="mono">{(sp.serviceAreas || []).map((a) => a.pincode).join(', ') || '—'}</span>
          {sp.pickupAvailable && ' · Pickup available'}
        </div>
      </div>
      <h2 style={{ margin: 0 }}>Products</h2>
      {products.length ? <div className="grid pgrid">{products.map((p) => <ProductCard key={p._id} product={{ ...p, supplier: s }} />)}</div> : <Empty title="No products in stock right now" />}
    </div>
  );
}
