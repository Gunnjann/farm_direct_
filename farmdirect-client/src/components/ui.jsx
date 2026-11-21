import { useEffect, useId, useState } from 'react';
import { STATUS_LABEL } from '../lib/format';
import { SproutLoader, EmptyBasket } from './art/Stickers';

/* Minimal stroke icons (no icon library needed). */
const paths = {
  cart: 'M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Zm4.3 12a2 2 0 0 0 3.4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0',
  shop: 'M4 9l1.5-5h13L20 9M4 9h16M4 9v11h16V9M9 20v-6h6v6',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6',
  box: 'M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  home: 'M3 11l9-8 9 8v10H3V11Zm6 10v-6h6v6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  pin: 'M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3',
  check: 'M4 12l5 5L20 6',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
};
export function Icon({ name, size = 20, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function Button({ variant = '', size = '', block, loading, children, className = '', ...rest }) {
  return (
    <button className={`btn ${variant} ${size} ${block ? 'block' : ''} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, className = '' }) {
  const id = useId();
  const child = typeof children === 'function' ? children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-e` : undefined }) : children;
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      {child}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && (
        <span className="err" id={`${id}-e`}>
          {error}
        </span>
      )}
    </div>
  );
}

export function Input({ label, hint, error, className = '', ...rest }) {
  return <Field label={label} hint={hint} error={error} className={className}>{(a) => <input className="input" {...a} {...rest} />}</Field>;
}

export function Select({ label, hint, error, options, className = '', ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(a) => (
        <select className="input" {...a} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function Textarea({ label, hint, error, className = '', ...rest }) {
  return <Field label={label} hint={hint} error={error} className={className}>{(a) => <textarea className="input" {...a} {...rest} />}</Field>;
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="row" style={{ padding: 32, justifyContent: 'center' }} role="status">
      <SproutLoader size={44} />
      <span className="muted">{label}</span>
    </div>
  );
}

export function SkeletonGrid({ n = 8 }) {
  return (
    <div className="grid">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 280 }} />
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert error" role="alert">
      <Icon name="alert" />
      <div className="grow">
        <strong>{error.status === 0 ? 'You seem to be offline' : 'Something went wrong'}</strong>
        {error.message}
        {error.details?.length > 1 && (
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {error.details.slice(1, 5).map((d, i) => (
              <li key={i}>{d.message}</li>
            ))}
          </ul>
        )}
      </div>
      {onRetry && (
        <button className="btn sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, action, sticker }) {
  return (
    <div className="empty stack" style={{ alignItems: 'center' }}>
      {sticker && (
        <div className="sticker-wrap">
          <EmptyBasket size={130} />
        </div>
      )}
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function Status({ value }) {
  return <span className={`status ${value}`}>{STATUS_LABEL[value] || value}</span>;
}

export function Stars({ value = 0, count }) {
  const full = Math.round(value);
  return (
    <span className="stars small" aria-label={`${value} out of 5`}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
      {count != null && <span className="muted"> ({count})</span>}
    </span>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99999, label = 'Quantity' }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const commit = (v) => {
    const n = Math.max(min, Math.min(max, parseInt(v, 10) || min));
    onChange(n);
    setText(String(n));
  };
  return (
    <div className="stepper">
      <button type="button" aria-label="Decrease" onClick={() => commit(value - 1)} disabled={value <= min}>
        −
      </button>
      <input aria-label={label} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value.replace(/\D/g, ''))} onBlur={(e) => commit(e.target.value)} />
      <button type="button" aria-label="Increase" onClick={() => commit(value + 1)} disabled={value >= max}>
        +
      </button>
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal stack" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Meter({ value, max, target }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${pct}%` }} />
      {target && <i style={{ left: `${(target / max) * 100}%` }} title="Target" />}
    </div>
  );
}
