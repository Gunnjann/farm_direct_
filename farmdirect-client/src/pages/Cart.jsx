import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useCart, useLocationPin } from '../context/AppContext';
import { api } from '../lib/api';
import { rupees, isBuyer } from '../lib/format';
import { useT } from '../lib/i18n';
import { Button, Empty, Icon, Stepper } from '../components/ui';
import ProduceArt from '../components/art/Produce';
import { PincodeModal } from '../components/Layout';

export default function Cart() {
  const { items, setQty, remove } = useCart();
  const { user } = useAuth();
  const { pincode } = useLocationPin();
  const { t, ln, u } = useT();
  const nav = useNavigate();
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);

  // Live server quote: the only source of truth for prices and fees.
  useEffect(() => {
    if (!items.length || !isBuyer(user) || !pincode) return setQuote(null);
    const tmr = setTimeout(() => {
      api('/checkout/quote', { method: 'POST', body: { items: items.map((i) => ({ productId: i.productId, qty: i.qty })), fulfilment: 'delivery', pincode } })
        .then((q) => (setQuote(q), setQuoteErr(null)))
        .catch(setQuoteErr);
    }, 300);
    return () => clearTimeout(tmr);
  }, [items, user, pincode]);

  if (!items.length)
    return (
      <div className="container page">
        <Empty sticker title={t('Your cart is empty')} action={<Link to="/shop" className="btn primary">{t('Browse produce')}</Link>}>
          Add vegetables, fruit or grains from sellers near you.
        </Empty>
      </div>
    );

  const bySupplier = items.reduce((m, i) => ((m[i.supplierId] ||= { name: i.supplierName, items: [] }).items.push(i), m), {});
  const problemFor = (pid) => quote?.problems?.find((p) => p.productId === pid)?.message;
  const supplierProblem = (sid) => quote?.problems?.find((p) => p.supplierId === sid)?.message;
  const est = items.reduce((s, i) => s + i.pricePerUnit * i.qty, 0);

  return (
    <div className="container page">
      <h1>{t('Cart')}</h1>
      <div className="two-col">
        <div className="stack">
          {Object.entries(bySupplier).map(([sid, g]) => {
            const o = quote?.orders?.find((x) => String(x.supplier) === sid);
            return (
              <div key={sid} className="card">
                <div className="panel-title">
                  <span>{g.name}</span>
                  {o && <span className="mono small">{o.deliveryFee === 0 ? 'Free delivery' : `Delivery ${rupees(o.deliveryFee)}`}</span>}
                </div>
                {supplierProblem(sid) && (
                  <div className="alert error small" style={{ marginBottom: 8 }}>
                    <Icon name="alert" size={18} /> {supplierProblem(sid)}
                  </div>
                )}
                {g.items.map((i) => (
                  <div key={i.productId} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <div className={`ptile ${i.category}`} style={{ width: 64, height: 64, aspectRatio: 'auto', padding: 6, border: 'var(--b)', flex: 'none', alignItems: 'center', justifyContent: 'center' }}>
                      {i.image ? <img src={i.image} alt="" /> : <ProduceArt name={i.name} category={i.category} />}
                    </div>
                    <div className="grow stack" style={{ '--gap': '8px' }}>
                      <div className="row between">
                        <Link to={`/product/${i.productId}`} style={{ fontWeight: 700 }}>
                          {ln(i.name)}
                        </Link>
                        <span className="mono" style={{ fontWeight: 700 }}>
                          {rupees((o?.items.find((x) => x.product === i.productId)?.lineTotal) ?? i.pricePerUnit * i.qty)}
                        </span>
                      </div>
                      <div className="row between">
                        <Stepper value={i.qty} min={i.minOrderQty || 1} max={i.stock || 99999} onChange={(q) => setQty(i.productId, q)} />
                        <span className="small muted">{u(i.unit)}</span>
                        <button className="link-btn small" onClick={() => remove(i.productId)}>
                          {t('Remove')}
                        </button>
                      </div>
                      {problemFor(i.productId) && <span className="small" style={{ color: 'var(--chili)', fontWeight: 600 }}>{problemFor(i.productId)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <aside className="card stack sticky">
          <div className="panel-title">{t('Summary')}</div>
          {!pincode && (
            <button className="alert warn" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setPinOpen(true)}>
              <Icon name="pin" /> <span>Set your pincode to see delivery fees.</span>
            </button>
          )}
          {quoteErr && <div className="alert error small">{quoteErr.message}</div>}
          {quote && quote.orders.length > 0 ? (
            <>
              {quote.problems.length > 0 && <p className="tiny muted" style={{ margin: 0 }}>Totals below exclude items with problems.</p>}
              <div className="sum-row">
                <span>{t('Subtotal')}</span>
                <span className="mono">{rupees(quote.totals.subtotal)}</span>
              </div>
              <div className="sum-row">
                <span>{t('Delivery fee')}</span>
                <span className="mono">{rupees(quote.totals.deliveryFee)}</span>
              </div>
              <div className="sum-row">
                <span>{t('Platform fee')} ({quote.platformFeePercent}%)</span>
                <span className="mono">{rupees(quote.totals.platformFee)}</span>
              </div>
              <div className="sum-row total">
                <span>{t('Total')}</span>
                <span className="mono">{rupees(quote.totals.total)}</span>
              </div>
            </>
          ) : (
            <div className="sum-row">
              <span>Estimated items</span>
              <span className="mono">{rupees(est)}</span>
            </div>
          )}
          {!user ? (
            <Link to="/login?next=/checkout" className="btn primary lg block">
              Log in to checkout
            </Link>
          ) : !isBuyer(user) ? (
            <p className="small muted">Seller and admin accounts can't place orders.</p>
          ) : (
            <Button variant="primary" size="lg" block onClick={() => nav('/checkout')} disabled={quote?.problems?.length > 0 && quote.orders.length === 0}>
              {t('Checkout')} <Icon name="arrow" />
            </Button>
          )}
          {quote?.problems?.length > 0 && <p className="tiny muted" style={{ margin: 0 }}>Fix the highlighted items, or choose pickup at checkout if the seller offers it.</p>}
        </aside>
      </div>
      <PincodeModal open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  );
}
