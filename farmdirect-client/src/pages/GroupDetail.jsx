import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useFetch, useToast } from '../context/AppContext';
import { api } from '../lib/api';
import { rupees, timeLeft, dateTime, isBuyer } from '../lib/format';
import { Button, ErrorBox, Loading, Meter, Status, Stepper } from '../components/ui';

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { data, error, loading, reload } = useFetch(`/groups/${id}`, [user?._id]);
  const [qty, setQty] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actErr, setActErr] = useState(null);

  if (loading) return <Loading />;
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>;
  const g = data.group;
  const q = qty ?? g.minMemberQty;
  const open = g.status === 'open' && new Date(g.deadline) > new Date();
  const me = g.myMembership;
  const share = `${window.location.origin}/groups/${g.code}`;

  const join = async () => {
    if (!user) return nav(`/login?next=/groups/${id}`);
    setBusy(true);
    setActErr(null);
    try {
      const d = await api(`/groups/${g._id}/join`, { method: 'POST', body: { qty: q } });
      nav(`/pay/${d.checkout.payment.checkoutId}`, { state: { checkout: d.checkout, kind: 'group', groupId: g._id } });
    } catch (e) {
      setActErr(e);
      reload();
    } finally {
      setBusy(false);
    }
  };
  const act = async (path, msg) => {
    setBusy(true);
    setActErr(null);
    try {
      await api(`/groups/${g._id}/${path}`, { method: 'POST' });
      toast(msg, 'ok');
      reload();
    } catch (e) {
      setActErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <Link to="/groups" className="small">← All groups</Link>
      <div className="two-col" style={{ marginTop: 12 }}>
        <div className="stack" style={{ '--gap': '20px' }}>
          <div className="card stack" style={{ '--gap': '14px' }}>
            <div className="row between">
              <Status value={g.status} />
              <span className="mono">{open || g.status === 'full' ? timeLeft(g.deadline) : g.closeReason}</span>
            </div>
            <h1 style={{ margin: 0 }}>{g.title}</h1>
            <Link to={`/product/${g.product}`} className="small">
              {g.productName} →
            </Link>
            <div className="price" style={{ fontSize: '2rem' }}>
              {rupees(g.pricePerUnit)}
              <small>/{g.unit}</small> <span className="strike">{rupees(g.regularPrice)}</span>
            </div>
            <Meter value={g.joinedQty} max={g.maxQty} target={g.targetQty} />
            <div className="grid" style={{ '--min': '120px' }}>
              <div className="stat">
                <div className="label">Joined</div>
                <div className="value">{g.joinedQty}</div>
              </div>
              <div className="stat hl">
                <div className="label">Target</div>
                <div className="value">{g.targetQty}</div>
              </div>
              <div className="stat">
                <div className="label">Space left</div>
                <div className="value">{g.remainingQty}</div>
              </div>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              All quantities in {g.unit}. Paid so far: {g.paidQty} {g.unit}. Deadline {dateTime(g.deadline)}.
            </p>
          </div>

          <div className="card">
            <div className="panel-title">How this group works</div>
            <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Join with at least {g.minMemberQty} {g.unit} and pay your share within 15 minutes to hold your spot.</li>
              <li>At the deadline, if paid quantity reaches {g.targetQty} {g.unit}, the seller confirms and delivers everything to the drop point.</li>
              <li>If the target isn't reached, every member is refunded in full automatically.</li>
              <li>Once full ({g.maxQty} {g.unit}) or closed, nobody else can join.</li>
            </ol>
          </div>

          <div className="card">
            <div className="panel-title">Members ({g.memberCount})</div>
            {g.members.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>No members yet.</p>
            ) : (
              g.members.map((m, i) => (
                <div key={i} className="list-item small">
                  <span className="grow">{m.name}</span>
                  <span className="mono">{m.qty} {g.unit}</span>
                  <span className={`badge ${m.status === 'paid' ? 'leaf' : 'soft'}`}>{m.status}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="stack sticky" style={{ '--gap': '16px' }}>
          <div className="card stack">
            <div className="panel-title">Drop point</div>
            <strong>{g.dropPoint.label}</strong>
            <span className="small">
              {g.dropPoint.line1}, {g.dropPoint.city} <span className="mono">{g.dropPoint.pincode}</span>
            </span>
            <span className="tiny muted">Delivery to the drop point is included in the group price.</span>
          </div>

          {me ? (
            <div className="card tint-leaf stack">
              <strong>
                You're in: {me.qty} {g.unit} · {me.status}
              </strong>
              {me.status === 'reserved' && <span className="small">Your spot is held. Complete payment from “My orders” before it expires.</span>}
              {me.order && (
                <Link to={`/orders/${me.order}`} className="btn sm">
                  View my order
                </Link>
              )}
              {(g.status === 'open' || g.status === 'full') && (
                <Button variant="ghost" loading={busy} onClick={() => act('leave', 'You left the group')}>
                  Leave group {me.status === 'paid' && '(refund)'}
                </Button>
              )}
            </div>
          ) : open && (!user || isBuyer(user)) ? (
            <div className="card stack">
              <div className="panel-title">Join this group</div>
              <Stepper value={q} min={g.minMemberQty} max={Math.max(g.minMemberQty, g.remainingQty)} onChange={setQty} />
              <div className="sum-row">
                <span>Your share</span>
                <span className="mono">{rupees(g.pricePerUnit * q)}</span>
              </div>
              <Button variant="primary" size="lg" loading={busy} onClick={join} disabled={g.remainingQty < g.minMemberQty}>
                Join & pay
              </Button>
              <span className="tiny muted">+ small platform fee shown at payment.</span>
            </div>
          ) : (
            <div className="alert warn">
              <span>
                <strong>{g.status === 'full' ? 'This group is full' : 'This group is closed'}</strong>No more members can join.
              </span>
            </div>
          )}
          <ErrorBox error={actErr} />

          <div className="card stack">
            <div className="panel-title">Invite neighbours</div>
            <div className="mono small" style={{ wordBreak: 'break-all' }}>{share}</div>
            <div className="row">
              <Button size="sm" onClick={() => navigator.clipboard?.writeText(share).then(() => toast('Link copied', 'ok'))}>
                Copy link
              </Button>
              <a className="btn sm leaf" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Join my FarmDirect group for ${g.productName} at ${rupees(g.pricePerUnit)}/${g.unit}: ${share}`)}`}>
                Share on WhatsApp
              </a>
            </div>
          </div>
          {g.isOwner && g.paidQty === 0 && (g.status === 'open' || g.status === 'full') && (
            <Button variant="ghost" loading={busy} onClick={() => act('cancel', 'Group cancelled')}>
              Cancel group
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
