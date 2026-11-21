import { Link } from 'react-router-dom';
import { useAuth, useFetch } from '../../context/AppContext';
import { rupees, dateTime } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { ErrorBox, Icon, Loading, Status } from '../../components/ui';

function SalesBars({ daily }) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    days.push({ key, label: d.getDate(), v: daily.find((x) => x._id === key)?.sales || 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.v));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, borderBottom: 'var(--b)' }} role="img" aria-label="Sales over the last 14 days">
        {days.map((d) => (
          <div key={d.key} title={`${d.key}: ${rupees(d.v)}`} style={{ flex: 1, height: `${(d.v / max) * 100}%`, minHeight: d.v ? 4 : 0, background: 'var(--leaf)', border: d.v ? '1.5px solid var(--ink)' : 0 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }} className="tiny mono muted">
        {days.map((d) => (
          <span key={d.key} style={{ flex: 1, textAlign: 'center' }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const { t, tr } = useT();
  const stats = useFetch('/seller/stats');
  const orders = useFetch('/orders/seller?status=new');
  const sp = user.supplierProfile || {};

  if (stats.loading) return <Loading />;
  if (stats.error) return <div className="container page"><ErrorBox error={stats.error} onRetry={stats.reload} /></div>;
  const s = stats.data;
  const noAreas = !(sp.serviceAreas || []).length && !sp.pickupAvailable;

  return (
    <div className="container page stack" style={{ '--gap': '20px' }}>
      <div className="row between">
        <div>
          <span className="eyebrow">{user.role} dashboard</span>
          <h1 style={{ margin: '6px 0 0' }}>{sp.displayName || user.name}</h1>
        </div>
        <Link to="/seller/products/new" className="btn accent">
          <Icon name="plus" /> {t('Add product')}
        </Link>
      </div>

      {noAreas && (
        <div className="alert error">
          <Icon name="alert" />
          <span>
            <strong>Buyers can't find you yet</strong>Add the pincodes you deliver to (or turn on pickup). <Link to="/seller/settings">Set delivery areas →</Link>
          </span>
        </div>
      )}
      {!s.verified && (
        <div className="alert warn">
          <Icon name="shield" />
          <span>
            <strong>Verification pending</strong>Our team will call you to verify your farm/shop. Verified sellers get a badge and more orders.
          </span>
        </div>
      )}

      {user.role === 'farmer' && (
        <div className="grid" style={{ '--min': '260px' }}>
          <Link to="/mandi/calculator" className="card tint-turmeric" style={{ textDecoration: 'none' }}>
            <strong style={{ fontSize: '1.15rem' }}>{tr('Where should I sell? →', 'कहाँ बेचूँ? →')}</strong>
            <div className="small">{tr('Compare every mandi after truck fare, commission & spoilage', 'भाड़ा, कमीशन और ख़राबी घटाकर हर मंडी की तुलना')}</div>
          </Link>
          <Link to="/vyapar" className="card tint-leaf" style={{ textDecoration: 'none' }}>
            <strong style={{ fontSize: '1.15rem' }}>{tr('Sell in bulk to brokers →', 'व्यापारियों को थोक में बेचें →')}</strong>
            <div className="small">{tr('Verified brokers, payment at pickup', 'सत्यापित व्यापारी, उठान पर भुगतान')}</div>
          </Link>
        </div>
      )}

      <div className="grid" style={{ '--min': '160px' }}>
        <Link to="/seller/orders" className="stat hl" style={{ textDecoration: 'none' }}>
          <div className="label">{t('New orders')}</div>
          <div className="value">{s.newOrders}</div>
        </Link>
        <div className="stat">
          <div className="label">In progress</div>
          <div className="value">{s.activeOrders}</div>
        </div>
        <div className="stat">
          <div className="label">Earned · 30 days</div>
          <div className="value">{rupees(s.earnings30)}</div>
        </div>
        <div className="stat">
          <div className="label">Rating</div>
          <div className="value">{s.rating ? `${s.rating.avg}★` : '—'}</div>
        </div>
      </div>

      <div className="two-col">
        <div className="stack" style={{ '--gap': '20px' }}>
          <div className="card">
            <div className="panel-title">
              <span>Orders waiting for you</span>
              <Link to="/seller/orders" className="small">
                All orders →
              </Link>
            </div>
            {orders.loading ? (
              <Loading />
            ) : !orders.data?.items.length ? (
              <p className="muted small" style={{ margin: 0 }}>No new orders right now.</p>
            ) : (
              orders.data.items.map((o) => (
                <Link key={o._id} to={`/seller/orders/${o._id}`} className="list-item">
                  <div className="grow">
                    <strong className="mono">{o.orderNumber}</strong>
                    <div className="small">{o.items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(', ')}</div>
                    <div className="tiny muted">
                      {o.buyer?.businessProfile?.businessName || o.buyer?.name} · {o.fulfilment === 'pickup' ? 'Pickup' : o.deliveryAddress?.pincode} · {dateTime(o.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span className="mono" style={{ fontWeight: 700 }}>{rupees(o.subtotal + o.deliveryFee)}</span>
                    <Status value={o.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="card">
            <div className="panel-title">Sales · last 14 days</div>
            <SalesBars daily={s.daily} />
          </div>
        </div>
        <aside className="stack">
          <div className="card">
            <div className="panel-title">
              <span>Low stock</span>
              <span className="badge">{s.products} live</span>
            </div>
            {s.lowStock.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>All products have healthy stock.</p>
            ) : (
              s.lowStock.map((p) => (
                <Link key={p._id} to={`/seller/products/${p._id}/edit`} className="list-item small">
                  <span className="grow">{p.name}</span>
                  <span className={`badge ${p.stock === 0 ? 'chili' : 'turmeric'}`}>
                    {p.stock} {p.unit}
                  </span>
                </Link>
              ))
            )}
          </div>
          <div className="card small" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="panel-title">Quick links</div>
            <Link to="/seller/settings">Delivery areas & fees</Link>
            <Link to="/disputes">Complaints</Link>
            <Link to={`/sellers/${user._id}`}>View my public page</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
