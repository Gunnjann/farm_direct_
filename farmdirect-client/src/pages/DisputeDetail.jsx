import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, useFetch, useToast } from '../context/AppContext';
import { api } from '../lib/api';
import { dateTime, rupees } from '../lib/format';
import { Button, ErrorBox, Input, Loading, Select, Status, Textarea } from '../components/ui';
import { REASONS } from './Disputes';

export default function DisputeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch(`/disputes/${id}`);
  const [response, setResponse] = useState('');
  const [res, setRes] = useState({ outcome: 'full_refund', refundAmount: '', note: '', liableParty: 'supplier' });
  const [busy, setBusy] = useState(false);
  const [actErr, setActErr] = useState(null);

  if (loading) return <Loading />;
  if (error) return <div className="container page"><ErrorBox error={error} onRetry={reload} /></div>;
  const d = data.dispute;
  const isSupplier = String(d.supplier) === String(user._id);
  const isAdmin = user.role === 'admin';
  const closed = ['resolved', 'rejected'].includes(d.status);

  const call = async (path, body, msg) => {
    setBusy(true);
    setActErr(null);
    try {
      await api(`/disputes/${d._id}/${path}`, { method: 'POST', body });
      toast(msg, 'ok');
      reload();
    } catch (e) {
      setActErr(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page stack" style={{ maxWidth: 820, '--gap': '20px' }}>
      <Link to="/disputes" className="small">← Complaints</Link>
      <div className="row between">
        <div>
          <span className="eyebrow">Complaint · {dateTime(d.createdAt)}</span>
          <h1 style={{ margin: '6px 0 0' }}>{REASONS[d.reason]}</h1>
          <Link to={isSupplier ? `/seller/orders/${d.order._id}` : `/orders/${d.order._id}`} className="mono small">
            Order {d.order.orderNumber} · {rupees(d.order.total)}
          </Link>
        </div>
        <Status value={d.status} />
      </div>

      <div className="card stack">
        <div className="panel-title">Buyer's report · wants {d.requested.replace('_', ' ')}</div>
        <p style={{ margin: 0 }}>{d.description}</p>
        {d.evidence?.length > 0 && (
          <div className="row">
            {d.evidence.map((u) => (
              <a key={u} href={u} target="_blank" rel="noreferrer">
                <img src={u} alt="Evidence" style={{ width: 96, height: 96, objectFit: 'cover', border: 'var(--b)' }} />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="card stack">
        <div className="panel-title">Seller's response</div>
        {d.supplierResponse ? <p style={{ margin: 0 }}>{d.supplierResponse}</p> : <p className="muted small" style={{ margin: 0 }}>No response yet.</p>}
        {isSupplier && !closed && (
          <>
            <Textarea label="Your response" value={response} onChange={(e) => setResponse(e.target.value)} hint="Explain what happened. Offer a replacement or partial refund if fair." />
            <Button variant="primary" disabled={response.trim().length < 5} loading={busy} onClick={() => call('respond', { response }, 'Response sent')}>
              Send response
            </Button>
          </>
        )}
      </div>

      {closed && d.resolution && (
        <div className={`card ${d.status === 'resolved' ? 'tint-leaf' : 'tint-chili'} stack`}>
          <div className="panel-title">Decision</div>
          <strong>
            {d.resolution.outcome.replace('_', ' ')}
            {d.resolution.refundAmount ? ` · ${rupees(d.resolution.refundAmount)} refunded` : ''}
          </strong>
          <p style={{ margin: 0 }}>{d.resolution.note}</p>
          <span className="tiny muted">Decided {dateTime(d.resolution.at)}</span>
        </div>
      )}

      {isAdmin && !closed && (
        <div className="card stack">
          <div className="panel-title">Resolve (admin)</div>
          <div className="form-grid cols-2">
            <Select
              label="Outcome"
              value={res.outcome}
              onChange={(e) => setRes({ ...res, outcome: e.target.value })}
              options={[
                { value: 'full_refund', label: 'Full refund' },
                { value: 'partial_refund', label: 'Partial refund' },
                { value: 'replacement', label: 'Replacement (no refund)' },
                { value: 'rejected', label: 'Reject complaint' },
              ]}
            />
            <Select
              label="Who bears the cost?"
              value={res.liableParty}
              onChange={(e) => setRes({ ...res, liableParty: e.target.value })}
              options={[
                { value: 'supplier', label: 'Seller' },
                { value: 'delivery_partner', label: 'Delivery partner' },
                { value: 'platform', label: 'FarmDirect' },
                { value: 'none', label: 'Nobody' },
              ]}
            />
            {res.outcome === 'partial_refund' && <Input label="Refund amount (₹)" inputMode="decimal" value={res.refundAmount} onChange={(e) => setRes({ ...res, refundAmount: e.target.value })} />}
            <Textarea className="span-2" label="Decision note (shared with both)" value={res.note} onChange={(e) => setRes({ ...res, note: e.target.value })} />
          </div>
          <Button
            variant="primary"
            loading={busy}
            disabled={res.note.trim().length < 5}
            onClick={() => call('resolve', { ...res, refundAmount: res.refundAmount ? Number(res.refundAmount) : undefined }, 'Dispute resolved')}
          >
            Confirm decision
          </Button>
        </div>
      )}
      <ErrorBox error={actErr} />
    </div>
  );
}
