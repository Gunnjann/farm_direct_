import { Link } from 'react-router-dom';
import { useFetch } from '../../context/AppContext';
import { rupees, dateTime } from '../../lib/format';
import { ErrorBox, Loading, Status } from '../../components/ui';

export default function AdminDashboard() {
  const stats = useFetch('/admin/stats');
  const orders = useFetch('/admin/orders');
  if (stats.loading) return <Loading />;
  if (stats.error) return <div className="container page"><ErrorBox error={stats.error} onRetry={stats.reload} /></div>;
  const s = stats.data;
  const tiles = [
    ['GMV · 30d', rupees(s.gmv30), true],
    ['Platform fees · 30d', rupees(s.platformFees30)],
    ['Paid orders · 30d', s.orders30],
    ['Live products', s.products],
    ['Open groups', s.openGroups],
    ['Buyers', (s.users.customer || 0) + (s.users.retailer || 0)],
    ['Sellers', (s.users.farmer || 0) + (s.users.trader || 0)],
  ];
  return (
    <div className="container page stack" style={{ '--gap': '20px' }}>
      <div>
        <span className="eyebrow">Operations</span>
        <h1 style={{ margin: '6px 0 0' }}>Admin dashboard</h1>
      </div>
      <div className="grid" style={{ '--min': '170px' }}>
        <Link to="/admin/users?unverified=true" className={`stat ${s.pendingVerification ? 'hl' : ''}`} style={{ textDecoration: 'none' }}>
          <div className="label">Sellers to verify</div>
          <div className="value">{s.pendingVerification}</div>
        </Link>
        <Link to="/disputes" className={`stat ${s.openDisputes ? 'hl' : ''}`} style={{ textDecoration: 'none' }}>
          <div className="label">Open complaints</div>
          <div className="value">{s.openDisputes}</div>
        </Link>
        <div className="stat" style={s.refundsStuck ? { background: 'var(--chili-2)' } : undefined}>
          <div className="label">Refunds needing action</div>
          <div className="value">{s.refundsStuck}</div>
        </div>
        {tiles.map(([l, v, hl]) => (
          <div key={l} className="stat" style={hl ? { background: 'var(--leaf-2)' } : undefined}>
            <div className="label">{l}</div>
            <div className="value">{v}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="panel-title">Latest orders</div>
        {orders.loading ? (
          <Loading />
        ) : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="ledger">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Seller</th>
                  <th className="num">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.data?.items.slice(0, 25).map((o) => (
                  <tr key={o._id}>
                    <td>
                      <Link to={`/orders/${o._id}`} className="mono">
                        {o.orderNumber}
                      </Link>
                      <div className="tiny muted">{dateTime(o.createdAt)}</div>
                    </td>
                    <td className="small">{o.buyer?.name}</td>
                    <td className="small">{o.supplier?.supplierProfile?.displayName || o.supplier?.name}</td>
                    <td className="num">{rupees(o.total)}</td>
                    <td className="tiny mono">{o.paymentStatus}</td>
                    <td>
                      <Status value={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
