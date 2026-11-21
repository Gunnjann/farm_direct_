import { Link } from 'react-router-dom';
import { useAuth, useFetch } from '../context/AppContext';
import { dateTime } from '../lib/format';
import { Empty, ErrorBox, Loading, Status } from '../components/ui';

export const REASONS = {
  damaged: 'Damaged / spoiled',
  wrong_item: 'Wrong item',
  poor_quality: 'Quality not as described',
  short_quantity: 'Short quantity',
  not_delivered: 'Not delivered',
  other: 'Other',
};

export default function Disputes() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch('/disputes');
  return (
    <div className="container page stack" style={{ maxWidth: 860 }}>
      <h1>{user.role === 'admin' ? 'All complaints' : 'Complaints'}</h1>
      <p className="muted" style={{ margin: 0 }}>
        Something wrong with a delivered order? Open the order and choose “Report a problem” within 48 hours of delivery.
      </p>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Empty title="No complaints">Good news — nothing to sort out.</Empty>
      ) : (
        <div className="card" style={{ padding: '0 16px' }}>
          {data.items.map((d) => (
            <Link key={d._id} to={`/disputes/${d._id}`} className="list-item">
              <div className="grow">
                <strong>{REASONS[d.reason]}</strong> <span className="mono small">· {d.order?.orderNumber}</span>
                <div className="small muted">{d.description.slice(0, 90)}</div>
                <div className="tiny muted">{dateTime(d.createdAt)}</div>
              </div>
              <Status value={d.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
