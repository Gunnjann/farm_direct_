import { useEffect, useState } from 'react';

/**
 * Animated hero illustration: a fruit tree that birds fly to and peck at,
 * swaying crops, drifting clouds, a turning sun and a FarmDirect truck
 * driving produce to town. Pure SVG (SMIL + CSS), no libraries, ~6 KB.
 * Respects "reduce motion": renders a still picture instead.
 */
const INK = '#141414';
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };

function useMotion() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return;
    setOk(!m.matches);
    const on = (e) => setOk(!e.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return ok;
}

function Bird({ color = '#F5EFD9', path, begin = '0s', dur = 10, motion, still }) {
  const body = (
    <g transform="scale(1.45)">
      <g>
        {motion && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;0 0;0 5;0 0;0 5;0 0;0 5;0 0;0 0"
            keyTimes="0;0.42;0.45;0.48;0.51;0.54;0.57;0.6;1"
            dur={`${dur}s`}
            begin={begin}
            repeatCount="indefinite"
          />
        )}
        <path d="M-2 0c6-10 22-10 28-2-6 8-20 10-28 2z" fill={color} {...S} strokeWidth="2.5" />
        <path d="M24-2l10-6-2 10z" fill={color} {...S} strokeWidth="2.5" />
        <circle cx="-4" cy="-6" r="7" fill={color} {...S} strokeWidth="2.5" />
        <circle cx="-6" cy="-7" r="1.6" fill={INK} />
        <path d="M-11-6l-8 3 8 2z" fill="#F2B632" {...S} strokeWidth="2" />
        <g>
          {motion && <animateTransform attributeName="transform" type="scale" values="1 1;1 -0.7;1 1" dur="0.35s" repeatCount="indefinite" />}
          <path d="M6-2c4-10 12-14 18-12-2 8-8 12-18 12z" fill={color} {...S} strokeWidth="2.5" />
        </g>
      </g>
    </g>
  );
  if (!motion) return <g transform={still}>{body}</g>;
  return (
    <g>
      <animateMotion path={path} dur={`${dur}s`} begin={begin} repeatCount="indefinite" keyPoints="0;0.5;0.5;1" keyTimes="0;0.42;0.6;1" calcMode="linear" />
      {body}
    </g>
  );
}

function EatenFruit({ cx, cy, dur, begin, motion }) {
  return (
    <circle cx={cx} cy={cy} r="9" fill="#E0452B" {...S} strokeWidth="2.5">
      {motion && <animate attributeName="r" values="9;9;7;4;0;0;9" keyTimes="0;0.44;0.49;0.54;0.6;0.94;1" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />}
    </circle>
  );
}

function Plant({ x, y, kind, delay = 0 }) {
  const style = { animationDelay: `${delay}s` };
  if (kind === 'cabbage')
    return (
      <g className="sway" style={style} transform={`translate(${x} ${y})`}>
        <circle cx="0" cy="-10" r="14" fill="#7DBE5C" {...S} strokeWidth="2.5" />
        <path d="M-8-12c4 6 12 6 16 0M-14-6c6 8 22 8 28 0" fill="none" {...S} strokeWidth="2" />
      </g>
    );
  if (kind === 'carrot')
    return (
      <g className="sway" style={style} transform={`translate(${x} ${y})`}>
        <path d="M-6-2l6 10 6-10z" fill="#E8792B" {...S} strokeWidth="2.5" />
        <path d="M0-2c-2-10-8-16-12-18M0-2c0-10 0-16 0-22M0-2c2-10 8-16 12-18" fill="none" stroke="#2F7A3C" strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  return (
    <g className="sway" style={style} transform={`translate(${x} ${y})`}>
      <path d="M0 0V-34" fill="none" stroke="#2F7A3C" strokeWidth="4" strokeLinecap="round" />
      <path d="M0-14c-10-2-14-8-14-14 8 0 12 6 14 14zM0-22c10-2 14-8 14-14-8 0-12 6-14 14z" fill="#4FA35A" {...S} strokeWidth="2" />
      <circle cx="-8" cy="-6" r="6" fill="#E0452B" {...S} strokeWidth="2" />
      <circle cx="8" cy="-12" r="6" fill="#E0452B" {...S} strokeWidth="2" />
    </g>
  );
}

export default function FarmScene() {
  const motion = useMotion();
  const BIRD_DUR = 11;
  const pathA = 'M680 70 C520 20 330 110 205 140 C160 90 40 40 -80 30';
  const pathB = 'M700 130 C540 70 300 60 108 104 C80 60 0 20 -90 50';

  return (
    <svg viewBox="0 0 600 440" className="farm-scene" role="img" aria-label="Illustration: birds flying to a fruit tree on a green farm while a FarmDirect truck drives produce to town">
      <rect width="600" height="440" fill="#FBE7B0" />

      {/* sun */}
      <g>
        <g>
          {motion && <animateTransform attributeName="transform" type="rotate" from="0 490 86" to="360 490 86" dur="40s" repeatCount="indefinite" />}
          {Array.from({ length: 12 }).map((_, i) => (
            <path key={i} d="M490 30v-14" stroke={INK} strokeWidth="3" strokeLinecap="round" transform={`rotate(${i * 30} 490 86)`} />
          ))}
        </g>
        <circle cx="490" cy="86" r="38" fill="#F2B632" {...S} />
      </g>

      {/* clouds */}
      {[
        [70, 60, 46],
        [300, 40, 60],
      ].map(([x, y, d], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g>
            {motion && <animateTransform attributeName="transform" type="translate" from={`${-x - 100} 0`} to={`${700 - x} 0`} dur={`${d}s`} begin={`-${(d * (x + 100)) / 800}s`} repeatCount="indefinite" />}
            <path d="M0 20c0-12 14-18 24-12 4-12 26-14 32 0 10-4 22 2 20 12z" fill="#FFFDF7" {...S} />
          </g>
        </g>
      ))}

      {/* hills & fields */}
      <path d="M-10 236C110 168 220 206 320 226S520 190 610 200V440H-10z" fill="#9CCB5B" {...S} />
      <path d="M-10 290C150 246 300 262 390 284S540 268 610 264V440H-10z" fill="#4FA35A" {...S} />
      {[310, 330, 350, 370].map((y, i) => (
        <path key={y} d={`M${-10 + i * 6} ${y}C150 ${y - 30} 330 ${y - 18} 610 ${y - 24}`} fill="none" stroke={INK} strokeWidth="2" opacity=".28" />
      ))}

      {/* barn */}
      <g transform="translate(400 196)">
        <path d="M0 40V14L26 0l26 14v26z" fill="#C8381F" {...S} />
        <path d="M18 40V24h16v16" fill="#FFFDF7" {...S} strokeWidth="2.5" />
        <path d="M18 24l16 16M34 24L18 40" stroke={INK} strokeWidth="2" />
      </g>

      {/* tree */}
      <path d="M120 300c6-30 8-60 4-100l14 0c-2 30 0 66 10 100z" fill="#7A4B2A" {...S} />
      <path d="M130 228c-14-8-24-6-32 2M134 214c12-10 24-10 32-4" fill="none" {...S} />
      <g>
        {[
          [130, 130, 62, '#2F7A3C'],
          [84, 150, 40, '#3E8E4A'],
          [180, 150, 42, '#3E8E4A'],
          [130, 96, 42, '#3E8E4A'],
        ].map(([cx, cy, r, f], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={f} {...S} />
        ))}
        <path d="M96 120c10 6 20 6 30 0M146 168c10 4 20 2 28-6M112 82c8-4 18-4 26 2" fill="none" stroke={INK} strokeWidth="2" opacity=".35" />
        {[
          [100, 168],
          [150, 92],
          [168, 186],
          [74, 132],
          [128, 170],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="9" fill="#E0452B" {...S} strokeWidth="2.5" />
        ))}
        <EatenFruit cx={196} cy={146} dur={BIRD_DUR} begin="0s" motion={motion} />
        <EatenFruit cx={100} cy={110} dur={BIRD_DUR} begin="-5.5s" motion={motion} />
      </g>

      {/* crops */}
      {[
        [230, 312, 'tomato'],
        [270, 318, 'cabbage'],
        [310, 316, 'carrot'],
        [345, 320, 'tomato'],
        [385, 322, 'cabbage'],
        [425, 318, 'carrot'],
        [462, 316, 'tomato'],
        [505, 314, 'cabbage'],
        [545, 312, 'carrot'],
        [60, 336, 'cabbage'],
        [200, 352, 'carrot'],
        [290, 360, 'cabbage'],
        [380, 362, 'tomato'],
        [470, 356, 'carrot'],
        [560, 352, 'tomato'],
      ].map(([x, y, k], i) => (
        <Plant key={i} x={x} y={y} kind={k} delay={(i % 5) * 0.4} />
      ))}

      {/* birds */}
      <Bird path={pathA} dur={BIRD_DUR} begin="0s" motion={motion} still="translate(212 140)" />
      <Bird path={pathB} dur={BIRD_DUR} begin="-5.5s" color="#CFE0EA" motion={motion} still="translate(116 104)" />

      {/* road */}
      <rect x="-10" y="384" width="620" height="60" fill="#E8DCC0" {...S} />
      <path d="M0 414H600" stroke={INK} strokeWidth="3" strokeDasharray="18 14" />

      {/* truck */}
      <g transform={motion ? undefined : 'translate(250 0)'}>
        {motion && <animateTransform attributeName="transform" type="translate" values="-200 0;700 0" dur="14s" repeatCount="indefinite" />}
        <g transform="translate(0 342)">
          <rect x="0" y="0" width="92" height="46" fill="#F2B632" {...S} />
          <text x="46" y="31" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="20" fill={INK}>
            FD
          </text>
          <path d="M92 14h24l14 16v16H92z" fill="#FFFDF7" {...S} />
          <path d="M100 18h14l8 10h-22z" fill="#CFE0EA" {...S} strokeWidth="2.5" />
          <circle cx="12" cy="-8" r="8" fill="#E0452B" {...S} strokeWidth="2.5" />
          <circle cx="30" cy="-6" r="8" fill="#7DBE5C" {...S} strokeWidth="2.5" />
          <circle cx="48" cy="-8" r="8" fill="#F2A33A" {...S} strokeWidth="2.5" />
          <circle cx="66" cy="-6" r="8" fill="#E0452B" {...S} strokeWidth="2.5" />
          {[22, 108].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="48" r="11" fill={INK} />
              <circle cx={cx} cy="48" r="4" fill="#FFFDF7" />
              <path d={`M${cx - 8} 48h16`} stroke="#FFFDF7" strokeWidth="2">
                {motion && <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} 48`} to={`360 ${cx} 48`} dur="0.6s" repeatCount="indefinite" />}
              </path>
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}
