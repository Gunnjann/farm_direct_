import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useFetch, useToast } from '../context/AppContext';
import { api } from '../lib/api';
import { rupees, dateTime, STATUS_LABEL } from '../lib/format';
import { useT } from '../lib/i18n';
import { Button, ErrorBox, Icon, Loading, Modal, Select, Status, Textarea } from '../components/ui';
import { HappyBasket } from '../components/art/Stickers';

const FLOW_DELIVERY = ['placed', 'accepted', 'packed', 'out_for_delivery', 'delivered'];
const FLOW_PICKUP = ['placed', 'accepted', 'packed', 'ready_for_pickup', 'delivered'];

function Timeline({ order }) {
  const flow = order.fulfilment === 'pickup' ? FLOW_PICKUP : FLOW_DELIVERY;
  const bad = ['rejected', 'cancelled', 'expired'].includes(order.status);
  const pre = ['pending_payment', 'awaiting_group'].includes(order.status);
  const idx = flow.indexOf(order.status);
  const at = (s) => order.statusHistory.filter((h) => h.status === s).pop();
  if (bad) {
    const h = at(order.status);
    return (
      <ul className="timeline">
        <li className="done">
          <span className="node" />
          <div>Order created</div>
        </li>
        <li className="bad">
          <span className="node" />
          <div>
            <strong>{STATUS_LABEL[order.status]}</strong>
            {h?.note && <div className="small">Reason: {h.note}</div>}
            <div className="tiny muted">{dateTime(h?.at)}</div>
          </div>
        </li>
      </ul>
    );
  }
  return (
    <ul className="timeline">
      {pre && (
        <li className="current">
          <span className="node" />
          <div>
            <strong>{STATUS_LABEL[order.status]}</strong>
            {order.status === 'awaiting_group' && <div className="small">Paid. Your order goes to the seller when the group closes successfully.</div>}
          </div>
        </li>
      )}
      {flow.map((s, i) => {
        const h = at(s);
        const cls = pre ? 'todo' : i < idx ? 'done' : i === idx ? (s === 'delivered' ? 'done' : 'current') : 'todo';
        return (
          <li key={s} className={cls}>
            <span className="node" />
            <div>
              <strong>{STATUS_LABEL[s]}</strong>
              {h && <div className="tiny muted">{dateTime(h.at)}{h.note ? ` · ${h.note}` : ''}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ReviewBox({ order, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [productId, setProductId] = useState(String(order.items[0].product));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/reviews', { method: 'POST', body: { orderId: order._id, productId, rating, comment: comment || undefined } });
      toast('Thanks for your review!', 'ok');
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card stack">
      <div className="panel-title">Rate this order</div>
      {order.items.length > 1 && <Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)} options={order.items.map((i) => ({ value: String(i.product), label: i.name }))} />}
      <div className="star-input" role="group" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={rating >= n} aria-label={`${n} star`} onClick={() => setRating(n)}>
            ★
          </button>
        ))}
      </div>
      <Textarea label="What was it like? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={800} />
      <ErrorBox error={error} />
      <Button variant="primary" disabled={!rating} loading={busy} onClick={send}>
        Submit review
      </Button>
    </div>
  );
}

function DisputeModal({ order, open, onClose }) {
  const nav = useNavigate();
  const [f, setF] = useState({ reason: 'poor_quality', requested: 'full_refund', description: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let evidence = [];
      if (files.length) {
        const fd = new FormData();
        [...files].slice(0, 6).forEach((file) => fd.append('images', file));
        evidence = (await api('/uploads', { method: 'POST', form: fd })).urls;
      }
      const d = await api('/disputes', { method: 'POST', body: { orderId: order._id, ...f, evidence } });
      nav(`/disputes/${d.dispute._id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Report a problem">
      <form className="form-grid" onSubmit={submit}>
        <Select
          label="What went wrong?"
          value={f.reason}
          onChange={(e) => setF({ ...f, reason: e.target.value })}
          options={[
            { value: 'poor_quality', label: 'Quality not as described' },
            { value: 'damaged', label: 'Damaged / spoiled' },
            { value: 'wrong_item', label: 'Wrong item' },
            { value: 'short_quantity', label: 'Less quantity than ordered' },
            { value: 'not_delivered', label: 'Not delivered' },
            { value: 'other', label: 'Something else' },
          ]}
        />
        <Textarea label="Describe the problem" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} minLength={10} required hint="Weight received, condition, etc." />
        <div className="field">
          <label htmlFor="ev">Photos (recommended)</label>
          <input id="ev" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(e.target.files)} />
          <span className="hint">Clear photos help us resolve complaints faster.</span>
        </div>
        <Select
          label="What would you like?"
          value={f.requested}
          onChange={(e) => setF({ ...f, requested: e.target.value })}
          options={[
            { value: 'full_refund', label: 'Full refund' },
            { value: 'partial_refund', label: 'Partial refund' },
            { value: 'replacement', label: 'Replacement' },
          ]}
        />
        <ErrorBox error={error} />
        <Button variant="danger" loading={busy} type="submit">
          Submit complaint
        </Button>
        <p className="tiny muted" style={{ margin: 0 }}>The seller can respond first. A FarmDirect team member makes the final decision.</p>
      </form>
    </Modal>
  );
}

export default function OrderDetail({ seller }) {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { t, ln, u } = useT();
  const { data, error, loading, reload } = useFetch(`/orders/${id}`);
  const [busy, setBusy] = useState('');
  const [actErr, setActErr] = useState(null);
  const [reasonFor, setReasonFor] = useState(null);
  const [reason, setReason] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);

  if (loading) return <Loading />;
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>;
  const o = data.order;
  const isSeller = String(o.supplier?._id) === String(user._id);
  const isBuyerHere = String(o.buyer?._id) === String(user._id);

  const move = async (to, note) => {
    setBusy(to);
    setActErr(null);
    try {
      await api(`/orders/${o._id}/status`, { method: 'POST', body: { to, note } });
      toast(`Order ${STATUS_LABEL[to].toLowerCase()}`, 'ok');
      setReasonFor(null);
      setReason('');
      reload();
    } catch (e) {
      setActErr(e);
    } finally {
      setBusy('');
    }
  };

  const nextFor = {
    placed: [{ to: 'accepted', label: t('Accept'), variant: 'leaf' }, { to: 'rejected', label: t('Reject'), variant: 'danger', reason: true }],
    accepted: [{ to: 'packed', label: 'Mark packed', variant: 'primary' }],
    packed: o.fulfilment === 'pickup' ? [{ to: 'ready_for_pickup', label: 'Ready for pickup', variant: 'primary' }] : [{ to: 'out_for_delivery', label: 'Out for delivery', variant: 'primary' }],
    out_for_delivery: [{ to: 'delivered', label: 'Mark delivered', variant: 'leaf' }],
    ready_for_pickup: [{ to: 'delivered', label: 'Picked up', variant: 'leaf' }],
  };
  const sellerActions = isSeller ? nextFor[o.status] || [] : [];
  const canCancel = isBuyerHere && o.status === 'placed';
  const canDispute = isBuyerHere && (o.status === 'delivered' || o.status === 'out_for_delivery' || o.status === 'ready_for_pickup');
  const canReview = isBuyerHere && o.status === 'delivered' && !o.reviewed;

  return (
    <div className="container page">
      <Link to={seller ? '/seller/orders' : '/orders'} className="small">
        ← All orders
      </Link>
      <div className="row between" style={{ margin: '12px 0 20px' }}>
        <div>
          <span className="eyebrow">{o.type === 'group' ? 'Group order' : 'Order'}</span>
          <h1 className="mono" style={{ fontSize: '1.8rem', margin: 0 }}>{o.orderNumber}</h1>
          <span className="small muted">{dateTime(o.createdAt)}</span>
        </div>
        <Status value={o.status} />
      </div>

      <div className="two-col">
        <div className="stack" style={{ '--gap': '20px' }}>
          {sellerActions.length > 0 && (
            <div className="card tint-turmeric stack">
              <strong>Next step</strong>
              <div className="row">
                {sellerActions.map((a) => (
                  <Button key={a.to} variant={a.variant} size="lg" loading={busy === a.to} onClick={() => (a.reason ? setReasonFor(a.to) : move(a.to))}>
                    {a.label}
                  </Button>
                ))}
              </div>
              {o.status === 'placed' && <p className="tiny" style={{ margin: 0 }}>Rejecting refunds the buyer in full and returns stock to your listing.</p>}
            </div>
          )}
          <ErrorBox error={actErr} />

          <div className="card">
            <div className="panel-title">Items</div>
            <table className="ledger">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.product}>
                    <td>
                      <Link to={`/product/${i.product}`}>{ln(i.name)}</Link>
                    </td>
                    <td className="num">
                      {i.qty} {u(i.unit)}
                    </td>
                    <td className="num">{rupees(i.unitPrice)}</td>
                    <td className="num">{rupees(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              <div className="sum-row">
                <span>Subtotal</span>
                <span className="mono">{rupees(o.subtotal)}</span>
              </div>
              <div className="sum-row">
                <span>Delivery</span>
                <span className="mono">{o.deliveryFee ? rupees(o.deliveryFee) : 'FREE'}</span>
              </div>
              <div className="sum-row">
                <span>Platform fee</span>
                <span className="mono">{rupees(o.platformFee)}</span>
              </div>
              <div className="sum-row total">
                <span>{isSeller ? 'Buyer paid' : 'Total paid'}</span>
                <span className="mono">{rupees(o.total)}</span>
              </div>
              {isSeller && (
                <div className="sum-row" style={{ color: 'var(--leaf)', fontWeight: 700 }}>
                  <span>Your earning (goods + delivery)</span>
                  <span className="mono">{rupees(o.subtotal + o.deliveryFee)}</span>
                </div>
              )}
              <div className="sum-row small muted">
                <span>Payment</span>
                <span className="mono">{o.paymentStatus.replace('_', ' ').toUpperCase()}</span>
              </div>
            </div>
          </div>

          {canReview && <ReviewBox order={o} onDone={reload} />}
        </div>

        <aside className="stack sticky" style={{ '--gap': '16px' }}>
          {o.status === 'delivered' && (
            <div className="card tint-leaf row" style={{ '--gap': '12px', flexWrap: 'nowrap' }}>
              <div className="sticker-wrap" style={{ flex: 'none' }}>
                <HappyBasket size={88} />
              </div>
              <div>
                <strong>Delivered fresh!</strong>
                <div className="small">{isBuyerHere ? 'Enjoy your produce. A quick review helps the farmer.' : 'Nice work. Earnings for this order count toward your next payout.'}</div>
              </div>
            </div>
          )}
          <div className="card">
            <div className="panel-title">Tracking</div>
            <Timeline order={o} />
          </div>
          <div className="card stack" style={{ '--gap': '6px' }}>
            <div className="panel-title">{o.fulfilment === 'pickup' ? 'Pickup' : 'Deliver to'}</div>
            {o.fulfilment === 'pickup' ? (
              <span className="small">{o.pickupAddress || 'Seller will share the pickup point.'}</span>
            ) : (
              <span className="small">
                <strong>{o.deliveryAddress?.name}</strong>
                <br />
                {o.deliveryAddress?.line1}
                {o.deliveryAddress?.line2 ? `, ${o.deliveryAddress.line2}` : ''}
                <br />
                {o.deliveryAddress?.city}, {o.deliveryAddress?.state} <span className="mono">{o.deliveryAddress?.pincode}</span>
                {o.deliveryAddress?.phone && (
                  <>
                    <br />📞 {o.deliveryAddress.phone}
                  </>
                )}
              </span>
            )}
            {o.note && <p className="small" style={{ margin: '8px 0 0' }}>Note: “{o.note}”</p>}
          </div>
          <div className="card stack" style={{ '--gap': '6px' }}>
            <div className="panel-title">{isSeller ? 'Buyer' : 'Seller'}</div>
            {isSeller ? (
              <span className="small">
                {o.buyer?.businessProfile?.businessName || o.buyer?.name}
                {o.buyer?.phone && ` · ${o.buyer.phone}`}
              </span>
            ) : (
              <Link className="small" to={`/sellers/${o.supplier?._id}`}>
                {o.supplier?.supplierProfile?.displayName || o.supplier?.name} {o.supplier?.supplierProfile?.verified && '✓'}
              </Link>
            )}
          </div>
          {isBuyerHere && o.status === 'pending_payment' && (
            <Link to={`/pay/${o.checkoutId}`} className="btn accent lg block">
              Complete payment
            </Link>
          )}
          {(canCancel || canDispute) && (
            <div className="card stack">
              {canCancel && (
                <Button variant="ghost" onClick={() => setReasonFor('cancelled')}>
                  Cancel order (full refund)
                </Button>
              )}
              {canDispute && (
                <Button variant="ghost" onClick={() => setDisputeOpen(true)}>
                  <Icon name="alert" size={18} /> Report a problem
                </Button>
              )}
            </div>
          )}
        </aside>
      </div>

      <Modal open={!!reasonFor} onClose={() => setReasonFor(null)} title={reasonFor === 'rejected' ? 'Reject order' : 'Cancel order'}>
        <Textarea label="Reason (shared with the other party)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <Button variant="danger" disabled={reason.trim().length < 3} loading={!!busy} onClick={() => move(reasonFor, reason.trim())}>
          Confirm
        </Button>
      </Modal>
      {disputeOpen && <DisputeModal order={o} open onClose={() => setDisputeOpen(false)} />}
    </div>
  );
}
