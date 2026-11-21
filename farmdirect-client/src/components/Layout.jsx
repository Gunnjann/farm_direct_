import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useCart, useLocationPin } from '../context/AppContext';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { isBuyer, isSupplier } from '../lib/format';
import { Button, Icon, Modal } from './ui';

export function PincodeModal({ open, onClose }) {
  const { pincode, setPincode } = useLocationPin();
  const [v, setV] = useState(pincode);
  const [err, setErr] = useState('');
  useEffect(() => {
    setV(pincode);
  }, [pincode, open]);
  const save = (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(v)) return setErr('Enter a 6-digit pincode');
    setPincode(v);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Where should we deliver?">
      <p className="muted small">We only show sellers who actually deliver to your pincode — with their real delivery fee.</p>
      <form onSubmit={save} className="stack">
        <input className="input mono" style={{ fontSize: '1.4rem', letterSpacing: '0.2em' }} inputMode="numeric" maxLength={6} autoFocus placeholder="411045" value={v} onChange={(e) => (setErr(''), setV(e.target.value.replace(/\D/g, '')))} aria-label="Pincode" />
        {err && <span className="err small" style={{ color: 'var(--chili)' }}>{err}</span>}
        <div className="row">
          <Button variant="primary" type="submit" className="grow">
            Save pincode
          </Button>
          {pincode && (
            <Button type="button" variant="ghost" onClick={() => (setPincode(''), onClose())}>
              Clear
            </Button>
          )}
        </div>
        <p className="tiny muted">Demo data covers Pune: 411001, 411004, 411038, 411045, 411057.</p>
      </form>
    </Modal>
  );
}

function useUnread(user) {
  const [n, setN] = useState(0);
  const loc = useLocation();
  useEffect(() => {
    if (!user) return setN(0);
    let alive = true;
    const load = () => api('/notifications').then((d) => alive && setN(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user, loc.pathname]);
  return n;
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Icon name="user" />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu" onClick={() => setOpen(false)}>
          {user ? (
            <>
              <div style={{ padding: '12px 14px' }}>
                <strong>{user.name}</strong>
                <div className="tiny muted mono">{user.role.toUpperCase()}</div>
              </div>
              <Link to="/account">{t('Account')}</Link>
              <Link to="/notifications">{t('Notifications')}</Link>
              <Link to="/disputes">{t('Complaints')}</Link>
              {isBuyer(user) && <Link to="/groups/mine">My groups</Link>}
              <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>{lang === 'en' ? 'हिन्दी में देखें' : 'View in English'}</button>
              <button onClick={() => (logout(), nav('/'))}>{t('Log out')}</button>
            </>
          ) : (
            <>
              <Link to="/login">{t('Log in')}</Link>
              <Link to="/register">{t('Sign up')}</Link>
              <Link to="/register?role=farmer">Sell on FarmDirect</Link>
              <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>{lang === 'en' ? 'हिन्दी में देखें' : 'View in English'}</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchBox() {
  const { t } = useT();
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState(new URLSearchParams(loc.search).get('q') || '');
  return (
    <form
      className="header-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        nav(`/shop${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      }}
    >
      <div style={{ display: 'flex', border: 'var(--b)', background: 'var(--card)', maxWidth: 440 }}>
        <span style={{ display: 'grid', placeItems: 'center', padding: '0 10px' }}>
          <Icon name="search" size={18} />
        </span>
        <input className="input" style={{ border: 0, minHeight: 40 }} placeholder={t('Search vegetables, grains…')} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </div>
    </form>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const { count } = useCart();
  const { pincode } = useLocationPin();
  const { t } = useT();
  const [pinOpen, setPinOpen] = useState(false);
  const unread = useUnread(user);
  const supplier = isSupplier(user);
  const admin = user?.role === 'admin';
  const broker = user?.role === 'broker';
  const farmer = user?.role === 'farmer';
  const { tr } = useT();

  const links = admin
    ? [
        { to: '/admin', label: t('Dashboard'), icon: 'home', end: true },
        { to: '/admin/users', label: 'Users', icon: 'users' },
        { to: '/disputes', label: t('Complaints'), icon: 'alert' },
        { to: '/shop', label: t('Shop'), icon: 'shop' },
      ]
    : broker
      ? [
          { to: '/vyapar', label: tr('Vyapar', 'व्यापार'), icon: 'users', end: true },
          { to: '/mandi', label: tr('Mandi Bhav', 'मंडी भाव'), icon: 'list', end: true },
          { to: '/mandi/calculator', label: tr('Calculator', 'हिसाब'), icon: 'truck' },
          { to: '/notifications', label: t('Notifications'), icon: 'bell', desk: true },
        ]
      : supplier
        ? [
            { to: '/seller', label: t('Dashboard'), icon: 'home', end: true },
            ...(farmer
              ? [
                  { to: '/mandi', label: tr('Mandi Bhav', 'मंडी भाव'), icon: 'list', end: true },
                  { to: '/vyapar', label: tr('Vyapar', 'व्यापार'), icon: 'users' },
                ]
              : []),
            { to: '/seller/products', label: t('Products'), icon: 'box', desk: farmer },
            { to: '/seller/orders', label: t('Orders'), icon: 'cart' },
            { to: '/seller/settings', label: t('Settings'), icon: 'gear', desk: farmer },
          ]
        : [
            { to: '/shop', label: t('Shop'), icon: 'shop' },
            { to: '/groups', label: t('Groups'), icon: 'users' },
            { to: '/cart', label: t('Cart'), icon: 'cart', badge: count },
            { to: '/orders', label: t('Orders'), icon: 'list' },
            { to: '/mandi', label: tr('Mandi Bhav', 'मंडी भाव'), icon: 'list', desk: true, end: true },
          ];

  return (
    <>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <header className="header">
        <div className="container header-inner">
          <Link to={supplier ? '/seller' : admin ? '/admin' : broker ? '/vyapar' : '/'} className="logo" aria-label="FarmDirect home">
            <span className="logo-mark">F</span>
            <span>FarmDirect</span>
          </Link>
          <nav className="top-links" aria-label="Main">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}>
                {l.label}
                {l.badge ? ` (${l.badge})` : ''}
              </NavLink>
            ))}
          </nav>
          {!supplier && !admin && !broker && <SearchBox />}
          <div className="header-actions">
            {!supplier && !admin && !broker && (
              <button className={`pin-chip ${pincode ? '' : 'unset'}`} onClick={() => setPinOpen(true)} aria-label="Change delivery pincode">
                <Icon name="pin" size={16} />
                {pincode || t('Set pincode')}
              </button>
            )}
            {user && (
              <Link to="/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
                <Icon name="bell" />
                {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
              </Link>
            )}
            {!user && (
              <Link to="/login" className="btn sm desk-only">
                {t('Log in')}
              </Link>
            )}
            <AccountMenu />
          </div>
        </div>
      </header>

      <main id="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container row between">
          <div>
            <strong>FarmDirect</strong> <span className="muted">· Farm-to-buyer marketplace</span>
          </div>
          <div className="row small" style={{ '--gap': '16px' }}>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/register?role=farmer">Sell with us</Link>
            <Link to="/disputes">Help &amp; complaints</Link>
          </div>
        </div>
      </footer>

      <nav className="bottom-nav" aria-label="Main">
        {links.filter((l) => !l.desk).map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <Icon name={l.icon} />
            {l.label}
            {l.badge > 0 && <span className="dot">{l.badge}</span>}
          </NavLink>
        ))}
        <NavLink to={user ? '/account' : '/login'}>
          <Icon name="user" />
          {user ? t('Account') : t('Log in')}
        </NavLink>
      </nav>

      <PincodeModal open={pinOpen} onClose={() => setPinOpen(false)} />
    </>
  );
}

/** Route guard: login required, optionally restricted to roles. */
export function RequireAuth({ roles, children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container page">
        <div className="empty stack">
          <h2>Not available for your account</h2>
          <p className="muted">This page is for {roles.join(' / ')} accounts.</p>
          <Link className="btn" to="/">
            Go home
          </Link>
        </div>
      </div>
    );
  }
  return children;
}
