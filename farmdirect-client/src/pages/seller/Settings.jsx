import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useToast } from '../../context/AppContext';
import { api } from '../../lib/api';
import { Button, ErrorBox, Input, Textarea } from '../../components/ui';

const toR = (p) => (p ? String(p / 100) : '');

export default function SellerSettings() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [sp] = useSearchParams();
  const p = user.supplierProfile || {};
  const [f, setF] = useState({
    displayName: p.displayName || '',
    bio: p.bio || '',
    village: p.village || '',
    district: p.district || '',
    state: p.state || '',
    pincode: p.pincode || '',
    freeDeliveryAbove: toR(p.freeDeliveryAbove),
    minOrderValue: toR(p.minOrderValue),
    pickupAvailable: !!p.pickupAvailable,
    pickupAddress: p.pickupAddress || '',
    upiId: p.upiId || '',
  });
  const [areas, setAreas] = useState((p.serviceAreas || []).map((a) => ({ pincode: a.pincode, deliveryFee: String(a.deliveryFee / 100), etaDays: String(a.etaDays ?? 1) })));
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const up = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const addBulk = () => {
    const pins = [...new Set(bulk.split(/[\s,]+/).filter((x) => /^\d{6}$/.test(x)))].filter((x) => !areas.some((a) => a.pincode === x));
    setAreas([...areas, ...pins.map((pincode) => ({ pincode, deliveryFee: areas[0]?.deliveryFee || '40', etaDays: '1' }))]);
    setBulk('');
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== '' || k === 'upiId')),
        freeDeliveryAbove: Number(f.freeDeliveryAbove || 0),
        minOrderValue: Number(f.minOrderValue || 0),
        serviceAreas: areas.map((a) => ({ pincode: a.pincode, deliveryFee: Number(a.deliveryFee || 0), etaDays: Number(a.etaDays || 1) })),
      };
      const d = await api('/seller/settings', { method: 'PATCH', body });
      setUser(d.user);
      toast('Settings saved', 'ok');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <h1>Shop settings</h1>
      {sp.get('welcome') && (
        <div className="alert ok" style={{ marginBottom: 16 }}>
          <span>
            <strong>Welcome to FarmDirect!</strong>Add the pincodes you deliver to so buyers nearby can find you. Then list your first product.
          </span>
        </div>
      )}
      <form onSubmit={save} className="stack" style={{ '--gap': '20px' }}>
        <div className="card form-grid cols-2">
          <div className="panel-title span-2">Public profile</div>
          <Input label="Farm / shop name" value={f.displayName} onChange={up('displayName')} />
          <Input label="UPI ID for payouts" placeholder="name@bank" value={f.upiId} onChange={up('upiId')} />
          <Textarea className="span-2" label="About you" value={f.bio} onChange={up('bio')} hint="What you grow, how, since when. Buyers love a story." />
          <Input label="Village / town" value={f.village} onChange={up('village')} />
          <Input label="District" value={f.district} onChange={up('district')} />
          <Input label="State" value={f.state} onChange={up('state')} />
          <Input label="Pincode" inputMode="numeric" maxLength={6} value={f.pincode} onChange={up('pincode')} />
        </div>

        <div className="card stack">
          <div className="panel-title">
            <span>Delivery areas</span>
            <span className="badge">{areas.length} pincodes</span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            List only pincodes you can reliably reach. Buyers elsewhere won't see your products — better than a missed delivery.
          </p>
          <div className="row">
            <input className="input grow" placeholder="Add pincodes: 411001, 411004 …" value={bulk} onChange={(e) => setBulk(e.target.value)} aria-label="Pincodes to add" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBulk())} />
            <Button type="button" onClick={addBulk}>
              Add
            </Button>
          </div>
          {areas.length > 0 && (
            <div className="table-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Pincode</th>
                    <th>Fee (₹)</th>
                    <th>Days</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((a, i) => (
                    <tr key={a.pincode}>
                      <td className="mono">{a.pincode}</td>
                      <td>
                        <input className="input" style={{ maxWidth: 100, minHeight: 36 }} inputMode="decimal" aria-label={`Fee for ${a.pincode}`} value={a.deliveryFee} onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, deliveryFee: e.target.value } : x)))} />
                      </td>
                      <td>
                        <input className="input" style={{ maxWidth: 70, minHeight: 36 }} inputMode="numeric" aria-label={`Days for ${a.pincode}`} value={a.etaDays} onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, etaDays: e.target.value } : x)))} />
                      </td>
                      <td>
                        <button type="button" className="link-btn small" onClick={() => setAreas(areas.filter((_, j) => j !== i))}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="form-grid cols-2">
            <Input label="Free delivery above (₹)" inputMode="decimal" value={f.freeDeliveryAbove} onChange={up('freeDeliveryAbove')} hint="Leave empty for never" />
            <Input label="Minimum order value (₹)" inputMode="decimal" value={f.minOrderValue} onChange={up('minOrderValue')} hint="Orders below this aren't worth a trip" />
          </div>
        </div>

        <div className="card form-grid">
          <div className="panel-title">Pickup</div>
          <label className="check">
            <input type="checkbox" checked={f.pickupAvailable} onChange={up('pickupAvailable')} />
            <span>Buyers can collect orders from me (free for them)</span>
          </label>
          {f.pickupAvailable && <Input label="Pickup address" value={f.pickupAddress} onChange={up('pickupAddress')} />}
        </div>

        <ErrorBox error={error} />
        <Button variant="primary" size="lg" loading={busy} type="submit">
          Save settings
        </Button>
      </form>
    </div>
  );
}
