/**
 * Original hand-drawn produce illustrations (ink outline + flat earth colours),
 * used whenever a seller hasn't uploaded a real photo. Matched by product name,
 * with a per-category fallback.
 */
const INK = '#141414';
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };
const shine = (cx, cy, rx = 7, ry = 4, rot = -30) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" opacity=".55" transform={`rotate(${rot} ${cx} ${cy})`} />;

const ART = {
  tomato: (
    <>
      <ellipse cx="60" cy="68" rx="38" ry="33" fill="#E0452B" {...S} />
      <path d="M44 50c-6 6-9 14-8 22M76 50c6 6 9 14 8 22" fill="none" {...S} strokeWidth="2" opacity=".35" />
      {shine(44, 58, 8, 5)}
      <path d="M60 38l6 8 10-3-6 9 9 5-11 1-2 9-6-8-6 8-2-9-11-1 9-5-6-9 10 3z" fill="#3E8E4A" {...S} />
      <path d="M60 38c0-8 3-13 8-15" fill="none" {...S} />
    </>
  ),
  onion: (
    <>
      <path d="M60 22c4 10 10 14 22 24 12 10 14 28 4 40-7 9-17 12-26 12s-19-3-26-12c-10-12-8-30 4-40 12-10 18-14 22-24z" fill="#B0466A" {...S} />
      <path d="M60 26c-6 18-16 30-14 52M60 26c6 18 16 30 14 52" fill="none" {...S} strokeWidth="2" opacity=".45" />
      <path d="M52 98l-4 10M60 98v12M68 98l4 10" fill="none" {...S} strokeWidth="2.5" />
      <path d="M60 22c-2-6 0-12 6-16" fill="none" {...S} />
      {shine(42, 62, 6, 9, 15)}
    </>
  ),
  potato: (
    <>
      <path d="M22 66c-2-18 16-30 36-31 22-1 42 8 42 26 0 20-18 32-42 32-20 0-34-10-36-27z" fill="#C9A066" {...S} />
      {[[42, 56], [70, 52], [82, 70], [52, 78], [64, 66]].map(([x, y], i) => (
        <path key={i} d={`M${x - 3} ${y}q3-3 6 0`} fill="none" {...S} strokeWidth="2.5" />
      ))}
      {shine(36, 52, 8, 4, -20)}
    </>
  ),
  spinach: (
    <>
      {[
        ['M60 100C40 80 26 56 34 28c14 6 26 30 26 72z', '#3E8E4A'],
        ['M60 100c20-20 34-44 26-72-14 6-26 30-26 72z', '#4FA35A'],
        ['M60 100c-4-30-2-58 0-80 6 22 6 50 0 80z', '#2F7A3C'],
      ].map(([d, f], i) => (
        <path key={i} d={d} fill={f} {...S} />
      ))}
      <path d="M40 40l14 30M80 40L66 70" fill="none" {...S} strokeWidth="2" opacity=".5" />
      <rect x="48" y="86" width="24" height="10" fill="#F2B632" {...S} />
    </>
  ),
  'green chilli': (
    <>
      <path d="M30 40c8 4 12 12 18 30 8 22 24 34 46 38-26 6-50-6-60-34-5-14-6-26-4-34z" fill="#4CA64C" {...S} />
      <path d="M26 36c4-6 10-6 14 0l-4 6c-2-2-4-2-6 0z" fill="#2F7A3C" {...S} />
      <path d="M32 32c-2-8 2-14 8-18" fill="none" {...S} />
      {shine(40, 60, 4, 9, -20)}
    </>
  ),
  pomegranate: (
    <>
      <circle cx="60" cy="66" r="36" fill="#C62D3A" {...S} />
      <path d="M48 32l4-12 8 8 8-8 4 12z" fill="#9E1F2C" {...S} />
      {shine(44, 54, 9, 5)}
      <path d="M40 80c8 8 26 10 38 0" fill="none" {...S} strokeWidth="2" opacity=".4" />
    </>
  ),
  banana: (
    <>
      {[0, 12, 24].map((o, i) => (
        <path key={i} d={`M30 ${40 + o}c10 30 40 42 66 28-4-4-8-4-12-2-18 8-38-2-48-28z`} fill={i === 1 ? '#F7D35A' : '#F2C94C'} {...S} />
      ))}
      <path d="M26 36l8 2-2 8-6-2z" fill="#6B4A2B" {...S} />
    </>
  ),
  guava: (
    <>
      <path d="M60 30c22 0 38 16 38 38S82 104 60 104 22 90 22 68s16-38 38-38z" fill="#9CCB5B" {...S} />
      <path d="M60 30c0-6 4-10 10-12" fill="none" {...S} />
      <path d="M68 22c10-6 22-4 26 4-10 6-20 4-26-4z" fill="#3E8E4A" {...S} />
      {[[50, 60], [70, 74], [58, 86], [76, 56]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" fill={INK} />
      ))}
      {shine(42, 54, 8, 5)}
    </>
  ),
  cauliflower: (
    <>
      <path d="M18 70c10 20 26 32 42 32s32-12 42-32c-14 6-28 6-42 6s-28 0-42-6z" fill="#3E8E4A" {...S} />
      {[[40, 56], [60, 48], [80, 56], [50, 68], [70, 68], [60, 60]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="14" fill="#F5EFD9" {...S} />
      ))}
      <path d="M18 70c4 14 14 24 24 28M102 70c-4 14-14 24-24 28" fill="none" {...S} strokeWidth="2" />
    </>
  ),
  brinjal: (
    <>
      <path d="M46 44c-16 14-24 34-18 50 6 14 26 16 40 6 14-10 24-28 20-46-2-10-10-16-20-16-8 0-16 2-22 6z" fill="#5B2A6E" {...S} />
      <path d="M50 44c4-10 14-14 24-12 10 2 16 10 14 20-8-6-16-8-24-4-6-6-10-6-14-4z" fill="#3E8E4A" {...S} />
      <path d="M76 32c2-8 8-14 16-14" fill="none" {...S} />
      {shine(44, 74, 5, 12, 20)}
    </>
  ),
  wheat: (
    <>
      {[-14, 0, 14].map((dx, k) => (
        <g key={k} transform={`rotate(${dx} 60 108)`}>
          <path d="M60 108V40" fill="none" {...S} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <ellipse cx="53" cy={46 + i * 11} rx="6" ry="9" fill="#E3B04B" {...S} strokeWidth="2.5" transform={`rotate(-30 53 ${46 + i * 11})`} />
              <ellipse cx="67" cy={46 + i * 11} rx="6" ry="9" fill="#D9A441" {...S} strokeWidth="2.5" transform={`rotate(30 67 ${46 + i * 11})`} />
            </g>
          ))}
          <path d="M60 36V18" fill="none" {...S} strokeWidth="2" />
        </g>
      ))}
    </>
  ),
  rice: (
    <>
      <path d="M44 34h32l10 12c6 8 8 22 6 36-2 14-12 22-32 22s-30-8-32-22c-2-14 0-28 6-36z" fill="#D8B27A" {...S} />
      <path d="M40 40h40" fill="none" {...S} />
      <rect x="40" y="58" width="40" height="22" fill="#FFFDF7" {...S} strokeWidth="2.5" />
      <text x="60" y="74" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="11" fill={INK}>RICE</text>
      {[[22, 104], [30, 108], [96, 104], [88, 108], [104, 100]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="4" ry="2" fill="#FFFDF7" {...S} strokeWidth="1.5" />
      ))}
    </>
  ),
  'toor dal': (
    <>
      <path d="M18 62h84c0 24-18 40-42 40S18 86 18 62z" fill="#C48A4A" {...S} />
      <path d="M24 62c6-10 20-14 36-14s30 4 36 14z" fill="#F2C14E" {...S} />
      {[[40, 56], [52, 52], [64, 54], [76, 56], [58, 58], [46, 60], [70, 60], [84, 60], [34, 60]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.2" fill="#E8A33A" {...S} strokeWidth="1.5" />
      ))}
      <path d="M30 76c10 6 50 6 60 0" fill="none" {...S} strokeWidth="2" opacity=".35" />
    </>
  ),
  jowar: (
    <>
      <path d="M60 108V60" fill="none" {...S} />
      <path d="M60 64c-14-4-22-18-20-34 14 2 22 16 20 34zM60 64c14-4 22-18 20-34-14 2-22 16-20 34z" fill="#3E8E4A" {...S} strokeWidth="2.5" />
      <ellipse cx="60" cy="34" rx="14" ry="22" fill="#EEDDB0" {...S} />
      {[24, 32, 40, 48].map((y) => (
        <path key={y} d={`M48 ${y}h24`} fill="none" {...S} strokeWidth="1.5" opacity=".5" />
      ))}
    </>
  ),
  turmeric: (
    <>
      <path d="M24 66c6-10 22-12 34-6 6-8 18-12 28-6 10 6 12 18 4 26-8 8-22 6-30 2-10 6-26 8-34 0-6-6-6-12-2-16z" fill="#D98A2B" {...S} />
      <path d="M44 62c-2-10 0-20 6-26 6 4 6 14 2 24" fill="#E8A33A" {...S} />
      {[[40, 70], [64, 66], [80, 72]].map(([x, y], i) => (
        <path key={i} d={`M${x - 4} ${y}h8`} fill="none" {...S} strokeWidth="2" />
      ))}
      <path d="M70 100c4-10 26-10 30 0z" fill="#F2B632" {...S} />
    </>
  ),
  cabbage: (
    <>
      <circle cx="60" cy="66" r="38" fill="#9CCB5B" {...S} />
      <path d="M60 30c-10 14-12 34-4 72M60 30c10 14 12 34 4 72M26 56c14 4 26 14 30 30M94 56c-14 4-26 14-30 30" fill="none" {...S} strokeWidth="2" opacity=".5" />
      <path d="M30 48c8-14 22-20 30-18 8-2 22 4 30 18-10-4-20-4-30 4-10-8-20-8-30-4z" fill="#7DBE5C" {...S} strokeWidth="2.5" />
    </>
  ),
  garlic: (
    <>
      <path d="M60 26c4 10 12 14 24 24 14 12 14 34 0 46-8 6-16 8-24 8s-16-2-24-8c-14-12-14-34 0-46 12-10 20-14 24-24z" fill="#F5EFD9" {...S} />
      <path d="M60 30c-8 16-14 34-10 70M60 30c8 16 14 34 10 70M60 30v72" fill="none" {...S} strokeWidth="2" opacity=".45" />
      <path d="M60 26c-2-8 2-14 6-18" fill="none" {...S} />
      <path d="M50 104l-4 6M60 104v8M70 104l4 6" fill="none" {...S} strokeWidth="2" />
    </>
  ),
  soybean: (
    <>
      <path d="M30 86c-6-20 6-44 26-52 20-8 40 2 38 22-2 24-30 46-50 44-8 0-12-6-14-14z" fill="#8DB255" {...S} />
      {[[48, 72], [62, 60], [76, 50]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="8" ry="7" fill="#E9D68A" {...S} strokeWidth="2.5" />
      ))}
      <path d="M94 50c6-4 10-10 10-16" fill="none" {...S} />
    </>
  ),
  'gram (chana)': (
    <>
      <path d="M18 62h84c0 24-18 40-42 40S18 86 18 62z" fill="#C48A4A" {...S} />
      <path d="M24 62c6-10 20-14 36-14s30 4 36 14z" fill="#E3B66E" {...S} />
      {[[38, 56], [52, 52], [66, 54], [80, 56], [46, 60], [60, 59], [74, 60]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="#D9A050" {...S} strokeWidth="2" />
      ))}
    </>
  ),
  maize: (
    <>
      <path d="M60 18c14 0 22 22 22 46s-8 44-22 44-22-20-22-44 8-46 22-46z" fill="#F2C94C" {...S} />
      {[30, 42, 54, 66, 78, 90].map((y) => (
        <path key={y} d={`M42 ${y}h36`} fill="none" {...S} strokeWidth="1.5" opacity=".45" />
      ))}
      <path d="M38 70c-10 10-14 26-10 40 10-8 18-22 22-36M82 70c10 10 14 26 10 40-10-8-18-22-22-36" fill="#4FA35A" {...S} strokeWidth="2.5" />
    </>
  ),
  orange: (
    <>
      <circle cx="60" cy="66" r="38" fill="#F28C28" {...S} />
      {[[46, 56], [70, 50], [76, 76], [52, 84], [62, 66]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill={INK} opacity=".5" />
      ))}
      <path d="M60 28c0-6 4-10 8-12" fill="none" {...S} />
      <path d="M66 22c8-6 20-4 24 4-8 6-18 4-24-4z" fill="#3E8E4A" {...S} />
      {shine(44, 54, 9, 5)}
    </>
  ),
};

const FALLBACK = {
  vegetables: (
    <>
      <path d="M50 40l26 6-16 62c-2 6-8 6-10 0z" fill="#E8792B" {...S} transform="rotate(-20 60 70)" />
      <path d="M58 36c-6-10-4-20 2-26 2 10 4 16 0 26M62 38c6-8 14-12 22-10-4 8-12 12-22 10" fill="#3E8E4A" {...S} />
    </>
  ),
  fruits: (
    <>
      <path d="M60 36c16-8 36 2 38 24 2 24-16 44-38 44S20 84 22 60c2-22 22-32 38-24z" fill="#F2A33A" {...S} />
      <path d="M60 36c0-8 4-14 10-16" fill="none" {...S} />
      <path d="M70 24c8-6 20-4 22 4-8 4-16 2-22-4z" fill="#3E8E4A" {...S} />
      {shine(42, 56, 8, 5)}
    </>
  ),
  grains: <>{ART.rice}</>,
  pulses: <>{ART['toor dal']}</>,
  spices: (
    <>
      <path d="M30 40c8 4 12 12 18 30 8 22 24 34 46 38-26 6-50-6-60-34-5-14-6-26-4-34z" fill="#D2382A" {...S} />
      <path d="M26 36c4-6 10-6 14 0l-4 6c-2-2-4-2-6 0z" fill="#2F7A3C" {...S} />
    </>
  ),
  others: (
    <>
      <path d="M20 54h80l-8 46H28z" fill="#C48A4A" {...S} />
      <path d="M36 54c0-18 48-18 48 0" fill="none" {...S} />
      <path d="M24 70h72M26 84h68" fill="none" {...S} strokeWidth="2" opacity=".5" />
    </>
  ),
};

export function artKey(name = '') {
  const n = name.toLowerCase();
  if (n.startsWith('gram') || n.includes('chana')) return 'gram (chana)';
  return Object.keys(ART).find((k) => n.includes(k)) || null;
}

export default function ProduceArt({ name, category, size = '100%', className = '' }) {
  const key = artKey(name);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={`produce-art ${className}`} role="img" aria-label={name} style={{ overflow: 'visible' }}>
      <ellipse cx="60" cy="110" rx="36" ry="5" fill={INK} opacity=".12" />
      {key ? ART[key] : FALLBACK[category] || FALLBACK.others}
    </svg>
  );
}
