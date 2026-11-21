import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '../context/AppContext';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { Empty, ErrorBox, Loading } from '../components/ui';

export default function Notifications() {
  const { data, error, loading, reload } = useFetch('/notifications');
  useEffect(() => {
    if (data?.unread) api('/notifications/read-all', { method: 'POST' }).catch(() => {});
  }, [data]);
  return (
    <div className="container page stack" style={{ maxWidth: 760 }}>
      <h1>Notifications</h1>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Empty title="All caught up">Order updates, group news and refunds will show up here.</Empty>
      ) : (
        <div className="card" style={{ padding: '0 16px' }}>
          {data.items.map((n) => (
            <Link key={n._id} to={n.link || '#'} className="list-item" style={{ background: n.read ? undefined : 'var(--turmeric-2)', margin: '0 -16px', padding: '14px 16px' }}>
              <div className="grow">
                <strong>{n.title}</strong>
                {n.body && <div className="small">{n.body}</div>}
                <div className="tiny muted">{dateTime(n.createdAt)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
