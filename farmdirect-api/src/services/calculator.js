/**
 * "Kahan bechun?" — where should I sell, and what will actually reach my hand?
 *
 * For each mandi with a recent price:
 *   gross        = modal ₹/qtl × quantity that survives the trip
 *   − transport  = vehicles × round-trip km × ₹/km
 *   − commission = gross × commission %
 *   − market fee = gross × market fee %
 *   − hamali     = ₹/qtl unloading & weighing
 *   − packaging  = ₹/qtl crates / bags
 *   − labour     = ₹/qtl harvesting & loading (paid wherever you sell)
 *   = NET IN HAND
 *
 * Spoilage: perishables lose a % per 100 km (cauliflower ~3%), which reduces sellable quantity.
 * All money here is in RUPEES (the calculator is advisory, not a payment), rounded at the end.
 *
 * Also returns `minFairFarmGatePerKg`: the best net per kg across mandis. If a broker
 * collects from your farm (his vehicle, no commission, no hamali), any offer BELOW this
 * means you'd be better off taking the crop to that mandi yourself.
 */
const { cropByKey, VEHICLES, roadKm } = require('../data/agri');

const r2 = (n) => Math.round(n * 100) / 100;

function calculate({ crop, quantityQtl, origin, vehicle = 'tempo', prices, overrides = {} }) {
  const c = cropByKey(crop);
  if (!c) throw new Error('Unknown crop');
  const v = VEHICLES.find((x) => x.key === vehicle) || VEHICLES[1];
  const ratePerKm = overrides.ratePerKm ?? v.ratePerKm;
  const commissionPct = overrides.commissionPct ?? c.commissionPct;
  const packagingPerQtl = overrides.packagingPerQtl ?? c.packagingPerQtl;
  const labourPerQtl = overrides.labourPerQtl ?? c.labourPerQtl;
  const perishPer100Km = overrides.perishPer100Km ?? c.perishPer100Km;
  const vehicles = Math.max(1, Math.ceil(quantityQtl / v.capacityQtl));

  const rows = prices
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => {
      const km = roadKm(origin, p);
      const spoilPct = Math.min(40, (perishPer100Km * km) / 100);
      const sellableQtl = quantityQtl * (1 - spoilPct / 100);
      const gross = p.modalPrice * sellableQtl;
      const transport = vehicles * km * 2 * ratePerKm;
      const commission = (gross * commissionPct) / 100;
      const marketFee = (gross * (overrides.marketFeePct ?? p.marketFeePct ?? 1)) / 100;
      const hamali = (overrides.hamaliPerQtl ?? p.hamaliPerQtl ?? 15) * sellableQtl;
      const packaging = packagingPerQtl * quantityQtl;
      const labour = labourPerQtl * quantityQtl;
      const spoilageLoss = p.modalPrice * (quantityQtl - sellableQtl);
      const costs = transport + commission + marketFee + hamali + packaging + labour;
      const net = gross - costs;
      return {
        market: p.market,
        nameHi: p.nameHi,
        district: p.district,
        state: p.state,
        source: p.source,
        priceDate: p.date,
        modalPerQtl: p.modalPrice,
        modalPerKg: r2(p.modalPrice / 100),
        distanceKm: km,
        travelHours: r2(km / 40),
        vehicles,
        spoilPct: r2(spoilPct),
        breakdown: {
          gross: Math.round(gross),
          transport: Math.round(transport),
          commission: Math.round(commission),
          marketFee: Math.round(marketFee),
          hamali: Math.round(hamali),
          packaging: Math.round(packaging),
          labour: Math.round(labour),
          spoilageLoss: Math.round(spoilageLoss),
        },
        totalCosts: Math.round(costs),
        net: Math.round(net),
        netPerKg: r2(net / (quantityQtl * 100)),
      };
    })
    .sort((a, b) => b.net - a.net);

  const best = rows[0] || null;
  const nearest = [...rows].sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;
  // At the farm gate the broker bears transport/commission/hamali; farmer still pays harvest labour + packaging.
  const farmGateExtraPerKg = r2((labourPerQtl + packagingPerQtl) / 100);
  const minFairFarmGatePerKg = best ? r2(Math.max(0, best.netPerKg + farmGateExtraPerKg)) : null;

  return {
    crop: c.key,
    quantityQtl,
    vehicle: { ...v, ratePerKm, count: vehicles },
    assumptions: { commissionPct, packagingPerQtl, labourPerQtl, perishPer100Km, roadFactor: 1.3, speedKmph: 40 },
    best,
    nearest,
    gainVsNearest: best && nearest ? best.net - nearest.net : 0,
    minFairFarmGatePerKg,
    rows,
  };
}

/** How does a broker's farm-gate offer compare with taking the crop to the best mandi? */
function judgeOffer(offerPerKgRupees, calc) {
  if (!calc?.minFairFarmGatePerKg && calc?.minFairFarmGatePerKg !== 0) return null;
  const diff = r2(offerPerKgRupees - calc.minFairFarmGatePerKg);
  return { diffPerKg: diff, verdict: diff >= 0.25 ? 'good' : diff >= -0.25 ? 'fair' : 'low' };
}

module.exports = { calculate, judgeOffer };
