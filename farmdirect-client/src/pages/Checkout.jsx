import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useCart, useLocationPin, useToast } from '../context/AppContext';
import { api } from '../lib/api';
import { rupees } from '../lib/format';
import { useT } from '../lib/i18n';
import { Button, Empty, ErrorBox, Icon, Input } from '../components/ui';

const blankAddr = { label: 'Home', name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

export default function Checkout() {
  const { user, setUser } = useAuth();
  const { items } = useCart();
  const { pincode, setPincode } = useLocationPin();
  const { t, ln, u } = useT();
  const toast = useToast();
  const nav = useNavigate();
  const idemKey = useRef(crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const saved = user.addresses || [];
  const [fulfilment, setFulfilment] = useState('delivery');
  const [addrId, setAddrId] = useState(() => (saved.find((a) => a.pincode === pincode) || saved[0])?._id || 'new');
  const [addr, setAddr] = useState({ ...blankAddr, name: user.name, phone: user.phone || '', pincode });
  const [saveAddr, setSaveAddr] = useState(true);
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const address = useMemo(() => (addrId === 'new' ? addr : saved.find((a) => a._id === addrId)), [addrId, addr, saved]);
  const pin = address?.pincode;

  useEffect(() => {
    if (!items.length) return;
    if (fulfilment === 'delivery' && !/^\d{6}$/.test(pin || '')) return setQuote(null);
    const tm = setTimeout(() => {
      api('/checkout/quote', { method: 'POST', body: { items: items.map((i) => ({ productId: i.productId, qty: i.qty })), fulfilment, pincode: pin } })
        .then((q) => (setQuote(q), setError(null)))
        .catch(setError);
    }, 250);
    return () => clearTimeout(tm);
  }, [items, fulfilment, pin]);

  if (!items.length) return <div className="container page"><Empty title="Nothing to check out" action={<Link to="/shop" className="btn">Shop</Link>} /></div>;

  const up = (k) => (e) => setAddr({ ...addr, [k]: e.target.value });

  const place = async () => {
    setBusy(true);
    setError(null);
    try {
      let a = address;
      if (fulfilment === 'delivery') {
        const clean = { name: a.name, phone: a.phone || undefined, line1: a.line1, line2: a.line2 || undefined, city: a.city, state: a.state, pincode: a.pincode };
        if (addrId === 'new' && saveAddr) {
          const d = await api('/auth/me/addresses', { method: 'POST', body: { label: a.label || 'Home', ...clean } });
          setUser(d.user);
        }
        a = clean;
        if (a.pincode !== pincode) setPincode(a.pincode);
      }
      const d = await api('/checkout', {
        method: 'POST',
        headers: { 'Idempotency-Key': idemKey.current },
        body: { items: items.map((i) => ({ productId: i.productId, qty: i.qty })), fulfilment, address: fulfilment === 'delivery' ? a : undefined, note: note || undefined },
      });
      nav(`/pay/${d.payment.checkoutId}`, { state: { checkout: d, kind: 'cart' } });
    } catch (err) {
      setError(err);
      if (err.code === 'OUT_OF_STOCK') toast('Stock changed — please review your cart', 'error');
    } finally {
      setBusy(false);
    }
  };

  const blocked = !quote || quote.problems.length > 0;

  return (
    <div className="container page">
      <h1>Checkout</h1>
      <div className="two-col">
        <div className="stack" style={{ '--gap': '20px' }}>
          <div className="card stack">
            <div className="panel-title">1 · How do you want it?</div>
            <div className="segmented" role="group" aria-label="Fulfilment">
              <button aria-pressed={fulfilment === 'delivery'} onClick={() => setFulfilment('delivery')}>
                <Icon name="truck" size={18} /> Delivery
              </button>
              <button aria-pressed={fulfilment === 'pickup'} onClick={() => setFulfilment('pickup')}>
                <Icon name="pin" size={18} /> Pickup from seller
              </button>
            </div>
            {fulfilment === 'pickup' && <p className="small muted" style={{ margin: 0 }}>Free. You collect from the seller's pickup point (shown after the order is accepted).</p>}
          </div>

          {fulfilment === 'delivery' && (
            <div className="card stack">
              <div className="panel-title">2 · Delivery address</div>
              {saved.map((a) => (
                <label key={a._id} className="check card flat" style={{ padding: 12, background: addrId === a._id ? 'var(--turmeric-2)' : undefined }}>
                  <input type="radio" name="addr" checked={addrId === a._id} onChange={() => setAddrId(a._id)} />
                  <span>
                    <strong>{a.label}</strong> · <span className="mono">{a.pincode}</span>
                    <br />
                    <span className="small">
                      {a.name}, {a.line1}
                      {a.line2 ? `, ${a.line2}` : ''}, {a.city}
                    </span>
                  </span>
                </label>
              ))}
              <label className="check">
                <input type="radio" name="addr" checked={addrId === 'new'} onChange={() => setAddrId('new')} />
                <span>Use a new address</span>
              </label>
              {addrId === 'new' && (
                <div className="form-grid cols-2">
                  <Input label="Full name" value={addr.name} onChange={up('name')} autoComplete="name" />
                  <Input label="Mobile" inputMode="tel" maxLength={10} value={addr.phone} onChange={up('phone')} autoComplete="tel-national" hint="For the delivery person" />
                  <Input className="span-2" label="House / flat, street" value={addr.line1} onChange={up('line1')} autoComplete="address-line1" />
                  <Input className="span-2" label="Landmark (optional)" value={addr.line2} onChange={up('line2')} />
                  <Input label="City" value={addr.city} onChange={up('city')} autoComplete="address-level2" />
                  <Input label="State" value={addr.state} onChange={up('state')} autoComplete="address-level1" />
                  <Input label="Pincode" inputMode="numeric" maxLength={6} value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value.replace(/\D/g, '') })} autoComplete="postal-code" />
                  <label className="check" style={{ alignSelf: 'end' }}>
                    <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} /> Save this address
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="card stack">
            <div className="panel-title">{fulfilment === 'delivery' ? '3' : '2'} · Note for seller (optional)</div>
            <textarea className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please call before arriving" aria-label="Note for seller" />
          </div>
        </div>

        <aside className="card stack sticky">
          <div className="panel-title">Bill</div>
          {quote?.orders.map((o) => (
            <div key={o.supplier} className="stack" style={{ '--gap': '4px' }}>
              <strong className="small">{o.supplierName}</strong>
              {o.items.map((i) => (
                <div key={i.product} className="sum-row small">
                  <span>
                    {ln(i.name)} · {i.qty} {u(i.unit)} × {rupees(i.unitPrice)}
                  </span>
                  <span className="mono">{rupees(i.lineTotal)}</span>
                </div>
              ))}
              <div className="sum-row small muted">
                <span>{fulfilment === 'pickup' ? 'Pickup' : `Delivery · ~${o.etaDays} day${o.etaDays === 1 ? '' : 's'}`}</span>
                <span className="mono">{o.deliveryFee === 0 ? 'FREE' : rupees(o.deliveryFee)}</span>
              </div>
              <hr className="rule" style={{ margin: '6px 0', borderTopWidth: 1, borderTopStyle: 'dashed' }} />
            </div>
          ))}
          {quote?.problems?.map((p, i) => (
            <div key={i} className="alert error small">
              <Icon name="alert" size={18} /> {p.message}
            </div>
          ))}
          {quote && (
            <>
              <div className="sum-row">
                <span>{t('Subtotal')}</span>
                <span className="mono">{rupees(quote.totals.subtotal)}</span>
              </div>
              <div className="sum-row">
                <span>{t('Delivery fee')}</span>
                <span className="mono">{rupees(quote.totals.deliveryFee)}</span>
              </div>
              <div className="sum-row">
                <span>Platform fee ({quote.platformFeePercent}%)</span>
                <span className="mono">{rupees(quote.totals.platformFee)}</span>
              </div>
              <div className="sum-row total">
                <span>{t('Total')}</span>
                <span className="mono">{rupees(quote.totals.total)}</span>
              </div>
            </>
          )}
          {!quote && fulfilment === 'delivery' && <p className="small muted">Enter a delivery pincode to calculate fees.</p>}
          <ErrorBox error={error} />
          <Button variant="primary" size="lg" block loading={busy} disabled={blocked} onClick={place}>
            {quote ? `Pay ${rupees(quote.totals.total)}` : t('Place order')}
          </Button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Stock is held for you for 15 minutes while you pay. Orders from different sellers are delivered separately.
          </p>
        </aside>
      </div>
    </div>
  );
}
