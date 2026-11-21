import { useSearchParams } from 'react-router-dom';
import { useFetch, useLocationPin } from '../context/AppContext';
import { qs } from '../lib/api';
import { CATEGORIES } from '../lib/format';
import { useT } from '../lib/i18n';
import ProductCard from '../components/ProductCard';
import { Empty, ErrorBox, SkeletonGrid } from '../components/ui';

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const { pincode } = useLocationPin();
  const { lang, t } = useT();
  const category = sp.get('category') || '';
  const q = sp.get('q') || '';
  const sort = sp.get('sort') || 'relevance';
  const supplierType = sp.get('supplierType') || '';
  const groupBuy = sp.get('groupBuy') || '';
  const page = Number(sp.get('page') || 1);

  const set = (k, v) => {
    const next = new URLSearchParams(sp);
    v ? next.set(k, v) : next.delete(k);
    if (k !== 'page') next.delete('page');
    setSp(next, { replace: true });
  };

  const { data, error, loading, reload } = useFetch(`/products${qs({ pincode, category, q, sort, supplierType, groupBuy, page })}`);

  return (
    <div className="container page stack" style={{ '--gap': '18px' }}>
      <div>
        <span className="eyebrow">{pincode ? `${t('Sellers delivering to')} ${pincode}` : lang === 'hi' ? 'सभी विक्रेता · डिलीवरी शुल्क के लिए पिनकोड डालें' : 'All sellers · set your pincode for delivery prices'}</span>
        <h1 style={{ marginTop: 6 }}>{q ? `Results for “${q}”` : category ? CATEGORIES.find((c) => c.id === category)?.[lang === 'hi' ? 'hi' : 'label'] : t('Shop fresh produce')}</h1>
      </div>

      <form
        className="mob-only"
        onSubmit={(e) => {
          e.preventDefault();
          set('q', new FormData(e.currentTarget).get('q'));
        }}
      >
        <input name="q" className="input" defaultValue={q} placeholder={t('Search vegetables, grains…')} aria-label="Search" />
      </form>

      <div className="chips" role="group" aria-label="Category">
        <button className="chip" aria-pressed={!category} onClick={() => set('category', '')}>
          {t('All')}
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className="chip" aria-pressed={category === c.id} onClick={() => set('category', c.id)}>
            {lang === 'hi' ? c.hi : c.label}
          </button>
        ))}
      </div>

      <div className="row between">
        <div className="row" style={{ '--gap': '8px' }}>
          <div className="segmented" role="group" aria-label="Seller type">
            <button aria-pressed={!supplierType} onClick={() => set('supplierType', '')}>
              {t('All')}
            </button>
            <button aria-pressed={supplierType === 'farmer'} onClick={() => set('supplierType', 'farmer')}>
              {t('Farmers')}
            </button>
            <button aria-pressed={supplierType === 'trader'} onClick={() => set('supplierType', 'trader')}>
              {t('Traders')}
            </button>
          </div>
          <button className="chip" aria-pressed={!!groupBuy} onClick={() => set('groupBuy', groupBuy ? '' : 'true')}>
            {t('Group deals')}
          </button>
        </div>
        <select className="input" style={{ width: 'auto', minHeight: 42 }} value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort by">
          <option value="relevance">{t('Popular')}</option>
          <option value="fresh">{t('Freshest harvest')}</option>
          <option value="price_asc">{t('Price: low to high')}</option>
          <option value="price_desc">{t('Price: high to low')}</option>
          <option value="rating">{t('Top rated')}</option>
          <option value="newest">{t('Newest')}</option>
        </select>
      </div>

      <ErrorBox error={error} onRetry={reload} />
      {loading ? (
        <SkeletonGrid />
      ) : data?.items?.length ? (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {lang === 'hi' ? `${data.total} ${t('products')}` : `${data.total} product${data.total === 1 ? '' : 's'}`}
          </p>
          <div className="grid pgrid">{data.items.map((p) => <ProductCard key={p._id} product={p} />)}</div>
          {data.pages > 1 && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn sm" disabled={page <= 1} onClick={() => set('page', String(page - 1))}>
                ← Prev
              </button>
              <span className="mono small">
                {page} / {data.pages}
              </span>
              <button className="btn sm" disabled={page >= data.pages} onClick={() => set('page', String(page + 1))}>
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        !error && (
          <Empty title={t('Nothing here yet')} sticker>
            {pincode ? `No matching products from sellers delivering to ${pincode}. Try removing filters or a nearby pincode.` : 'Try a different search or category.'}
          </Empty>
        )
      )}
    </div>
  );
}
