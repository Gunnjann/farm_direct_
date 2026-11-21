/**
 * Mandi (wholesale market) prices.
 *
 * Sources, in order of trust:
 *   1. AGMARKNET via the Open Government Data platform (data.gov.in), if DATA_GOV_IN_API_KEY is set.
 *      The endpoint is configurable (MANDI_API_URL) because data.gov.in has re-published this
 *      dataset under different resource ids over time. Verify the current one on data.gov.in.
 *   2. Prices entered by FarmDirect admins (e.g. read from the local mandi board each morning).
 *   3. Sample data (demo only), always labelled "Sample" in the UI.
 */
const { MandiPrice } = require('../models/Market');
const { CROPS, MANDIS, cropFromAgmark, cropByKey } = require('../data/agri');

const API_URL = process.env.MANDI_API_URL || 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
const API_KEY = process.env.DATA_GOV_IN_API_KEY || '';
const STATES = ['Madhya Pradesh', 'Maharashtra'];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/** Match a market name from the API to one of our known mandis (for coordinates). */
function matchMandi(market, district, state) {
  const m = norm(market);
  return (
    MANDIS.find((x) => x.state === state && (norm(x.name).includes(m) || m.includes(norm(x.name.split(' ')[0])))) ||
    MANDIS.find((x) => x.state === state && norm(x.district) === norm(district)) ||
    null
  );
}

function parseDate(v) {
  if (!v) return null;
  const s = String(v);
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // 21/11/2026
  if (dmy) return new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Turns one API record into our shape. Tolerates the field-name variants the
 * dataset has used (state / state_name, market / market_name, arrival_date / report_date …).
 */
function normalizeRecord(r) {
  const pick = (...keys) => keys.map((k) => r[k] ?? r[k.toLowerCase()] ?? r[k.replace(/_/g, ' ')]).find((v) => v !== undefined && v !== '');
  const state = pick('state', 'State', 'state_name');
  const commodity = pick('commodity', 'Commodity', 'commodity_name');
  const crop = cropFromAgmark(commodity);
  if (!crop || !STATES.includes(state)) return null;
  const market = pick('market', 'Market', 'market_name');
  const district = pick('district', 'District', 'district_name');
  const date = parseDate(pick('arrival_date', 'Arrival_Date', 'report_date', 'date'));
  const minPrice = Number(pick('min_price', 'Min_Price', 'Min_x0020_Price'));
  const maxPrice = Number(pick('max_price', 'Max_Price', 'Max_x0020_Price'));
  const modalPrice = Number(pick('modal_price', 'Modal_Price', 'Modal_x0020_Price'));
  if (!market || !date || !Number.isFinite(modalPrice) || modalPrice <= 0) return null;
  const mandi = matchMandi(market, district, state);
  return {
    crop,
    market: String(market).trim(),
    district: district ? String(district).trim() : mandi?.district,
    state,
    mandiKey: mandi?.key,
    variety: String(pick('variety', 'Variety') || 'Other').trim(),
    date,
    minPrice: Number.isFinite(minPrice) ? minPrice : modalPrice,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : modalPrice,
    modalPrice,
    source: 'agmarknet',
  };
}

async function upsertPrices(rows) {
  if (!rows.length) return 0;
  const ops = rows.map((r) => ({
    updateOne: {
      filter: { crop: r.crop, market: r.market, variety: r.variety, date: r.date, source: r.source },
      update: { $set: r },
      upsert: true,
    },
  }));
  const res = await MandiPrice.bulkWrite(ops, { ordered: false });
  return (res.upsertedCount || 0) + (res.modifiedCount || 0);
}

/** Pull today's AGMARKNET prices for our crops in MP + MH. Safe to call repeatedly. */
async function syncFromDataGov({ fetchImpl = fetch } = {}) {
  if (!API_KEY) return { skipped: true, reason: 'DATA_GOV_IN_API_KEY not set' };
  let total = 0;
  const errors = [];
  for (const state of STATES) {
    for (const crop of CROPS) {
      for (const commodity of crop.agmark) {
        const url = new URL(API_URL);
        url.searchParams.set('api-key', API_KEY);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '500');
        url.searchParams.set('filters[state]', state);
        url.searchParams.set('filters[commodity]', commodity);
        try {
          const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = await res.json();
          const rows = (body.records || []).map(normalizeRecord).filter(Boolean);
          total += await upsertPrices(rows);
        } catch (e) {
          errors.push(`${state}/${commodity}: ${e.message}`);
        }
      }
    }
  }
  return { saved: total, errors: errors.slice(0, 10), errorCount: errors.length };
}

/**
 * Latest price per market for a crop. Real data (agmarknet/admin) wins over sample
 * data for the same market. Only prices from the last `maxAgeDays` are used.
 */
async function latestPrices(crop, { state, maxAgeDays = 10 } = {}) {
  const since = new Date(Date.now() - maxAgeDays * 86400000);
  const match = { crop, date: { $gte: since } };
  if (state) match.state = state;
  const rows = await MandiPrice.aggregate([
    { $match: match },
    { $addFields: { rank: { $switch: { branches: [{ case: { $eq: ['$source', 'agmarknet'] }, then: 0 }, { case: { $eq: ['$source', 'admin'] }, then: 1 }], default: 2 } } } },
    { $sort: { rank: 1, date: -1 } },
    { $group: { _id: '$market', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { modalPrice: -1 } },
  ]);
  return rows.map((r) => {
    const m = r.mandiKey ? MANDIS.find((x) => x.key === r.mandiKey) : null;
    return { ...r, nameHi: m?.nameHi, lat: m?.lat, lng: m?.lng, marketFeePct: m?.marketFeePct, hamaliPerQtl: m?.hamaliPerQtl };
  });
}

async function priceHistory(crop, market, days = 30) {
  const since = new Date(Date.now() - days * 86400000);
  return MandiPrice.find({ crop, market, date: { $gte: since } })
    .sort({ date: 1, source: 1 })
    .select('date modalPrice minPrice maxPrice source -_id')
    .lean();
}

/* ------------------------------------------------------------------ sample data (demo only) */

// Base modal ₹/quintal per crop for a "normal" big-city mandi, then mandi multipliers.
const SAMPLE_BASE = {
  cauliflower: 900, cabbage: 700, tomato: 1400, onion: 1900, potato: 1300, brinjal: 1500, 'green chilli': 3200, garlic: 9000,
  wheat: 2550, soybean: 4450, gram: 5600, maize: 2150, pomegranate: 7500, orange: 3200,
};
// Big city terminals pay more for perishables; small local mandis are where gluts crash prices.
const SAMPLE_MULT = {
  'mh-vashi': 1.45, 'mh-pune': 1.2, 'mp-indore': 1.1, 'mp-bhopal': 1.0, 'mh-nagpur': 1.05, 'mh-nashik': 0.9, 'mh-lasalgaon': 0.95,
  'mh-ahilyanagar': 0.75, 'mh-solapur': 0.8, 'mh-sambhajinagar': 0.85, 'mh-kolhapur': 0.95, 'mh-jalgaon': 0.8,
  'mp-ujjain': 0.85, 'mp-dewas': 0.7, 'mp-jabalpur': 0.9, 'mp-gwalior': 0.95, 'mp-ratlam': 0.75, 'mp-sagar': 0.75, 'mp-khandwa': 0.7, 'mp-chhindwara': 0.8,
};
// Glut: in these rural mandis cauliflower has crashed to ~₹1/kg (₹100/qtl) — the real-world problem.
const GLUT = { cauliflower: ['mp-dewas', 'mp-khandwa', 'mp-ratlam', 'mp-sagar', 'mh-ahilyanagar', 'mh-solapur', 'mh-jalgaon'] };

function seededRand(seed) {
  let x = seed % 2147483647;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
}

function generateSample(days = 21) {
  const rows = [];
  const today = new Date();
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  MANDIS.forEach((m, mi) => {
    CROPS.forEach((c, ci) => {
      const rand = seededRand(1000 + mi * 97 + ci * 13);
      const glut = GLUT[c.key]?.includes(m.key);
      for (let d = days - 1; d >= 0; d--) {
        let modal = SAMPLE_BASE[c.key] * (SAMPLE_MULT[m.key] || 1) * (0.9 + rand() * 0.2);
        if (glut) modal = Math.max(60, 420 - (days - d) * 16 + rand() * 40); // sliding to ~₹1/kg
        if (c.key === 'cauliflower' && !glut) modal *= 1 - (days - d) * 0.006; // national dip
        modal = Math.round(modal / 10) * 10;
        rows.push({
          crop: c.key,
          mandiKey: m.key,
          market: m.name,
          district: m.district,
          state: m.state,
          variety: 'Other',
          date: new Date(base - d * 86400000),
          minPrice: Math.round(modal * 0.8),
          maxPrice: Math.round(modal * 1.18),
          modalPrice: modal,
          arrivalsQtl: Math.round(50 + rand() * (glut ? 900 : 300)),
          source: 'sample',
        });
      }
    });
  });
  return rows;
}

module.exports = { syncFromDataGov, normalizeRecord, upsertPrices, latestPrices, priceHistory, generateSample, parseDate, cropByKey, API_KEY };
