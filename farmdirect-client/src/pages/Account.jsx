import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useToast } from '../context/AppContext';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { isBuyer, isSupplier } from '../lib/format';
import { Button, ErrorBox, Input } from '../components/ui';

export default function Account() {
  const { user, setUser, logout } = useAuth();
  const { lang, setLang } = useT();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', businessName: user.businessProfile?.businessName || '', gstin: user.businessProfile?.gstin || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name: f.name, phone: f.phone || undefined };
      if (user.role === 'retailer') Object.assign(body, { businessName: f.businessName || undefined, gstin: f.gstin || undefined });
      const d = await api('/auth/me', { method: 'PATCH', body });
      setUser(d.user);
      toast('Profile saved', 'ok');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const delAddr = async (id) => {
    const d = await api(`/auth/me/addresses/${id}`, { method: 'DELETE' });
    setUser(d.user);
  };
  const logoutAll = async () => {
    await api('/auth/logout-all', { method: 'POST' }).catch(() => {});
    logout();
    nav('/login');
  };

  return (
    <div className="container page stack" style={{ maxWidth: 760, '--gap': '20px' }}>
      <div>
        <span className="eyebrow">{user.role}</span>
        <h1 style={{ marginTop: 6 }}>{user.name}</h1>
        <span className="muted">{user.email}</span>
      </div>

      <form className="card form-grid cols-2" onSubmit={save}>
        <div className="panel-title span-2">Profile</div>
        <Input label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <Input label="Mobile" inputMode="tel" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        {user.role === 'retailer' && (
          <>
            <Input label="Business name" value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} />
            <Input label="GSTIN (optional)" maxLength={15} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} />
          </>
        )}
        <div className="span-2 stack">
          <ErrorBox error={error} />
          <Button variant="primary" loading={busy} type="submit">
            Save
          </Button>
        </div>
      </form>

      {isBuyer(user) && (
        <div className="card">
          <div className="panel-title">Saved addresses</div>
          {user.addresses.length === 0 && <p className="muted small" style={{ margin: 0 }}>Addresses you add at checkout appear here.</p>}
          {user.addresses.map((a) => (
            <div key={a._id} className="list-item">
              <div className="grow small">
                <strong>{a.label}</strong> · <span className="mono">{a.pincode}</span>
                <br />
                {a.line1}, {a.city}
              </div>
              <button className="link-btn small" onClick={() => delAddr(a._id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card stack">
        <div className="panel-title">Preferences & security</div>
        <div className="row between">
          <span>Language</span>
          <div className="segmented">
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
              English
            </button>
            <button aria-pressed={lang === 'hi'} onClick={() => setLang('hi')}>
              हिन्दी
            </button>
          </div>
        </div>
        {isSupplier(user) && (
          <Link to="/seller/settings" className="btn">
            Delivery areas & payout settings
          </Link>
        )}
        <div className="row">
          <Button onClick={() => (logout(), nav('/'))}>Log out</Button>
          <Button variant="ghost" onClick={logoutAll}>
            Log out on all devices
          </Button>
        </div>
      </div>
    </div>
  );
}
