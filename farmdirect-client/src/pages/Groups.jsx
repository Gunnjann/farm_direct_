import { Link } from 'react-router-dom';
import { useFetch, useLocationPin } from '../context/AppContext';
import { qs } from '../lib/api';
import { rupees, timeLeft } from '../lib/format';
import { Empty, ErrorBox, Loading, Meter, Status } from '../components/ui';

export default function Groups({ mine }) {
  const { pincode } = useLocationPin();
  const { data, error, loading, reload } = useFetch(mine ? '/groups/mine' : `/groups${qs({ pincode })}`);
  return (
    <div className="container page stack">
      <div>
        <span className="eyebrow">{mine ? 'Groups you joined' : pincode ? `Open groups delivering to ${pincode}` : 'Open groups'}</span>
        <h1 style={{ marginTop: 6 }}>{mine ? 'My group orders' : 'Group orders'}</h1>
        {!mine && (
          <p className="muted" style={{ maxWidth: 640 }}>
            Neighbours and nearby shops pool their orders to unlock the seller's group price. Everyone pays their share upfront; if the group misses its target by the deadline, everyone is refunded automatically.
          </p>
        )}
      </div>
      <div className="row">
        <Link to={mine ? '/groups' : '/groups/mine'} className="btn sm">
          {mine ? 'Browse open groups' : 'My groups'}
        </Link>
        {!mine && (
          <Link to="/shop?groupBuy=true" className="btn sm accent">
            Start a group from a product
          </Link>
        )}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Empty title={mine ? "You haven't joined any groups" : 'No open groups yet'} action={<Link to="/shop?groupBuy=true" className="btn primary">See group deals</Link>}>
          Products with a “Group deal” tag can be bought together.
        </Empty>
      ) : (
        <div className="grid" style={{ '--min': '280px' }}>
          {data.items.map((g) => (
            <Link key={g._id} to={`/groups/${g._id}`} className="card stack" style={{ textDecoration: 'none', '--gap': '10px' }}>
              <div className="row between">
                <Status value={g.status} />
                <span className="mono small">{g.status === 'open' || g.status === 'full' ? timeLeft(g.deadline) : ''}</span>
              </div>
              <h3 style={{ margin: 0 }}>{g.productName}</h3>
              <div className="price">
                {rupees(g.pricePerUnit)}
                <small>/{g.unit}</small> <span className="strike">{rupees(g.regularPrice)}</span>
              </div>
              <Meter value={g.joinedQty} max={g.maxQty} target={g.targetQty} />
              <div className="small row between">
                <span>
                  {g.joinedQty}/{g.targetQty} {g.unit} target
                </span>
                <span>{g.memberCount} joined</span>
              </div>
              <div className="tiny muted">
                Drop point: {g.dropPoint.label} · {g.dropPoint.pincode}
              </div>
              {g.myMembership && (
                <span className="badge leaf">
                  You: {g.myMembership.qty} {g.unit} · {g.myMembership.status}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
