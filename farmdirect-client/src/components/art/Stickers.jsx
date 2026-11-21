/** Small animated stickers used across the app (loading, empty states, success). */
const INK = '#141414';
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };

/** A seed that sprouts — the loading indicator. */
export function SproutLoader({ size = 56 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="sprout" aria-hidden="true">
      <g className="sprout-grow">
        <path d="M32 50V26" fill="none" stroke="#2F7A3C" strokeWidth="4" strokeLinecap="round" />
        <path className="leaf-l" d="M32 34c-10 0-16-6-16-14 10 0 16 6 16 14z" fill="#4FA35A" {...S} strokeWidth="2.5" />
        <path className="leaf-r" d="M32 28c10 0 16-6 16-14-10 0-16 6-16 14z" fill="#7DBE5C" {...S} strokeWidth="2.5" />
      </g>
      <path d="M8 52c8-8 40-8 48 0z" fill="#7A4B2A" {...S} />
    </svg>
  );
}

/** Empty basket with a curious bird — empty cart / no results. */
export function EmptyBasket({ size = 140 }) {
  return (
    <svg viewBox="0 0 140 110" width={size} height={size * 0.8} className="sticker-basket" aria-hidden="true">
      <ellipse cx="70" cy="102" rx="46" ry="5" fill={INK} opacity=".12" />
      <path d="M38 48c0-26 64-26 64 0" fill="none" {...S} strokeWidth="5" />
      <path d="M22 48h96l-10 50H32z" fill="#C48A4A" {...S} />
      <path d="M28 64h84M30 80h80M50 48l4 50M70 48v50M90 48l-4 50" fill="none" {...S} strokeWidth="2" opacity=".45" />
      <g className="bird-peek">
        <path d="M86 46c6-12 24-12 30-2-6 8-22 10-30 2z" fill="#F5EFD9" {...S} strokeWidth="2.5" />
        <circle cx="114" cy="36" r="8" fill="#F5EFD9" {...S} strokeWidth="2.5" />
        <circle cx="116" cy="35" r="1.8" fill={INK} />
        <path d="M121 36l9 3-9 2z" fill="#F2B632" {...S} strokeWidth="2" />
        <path d="M100 44c-4-8-12-10-16-8 2 6 8 8 16 8z" fill="#F5EFD9" {...S} strokeWidth="2.5" />
      </g>
    </svg>
  );
}

/** Basket full of veggies with a check — success / delivered. */
export function HappyBasket({ size = 120 }) {
  return (
    <svg viewBox="0 0 140 120" width={size} height={size * 0.86} className="sticker-pop" aria-hidden="true">
      <circle cx="46" cy="44" r="14" fill="#E0452B" {...S} />
      <circle cx="70" cy="36" r="16" fill="#7DBE5C" {...S} />
      <circle cx="94" cy="46" r="13" fill="#F2A33A" {...S} />
      <path d="M58 22c2-8 8-12 14-12" fill="none" {...S} />
      <path d="M22 54h96l-10 50H32z" fill="#C48A4A" {...S} />
      <path d="M28 70h84M30 86h80" fill="none" {...S} strokeWidth="2" opacity=".45" />
      <circle cx="112" cy="94" r="16" fill="#1E5E3A" {...S} />
      <path d="M104 94l6 6 10-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
