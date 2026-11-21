import { Link } from 'react-router-dom';
import { rupees, freshness } from '../lib/format';
import { useT } from '../lib/i18n';
import ProduceArt from './art/Produce';
import { Icon } from './ui';

const longestWord = (s) => Math.max(...String(s).split(/\s+/).map((w) => w.length));

export function ProductTile({ product, big }) {
  const { t, pn } = useT();
  const img = product.images?.[0];
  const label = pn(product);
  return (
    <div className={`ptile ${product.category} ${big ? 'big' : ''} ${img ? '' : 'has-art'}`} style={big ? { aspectRatio: '4 / 3' } : undefined}>
      {img ? <img src={img} alt={label} loading="lazy" /> : <div className="stripes" />}
      <div className="tags">
        {product.grade && product.grade !== 'ungraded' && (
          <span className="badge">
            {t('Grade')} {product.grade}
          </span>
        )}
        {product.groupBuy?.enabled && <span className="badge turmeric">{t('Group deal')}</span>}
        {product.organicClaim && (
          <span className="badge soft" title="Declared by the seller. Not certified by FarmDirect.">
            Organic*
          </span>
        )}
      </div>
      {!img && (
        <>
          <div className="art">
            <ProduceArt name={product.name} category={product.category} />
          </div>
          <div className="glyph" style={{ '--len': Math.max(4, longestWord(label)) }}>
            {label}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductCard({ product }) {
  const { t, pn, u, ln, lang } = useT();
  const s = product.supplier || {};
  const sp = s.supplierProfile || {};
  const fresh = freshness(product.harvestDate, lang);
  return (
    <Link to={`/product/${product._id}`} className="pcard">
      <ProductTile product={product} />
      <div className="pbody">
        <div className="pname">
          {pn(product)}
          {product.variety && <span className="muted" style={{ fontWeight: 500 }}> · {ln(product.variety)}</span>}
        </div>
        <div className="row" style={{ '--gap': '6px' }}>
          <span className="price">
            {rupees(product.pricePerUnit)}
            <small>/{u(product.unit)}</small>
          </span>
          {product.bulkTiers?.length > 0 && (
            <span className="tiny muted">
              {lang === 'hi'
                ? `थोक में ${rupees(product.bulkTiers[product.bulkTiers.length - 1].pricePerUnit)} से`
                : `from ${rupees(product.bulkTiers[product.bulkTiers.length - 1].pricePerUnit)} in bulk`}
            </span>
          )}
        </div>
        <div className="small" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span>{sp.displayName || s.name}</span>
          {sp.verified && (
            <span title={t('Verified')} style={{ color: 'var(--leaf)', display: 'inline-flex' }}>
              <Icon name="shield" size={14} />
            </span>
          )}
          <span className="muted">· {product.supplierRole === 'trader' ? t('Trader') : t('Farmer')}</span>
        </div>
        <div className="pmeta">
          <span>{fresh || (sp.district ? sp.district : '')}</span>
          {product.delivery ? (
            <span className="mono">{product.delivery.fee === 0 ? t('Free delivery') : `+${rupees(product.delivery.fee)} ${t('delivery')}`}</span>
          ) : (
            <span className="mono">
              {t('Min')} {product.minOrderQty} {u(product.unit)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
