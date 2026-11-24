// Builds data/deals.json for the "Hot" tab. Runs in GitHub Actions on a schedule.
// Sources are public RSS feeds; if one fails the others still count, and if all fail
// the existing file is left alone so the app falls back to fetching live.
import { writeFile } from 'node:fs/promises';
import { parseRssItems, makeDeal } from '../js/deal-utils.js';

const FEEDS = [
  { name: 'Slickdeals Frontpage', url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', slick: true },
  { name: 'Slickdeals Popular', url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1', slick: true },
  { name: 'Slickdeals Coupons', url: 'https://slickdeals.net/newsearch.php?q=code&searcharea=deals&searchin=first&rss=1', slick: true },
];

const out = new Map();
for (const feed of FEEDS) {
  try {
    const r = await fetch(feed.url, { headers: { 'User-Agent': 'PromoPounce/1.0 (+https://github.com/chadant1/promo-pounce)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const items = parseRssItems(await r.text());
    for (const it of items) {
      const store = (it.snippet.match(/\[([a-z0-9.-]+\.(?:com|net|org|co|us))\]/i) || [])[1];
      const d = makeDeal({ ...it, kind: 'deal', source: store ? `${store.replace(/^www\./, '')} · Slickdeals` : 'slickdeals.net' });
      if (!out.has(d.id)) out.set(d.id, d);
    }
    console.log(`✓ ${feed.name}: ${items.length} items`);
  } catch (e) {
    console.warn(`✗ ${feed.name}: ${e.message}`);
  }
}

const deals = [...out.values()].sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0)).slice(0, 120);
if (deals.length) {
  await writeFile(new URL('../data/deals.json', import.meta.url), JSON.stringify({ updated: new Date().toISOString(), count: deals.length, deals }));
  console.log(`Wrote ${deals.length} deals (${deals.filter(d => d.codes.length).length} with codes).`);
} else {
  console.warn('No deals fetched; keeping existing data/deals.json');
}
