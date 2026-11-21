import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';

/* ============================== Toasts ============================== */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast ${i.kind}`}>
            {i.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ============================== Auth ============================== */
const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return setReady(true);
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true));
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    tokenStore.set(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const register = useCallback(async (payload) => {
    const d = await api('/auth/register', { method: 'POST', body: payload });
    tokenStore.set(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const value = useMemo(() => ({ user, setUser, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

/* ============================== Location (pincode) ============================== */
const LocCtx = createContext(null);
export function LocationProvider({ children }) {
  const [pincode, setPin] = useState(() => {
    try {
      return localStorage.getItem('fd_pin') || '';
    } catch {
      return '';
    }
  });
  const setPincode = (p) => {
    setPin(p);
    try {
      p ? localStorage.setItem('fd_pin', p) : localStorage.removeItem('fd_pin');
    } catch {
      /* ignore */
    }
  };
  return <LocCtx.Provider value={{ pincode, setPincode }}>{children}</LocCtx.Provider>;
}
export const useLocationPin = () => useContext(LocCtx);

/* ============================== Cart ==============================
 * The cart stores ONLY product ids, quantities and a display snapshot.
 * Prices shown at checkout always come fresh from the server quote.
 */
const CartCtx = createContext(null);
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('fd_cart') || '[]');
    } catch {
      return [];
    }
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem('fd_cart', JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = (product, qty) =>
    setItems((xs) => {
      const i = xs.findIndex((x) => x.productId === product._id);
      const snap = {
        productId: product._id,
        name: product.variety ? `${product.name} (${product.variety})` : product.name,
        unit: product.unit,
        category: product.category,
        image: product.images?.[0],
        pricePerUnit: product.pricePerUnit,
        minOrderQty: product.minOrderQty,
        stock: product.stock,
        supplierName: product.supplier?.supplierProfile?.displayName || product.supplier?.name,
        supplierId: product.supplier?._id || product.supplier,
      };
      if (i === -1) return [...xs, { ...snap, qty }];
      const next = [...xs];
      next[i] = { ...next[i], ...snap, qty: Math.min(next[i].qty + qty, product.stock) };
      return next;
    });
  const setQty = (productId, qty) => setItems((xs) => xs.map((x) => (x.productId === productId ? { ...x, qty } : x)));
  const remove = (productId) => setItems((xs) => xs.filter((x) => x.productId !== productId));
  const clear = () => setItems([]);
  const count = items.length;

  return <CartCtx.Provider value={{ items, add, setQty, remove, clear, count }}>{children}</CartCtx.Provider>;
}
export const useCart = () => useContext(CartCtx);

/* ============================== Data hook ============================== */
export function useFetch(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
