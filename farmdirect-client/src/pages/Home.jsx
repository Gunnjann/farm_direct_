import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFetch, useLocationPin } from '../context/AppContext';
import { CATEGORIES, rupees, timeLeft } from '../lib/format';
import { useT } from '../lib/i18n';
import { qs } from '../lib/api';
import ProductCard from '../components/ProductCard';
import FarmScene from '../components/art/FarmScene';
import ProduceArt from '../components/art/Produce';
import { Icon, Meter, SkeletonGrid } from '../components/ui';

const CAT_ART = { vegetables: 'Tomato', fruits: 'Pomegranate', grains: 'Wheat', pulses: 'Toor Dal', spices: 'Turmeric', others: '' };

function Ticker({ items }) {
  const { pn, u } = useT();
  if (!items?.length) return null;
  const row = [...items, ...items];
  return (
    <div className="ticker" aria-label="Today's prices">
      <div className="ticker-track">
        {row.map((p, i) => (
          <Link key={i} to={`/product/${p._id}`} className="ticker-item" tabIndex={i < items.length ? 0 : -1} aria-hidden={i >= items.length}>
            <span className="ti-art">
              <ProduceArt name={p.name} category={p.category} />
            </span>
            {pn(p).toUpperCase()} <span className="up">{rupees(p.pricePerUnit)}/{u(p.unit)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const CAT_BG = { vegetables: '#cfe3c4', fruits: '#f6c9b8', grains: '#f1dca2', pulses: '#e8cfa8', spices: '#f0b98d', others: '#cfe0ea' };

export default function Home() {
  const { pincode, setPincode } = useLocationPin();
  const { lang, t } = useT();
  const [pin, setPin] = useState(pincode);
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const products = useFetch(`/products${qs({ pincode, limit: 8 })}`);
  const groups = useFetch(`/groups${qs({ pincode })}`);
  const tickerItems = useFetch('/products?limit=14&sort=fresh');

  const submit = (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) return setErr('Enter a 6-digit pincode');
    setPincode(pin);
    nav('/shop');
  };

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="stack" style={{ '--gap': '20px' }}>
            <span className="eyebrow">{t('Farmers · Traders · Shops · Homes')}</span>
            {lang === 'hi' ? (
              <h1>
                <mark>खेत से</mark> सीधे खरीदें। सही दाम चुकाएँ।
              </h1>
            ) : (
              <h1>
                Buy straight from the <mark>farm</mark>. Pay the real price.
              </h1>
            )}
            <p style={{ fontSize: '1.1rem', maxWidth: 520 }} className="muted">
              {lang === 'hi' ? t('heroSub') : 'Vegetables, fruit and grains from verified farmers and local traders near you. See the harvest date, the grade and the exact delivery fee — before you pay.'}
            </p>
            <form className="pin-form" onSubmit={submit}>
              <label htmlFor="home-pin" className="sr-only">
                {t('Your pincode')}
              </label>
              <input id="home-pin" inputMode="numeric" maxLength={6} placeholder={t('Your pincode')} value={pin} onChange={(e) => (setErr(''), setPin(e.target.value.replace(/\D/g, '')))} />
              <button type="submit">{t('Find sellers')}</button>
            </form>
            {err && <span style={{ color: 'var(--chili)', fontWeight: 600 }}>{err}</span>}
            <div className="row small" style={{ '--gap': '16px' }}>
              <span className="row" style={{ '--gap': '6px' }}>
                <Icon name="shield" size={16} /> {t('Verified sellers')}
              </span>
              <span className="row" style={{ '--gap': '6px' }}>
                <Icon name="truck" size={16} /> {t('Fees shown upfront')}
              </span>
              <span className="row" style={{ '--gap': '6px' }}>
                <Icon name="check" size={16} /> {t('Refund if it goes wrong')}
              </span>
            </div>
          </div>

          <div className="scene-wrap">
          <div className="scene-card">
            <FarmScene />
            <span className="scene-tag">{t('Live from the farm')}</span>
          </div>
            <div className="receipt mini" aria-label="Example of a transparent bill">
              <div className="row between">
                <strong>BILL</strong>
                <span>411045</span>
              </div>
              <div className="r-cut" />
              <div className="r-row">
                <span>{lang === 'hi' ? 'टमाटर 10 किलो' : 'Tomato 10 kg'}</span>
                <span>₹280</span>
              </div>
              <div className="r-row">
                <span>{lang === 'hi' ? 'डिलीवरी' : 'Delivery'}</span>
                <span>₹40</span>
              </div>
              <div className="r-row">
                <span>{lang === 'hi' ? 'शुल्क 2%' : 'Fee 2%'}</span>
                <span>₹5.60</span>
              </div>
              <div className="r-cut" />
              <div className="r-row" style={{ fontWeight: 700 }}>
                <span>{lang === 'hi' ? 'कुल' : 'TOTAL'}</span>
                <span>₹325.60</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Ticker items={tickerItems.data?.items} />

      <section className="band">
        <div className="container stack">
          <div className="row between">
            <h2 style={{ margin: 0 }}>{t('Shop by category')}</h2>
          </div>
          <div className="grid" style={{ '--min': '150px' }}>
            {CATEGORIES.map((c) => (
              <Link key={c.id} to={`/shop?category=${c.id}`} className="cat-tile" style={{ background: CAT_BG[c.id] }}>
                <span>{lang === 'hi' ? c.hi : c.label}</span>
                <Icon name="arrow" />
                <span className="cat-art" aria-hidden="true">
                  <ProduceArt name={CAT_ART[c.id]} category={c.id} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container stack">
          <div className="row between">
            <div>
              <h2 style={{ margin: 0 }}>{pincode ? `${t('Delivering to')} ${pincode}` : t('Fresh on FarmDirect')}</h2>
              {!pincode && <p className="muted small" style={{ margin: 0 }}>Add your pincode to see only sellers who deliver to you.</p>}
            </div>
            <Link to="/shop" className="btn sm">
              {t('See all')}
            </Link>
          </div>
          {products.loading ? (
            <SkeletonGrid n={4} />
          ) : products.data?.items?.length ? (
            <div className="grid pgrid">{products.data.items.map((p) => <ProductCard key={p._id} product={p} />)}</div>
          ) : (
            <div className="empty">
              <h3>No sellers deliver to {pincode} yet</h3>
              <p className="muted">We're onboarding farmers area by area. Try a nearby pincode, or check back soon.</p>
            </div>
          )}
        </div>
      </section>

      {groups.data?.items?.length > 0 && (
        <section className="band turmeric">
          <div className="container stack">
            <div className="row between">
              <div>
                <h2 style={{ margin: 0 }}>{t('Group orders near you')}</h2>
                <p style={{ margin: 0 }}>Neighbours pooling orders for wholesale prices, delivered to one drop point.</p>
              </div>
              <Link to="/groups" className="btn sm">
                All groups
              </Link>
            </div>
            <div className="grid" style={{ '--min': '260px' }}>
              {groups.data.items.slice(0, 3).map((g) => (
                <Link key={g._id} to={`/groups/${g._id}`} className="card stack" style={{ textDecoration: 'none', '--gap': '10px' }}>
                  <div className="row between">
                    <strong>{g.productName}</strong>
                    <span className="badge">{timeLeft(g.deadline)}</span>
                  </div>
                  <div className="price">
                    {rupees(g.pricePerUnit)}
                    <small>/{g.unit}</small> <span className="strike">{rupees(g.regularPrice)}</span>
                  </div>
                  <Meter value={g.joinedQty} max={g.maxQty} target={g.targetQty} />
                  <span className="small">
                    {g.joinedQty}/{g.targetQty} {g.unit} to target · {g.dropPoint.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="band" style={{ background: 'var(--leaf-2)' }}>
        <div className="container two-col" style={{ alignItems: 'center' }}>
          <div className="stack">
            <span className="eyebrow">{lang === 'hi' ? 'किसान भाइयों के लिए' : 'For farmers'}</span>
            <h2 style={{ margin: 0 }}>{lang === 'hi' ? 'पास की मंडी में भाव गिर गया? दूर कहाँ बेचने में फ़ायदा है — पहले हिसाब देखें।' : 'Local price crashed? See where selling actually pays — before you load the truck.'}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {lang === 'hi'
                ? 'मध्य प्रदेश और महाराष्ट्र की मंडियों के भाव, भाड़ा-कमीशन-ख़राबी घटाकर असली कमाई, और सत्यापित व्यापारी जो खेत से माल उठाकर मौके पर भुगतान करते हैं।'
                : 'Mandi prices across Madhya Pradesh & Maharashtra, real take-home after fare, commission and spoilage, and verified brokers who collect from your farm and pay on the spot.'}
            </p>
            <div className="row">
              <Link to="/mandi" className="btn primary lg">{lang === 'hi' ? 'मंडी भाव' : 'Mandi Bhav'}</Link>
              <Link to="/mandi/calculator" className="btn accent lg">{lang === 'hi' ? 'कहाँ बेचूँ?' : 'Where should I sell?'}</Link>
              <Link to="/vyapar" className="btn lg">{lang === 'hi' ? 'व्यापारी खोजें' : 'Find brokers'}</Link>
            </div>
          </div>
          <div className="card stack" style={{ '--gap': '8px' }}>
            <div className="panel-title">{lang === 'hi' ? 'उदाहरण: 60 क्विंटल गोभी, देवास' : 'Example: 60 qtl cauliflower, Dewas'}</div>
            <div className="sum-row"><span>{lang === 'hi' ? 'देवास मंडी (0 किमी)' : 'Dewas mandi (0 km)'}</span><strong className="mono" style={{ color: 'var(--chili)' }}>{lang === 'hi' ? 'नुक़सान' : 'LOSS'}</strong></div>
            <div className="sum-row"><span>{lang === 'hi' ? 'इंदौर मंडी (48 किमी)' : 'Indore mandi (48 km)'}</span><strong className="mono" style={{ color: 'var(--leaf)' }}>+₹5.5/kg</strong></div>
            <div className="sum-row"><span>{lang === 'hi' ? 'सही खेत-भाव (व्यापारी से)' : 'Fair farm-gate price (broker)'}</span><strong className="mono">≥ ₹7.4/kg</strong></div>
            <p className="tiny muted" style={{ margin: 0 }}>{lang === 'hi' ? 'सैंपल डेटा से उदाहरण।' : 'Illustration from sample data.'}</p>
          </div>
        </div>
      </section>

      <section className="band ink">
        <div className="container stack" style={{ '--gap': '24px' }}>
          <h2>Built for how farm trade really works</h2>
          <div className="grid" style={{ '--min': '240px' }}>
            {[
              ['01', 'Real delivery areas', 'Sellers list the pincodes they actually reach. If nobody delivers to you, we say so — no fake promises.'],
              ['02', 'Harvest date & grade', 'Every listing shows when it was harvested and its grade, so you know what you are buying.'],
              ['03', 'Group buying', 'Pool orders with neighbours or nearby shops to unlock wholesale prices and one shared delivery.'],
              ['04', 'Fair to farmers', 'Farmers set their own prices and get paid for delivered orders. No auction pressure, no hidden cuts.'],
            ].map(([n, h, p]) => (
              <div key={n} className="feature">
                <span className="num">{n}</span>
                <h3>{h}</h3>
                <p style={{ margin: 0, opacity: 0.85 }}>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="container two-col" style={{ alignItems: 'center' }}>
          <div className="stack">
            <span className="eyebrow">For farmers &amp; traders</span>
            <h2>Sell directly. Set your own price. Deliver where you choose.</h2>
            <p className="muted">List produce in two minutes from your phone. Choose the pincodes you deliver to, accept the orders you want, and see your earnings every week.</p>
            <div className="row">
              <Link to="/register?role=farmer" className="btn accent lg">
                Start selling
              </Link>
              <Link to="/how-it-works" className="btn lg ghost">
                How it works
              </Link>
            </div>
          </div>
          <div className="card stack">
            <div className="panel-title">Seller dashboard · today</div>
            <div className="grid" style={{ '--min': '120px' }}>
              <div className="stat hl">
                <div className="label">New orders</div>
                <div className="value">7</div>
              </div>
              <div className="stat">
                <div className="label">30-day sales</div>
                <div className="value">₹48k</div>
              </div>
            </div>
            <p className="small muted" style={{ margin: 0 }}>Illustration. Your real numbers appear after you start selling.</p>
          </div>
        </div>
      </section>
    </>
  );
}
