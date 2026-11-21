import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * English / Hindi.
 *  - t('Label')       → UI strings (falls back to English)
 *  - pn(product)      → product name: seller's own Hindi name, else dictionary
 *  - ln('Tomato (Desi)') → localise a free-text name snapshot (orders, cart)
 *  - u('kg')          → units
 * Add Marathi/Telugu/etc. by adding another language block.
 */
const UI = {
  hi: {
    // nav
    Shop: 'खरीदें',
    Groups: 'ग्रुप',
    Cart: 'कार्ट',
    Orders: 'ऑर्डर',
    Account: 'खाता',
    Dashboard: 'डैशबोर्ड',
    Products: 'उत्पाद',
    Settings: 'सेटिंग्स',
    Complaints: 'शिकायतें',
    Notifications: 'सूचनाएँ',
    'Log in': 'लॉग इन',
    'Sign up': 'साइन अप',
    'Log out': 'लॉग आउट',
    'Set pincode': 'पिनकोड डालें',
    'Search vegetables, grains…': 'सब्ज़ी, अनाज खोजें…',
    // home
    'Farmers · Traders · Shops · Homes': 'किसान · व्यापारी · दुकानें · घर',
    'Buy straight from the': 'सीधे खरीदें',
    farm: 'खेत से',
    'Pay the real price.': 'सही दाम चुकाएँ।',
    heroSub: 'आपके पास के सत्यापित किसानों और व्यापारियों से सब्ज़ी, फल और अनाज। भुगतान से पहले कटाई की तारीख़, ग्रेड और डिलीवरी शुल्क देखें।',
    'Your pincode': 'आपका पिनकोड',
    'Find sellers': 'विक्रेता खोजें',
    'Verified sellers': 'सत्यापित विक्रेता',
    'Fees shown upfront': 'शुल्क पहले से साफ़',
    'Refund if it goes wrong': 'गड़बड़ी पर रिफ़ंड',
    'Shop by category': 'श्रेणी से खरीदें',
    'Fresh on FarmDirect': 'FarmDirect पर ताज़ा',
    'Delivering to': 'डिलीवरी:',
    'See all': 'सब देखें',
    'Group orders near you': 'आपके पास ग्रुप ऑर्डर',
    'All groups': 'सभी ग्रुप',
    'Start selling': 'बेचना शुरू करें',
    'How it works': 'कैसे काम करता है',
    'Live from the farm': 'खेत से सीधा',
    // shop
    'Shop fresh produce': 'ताज़ा उपज खरीदें',
    All: 'सभी',
    Farmers: 'किसान',
    Traders: 'व्यापारी',
    'Group deals': 'ग्रुप डील',
    Popular: 'लोकप्रिय',
    'Freshest harvest': 'सबसे ताज़ा',
    'Price: low to high': 'कीमत: कम से ज़्यादा',
    'Price: high to low': 'कीमत: ज़्यादा से कम',
    'Top rated': 'सबसे अच्छी रेटिंग',
    Newest: 'नए',
    products: 'उत्पाद',
    'Nothing here yet': 'अभी यहाँ कुछ नहीं है',
    'Sellers delivering to': 'यहाँ डिलीवरी करने वाले विक्रेता:',
    // card / product
    Farmer: 'किसान',
    Trader: 'व्यापारी',
    Grade: 'ग्रेड',
    'Group deal': 'ग्रुप डील',
    'Free delivery': 'मुफ़्त डिलीवरी',
    delivery: 'डिलीवरी',
    Min: 'न्यूनतम',
    'in bulk': 'थोक में',
    from: 'से',
    'Add to cart': 'कार्ट में डालें',
    'Buy now': 'अभी खरीदें',
    'Delivers to': 'डिलीवरी',
    'Check delivery': 'डिलीवरी जाँचें',
    'About this produce': 'इस उपज के बारे में',
    Harvest: 'कटाई',
    'Sold by': 'विक्रेता',
    Minimum: 'न्यूनतम',
    Available: 'उपलब्ध',
    'Reviews from verified buyers': 'सत्यापित खरीदारों की समीक्षा',
    'Start a group': 'ग्रुप शुरू करें',
    Seller: 'विक्रेता',
    Verified: 'सत्यापित',
    Quantity: 'मात्रा',
    // cart / checkout
    Subtotal: 'सामान का मूल्य',
    'Delivery fee': 'डिलीवरी शुल्क',
    'Platform fee': 'प्लेटफ़ॉर्म शुल्क',
    Total: 'कुल',
    Checkout: 'चेकआउट',
    Remove: 'हटाएँ',
    Summary: 'सारांश',
    'Your cart is empty': 'आपका कार्ट ख़ाली है',
    'Browse produce': 'उपज देखें',
    'Place order': 'ऑर्डर करें',
    // seller
    Accept: 'स्वीकार करें',
    Reject: 'अस्वीकार करें',
    'New orders': 'नए ऑर्डर',
    'Add product': 'उत्पाद जोड़ें',
    Stock: 'स्टॉक',
    Price: 'कीमत',
    'Join group': 'ग्रुप में जुड़ें',
    'Loading…': 'लोड हो रहा है…',
  },
};

const PRODUCE_HI = {
  'green chilli': 'हरी मिर्च',
  'toor dal': 'तूर दाल',
  'moong dal': 'मूंग दाल',
  'chana dal': 'चना दाल',
  'masoor dal': 'मसूर दाल',
  'red nashik': 'लाल नासिक',
  'lady finger': 'भिंडी',
  tomato: 'टमाटर',
  onion: 'प्याज़',
  potato: 'आलू',
  spinach: 'पालक',
  palak: 'पालक',
  chilli: 'मिर्च',
  pomegranate: 'अनार',
  banana: 'केला',
  guava: 'अमरूद',
  cauliflower: 'फूलगोभी',
  cabbage: 'पत्तागोभी',
  brinjal: 'बैंगन',
  carrot: 'गाजर',
  okra: 'भिंडी',
  garlic: 'लहसुन',
  ginger: 'अदरक',
  coriander: 'धनिया',
  methi: 'मेथी',
  cucumber: 'खीरा',
  pumpkin: 'कद्दू',
  mango: 'आम',
  apple: 'सेब',
  grapes: 'अंगूर',
  orange: 'संतरा',
  papaya: 'पपीता',
  wheat: 'गेहूँ',
  rice: 'चावल',
  jowar: 'ज्वार',
  bajra: 'बाजरा',
  maize: 'मक्का',
  ragi: 'रागी',
  turmeric: 'हल्दी',
  soybean: 'सोयाबीन',
  gram: 'चना',
  dal: 'दाल',
  // varieties / descriptors
  desi: 'देसी',
  hybrid: 'हाइब्रिड',
  organic: 'जैविक',
  unpolished: 'बिना पॉलिश',
  whole: 'साबुत',
  sharbati: 'शरबती',
  bhagwa: 'भगवा',
  robusta: 'रोबस्टा',
  indrayani: 'इंद्रायणी',
  maldandi: 'मालदांडी',
  rajapuri: 'राजापुरी',
  lalit: 'ललित',
  jyoti: 'ज्योति',
  bharit: 'भरीत',
  red: 'लाल',
  green: 'हरा',
};
const PRODUCE_KEYS = Object.keys(PRODUCE_HI).sort((a, b) => b.length - a.length);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRODUCE_RX = new RegExp(`\\b(${PRODUCE_KEYS.map(escape).join('|')})\\b`, 'gi');

const UNITS_HI = { kg: 'किलो', quintal: 'क्विंटल', dozen: 'दर्जन', piece: 'पीस', bundle: 'गड्डी' };

const I18nCtx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('fd_lang') || 'en';
    } catch {
      return 'en';
    }
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('fd_lang', lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const t = useCallback((s) => UI[lang]?.[s] || s, [lang]);
  const ln = useCallback((text = '') => (lang === 'hi' ? text.replace(PRODUCE_RX, (m) => PRODUCE_HI[m.toLowerCase()]) : text), [lang]);
  const pn = useCallback(
    (p, { withVariety = false } = {}) => {
      if (!p) return '';
      if (lang !== 'hi') return withVariety && p.variety ? `${p.name} · ${p.variety}` : p.name;
      const name = p.nameHi || ln(p.name);
      return withVariety && p.variety ? `${name} · ${ln(p.variety)}` : name;
    },
    [lang, ln]
  );
  const u = useCallback((unit) => (lang === 'hi' ? UNITS_HI[unit] || unit : unit), [lang]);

  const tr = useCallback((en, hi) => (lang === 'hi' ? hi : en), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, ln, pn, u, tr }), [lang, t, ln, pn, u, tr]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useT = () => useContext(I18nCtx);
