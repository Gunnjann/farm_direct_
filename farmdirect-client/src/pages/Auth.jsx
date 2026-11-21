import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AppContext';
import { Button, ErrorBox, Input, Select } from '../components/ui';
import { useMarketMeta, STATES } from '../lib/market';

const home = (u) => (['farmer', 'trader'].includes(u.role) ? '/seller' : u.role === 'admin' ? '/admin' : u.role === 'broker' ? '/vyapar' : '/shop');
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null); // no open redirects

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(f.email, f.password);
      nav(safeNext(sp.get('next')) || home(u), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page" style={{ maxWidth: 460 }}>
      <div className="card stack" style={{ '--gap': '18px' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Welcome back</h1>
        <form className="form-grid" onSubmit={submit}>
          <Input label="Email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input label="Password" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <ErrorBox error={error} />
          <Button variant="primary" size="lg" loading={busy} type="submit">
            Log in
          </Button>
        </form>
        <p className="small" style={{ margin: 0 }}>
          New here? <Link to={`/register${sp.get('next') ? `?next=${encodeURIComponent(sp.get('next'))}` : ''}`}>Create an account</Link>
        </p>
        <details className="small">
          <summary style={{ cursor: 'pointer' }}>Demo accounts (local seed data)</summary>
          <p className="mono tiny" style={{ marginTop: 8 }}>
            customer@farmdirect.test · retailer@farmdirect.test · ramesh@farmdirect.test · trader@farmdirect.test — password Farm@1234
            <br />
            admin@farmdirect.test — Admin@12345
          </p>
        </details>
      </div>
    </div>
  );
}

const ROLES = [
  { id: 'customer', title: 'Household', text: 'Buy fresh produce for home' },
  { id: 'retailer', title: 'Business', text: 'Shop, restaurant or wholesale buyer' },
  { id: 'farmer', title: 'Farmer', text: 'Sell what you grow' },
  { id: 'trader', title: 'Trader', text: 'Sell aggregated stock in bulk' },
  { id: 'broker', title: 'Broker', text: 'Buy crops in bulk from farmers' },
];

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const initialRole = ROLES.some((r) => r.id === sp.get('role')) ? sp.get('role') : 'customer';
  const [f, setF] = useState({ role: initialRole, name: '', email: '', phone: '', password: '', businessName: '', businessType: 'retail_shop', village: '', district: '', state: '', pincode: '', licenseNumber: '' });
  const { meta } = useMarketMeta();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const supplier = f.role === 'farmer' || f.role === 'trader';
  const broker = f.role === 'broker';
  const mpmh = f.role === 'farmer' || broker; // farm/broker location drives distance matching

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
    if (f.role !== 'retailer') delete payload.businessType;
    if (!supplier && !broker) ['village', 'district', 'state', 'pincode'].forEach((k) => delete payload[k]);
    if (!broker) delete payload.licenseNumber;
    try {
      const u = await register(payload);
      nav(safeNext(sp.get('next')) || (supplier ? '/seller/settings?welcome=1' : home(u)), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page" style={{ maxWidth: 640 }}>
      <div className="card stack" style={{ '--gap': '18px' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Create your account</h1>
        <div className="grid" style={{ '--min': '130px', gap: 10 }} role="radiogroup" aria-label="Account type">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={f.role === r.id}
              onClick={() => setF({ ...f, role: r.id })}
              className="card flat"
              style={{ textAlign: 'left', cursor: 'pointer', padding: 12, background: f.role === r.id ? 'var(--turmeric)' : undefined, boxShadow: f.role === r.id ? 'var(--shadow-sm)' : 'none' }}
            >
              <strong style={{ display: 'block' }}>{r.title}</strong>
              <span className="tiny">{r.text}</span>
            </button>
          ))}
        </div>
        <form className="form-grid cols-2" onSubmit={submit}>
          <Input label="Full name" required autoComplete="name" value={f.name} onChange={up('name')} />
          <Input label="Mobile number" inputMode="tel" maxLength={10} autoComplete="tel-national" value={f.phone} onChange={up('phone')} required={broker} hint={broker ? 'Required — farmers call you to verify' : f.role === 'farmer' ? 'Needed to deal with brokers' : '10 digits, optional'} />
          <Input className="span-2" label="Email" type="email" required autoComplete="email" value={f.email} onChange={up('email')} />
          <Input className="span-2" label="Password" type="password" required autoComplete="new-password" value={f.password} onChange={up('password')} hint="At least 8 characters with a letter and a number" />
          {broker && (
            <>
              <Input label="Business / firm name" value={f.businessName} onChange={up('businessName')} required />
              <Input label="Mandi licence no. (optional)" value={f.licenseNumber} onChange={up('licenseNumber')} hint="Speeds up your verification" />
            </>
          )}
          {(f.role === 'retailer' || supplier) && (
            <Input className={f.role === 'retailer' ? '' : 'span-2'} label={supplier ? 'Farm / shop name' : 'Business name'} value={f.businessName} onChange={up('businessName')} required={f.role === 'retailer'} />
          )}
          {f.role === 'retailer' && (
            <Select
              label="Business type"
              value={f.businessType}
              onChange={up('businessType')}
              options={[
                { value: 'retail_shop', label: 'Retail shop' },
                { value: 'restaurant', label: 'Restaurant' },
                { value: 'hotel', label: 'Hotel / caterer' },
                { value: 'wholesaler', label: 'Wholesaler' },
                { value: 'other', label: 'Other' },
              ]}
            />
          )}
          {mpmh && meta && (
            <>
              <Select label="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value, district: '' })} options={[{ value: '', label: 'Choose…' }, ...STATES.map((s) => ({ value: s.value, label: s.value }))]} />
              <Select label="District" value={f.district} onChange={up('district')} options={[{ value: '', label: 'Choose…' }, ...meta.locations.filter((l) => l.state === f.state).map((l) => ({ value: l.district, label: l.district }))]} />
            </>
          )}
          {supplier && (
            <>
              <Input label="Village / town" value={f.village} onChange={up('village')} />
              {!mpmh && <Input label="District" value={f.district} onChange={up('district')} />}
              {!mpmh && <Input label="State" value={f.state} onChange={up('state')} />}
              <Input label="Pincode" inputMode="numeric" maxLength={6} value={f.pincode} onChange={up('pincode')} />
              <p className="small muted span-2" style={{ margin: 0 }}>
                After sign-up you'll set the pincodes you deliver to. Our team verifies new sellers before they get the Verified badge.
              </p>
            </>
          )}
          <div className="span-2 stack">
            <ErrorBox error={error} />
            <Button variant="primary" size="lg" block loading={busy} type="submit">
              Create account
            </Button>
          </div>
        </form>
        <p className="small" style={{ margin: 0 }}>
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
