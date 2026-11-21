import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useCart, useFetch, useLocationPin, useToast } from '../context/AppContext';
import { api, qs } from '../lib/api';
import { freshness, date, rupees, timeLeft, isSupplier, CATEGORIES } from '../lib/format';
import { useT } from '../lib/i18n';
import { ProductTile } from '../components/ProductCard';
import { PincodeModal } from '../components/Layout';
import { Button, ErrorBox, Icon, Input, Loading, Meter, Modal, Select, Stars, Stepper } from '../components/ui';

function StartGroupModal({ open, onClose, product, pincode }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const g = product.groupBuy;
  const addr = user?.addresses?.find((a) => a.pincode === pincode) || user?.addresses?.[0];
  const [f, setF] = useState({ qty: g.minMemberQty, label: '', line1: addr?.line1 || '', city: addr?.city || '', state: addr?.state || '', pincode: pincode || addr?.pincode || '', deadlineHours: 48 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api('/groups', {
        method: 'POST',
        body: { productId: product._id, qty: Number(f.qty), deadlineHours: Number(f.deadlineHours), dropPoint: { label: f.label, line1: f.line1, city: f.city, state: f.state, pincode: f.pincode } },
      });
      nav(`/pay/${d.checkout.payment.checkoutId}`, { state: { checkout: d.checkout, kind: 'group', groupId: d.group._id } });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Start a group order">
      <p className="small muted">
        You pay now for your share at the group price ({rupees(g.pricePerUnit)}/{product.unit}). If the group reaches {g.targetQty} {product.unit} by the deadline, the seller delivers everything to one drop point. If not, everyone is refunded automatically.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <div className="field">
          <label>Your quantity ({product.unit})</label>
          <Stepper value={Number(f.qty)} min={g.minMemberQty} max={g.maxQty} onChange={(qty) => setF({ ...f, qty })} />
        </div>
        <Input label="Drop point name" placeholder="e.g. Green Park Society main gate" value={f.label} onChange={up('label')} required minLength={2} />
        <Input label="Drop point address" value={f.line1} onChange={up('line1')} required minLength={3} />
        <div className="form-grid cols-2">
          <Input label="City" value={f.city} onChange={up('city')} required />
          <Input label="State" value={f.state} onChange={up('state')} required />
          <Input label="Pincode" inputMode="numeric" maxLength={6} value={f.pincode} onChange={up('pincode')} required pattern="\d{6}" />
          <Select
            label="Closes in"
            value={f.deadlineHours}
            onChange={up('deadlineHours')}
            options={[
              { value: 12, label: '12 hours' },
              { value: 24, label: '1 day' },
              { value: 48, label: '2 days' },
              { value: 72, label: '3 days' },
              { value: 168, label: '7 days' },
            ]}
          />
        </div>
        <ErrorBox error={error} />
        <Button variant="primary" size="lg" loading={busy} type="submit">
          Create group & pay {rupees(g.pricePerUnit * f.qty)}
        </Button>
      </form>
    </Modal>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const { pincode } = useLocationPin();
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const nav = useNavigate();
  const { t, pn, u, ln, lang } = useT();
  const { data, error, loading, reload } = useFetch(`/products/${id}${qs({ pincode })}`);
  const [qty, setQty] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  if (loading) return <Loading />;
  if (error)
    return (
      <div className="container page">
        <ErrorBox error={error} onRetry={reload} />
      </div>
    );
  const { product: p, delivery, groups, reviews } = data;
  const sp = p.supplier.supplierProfile || {};
  const q = qty ?? p.minOrderQty;
  const unitPrice = [...(p.bulkTiers || [])].reverse().find((tier) => q >= tier.minQty)?.pricePerUnit || p.pricePerUnit;
  const seller = isSupplier(user) || user?.role === 'admin';
  const businessOnly = p.audience === 'business' && user?.role !== 'retailer';

  const addToCart = () => {
    cart.add(p, q);
    toast(lang === 'hi' ? `${q} ${u(p.unit)} ${pn(p)} कार्ट में जोड़ा` : `Added ${q} ${p.unit} ${p.name} to cart`, 'ok');
  };

  return (
    <div className="container page">
      <nav className="small muted" style={{ marginBottom: 12 }}>
        <Link to="/shop">{t('Shop')}</Link> / <Link to={`/shop?category=${p.category}`}>{lang === 'hi' ? CATEGORIES.find((c) => c.id === p.category)?.hi : p.category}</Link> / {pn(p)}
      </nav>
      <div className="product-layout">
        <div className="card flat pl-tile" style={{ padding: 0, overflow: 'hidden' }}>
          <ProductTile product={p} big />
        </div>
        <div className="stack pl-info" style={{ '--gap': '20px' }}>

          <div className="card stack">
            <div className="panel-title">{t('About this produce')}</div>
            {p.description && <p>{p.description}</p>}
            <table className="ledger">
              <tbody>
                <tr>
                  <th>{t('Grade')}</th>
                  <td>
                    {p.grade === 'ungraded' ? 'Not graded' : `Grade ${p.grade}`}
                    {p.gradeNote && <div className="small muted">{p.gradeNote}</div>}
                  </td>
                </tr>
                {p.harvestDate && (
                  <tr>
                    <th>{t('Harvest')}</th>
                    <td>
                      {date(p.harvestDate)} <span className="muted small">· {freshness(p.harvestDate, lang)}</span>
                    </td>
                  </tr>
                )}
                <tr>
                  <th>{t('Sold by')}</th>
                  <td>{p.supplierRole === 'trader' ? 'Trader (aggregated from farms)' : 'Farmer (own produce)'}</td>
                </tr>
                {p.organicClaim && (
                  <tr>
                    <th>Organic</th>
                    <td>
                      Seller says it is grown organically.{' '}
                      <span className="muted small">{p.certificationVerified ? 'Certificate verified by FarmDirect.' : 'Not certified by FarmDirect.'}</span>
                    </td>
                  </tr>
                )}
                <tr>
                  <th>{t('Minimum')}</th>
                  <td>
                    {p.minOrderQty} {u(p.unit)}
                  </td>
                </tr>
                <tr>
                  <th>{t('Available')}</th>
                  <td>
                    {p.stock} {u(p.unit)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="tiny muted" style={{ margin: 0 }}>
              Product details are provided by the seller. If what arrives doesn't match, raise a complaint within 48 hours of delivery.
            </p>
          </div>

          <div className="card stack">
            <div className="panel-title">
              <span>{t('Reviews from verified buyers')}</span>
              {p.ratingCount > 0 && <Stars value={p.ratingAvg} count={p.ratingCount} />}
            </div>
            {reviews.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                No reviews yet. Only buyers with a delivered order can review.
              </p>
            ) : (
              reviews.map((r) => (
                <div key={r._id} className="list-item" style={{ display: 'block' }}>
                  <div className="row between">
                    <strong>{r.buyerName}</strong>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="small" style={{ margin: '4px 0 0' }}>{r.comment}</p>}
                  <span className="tiny muted">{date(r.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="stack pl-buy" style={{ '--gap': '16px' }}>
          <div className="card stack" style={{ '--gap': '14px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', marginBottom: 4 }}>
                {pn(p)}
                {p.variety && <span className="muted" style={{ fontWeight: 500 }}> · {ln(p.variety)}</span>}
              </h1>
              {lang === 'hi' && <div className="small muted">{p.name}</div>}
              {p.ratingCount > 0 && <Stars value={p.ratingAvg} count={p.ratingCount} />}
            </div>
            <div className="price" style={{ fontSize: '1.8rem' }}>
              {rupees(unitPrice)}
              <small>/{u(p.unit)}</small>
              {unitPrice < p.pricePerUnit && <span className="strike"> {rupees(p.pricePerUnit)}</span>}
            </div>

            {p.bulkTiers?.length > 0 && (
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Quantity</th>
                    <th className="num">Price/{p.unit}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {p.minOrderQty}+ {p.unit}
                    </td>
                    <td className="num">{rupees(p.pricePerUnit)}</td>
                  </tr>
                  {p.bulkTiers.map((tier) => (
                    <tr key={tier.minQty} style={q >= tier.minQty ? { background: 'var(--leaf-2)' } : undefined}>
                      <td>
                        {tier.minQty}+ {p.unit}
                      </td>
                      <td className="num">{rupees(tier.pricePerUnit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Delivery truth-telling */}
            {!pincode ? (
              <button className="alert warn" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => setPinOpen(true)}>
                <Icon name="pin" />
                <span>
                  <strong>{t('Check delivery')}</strong>Enter your pincode to see if this seller delivers to you and the exact fee.
                </span>
              </button>
            ) : delivery?.ok ? (
              <div className="alert ok">
                <Icon name="truck" />
                <span>
                  <strong>
                    {t('Delivers to')} {pincode} · {delivery.fee === 0 ? 'free' : rupees(delivery.fee)}
                  </strong>
                  Usually within {delivery.etaDays === 0 ? 'the same day' : `${delivery.etaDays} day${delivery.etaDays > 1 ? 's' : ''}`}.
                  {delivery.freeDeliveryAbove > 0 && ` Free above ${rupees(delivery.freeDeliveryAbove)}.`}
                  {delivery.minOrderValue > 0 && ` Min order ${rupees(delivery.minOrderValue)} from this seller.`}
                </span>
              </div>
            ) : (
              <div className="alert error">
                <Icon name="alert" />
                <span>
                  <strong>No delivery to {pincode}</strong>
                  {delivery?.pickupAvailable ? 'You can still order for pickup from the seller.' : 'This seller does not deliver to your area yet.'}{' '}
                  <button className="link-btn" onClick={() => setPinOpen(true)}>
                    Change pincode
                  </button>
                </span>
              </div>
            )}

            {seller ? (
              <p className="small muted">You're signed in as a seller/admin account. Use a buyer account to order.</p>
            ) : businessOnly ? (
              <div className="alert warn">
                <Icon name="shield" />
                <span>
                  <strong>Business buyers only</strong>Bulk listing for registered retailers. <Link to="/register?role=retailer">Register your business</Link>
                </span>
              </div>
            ) : (
              <>
                <div className="row between">
                  <Stepper value={q} min={p.minOrderQty} max={p.stock} onChange={setQty} label={`Quantity in ${p.unit}`} />
                  <span className="small muted">{u(p.unit)}</span>
                  <div className="mono" style={{ fontWeight: 700, fontSize: '1.15rem' }}>
                    {rupees(unitPrice * q)}
                  </div>
                </div>
                <div className="row">
                  <Button variant="primary" size="lg" className="grow" onClick={addToCart}>
                    <Icon name="cart" /> {t('Add to cart')}
                  </Button>
                  <Button size="lg" onClick={() => (addToCart(), nav('/cart'))}>
                    {t('Buy now')}
                  </Button>
                </div>
              </>
            )}
          </div>

          {p.groupBuy?.enabled && !seller && !businessOnly && (
            <div className="card tint-turmeric stack">
              <div className="panel-title">
                <span>Group deal · {rupees(p.groupBuy.pricePerUnit)}/{p.unit}</span>
                <span className="badge">Save {Math.round((1 - p.groupBuy.pricePerUnit / p.pricePerUnit) * 100)}%</span>
              </div>
              <p className="small" style={{ margin: 0 }}>
                Pool {p.groupBuy.targetQty}+ {p.unit} with neighbours. Min {p.groupBuy.minMemberQty} {p.unit} each. Delivered to one drop point.
              </p>
              {groups.length > 0 ? (
                groups.map((g) => (
                  <Link key={g._id} to={`/groups/${g._id}`} className="card flat stack" style={{ textDecoration: 'none', '--gap': '8px', padding: 12 }}>
                    <div className="row between small">
                      <strong>{g.dropPoint.label}</strong>
                      <span>{timeLeft(g.deadline)}</span>
                    </div>
                    <Meter value={g.joinedQty} max={g.maxQty} target={g.targetQty} />
                    <span className="tiny">
                      {g.joinedQty}/{g.targetQty} {g.unit} · {g.dropPoint.pincode}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="small muted" style={{ margin: 0 }}>No open groups{pincode ? ` for ${pincode}` : ''}. Start one and share the link.</p>
              )}
              <Button variant="accent" onClick={() => (user ? setGroupOpen(true) : nav(`/login?next=/product/${p._id}`))}>
                {t('Start a group')}
              </Button>
            </div>
          )}

          <Link to={`/sellers/${p.supplier._id}`} className="card stack" style={{ textDecoration: 'none', '--gap': '6px' }}>
            <span className="eyebrow">{t('Seller')}</span>
            <div className="row between">
              <strong style={{ fontSize: '1.1rem' }}>{sp.displayName || p.supplier.name}</strong>
              {sp.verified ? <span className="badge leaf">✓ {t('Verified')}</span> : <span className="badge soft">Not yet verified</span>}
            </div>
            <span className="small muted">
              {[sp.village, sp.district, sp.state].filter(Boolean).join(', ')}
              {sp.pickupAvailable && ' · Pickup available'}
            </span>
            {sp.bio && <p className="small" style={{ margin: 0 }}>{sp.bio}</p>}
          </Link>
        </aside>
      </div>
      <PincodeModal open={pinOpen} onClose={() => setPinOpen(false)} />
      {groupOpen && <StartGroupModal open onClose={() => setGroupOpen(false)} product={p} pincode={pincode} />}
    </div>
  );
}
