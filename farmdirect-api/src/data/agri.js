/**
 * Reference data for the farmer–broker market module (Madhya Pradesh + Maharashtra).
 *
 * IMPORTANT: coordinates are approximate (district HQ / mandi area) and cost
 * defaults are TYPICAL ASSUMPTIONS, not official rates. Every cost is editable
 * by the farmer in the calculator, and the UI says so.
 */

// ---------------------------------------------------------------- crops
// perishPer100Km: % of quantity lost/downgraded per 100 km of road travel
// packagingPerQtl / labourPerQtl: ₹ per quintal (crates/bags, harvesting + loading)
// commissionPct: typical commission agent (adat) charge at the mandi
const CROPS = [
  { key: 'cauliflower', en: 'Cauliflower', hi: 'फूलगोभी', agmark: ['Cauliflower'], group: 'vegetable', perishPer100Km: 3, packagingPerQtl: 40, labourPerQtl: 150, commissionPct: 6 },
  { key: 'cabbage', en: 'Cabbage', hi: 'पत्तागोभी', agmark: ['Cabbage'], group: 'vegetable', perishPer100Km: 2, packagingPerQtl: 35, labourPerQtl: 120, commissionPct: 6 },
  { key: 'tomato', en: 'Tomato', hi: 'टमाटर', agmark: ['Tomato'], group: 'vegetable', perishPer100Km: 4, packagingPerQtl: 60, labourPerQtl: 150, commissionPct: 6 },
  { key: 'onion', en: 'Onion', hi: 'प्याज़', agmark: ['Onion'], group: 'vegetable', perishPer100Km: 0.5, packagingPerQtl: 25, labourPerQtl: 80, commissionPct: 6 },
  { key: 'potato', en: 'Potato', hi: 'आलू', agmark: ['Potato'], group: 'vegetable', perishPer100Km: 0.5, packagingPerQtl: 25, labourPerQtl: 80, commissionPct: 6 },
  { key: 'brinjal', en: 'Brinjal', hi: 'बैंगन', agmark: ['Brinjal'], group: 'vegetable', perishPer100Km: 3, packagingPerQtl: 40, labourPerQtl: 150, commissionPct: 6 },
  { key: 'green chilli', en: 'Green Chilli', hi: 'हरी मिर्च', agmark: ['Green Chilli'], group: 'vegetable', perishPer100Km: 2.5, packagingPerQtl: 40, labourPerQtl: 250, commissionPct: 6 },
  { key: 'garlic', en: 'Garlic', hi: 'लहसुन', agmark: ['Garlic'], group: 'vegetable', perishPer100Km: 0.3, packagingPerQtl: 25, labourPerQtl: 100, commissionPct: 2 },
  { key: 'wheat', en: 'Wheat', hi: 'गेहूँ', agmark: ['Wheat'], group: 'grain', perishPer100Km: 0, packagingPerQtl: 20, labourPerQtl: 40, commissionPct: 2 },
  { key: 'soybean', en: 'Soybean', hi: 'सोयाबीन', agmark: ['Soyabean', 'Soybean'], group: 'grain', perishPer100Km: 0, packagingPerQtl: 20, labourPerQtl: 40, commissionPct: 2 },
  { key: 'gram', en: 'Gram (Chana)', hi: 'चना', agmark: ['Bengal Gram(Gram)(Whole)', 'Gram'], group: 'grain', perishPer100Km: 0, packagingPerQtl: 20, labourPerQtl: 40, commissionPct: 2 },
  { key: 'maize', en: 'Maize', hi: 'मक्का', agmark: ['Maize'], group: 'grain', perishPer100Km: 0, packagingPerQtl: 20, labourPerQtl: 40, commissionPct: 2 },
  { key: 'pomegranate', en: 'Pomegranate', hi: 'अनार', agmark: ['Pomegranate'], group: 'fruit', perishPer100Km: 1, packagingPerQtl: 120, labourPerQtl: 150, commissionPct: 6 },
  { key: 'orange', en: 'Orange', hi: 'संतरा', agmark: ['Orange'], group: 'fruit', perishPer100Km: 1, packagingPerQtl: 90, labourPerQtl: 120, commissionPct: 6 },
];
const CROP_KEYS = CROPS.map((c) => c.key);
const cropByKey = (k) => CROPS.find((c) => c.key === k);
const cropFromAgmark = (name = '') => {
  const n = String(name).trim().toLowerCase();
  return CROPS.find((c) => c.agmark.some((a) => a.toLowerCase() === n))?.key || null;
};

// ---------------------------------------------------------------- vehicles
// ratePerKm is charged on the ROUND trip (vehicle goes and comes back empty).
const VEHICLES = [
  { key: 'pickup', en: 'Pickup / Bolero (1.5 t)', hi: 'पिकअप / बोलेरो (1.5 टन)', capacityQtl: 15, ratePerKm: 14 },
  { key: 'tempo', en: 'Tempo / 407 (3.5 t)', hi: 'टेम्पो / 407 (3.5 टन)', capacityQtl: 35, ratePerKm: 20 },
  { key: 'truck', en: 'Truck (10 t)', hi: 'ट्रक (10 टन)', capacityQtl: 100, ratePerKm: 32 },
];

// ---------------------------------------------------------------- mandis
// marketFeePct: APMC market fee (approx); hamaliPerQtl: unloading/weighing labour.
const MANDIS = [
  // Maharashtra
  { key: 'mh-pune', name: 'Pune (Gultekdi Market Yard)', nameHi: 'पुणे (गुलटेकडी मार्केट यार्ड)', district: 'Pune', state: 'Maharashtra', lat: 18.4925, lng: 73.8662, marketFeePct: 1, hamaliPerQtl: 20 },
  { key: 'mh-vashi', name: 'Mumbai (Vashi APMC)', nameHi: 'मुंबई (वाशी APMC)', district: 'Thane', state: 'Maharashtra', lat: 19.0656, lng: 73.0004, marketFeePct: 1, hamaliPerQtl: 25 },
  { key: 'mh-nashik', name: 'Nashik APMC', nameHi: 'नासिक APMC', district: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898, marketFeePct: 1, hamaliPerQtl: 15 },
  { key: 'mh-lasalgaon', name: 'Lasalgaon APMC', nameHi: 'लासलगाँव APMC', district: 'Nashik', state: 'Maharashtra', lat: 20.1497, lng: 74.2398, marketFeePct: 1, hamaliPerQtl: 12 },
  { key: 'mh-ahilyanagar', name: 'Ahilyanagar APMC', nameHi: 'अहिल्यानगर APMC', district: 'Ahilyanagar', state: 'Maharashtra', lat: 19.0952, lng: 74.7496, marketFeePct: 1, hamaliPerQtl: 12 },
  { key: 'mh-solapur', name: 'Solapur APMC', nameHi: 'सोलापुर APMC', district: 'Solapur', state: 'Maharashtra', lat: 17.6599, lng: 75.9064, marketFeePct: 1, hamaliPerQtl: 12 },
  { key: 'mh-sambhajinagar', name: 'Chhatrapati Sambhajinagar APMC', nameHi: 'छत्रपति संभाजीनगर APMC', district: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', lat: 19.8762, lng: 75.3433, marketFeePct: 1, hamaliPerQtl: 12 },
  { key: 'mh-nagpur', name: 'Nagpur (Kalamna)', nameHi: 'नागपुर (कळमना)', district: 'Nagpur', state: 'Maharashtra', lat: 21.1702, lng: 79.1307, marketFeePct: 1, hamaliPerQtl: 15 },
  { key: 'mh-kolhapur', name: 'Kolhapur APMC', nameHi: 'कोल्हापुर APMC', district: 'Kolhapur', state: 'Maharashtra', lat: 16.705, lng: 74.2433, marketFeePct: 1, hamaliPerQtl: 12 },
  { key: 'mh-jalgaon', name: 'Jalgaon APMC', nameHi: 'जलगाँव APMC', district: 'Jalgaon', state: 'Maharashtra', lat: 21.0077, lng: 75.5626, marketFeePct: 1, hamaliPerQtl: 12 },
  // Madhya Pradesh
  { key: 'mp-indore', name: 'Indore (Choithram Mandi)', nameHi: 'इंदौर (चोइथराम मंडी)', district: 'Indore', state: 'Madhya Pradesh', lat: 22.6916, lng: 75.8466, marketFeePct: 1.5, hamaliPerQtl: 15 },
  { key: 'mp-bhopal', name: 'Bhopal (Karond Mandi)', nameHi: 'भोपाल (करोंद मंडी)', district: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2988, lng: 77.4055, marketFeePct: 1.5, hamaliPerQtl: 15 },
  { key: 'mp-ujjain', name: 'Ujjain Mandi', nameHi: 'उज्जैन मंडी', district: 'Ujjain', state: 'Madhya Pradesh', lat: 23.1765, lng: 75.7885, marketFeePct: 1.5, hamaliPerQtl: 12 },
  { key: 'mp-dewas', name: 'Dewas Mandi', nameHi: 'देवास मंडी', district: 'Dewas', state: 'Madhya Pradesh', lat: 22.9676, lng: 76.0534, marketFeePct: 1.5, hamaliPerQtl: 12 },
  { key: 'mp-jabalpur', name: 'Jabalpur Mandi', nameHi: 'जबलपुर मंडी', district: 'Jabalpur', state: 'Madhya Pradesh', lat: 23.1815, lng: 79.9864, marketFeePct: 1.5, hamaliPerQtl: 12 },
  { key: 'mp-gwalior', name: 'Gwalior (Lashkar Mandi)', nameHi: 'ग्वालियर (लश्कर मंडी)', district: 'Gwalior', state: 'Madhya Pradesh', lat: 26.2183, lng: 78.1828, marketFeePct: 1.5, hamaliPerQtl: 12 },
  { key: 'mp-ratlam', name: 'Ratlam Mandi', nameHi: 'रतलाम मंडी', district: 'Ratlam', state: 'Madhya Pradesh', lat: 23.3315, lng: 75.0367, marketFeePct: 1.5, hamaliPerQtl: 10 },
  { key: 'mp-sagar', name: 'Sagar Mandi', nameHi: 'सागर मंडी', district: 'Sagar', state: 'Madhya Pradesh', lat: 23.8388, lng: 78.7378, marketFeePct: 1.5, hamaliPerQtl: 10 },
  { key: 'mp-khandwa', name: 'Khandwa Mandi', nameHi: 'खंडवा मंडी', district: 'Khandwa', state: 'Madhya Pradesh', lat: 21.8243, lng: 76.3523, marketFeePct: 1.5, hamaliPerQtl: 10 },
  { key: 'mp-chhindwara', name: 'Chhindwara Mandi', nameHi: 'छिंदवाड़ा मंडी', district: 'Chhindwara', state: 'Madhya Pradesh', lat: 22.0574, lng: 78.9382, marketFeePct: 1.5, hamaliPerQtl: 10 },
];
const mandiByKey = (k) => MANDIS.find((m) => m.key === k);

// ---------------------------------------------------------------- districts (approx HQ coordinates)
const L = (state, district, hi, lat, lng) => ({ state, district, hi, lat, lng });
const LOCATIONS = [
  // Maharashtra
  L('Maharashtra', 'Ahilyanagar', 'अहिल्यानगर', 19.0952, 74.7496),
  L('Maharashtra', 'Akola', 'अकोला', 20.7002, 77.0082),
  L('Maharashtra', 'Amravati', 'अमरावती', 20.9374, 77.7796),
  L('Maharashtra', 'Beed', 'बीड', 18.9891, 75.756),
  L('Maharashtra', 'Bhandara', 'भंडारा', 21.1669, 79.6508),
  L('Maharashtra', 'Buldhana', 'बुलढाणा', 20.5293, 76.1842),
  L('Maharashtra', 'Chandrapur', 'चंद्रपुर', 19.9615, 79.2961),
  L('Maharashtra', 'Chhatrapati Sambhajinagar', 'छत्रपति संभाजीनगर', 19.8762, 75.3433),
  L('Maharashtra', 'Dharashiv', 'धाराशिव', 18.1861, 76.0419),
  L('Maharashtra', 'Dhule', 'धुले', 20.9042, 74.7749),
  L('Maharashtra', 'Hingoli', 'हिंगोली', 19.7173, 77.1495),
  L('Maharashtra', 'Jalgaon', 'जलगाँव', 21.0077, 75.5626),
  L('Maharashtra', 'Jalna', 'जालना', 19.8347, 75.8816),
  L('Maharashtra', 'Kolhapur', 'कोल्हापुर', 16.705, 74.2433),
  L('Maharashtra', 'Latur', 'लातूर', 18.4088, 76.5604),
  L('Maharashtra', 'Mumbai', 'मुंबई', 19.076, 72.8777),
  L('Maharashtra', 'Nagpur', 'नागपुर', 21.1458, 79.0882),
  L('Maharashtra', 'Nanded', 'नांदेड़', 19.1383, 77.321),
  L('Maharashtra', 'Nandurbar', 'नंदुरबार', 21.3667, 74.2333),
  L('Maharashtra', 'Nashik', 'नासिक', 19.9975, 73.7898),
  L('Maharashtra', 'Parbhani', 'परभणी', 19.2608, 76.7748),
  L('Maharashtra', 'Pune', 'पुणे', 18.5204, 73.8567),
  L('Maharashtra', 'Ratnagiri', 'रत्नागिरी', 16.9902, 73.312),
  L('Maharashtra', 'Sangli', 'सांगली', 16.8524, 74.5815),
  L('Maharashtra', 'Satara', 'सातारा', 17.6805, 74.0183),
  L('Maharashtra', 'Solapur', 'सोलापुर', 17.6599, 75.9064),
  L('Maharashtra', 'Thane', 'ठाणे', 19.2183, 72.9781),
  L('Maharashtra', 'Wardha', 'वर्धा', 20.7453, 78.6022),
  L('Maharashtra', 'Yavatmal', 'यवतमाल', 20.3888, 78.1204),
  // Madhya Pradesh
  L('Madhya Pradesh', 'Balaghat', 'बालाघाट', 21.8129, 80.1838),
  L('Madhya Pradesh', 'Barwani', 'बड़वानी', 22.0363, 74.9033),
  L('Madhya Pradesh', 'Betul', 'बैतूल', 21.9022, 77.8987),
  L('Madhya Pradesh', 'Bhind', 'भिंड', 26.5587, 78.7871),
  L('Madhya Pradesh', 'Bhopal', 'भोपाल', 23.2599, 77.4126),
  L('Madhya Pradesh', 'Burhanpur', 'बुरहानपुर', 21.3094, 76.2297),
  L('Madhya Pradesh', 'Chhatarpur', 'छतरपुर', 24.9162, 79.5812),
  L('Madhya Pradesh', 'Chhindwara', 'छिंदवाड़ा', 22.0574, 78.9382),
  L('Madhya Pradesh', 'Damoh', 'दमोह', 23.8315, 79.442),
  L('Madhya Pradesh', 'Dewas', 'देवास', 22.9676, 76.0534),
  L('Madhya Pradesh', 'Dhar', 'धार', 22.6013, 75.3025),
  L('Madhya Pradesh', 'Guna', 'गुना', 24.6469, 77.3113),
  L('Madhya Pradesh', 'Gwalior', 'ग्वालियर', 26.2183, 78.1828),
  L('Madhya Pradesh', 'Harda', 'हरदा', 22.3442, 77.0954),
  L('Madhya Pradesh', 'Indore', 'इंदौर', 22.7196, 75.8577),
  L('Madhya Pradesh', 'Jabalpur', 'जबलपुर', 23.1815, 79.9864),
  L('Madhya Pradesh', 'Katni', 'कटनी', 23.8343, 80.3894),
  L('Madhya Pradesh', 'Khandwa', 'खंडवा', 21.8243, 76.3523),
  L('Madhya Pradesh', 'Khargone', 'खरगोन', 21.8238, 75.6114),
  L('Madhya Pradesh', 'Mandsaur', 'मंदसौर', 24.0734, 75.0679),
  L('Madhya Pradesh', 'Morena', 'मुरैना', 26.4947, 77.991),
  L('Madhya Pradesh', 'Narmadapuram', 'नर्मदापुरम', 22.7539, 77.7171),
  L('Madhya Pradesh', 'Neemuch', 'नीमच', 24.4764, 74.8624),
  L('Madhya Pradesh', 'Raisen', 'रायसेन', 23.3327, 77.7824),
  L('Madhya Pradesh', 'Rajgarh', 'राजगढ़', 24.0073, 76.7268),
  L('Madhya Pradesh', 'Ratlam', 'रतलाम', 23.3315, 75.0367),
  L('Madhya Pradesh', 'Rewa', 'रीवा', 24.5362, 81.3037),
  L('Madhya Pradesh', 'Sagar', 'सागर', 23.8388, 78.7378),
  L('Madhya Pradesh', 'Satna', 'सतना', 24.6005, 80.8322),
  L('Madhya Pradesh', 'Sehore', 'सीहोर', 23.2032, 77.0844),
  L('Madhya Pradesh', 'Seoni', 'सिवनी', 22.0869, 79.5435),
  L('Madhya Pradesh', 'Shajapur', 'शाजापुर', 23.4273, 76.273),
  L('Madhya Pradesh', 'Shivpuri', 'शिवपुरी', 25.4358, 77.6651),
  L('Madhya Pradesh', 'Ujjain', 'उज्जैन', 23.1765, 75.7885),
  L('Madhya Pradesh', 'Vidisha', 'विदिशा', 23.5251, 77.8081),
];
const findLocation = (state, district) => LOCATIONS.find((l) => l.state === state && l.district === district);

/** Straight-line km × 1.3 ≈ road km (rural roads are rarely straight). */
function roadKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3);
}

module.exports = { CROPS, CROP_KEYS, cropByKey, cropFromAgmark, VEHICLES, MANDIS, mandiByKey, LOCATIONS, findLocation, roadKm };
