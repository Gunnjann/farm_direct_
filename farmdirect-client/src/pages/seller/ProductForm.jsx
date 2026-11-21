import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../context/AppContext';
import { api } from '../../lib/api';
import { CATEGORIES } from '../../lib/format';
import { Button, ErrorBox, Input, Loading, Select, Textarea } from '../../components/ui';

const toR = (p) => (p == null ? '' : String(p / 100));
const empty = {
  name: '',
  variety: '',
  nameHi: '',
  description: '',
  category: 'vegetables',
  unit: 'kg',
  pricePerUnit: '',
  minOrderQty: '1',
  stock: '',
  grade: 'ungraded',
  gradeNote: '',
  harvestDate: '',
  organicClaim: false,
  audience: 'all',
  images: [],
  bulkTiers: [],
  groupBuy: { enabled: false, pricePerUnit: '', minMemberQty: '1', targetQty: '', maxQty: '' },
};

export default function ProductForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState(empty);
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    api('/products/mine')
      .then((d) => {
        const p = d.items.find((x) => x._id === id);
        if (!p) throw new Error('Product not found');
        setF({
          ...empty,
          ...p,
          variety: p.variety || '',
          nameHi: p.nameHi || '',
          description: p.description || '',
          gradeNote: p.gradeNote || '',
          pricePerUnit: toR(p.pricePerUnit),
          minOrderQty: String(p.minOrderQty),
          stock: String(p.stock),
          harvestDate: p.harvestDate ? p.harvestDate.slice(0, 10) : '',
          bulkTiers: (p.bulkTiers || []).map((t) => ({ minQty: String(t.minQty), pricePerUnit: toR(t.pricePerUnit) })),
          groupBuy: {
            enabled: !!p.groupBuy?.enabled,
            pricePerUnit: toR(p.groupBuy?.pricePerUnit),
            minMemberQty: String(p.groupBuy?.minMemberQty || 1),
            targetQty: p.groupBuy?.targetQty ? String(p.groupBuy.targetQty) : '',
            maxQty: p.groupBuy?.maxQty ? String(p.groupBuy.maxQty) : '',
          },
        });
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  const up = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const upG = (k) => (e) => setF({ ...f, groupBuy: { ...f.groupBuy, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } });

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      [...files].slice(0, 6 - f.images.length).forEach((file) => fd.append('images', file));
      const d = await api('/uploads', { method: 'POST', form: fd });
      setF((x) => ({ ...x, images: [...x.images, ...d.urls].slice(0, 6) }));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: f.name,
      variety: f.variety || undefined,
      nameHi: f.nameHi || undefined,
      description: f.description || undefined,
      category: f.category,
      unit: f.unit,
      pricePerUnit: Number(f.pricePerUnit),
      minOrderQty: Number(f.minOrderQty || 1),
      stock: Number(f.stock),
      grade: f.grade,
      gradeNote: f.gradeNote || undefined,
      harvestDate: f.harvestDate || undefined,
      organicClaim: !!f.organicClaim,
      audience: f.audience,
      images: f.images,
      bulkTiers: f.bulkTiers.filter((t) => t.minQty && t.pricePerUnit).map((t) => ({ minQty: Number(t.minQty), pricePerUnit: Number(t.pricePerUnit) })),
      groupBuy: f.groupBuy.enabled
        ? { enabled: true, pricePerUnit: Number(f.groupBuy.pricePerUnit), minMemberQty: Number(f.groupBuy.minMemberQty || 1), targetQty: Number(f.groupBuy.targetQty), maxQty: Number(f.groupBuy.maxQty) }
        : { enabled: false },
    };
    try {
      await api(id ? `/products/${id}` : '/products', { method: id ? 'PATCH' : 'POST', body });
      toast(id ? 'Product updated' : 'Product listed', 'ok');
      nav('/seller/products');
    } catch (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <Link to="/seller/products" className="small">← Products</Link>
      <h1 style={{ marginTop: 12 }}>{id ? 'Edit product' : 'List a product'}</h1>
      <form onSubmit={submit} className="stack" style={{ '--gap': '20px' }}>
        <ErrorBox error={error} />
        <div className="card form-grid cols-2">
          <div className="panel-title span-2">What are you selling?</div>
          <Input label="Product name" placeholder="Tomato" required value={f.name} onChange={up('name')} />
          <Input label="Variety (optional)" placeholder="Desi / Hybrid / Sharbati" value={f.variety} onChange={up('variety')} />
          <Input className="span-2" label="Name in Hindi (optional)" placeholder="टमाटर" value={f.nameHi} onChange={up('nameHi')} hint="Shown to buyers who use FarmDirect in Hindi. Common produce is translated automatically if you leave this empty." />
          <Select label="Category" value={f.category} onChange={up('category')} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          <Select
            label="Sold per"
            value={f.unit}
            onChange={up('unit')}
            options={['kg', 'quintal', 'dozen', 'piece', 'bundle'].map((u) => ({ value: u, label: u }))}
          />
          <Textarea className="span-2" label="Description" value={f.description} onChange={up('description')} hint="Taste, size, how it's grown, best use." />
          <div className="field span-2">
            <label htmlFor="imgs">Photos (up to 6)</label>
            <input id="imgs" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => upload(e.target.files)} disabled={uploading || f.images.length >= 6} />
            <span className="hint">Real photos of your produce build trust. JPG/PNG/WEBP, max 3 MB each.</span>
            <div className="row">
              {f.images.map((u) => (
                <div key={u} style={{ position: 'relative' }}>
                  <img src={u} alt="" style={{ width: 84, height: 84, objectFit: 'cover', border: 'var(--b)' }} />
                  <button type="button" className="dot" style={{ cursor: 'pointer' }} aria-label="Remove photo" onClick={() => setF({ ...f, images: f.images.filter((x) => x !== u) })}>
                    ×
                  </button>
                </div>
              ))}
              {uploading && <span className="spinner" />}
            </div>
          </div>
        </div>

        <div className="card form-grid cols-2">
          <div className="panel-title span-2">Price & stock</div>
          <Input label={`Price per ${f.unit} (₹)`} inputMode="decimal" required value={f.pricePerUnit} onChange={up('pricePerUnit')} />
          <Input label={`Stock available (${f.unit})`} inputMode="numeric" required value={f.stock} onChange={up('stock')} />
          <Input label={`Minimum order (${f.unit})`} inputMode="numeric" value={f.minOrderQty} onChange={up('minOrderQty')} />
          <Select
            label="Who can buy"
            value={f.audience}
            onChange={up('audience')}
            options={[
              { value: 'all', label: 'Everyone' },
              { value: 'business', label: 'Business buyers only' },
            ]}
          />
          <div className="span-2 stack" style={{ '--gap': '8px' }}>
            <strong className="small">Bulk prices (optional)</strong>
            {f.bulkTiers.map((t, i) => (
              <div key={i} className="row">
                <input className="input" style={{ maxWidth: 140 }} inputMode="numeric" placeholder={`From qty`} value={t.minQty} aria-label="Minimum quantity" onChange={(e) => setF({ ...f, bulkTiers: f.bulkTiers.map((x, j) => (j === i ? { ...x, minQty: e.target.value } : x)) })} />
                <input className="input" style={{ maxWidth: 160 }} inputMode="decimal" placeholder={`₹ per ${f.unit}`} value={t.pricePerUnit} aria-label="Price" onChange={(e) => setF({ ...f, bulkTiers: f.bulkTiers.map((x, j) => (j === i ? { ...x, pricePerUnit: e.target.value } : x)) })} />
                <button type="button" className="link-btn small" onClick={() => setF({ ...f, bulkTiers: f.bulkTiers.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              </div>
            ))}
            {f.bulkTiers.length < 5 && (
              <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setF({ ...f, bulkTiers: [...f.bulkTiers, { minQty: '', pricePerUnit: '' }] })}>
                + Add bulk price
              </button>
            )}
          </div>
        </div>

        <div className="card form-grid cols-2">
          <div className="panel-title span-2">Quality</div>
          <Select
            label="Grade"
            value={f.grade}
            onChange={up('grade')}
            options={[
              { value: 'A', label: 'A — premium, uniform' },
              { value: 'B', label: 'B — good, some variation' },
              { value: 'C', label: 'C — fair / processing' },
              { value: 'ungraded', label: 'Not graded' },
            ]}
          />
          <Input label="Harvest date" type="date" value={f.harvestDate} max={new Date().toLocaleDateString('en-CA')} onChange={up('harvestDate')} />
          <Input className="span-2" label="Grade details (optional)" placeholder="e.g. 60–80 g per tomato, no cracks" value={f.gradeNote} onChange={up('gradeNote')} />
          <label className="check span-2">
            <input type="checkbox" checked={!!f.organicClaim} onChange={up('organicClaim')} />
            <span>
              Grown organically <span className="muted small">(shown to buyers as “declared by seller” unless you share a certificate with our team)</span>
            </span>
          </label>
        </div>

        <div className="card form-grid cols-2">
          <div className="panel-title span-2">Group deal</div>
          <label className="check span-2">
            <input type="checkbox" checked={f.groupBuy.enabled} onChange={upG('enabled')} />
            <span>Allow buyers to pool orders for a lower price, delivered to one drop point</span>
          </label>
          {f.groupBuy.enabled && (
            <>
              <Input label={`Group price per ${f.unit} (₹)`} inputMode="decimal" value={f.groupBuy.pricePerUnit} onChange={upG('pricePerUnit')} hint="Must be lower than the regular price; include delivery to the drop point." />
              <Input label={`Minimum per member (${f.unit})`} inputMode="numeric" value={f.groupBuy.minMemberQty} onChange={upG('minMemberQty')} />
              <Input label={`Target to confirm (${f.unit})`} inputMode="numeric" value={f.groupBuy.targetQty} onChange={upG('targetQty')} />
              <Input label={`Maximum per group (${f.unit})`} inputMode="numeric" value={f.groupBuy.maxQty} onChange={upG('maxQty')} hint="Reserved from stock when a group starts." />
            </>
          )}
        </div>

        <Button variant="primary" size="lg" loading={busy} type="submit">
          {id ? 'Save changes' : 'Publish listing'}
        </Button>
      </form>
    </div>
  );
}
