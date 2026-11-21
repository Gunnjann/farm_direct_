import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch, useToast } from '../../context/AppContext';
import { api } from '../../lib/api';
import { rupees } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { Empty, ErrorBox, Icon, Loading } from '../../components/ui';

function StockCell({ p, onSaved }) {
  const [v, setV] = useState(String(p.stock));
  const toast = useToast();
  const save = async () => {
    const n = parseInt(v, 10);
    if (Number.isNaN(n) || n < 0 || n === p.stock) return setV(String(p.stock));
    try {
      await api(`/products/${p._id}`, { method: 'PATCH', body: { stock: n } });
      toast(`${p.name} stock updated`, 'ok');
      onSaved();
    } catch (e) {
      toast(e.message, 'error');
      setV(String(p.stock));
    }
  };
  return (
    <input
      className="input mono"
      style={{ width: 90, minHeight: 36, padding: '4px 8px', textAlign: 'right' }}
      inputMode="numeric"
      aria-label={`Stock for ${p.name}`}
      value={v}
      onChange={(e) => setV(e.target.value.replace(/\D/g, ''))}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

export default function SellerProducts() {
  const { t } = useT();
  const toast = useToast();
  const { data, error, loading, reload } = useFetch('/products/mine');

  const toggle = async (p) => {
    try {
      await api(`/products/${p._id}`, { method: 'PATCH', body: { isActive: !p.isActive } });
      toast(p.isActive ? 'Listing hidden' : 'Listing live', 'ok');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="container page stack">
      <div className="row between">
        <h1 style={{ margin: 0 }}>{t('Products')}</h1>
        <Link to="/seller/products/new" className="btn accent">
          <Icon name="plus" /> {t('Add product')}
        </Link>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Empty title="No products yet" action={<Link to="/seller/products/new" className="btn primary">List your first product</Link>}>
          It takes about two minutes.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">{t('Price')}</th>
                <th className="num">{t('Stock')}</th>
                <th className="num">Sold</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p._id} style={{ opacity: p.isActive ? 1 : 0.55 }}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.variety && <span className="muted"> · {p.variety}</span>}
                    <div className="tiny muted">
                      {p.category} · Grade {p.grade}
                      {p.groupBuy?.enabled && ' · Group deal'}
                    </div>
                  </td>
                  <td className="num">
                    {rupees(p.pricePerUnit)}/{p.unit}
                  </td>
                  <td className="num">
                    <StockCell p={p} onSaved={reload} />
                  </td>
                  <td className="num">{p.soldQty}</td>
                  <td>
                    <button className={`badge ${p.isActive ? 'leaf' : 'soft'}`} style={{ cursor: 'pointer' }} onClick={() => toggle(p)} title="Click to toggle">
                      {p.isActive ? 'Live' : 'Hidden'}
                    </button>
                  </td>
                  <td>
                    <Link to={`/seller/products/${p._id}/edit`} className="btn sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
