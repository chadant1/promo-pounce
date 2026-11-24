// Shared deal-parsing helpers. Used by the app (browser) and by scripts/fetch-deals.mjs (Node).

export const CATEGORIES = [
  { id: 'electronics', name: 'Electronics', emoji: '📱', generic: 'electronics',
    kw: ['airpods','earbuds','headphones','headphone','speaker','iphone','ipad','macbook','laptop','tablet','tv','television','monitor','camera','phone','smartphone','charger','usb','ssd','hard drive','router','smartwatch','watch','apple','samsung','sony','bose','lg','lenovo','dell','hp','asus','acer','anker','ugreen','beats','jbl','kindle','echo','alexa','ring','roku','gpu','cpu','pc','keyboard','mouse','bluetooth','projector','drone','gopro','fitbit','garmin','pixel','oled','4k','hdmi','nvme','memory','ram','printer','best buy','bestbuy','newegg','micro center','tech','gadget','robot vacuum','roborock'] },
  { id: 'fashion', name: 'Fashion', emoji: '👟', generic: 'clothing',
    kw: ['shoes','shoe','sneakers','sneaker','boots','jacket','coat','hoodie','shirt','t-shirt','tee','jeans','pants','dress','skirt','socks','apparel','clothing','clothes','fashion','loafer','loafers','sandals','nike','adidas','puma','reebok','new balance','under armour','levi','levis','gap','old navy','h&m','zara','uniqlo','lululemon','north face','columbia','carhartt','heydude','crocs','vans','converse','ugg','handbag','bag','backpack','wallet','sunglasses','jewelry','ring','necklace','nordstrom','macys','kohls','asos','shein','men\'s','women\'s'] },
  { id: 'home', name: 'Home & Kitchen', emoji: '🛋️', generic: 'home goods',
    kw: ['vacuum','mop','furniture','sofa','couch','mattress','bed','pillow','sheets','blanket','towel','kitchen','cookware','pan','pot','knife','air fryer','instant pot','blender','coffee','keurig','nespresso','dyson','shark','lamp','rug','curtain','storage','organizer','decor','candle','wayfair','ikea','home depot','lowes','lowe\'s','tool','tools','drill','dewalt','milwaukee','ryobi','craftsman','dolly','cart','grill','patio','garden','lawn','mower','appliance','dishwasher','refrigerator','washer','dryer','bedding','bath','kitchenaid','ninja','cuisinart','bissell','hand truck'] },
  { id: 'beauty', name: 'Beauty', emoji: '💄', generic: 'beauty',
    kw: ['makeup','cosmetics','skincare','skin care','serum','moisturizer','lipstick','mascara','foundation','perfume','fragrance','cologne','shampoo','conditioner','hair','nail','sephora','ulta','beauty','olaplex','cerave','glossier','razor','shaver','trimmer','sunscreen','lotion','bath & body','spa'] },
  { id: 'food', name: 'Food & Drink', emoji: '🍕', generic: 'food delivery',
    kw: ['food','pizza','burger','restaurant','delivery','doordash','uber eats','ubereats','grubhub','instacart','meal','meal kit','hellofresh','snack','snacks','coffee beans','tea','grocery','groceries','sauce','hot sauce','chocolate','candy','drink','soda','wine','beer','starbucks','dominos','domino\'s','mcdonalds','chipotle','taco','protein bar','cereal','s&s'] },
  { id: 'travel', name: 'Travel', emoji: '✈️', generic: 'travel',
    kw: ['flight','flights','hotel','hotels','airline','travel','vacation','cruise','car rental','rental car','airbnb','vrbo','expedia','booking.com','priceline','kayak','hertz','avis','enterprise','luggage','suitcase','resort','trip','southwest','delta','united','marriott','hilton'] },
  { id: 'toys', name: 'Toys & Games', emoji: '🎮', generic: 'video games',
    kw: ['toy','toys','lego','game','games','gaming','video game','playstation','ps5','ps4','xbox','nintendo','switch','steam','board game','puzzle','doll','barbie','hot wheels','nerf','console','controller','vr','meta quest','quest 3','funko','pokemon cards','gamestop'] },
  { id: 'sports', name: 'Sports & Outdoors', emoji: '⚽', generic: 'sporting goods',
    kw: ['sports','fitness','gym','workout','yoga','bike','bicycle','ebike','e-bike','camping','tent','hiking','fishing','golf','running','treadmill','dumbbell','weights','kayak','outdoor','outdoors','yeti','stanley','hydro flask','rei','dicks','dick\'s','peloton','basketball','football','soccer','baseball','ski','snowboard','scooter','cooler'] },
  { id: 'pets', name: 'Pets', emoji: '🐾', generic: 'pet supplies',
    kw: ['pet','pets','dog','dogs','cat','cats','puppy','kitten','chewy','petco','petsmart','litter','kibble','pet food','leash','collar','aquarium','bird','barkbox'] },
  { id: 'health', name: 'Health', emoji: '💊', generic: 'vitamins',
    kw: ['vitamin','vitamins','supplement','supplements','protein','medicine','pharmacy','cvs','walgreens','first aid','thermometer','toothbrush','oral-b','sonicare','contacts','glasses','eyeglasses','hearing','massage','massager','theragun','health','wellness','cpap'] },
  { id: 'auto', name: 'Auto', emoji: '🚗', generic: 'auto parts',
    kw: ['car','cars','auto','automotive','tire','tires','oil change','motor oil','autozone','advance auto','o\'reilly','napa','dash cam','car seat','jump starter','wiper','truck','vehicle','motorcycle','tesla'] },
  { id: 'media', name: 'Books & Media', emoji: '📚', generic: 'books',
    kw: ['book','books','ebook','audiobook','audible','magazine','movie','movies','4k blu-ray','blu-ray','dvd','vinyl','music','spotify','netflix','hulu','disney+','streaming','subscription','software','vpn','antivirus','microsoft office','adobe','course','udemy','masterclass'] },
  { id: 'other', name: 'Other', emoji: '🛍️', generic: 'online shopping', kw: [] },
];

export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KW_RES = CATEGORIES.map(c => ({
  id: c.id,
  res: c.kw.map(k => new RegExp('(^|[^a-z0-9])' + escapeRe(k) + '($|[^a-z0-9])', 'i')),
}));

/** Guess the category of a deal from its text. Title matches count double. */
export function classify(title = '', extra = '') {
  let best = 'other', bestScore = 0;
  for (const { id, res } of KW_RES) {
    let s = 0;
    for (const re of res) {
      if (re.test(title)) s += 2;
      else if (extra && re.test(extra)) s += 1;
    }
    if (s > bestScore) { bestScore = s; best = id; }
  }
  return best;
}

const CODE_STOP = new Set(('CODE CODES COUPON COUPONS PROMO PROMOS OFF SALE FREE SHIPPING DEAL DEALS BLACK FRIDAY CYBER MONDAY ' +
  'JANUARY FEBRUARY MARCH APRIL MAY JUNE JULY AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER TODAY NOW HERE VALID EXTRA WITH FOR THE AND ' +
  'ORDER ORDERS ONLINE APP USE USED APPLIED REQUIRED NEEDED NONE CHECKOUT CART CLIP VERIFIED ACTIVE ALL NEW BEST PRIME AMAZON ' +
  'WALMART TARGET APPLE NIKE YOUR THIS THAT FROM ONLY SAVE GET AT IN ON TO OR AN OF IS NO S&H NOTE BELOW ABOVE EXPIRED WORKS ' +
  'WORKING INSTANT SITEWIDE AUTOMATIC ENTER APPLY REDEEM FIRST LIMIT TERMS EXCLUSIONS MEMBERS MEMBER EMAIL SMS TEXT ' +
  'HTTP HTTPS WWW COM USD').split(' '));

/** Pull likely promo codes ("use code SAVE20", "promo code: BF25") out of free text. */
export function extractCodes(text = '') {
  const out = [];
  const re = /\b(?:[Cc]ode|CODE|[Cc]oupon|[Pp]romo|[Uu]se|[Ee]nter|[Aa]pply)\s*(?:[Cc]ode)?\s*[:=\-–]?\s*["'“‘*]?\s*([A-Z0-9][A-Z0-9\-]{3,19})(?![A-Za-z0-9])/g;
  let m;
  while ((m = re.exec(text))) {
    const c = m[1].replace(/-+$/, '');
    if (c.length < 4 || CODE_STOP.has(c)) continue;
    if (!/[A-Z]/.test(c)) continue;               // pure numbers are usually prices/years
    if (/^\d+(GB|TB|MB|HZ|W|MM|IN|OZ|LB|LBS|PK|PC|CT)$/.test(c)) continue; // specs, not codes
    if (!out.includes(c)) out.push(c);
  }
  return out.slice(0, 3);
}

const num = s => parseFloat(String(s).replace(/,/g, ''));

/** Read a discount out of text: percent, dollars off, sale/regular price. */
export function parseDiscount(text = '') {
  const d = { pct: 0, amount: 0, price: 0, was: 0, freeShip: false, upTo: false };
  for (const m of text.matchAll(/(up to\s*)?(\d{1,2}(?:\.\d)?)\s*%\s*off/gi)) {
    const v = num(m[2]);
    if (v > d.pct && v <= 95) { d.pct = v; d.upTo = !!m[1]; }
  }
  const amt = text.match(/\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)\s*off/i);
  if (amt) d.amount = num(amt[1]);
  const was = text.match(/(?:reg\.?|regularly|was|orig\.?|originally|list(?: price)?|retail|msrp|compare at)\s*:?\s*\$\s?(\d[\d,]*(?:\.\d{2})?)/i);
  if (was) d.was = num(was[1]);
  const prices = [...text.matchAll(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)(?![\d.,]|\s*off)/gi)].map(m => num(m[1])).filter(v => v > 0);
  if (prices.length) d.price = d.was ? Math.min(...prices.filter(p => p < d.was), d.was) : prices[0];
  if (d.was && d.price && d.price < d.was && !d.pct) d.pct = Math.round((1 - d.price / d.was) * 100);
  d.freeShip = /free\s*(?:s\/h|s&h|shipping|ship)/i.test(text);
  return d;
}

/** One number for "greatest to least" sorting. Percent wins; dollar amounts are scaled down. */
export function discountScore(d = {}) {
  if (!d) return 0;
  if (d.pct) return d.pct;
  if (d.amount) return Math.min(90, d.amount / (d.price ? d.price + d.amount : d.amount * 4) * 100);
  return 0;
}

export function discountLabel(d = {}) {
  if (!d) return null;
  if (d.pct) return { big: Math.round(d.pct) + '%', small: d.upTo ? 'UP TO' : 'OFF' };
  if (d.amount) return { big: '$' + Math.round(d.amount), small: 'OFF' };
  if (d.price) return { big: '$' + (d.price >= 100 || Number.isInteger(d.price) ? Math.round(d.price) : d.price.toFixed(2)), small: 'NOW' };
  return null;
}

export function hostOf(url = '') {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function stripTags(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim();
}

export function hashId(s = '') {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'd' + (h >>> 0).toString(36);
}


/* ---------- Retailers ----------
   `re` matches the store's name in text; brand-name stores (Apple, Nike, Dell…) are only
   detected by their domain so a product's brand isn't mistaken for where it's sold. */
export const RETAILERS = [
  { id: 'amazon', name: 'Amazon', color: '#ff9900', domains: ['amazon.com', 'amzn.to', 'woot.com'], re: /\bamazon\b|\bprime members\b/i },
  { id: 'walmart', name: 'Walmart', color: '#0071ce', domains: ['walmart.com'], re: /\bwalmart\b/i },
  { id: 'target', name: 'Target', color: '#cc0000', domains: ['target.com'], re: /\bTarget\b/ },
  { id: 'bestbuy', name: 'Best Buy', color: '#0046be', domains: ['bestbuy.com'], re: /\bbest\s?buy\b/i },
  { id: 'costco', name: 'Costco', color: '#e31837', domains: ['costco.com'], re: /\bcostco\b/i },
  { id: 'samsclub', name: "Sam's Club", color: '#0067a0', domains: ['samsclub.com'], re: /\bsam'?s club\b/i },
  { id: 'homedepot', name: 'Home Depot', color: '#f96302', domains: ['homedepot.com'], re: /\bhome depot\b/i },
  { id: 'lowes', name: "Lowe's", color: '#004990', domains: ['lowes.com'], re: /\blowe'?s\b/i },
  { id: 'macys', name: "Macy's", color: '#e21a2c', domains: ['macys.com'], re: /\bmacy'?s\b/i },
  { id: 'kohls', name: "Kohl's", color: '#859b3c', domains: ['kohls.com'], re: /\bkohl'?s\b/i },
  { id: 'nordstrom', name: 'Nordstrom', color: '#6b6b6b', domains: ['nordstrom.com', 'nordstromrack.com'], re: /\bnordstrom\b/i },
  { id: 'newegg', name: 'Newegg', color: '#f7a21b', domains: ['newegg.com'], re: /\bnewegg\b/i },
  { id: 'gamestop', name: 'GameStop', color: '#e10000', domains: ['gamestop.com'], re: /\bgamestop\b/i },
  { id: 'wayfair', name: 'Wayfair', color: '#7b189f', domains: ['wayfair.com'], re: /\bwayfair\b/i },
  { id: 'staples', name: 'Staples', color: '#cc0000', domains: ['staples.com'], re: /\bstaples\b/i },
  { id: 'officedepot', name: 'Office Depot', color: '#d12026', domains: ['officedepot.com'], re: /\boffice ?depot\b/i },
  { id: 'dicks', name: "Dick's", color: '#006b54', domains: ['dickssportinggoods.com'], re: /\bdick'?s sporting\b/i },
  { id: 'rei', name: 'REI', color: '#3f6e47', domains: ['rei.com'], re: /\bREI\b/ },
  { id: 'sephora', name: 'Sephora', color: '#111111', domains: ['sephora.com'], re: /\bsephora\b/i },
  { id: 'ulta', name: 'Ulta', color: '#f26b3a', domains: ['ulta.com'], re: /\bulta\b/i },
  { id: 'cvs', name: 'CVS', color: '#cc0000', domains: ['cvs.com'], re: /\bCVS\b/ },
  { id: 'walgreens', name: 'Walgreens', color: '#e31837', domains: ['walgreens.com'], re: /\bwalgreens\b/i },
  { id: 'chewy', name: 'Chewy', color: '#1c49c2', domains: ['chewy.com'], re: /\bchewy\b/i },
  { id: 'petsmart', name: 'PetSmart', color: '#d1131f', domains: ['petsmart.com'], re: /\bpetsmart\b/i },
  { id: 'apple', name: 'Apple', color: '#555555', domains: ['apple.com'], re: /\bapple\.com\b|\bapple store\b/i },
  { id: 'nike', name: 'Nike', color: '#111111', domains: ['nike.com'], re: null },
  { id: 'adidas', name: 'adidas', color: '#111111', domains: ['adidas.com'], re: null },
  { id: 'dell', name: 'Dell', color: '#007db8', domains: ['dell.com'], re: null },
  { id: 'lenovo', name: 'Lenovo', color: '#e2231a', domains: ['lenovo.com'], re: null },
  { id: 'samsung', name: 'Samsung', color: '#1428a0', domains: ['samsung.com'], re: null },
  { id: 'hp', name: 'HP', color: '#0096d6', domains: ['hp.com'], re: null },
  { id: 'microsoft', name: 'Microsoft', color: '#00a4ef', domains: ['microsoft.com'], re: null },
  { id: 'ebay', name: 'eBay', color: '#e53238', domains: ['ebay.com'], re: /\bebay\b/i },
];
export const RETAILER_BY_ID = Object.fromEntries(RETAILERS.map(r => [r.id, r]));
const DOMAIN_TO_RETAILER = new Map(RETAILERS.flatMap(r => r.domains.map(d => [d, r.id])));

function retailerFromHost(host = '') {
  host = host.toLowerCase().replace(/^www\./, '');
  for (const [d, id] of DOMAIN_TO_RETAILER) if (host === d || host.endsWith('.' + d)) return id;
  return null;
}

/** Work out which store a deal is from. Returns a retailer id or null. */
export function detectRetailer({ title = '', snippet = '', url = '', source = '' } = {}) {
  const fromUrl = retailerFromHost(hostOf(url));
  if (fromUrl) return fromUrl;
  // Domains written in the text, e.g. Slickdeals' "[walmart.com]" or "amazon.com · Slickdeals"
  for (const m of `${source} ${title} ${snippet}`.matchAll(/\b((?:[a-z0-9-]+\.)+(?:com|to))\b/gi)) {
    const id = retailerFromHost(m[1]);
    if (id) return id;
  }
  // "… at Walmart", "via Amazon", "@ Target" in the title wins over a brand mentioned first
  for (const r of RETAILERS) {
    if (r.re && new RegExp('(?:\\bat|\\bvia|\\bfrom|@|\\|)\\s+(?:' + r.re.source + ')', r.re.flags).test(title)) return r.id;
  }
  const earliest = text => {
    let best = null, pos = Infinity;
    for (const r of RETAILERS) {
      if (!r.re) continue;
      const m = text.match(r.re);
      if (m && m.index < pos) { pos = m.index; best = r.id; }
    }
    return best;
  };
  return earliest(title) || earliest(snippet);
}

const REFURB_RE = /\b(?:refurb(?:ished)?|renewed|reconditioned|re-?certified|remanufactured|open[- ]box|pre-?owned|second[- ]hand|like[- ]new|used\s*-\s*(?:good|very good|acceptable|like new)|grade [abc] (?:condition|used))\b/i;
export const isRefurb = d => REFURB_RE.test(`${d.title || ''} ${d.snippet || ''}`);
export const isEbay = d => d.retailer === 'ebay' || /\bebay\b/i.test(d.title || '') || retailerFromHost(hostOf(d.url || '')) === 'ebay';

/** Turn any raw result into the app's deal shape. */
export function makeDeal({ title, url, snippet = '', source = '', date = null, kind = 'web' }) {
  title = stripTags(title).replace(/\*\*/g, '');
  const retailer = detectRetailer({ title, snippet: stripTags(snippet), url, source });
  snippet = stripTags(snippet).replace(/\*\*/g, '').replace(/\[[^\]]*\.(?:com|net|org)\]/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const text = title + ' ' + snippet;
  const discount = parseDiscount(text);
  return {
    id: hashId(url || title),
    title,
    url,
    source: source || hostOf(url),
    snippet: snippet.slice(0, 320),
    codes: extractCodes(text),
    discount,
    score: discountScore(discount),
    category: classify(title, snippet),
    retailer,
    date,
    kind,
  };
}

/** Parse RSS 2.0 XML without a DOM (works in Node and browsers). */
export function parseRssItems(xml = '') {
  const items = [];
  const get = (block, tag) => {
    const m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
    if (!m) return '';
    return m[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
  };
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const b = m[1];
    items.push({
      title: stripTags(get(b, 'title')),
      url: stripTags(get(b, 'link')),
      snippet: get(b, 'description'),
      date: get(b, 'pubDate') || null,
    });
  }
  return items;
}

export function tokens(s = '') {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(t => t.length > 1);
}
