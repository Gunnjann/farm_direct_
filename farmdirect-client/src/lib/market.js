import { useEffect, useState } from 'react';
import { api } from './api';

/** Crops, districts, vehicles and mandis — fetched once and shared. */
let cache = null;
let pending = null;
export function useMarketMeta() {
  const [meta, setMeta] = useState(cache);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (cache) return;
    pending ||= api('/market/meta').then((m) => (cache = m));
    pending.then(setMeta).catch((e) => {
      pending = null;
      setError(e);
    });
  }, []);
  return { meta, error };
}

export const STATES = [
  { value: 'Madhya Pradesh', hi: 'मध्य प्रदेश' },
  { value: 'Maharashtra', hi: 'महाराष्ट्र' },
];

export const inr = (n, d = 0) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const perKg = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kg`;
export const cropName = (meta, key, lang) => {
  const c = meta?.crops.find((x) => x.key === key);
  return c ? (lang === 'hi' ? c.hi : c.en) : key;
};
export const districtName = (meta, district, lang) => (lang === 'hi' ? meta?.locations.find((l) => l.district === district)?.hi || district : district);
