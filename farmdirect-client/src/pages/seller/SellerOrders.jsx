import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../../context/AppContext';
import { rupees, dateTime } from '../../lib/format';
import { Empty, ErrorBox, Loading, Status } from '../../components/ui';

export default function SellerOrders() {
  const [tab, setTab] = useState('new');
  const { data, error, loading, reload } = useFetch(`/orders/seller?status=${tab}`);
  return (
    <div className="container page stack">
      <h1 style={{ margin: 0 }}>Incoming orders</h1>
      <div className="tabs" role="tablist">
        {[
          ['new', 'New'],
          ['active', 'In progress'],
          ['done', 'Completed'],
          ['all', 'All'],
        ].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Empty title="No orders in this list" />
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>Order</th>
                <th>Items</th>
                <th>Buyer</th>
                <th className="num">You earn</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o._id}>
                  <td>
                    <Link to={`/seller/orders/${o._id}`} className="mono" style={{ fontWeight: 700 }}>
                      {o.orderNumber}
                    </Link>
                    <div className="tiny muted">{dateTime(o.createdAt)}</div>
                    {o.type === 'group' && <span className="badge turmeric">Group</span>}
                  </td>
                  <td className="small">{o.items.map((i) => `${i.name} × ${i.qty} ${i.unit}`).join(', ')}</td>
                  <td className="small">
                    {o.buyer?.businessProfile?.businessName || o.buyer?.name}
                    <div className="tiny muted">{o.fulfilment === 'pickup' ? 'Pickup' : `Deliver · ${o.deliveryAddress?.pincode}`}</div>
                  </td>
                  <td className="num">{rupees(o.subtotal + o.deliveryFee)}</td>
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
  );
}
