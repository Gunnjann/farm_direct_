import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../context/AppContext';
import { rupees, dateTime } from '../lib/format';
import { Empty, ErrorBox, Loading, Status } from '../components/ui';
import { useT } from '../lib/i18n';

export default function Orders() {
  const [tab, setTab] = useState('active');
  const { ln } = useT();
  const { data, error, loading, reload } = useFetch(`/orders?status=${tab}`);
  return (
    <div className="container page stack">
      <h1>My orders</h1>
      <div className="tabs" role="tablist">
        {[
          ['active', 'Active'],
          ['past', 'Past'],
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
        <Empty sticker title="No orders here" action={<Link className="btn" to="/shop">Start shopping</Link>} />
      ) : (
        <div className="card" style={{ padding: '0 16px' }}>
          {data.items.map((o) => (
            <Link key={o._id} to={`/orders/${o._id}`} className="list-item">
              <div className="grow">
                <div className="row" style={{ '--gap': '8px' }}>
                  <strong className="mono">{o.orderNumber}</strong>
                  {o.type === 'group' && <span className="badge turmeric">Group</span>}
                </div>
                <div className="small">
                  {o.supplier?.supplierProfile?.displayName || o.supplier?.name} · {o.items.map((i) => ln(i.name)).join(', ')}
                </div>
                <div className="tiny muted">{dateTime(o.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className="mono" style={{ fontWeight: 700 }}>{rupees(o.total)}</span>
                <Status value={o.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
