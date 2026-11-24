import {
  CATEGORIES, CAT_BY_ID, classify, makeDeal, parseRssItems, parseDiscount, discountScore,
  discountLabel, hostOf, tokens,
} from './deal-utils.js';

/* =========================================================
   Storage (wrapped: private mode / full storage must not crash the app)
   ========================================================= */
const store = {
  get(k, fallback) { try { const v = localStorage.getItem('pp.' + k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem('pp.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const DEFAULTS = {
  theme: 'arcade', hue: null, font: 100, radius: 18, density: 'cozy', layout: 'list',
  motion: true, blobs: true, confetti: true, haptics: true, snippets: true,
  provider: 'ddg', serperKey: '', jinaKey: '', slick: true, similar: true,
};
let settings = { ...DEFAULTS, ...store.get('settings', {}) };
let stash = store.get('stash', []);
let recent = store.get('recent', []);
let hot = store.get('hot', { updated: 0, deals: [] });
const known = new Map();           // every deal currently on screen, by id
let stashFilter = 'all';
let hideUsed = false;
let hotFilter = 'all';

const saveSettings = () => store.set('settings', settings);
const saveStash = () => { store.set('stash', stash); updateStashCount(); };

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;

/* =========================================================
   Themes & settings UI
   ========================================================= */
const THEMES = [
  { id: 'arcade', name: 'Neon Arcade', sw: ['#110922', '#b05cff', '#25d9f0'] },
  { id: 'candy', name: 'Candy Pop', sw: ['#fff5fb', '#ff4fa8', '#5fd3ff'] },
  { id: 'sunset', name: 'Sunset', sw: ['#1d0b12', '#ff7a3d', '#ff3d7f'] },
  { id: 'mint', name: 'Mint Fresh', sw: ['#effbf5', '#1aa874', '#8a7bff'] },
  { id: 'midnight', name: 'Midnight', sw: ['#080d1a', '#3d8bff', '#ffcf3d'] },
  { id: 'paper', name: 'Paper', sw: ['#f5f1ea', '#c4532b', '#5b84b1'] },
];

function applySettings() {
  const b = document.body;
  b.dataset.theme = settings.theme;
  if (settings.hue == null) b.style.removeProperty('--hue'); else b.style.setProperty('--hue', settings.hue);
  document.documentElement.style.setProperty('--fs', settings.font / 100);
  b.style.setProperty('--r', settings.radius + 'px');
  b.classList.toggle('compact', settings.density === 'compact');
  b.classList.toggle('layout-grid', settings.layout === 'grid');
  b.classList.toggle('no-motion', !settings.motion);
  b.classList.toggle('no-blobs', !settings.blobs);
  b.classList.toggle('hide-snippets', !settings.snippets);
  const bg = getComputedStyle(b).getPropertyValue('--bg').trim();
  if (bg) $('meta[name="theme-color"]').setAttribute('content', bg);
}

function themeHue() {
  const b = document.body, prev = b.style.getPropertyValue('--hue');
  b.style.removeProperty('--hue');
  const h = parseInt(getComputedStyle(b).getPropertyValue('--hue'), 10);
  if (prev) b.style.setProperty('--hue', prev);
  return h;
}

function initSettingsUI() {
  $('#theme-grid').innerHTML = THEMES.map(t => `
    <button class="theme-card" data-theme-pick="${t.id}" aria-label="${t.name} theme">
      <div class="sw" style="background:${t.sw[0]}"><i style="background:${t.sw[1]}"></i><i style="background:${t.sw[2]}"></i></div>
      <span>${t.name}</span>
    </button>`).join('');

  const bindRange = (id, key, fmt) => {
    const el = $(id), out = $(id.replace('s-', 'o-'));
    const sync = () => { out.textContent = fmt(el.value); };
    el.addEventListener('input', () => { settings[key] = +el.value; sync(); applySettings(); saveSettings(); });
    return () => { el.value = settings[key] ?? themeHue(); sync(); };
  };
  const syncers = [
    bindRange('#s-hue', 'hue', v => v + '°'),
    bindRange('#s-font', 'font', v => v + '%'),
    bindRange('#s-radius', 'radius', v => v + 'px'),
  ];
  const bindSeg = (id, key) => {
    const el = $(id);
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      settings[key] = b.dataset.v; applySettings(); saveSettings(); syncAll(); buzz(8);
    });
    return () => $$('button', el).forEach(b => b.classList.toggle('on', b.dataset.v === settings[key]));
  };
  syncers.push(bindSeg('#s-density', 'density'), bindSeg('#s-layout', 'layout'));
  const bindCheck = (id, key) => {
    const el = $(id);
    el.addEventListener('change', () => { settings[key] = el.checked; applySettings(); saveSettings(); });
    return () => { el.checked = !!settings[key]; };
  };
  syncers.push(
    bindCheck('#s-motion', 'motion'), bindCheck('#s-blobs', 'blobs'), bindCheck('#s-confetti', 'confetti'),
    bindCheck('#s-haptics', 'haptics'), bindCheck('#s-snippets', 'snippets'), bindCheck('#s-slick', 'slick'),
    bindCheck('#s-similar', 'similar'),
  );
  const bindText = (id, key) => {
    const el = $(id);
    el.addEventListener('change', () => { settings[key] = el.value.trim(); saveSettings(); toast('Saved ✓'); });
    return () => { el.value = settings[key] || ''; };
  };
  syncers.push(bindText('#s-serper', 'serperKey'), bindText('#s-jina', 'jinaKey'));
  $('#s-provider').addEventListener('change', e => {
    settings.provider = e.target.value; saveSettings();
    if (settings.provider === 'serper' && !settings.serperKey) toast('Add your free Serper.dev key below 👇');
  });
  syncers.push(() => { $('#s-provider').value = settings.provider; });

  const syncAll = () => {
    syncers.forEach(f => f());
    $$('.theme-card').forEach(c => c.classList.toggle('on', c.dataset.themePick === settings.theme));
  };
  $('#theme-grid').addEventListener('click', e => {
    const c = e.target.closest('[data-theme-pick]'); if (!c) return;
    settings.theme = c.dataset.themePick; settings.hue = null;
    applySettings(); saveSettings(); syncAll(); buzz(10);
    burst(c.getBoundingClientRect(), 40);
  });
  $('#reset-hue').addEventListener('click', () => { settings.hue = null; applySettings(); saveSettings(); syncAll(); });
  syncAll();
}

/* =========================================================
   Fun stuff: toast, haptics, confetti
   ========================================================= */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function buzz(ms = 15) { if (settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* ignore */ } }

const confetti = { parts: [], running: false };
function burst(rect, n = 70) {
  if (!settings.confetti || !settings.motion) return;
  const cv = $('#confetti'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.body);
  const colors = [cs.getPropertyValue('--accent'), cs.getPropertyValue('--accent-2'), '#ffd23d', '#ff4f9a', '#4fffb0'];
  const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 8;
    confetti.parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, g: .32 + Math.random() * .15,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
      c: colors[i % colors.length], life: 70 + Math.random() * 40, shape: Math.random() < .3 ? 'circle' : 'rect',
    });
  }
  if (confetti.running) return;
  confetti.running = true;
  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    confetti.parts = confetti.parts.filter(p => p.life > 0);
    for (const p of confetti.parts) {
      p.vy += p.g; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
      ctx.save(); ctx.globalAlpha = Math.min(1, p.life / 30); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.5, 0, 7); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (confetti.parts.length) requestAnimationFrame(tick);
    else { confetti.running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  };
  requestAnimationFrame(tick);
}

/* =========================================================
   Navigation
   ========================================================= */
const VIEWS = ['search', 'hot', 'stash', 'style'];
function go(view, push = true) {
  if (!VIEWS.includes(view)) view = 'search';
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.go === view));
  $('.tab-ink').style.transform = `translateX(${VIEWS.indexOf(view) * 100}%)`;
  if (push && location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  if (view === 'hot') loadHot();
  if (view === 'stash') renderStash();
  scrollTo({ top: 0, behavior: settings.motion ? 'smooth' : 'auto' });
}

/* =========================================================
   Search providers
   ========================================================= */
const JINA = 'https://r.jina.ai/';
function jinaHeaders(extra = {}) {
  const h = { ...extra };
  if (settings.jinaKey) h.Authorization = 'Bearer ' + settings.jinaKey;
  return h;
}
async function fetchText(url, opts = {}, ms = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (r.status === 429) throw new Error('rate-limited');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

function parseDdgMarkdown(md) {
  const out = [];
  let cur = null;
  const push = () => { if (cur && !cur.ad) out.push(cur); };
  for (const line of md.split('\n')) {
    const h = line.match(/^## \[(.+)\]\((\S+)\)\s*$/);
    if (h) { push(); cur = { title: h[1], href: h[2], ad: false, snippet: '' }; continue; }
    if (!cur) continue;
    if (line.trim() === 'Ad') { cur.ad = true; continue; }
    if (!cur.snippet) {
      const s = line.match(/^\[(.{30,})\]\(\S+\)\s*$/);
      if (s && !s[1].startsWith('![') && /\s/.test(s[1])) cur.snippet = s[1];
    }
  }
  push();
  return out.map(r => {
    let url = r.href;
    try { const u = new URL(r.href, 'https://duckduckgo.com'); url = u.searchParams.get('uddg') || u.href; } catch { /* keep */ }
    return { title: r.title, url, snippet: r.snippet };
  }).filter(r => /^https?:/.test(r.url) && !/duckduckgo\.com/.test(hostOf(r.url)));
}

async function searchDDG(q) {
  const md = await fetchText(JINA + 'https://html.duckduckgo.com/html/?q=' + enc(q), { headers: jinaHeaders({ Accept: 'text/plain' }) });
  return parseDdgMarkdown(md).map(r => makeDeal({ ...r, kind: 'web' }));
}

async function searchSerper(q) {
  if (!settings.serperKey) throw new Error('no-key');
  const txt = await fetchText('https://google.serper.dev/search', {
    method: 'POST', headers: { 'X-API-KEY': settings.serperKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, num: 20, gl: 'us' }),
  });
  const j = JSON.parse(txt);
  return (j.organic || []).map(o => makeDeal({ title: o.title, url: o.link, snippet: o.snippet || '', kind: 'web' }));
}

function slickToDeal(it, kind = 'deal') {
  const store = (it.snippet.match(/\[([a-z0-9.-]+\.(?:com|net|org|co|us))\]/i) || [])[1];
  const d = makeDeal({ title: it.title, url: it.url, snippet: it.snippet, date: it.date, kind, source: store ? `${store.replace(/^www\./, '')} · Slickdeals` : 'slickdeals.net' });
  return d;
}

async function searchSlick(q) {
  const xml = await fetchText(JINA + `https://slickdeals.net/newsearch.php?q=${enc(q)}&searcharea=deals&searchin=first&rss=1`, { headers: jinaHeaders({ 'X-Return-Format': 'html' }) });
  return parseRssItems(xml).slice(0, 15).map(it => slickToDeal(it));
}

const webSearch = q => (settings.provider === 'serper' && settings.serperKey ? searchSerper(q) : searchDDG(q));

/* ---------- "similar" query builder ---------- */
const SIMILAR = {
  airpods: 'wireless earbuds', iphone: 'smartphone', ipad: 'tablet', macbook: 'laptop', ps5: 'playstation games', playstation: 'video games',
  xbox: 'gaming console', 'nintendo switch': 'video games', kindle: 'e-reader', roomba: 'robot vacuum', dyson: 'cordless vacuum',
  yeti: 'insulated tumbler', stanley: 'insulated tumbler', lego: 'building toys', nike: 'running shoes', adidas: 'sneakers',
  'instant pot': 'pressure cooker', keurig: 'coffee maker', nespresso: 'espresso machine', sephora: 'makeup', ulta: 'beauty products',
  doordash: 'food delivery', 'uber eats': 'food delivery', grubhub: 'food delivery', expedia: 'hotel deals', airbnb: 'vacation rental',
  peloton: 'exercise bike', fitbit: 'fitness tracker', 'apple watch': 'smartwatch', gopro: 'action camera', bose: 'headphones',
  beats: 'headphones', sonos: 'smart speaker', ring: 'video doorbell', vitamix: 'blender', kitchenaid: 'stand mixer', crocs: 'clogs',
  ugg: 'boots', lululemon: 'athletic wear', 'north face': 'winter jacket', chewy: 'pet supplies', hellofresh: 'meal kit',
};
const SIM_STOP = new Set('pro max plus mini ultra gen generation edition new the for with and inch size pack set of a an deal deals sale coupon code promo'.split(' '));
function similarQuery(q) {
  const lq = q.toLowerCase().trim();
  for (const k of Object.keys(SIMILAR).sort((a, b) => b.length - a.length)) {
    if (new RegExp('(^|\\s)' + k + '(\\s|$)').test(lq) && SIMILAR[k] !== lq) return SIMILAR[k];
  }
  const tk = tokens(lq);
  const clean = tk.filter(t => !/\d/.test(t) && !SIM_STOP.has(t));
  if (clean.length && clean.length < tk.length) return clean.join(' ');
  const cat = classify(lq);
  if (cat !== 'other' && CAT_BY_ID[cat].generic !== lq) return CAT_BY_ID[cat].generic;
  if (clean.length > 1) return clean[clean.length - 1];
  return null;
}

function localMatches(q, excludeIds) {
  const qt = tokens(q).filter(t => !SIM_STOP.has(t));
  if (!qt.length) return [];
  const pool = [...stash, ...hot.deals];
  const seen = new Set();
  return pool.map(d => {
    const tt = new Set(tokens(d.title + ' ' + (d.snippet || '')));
    return { d, s: qt.filter(t => tt.has(t)).length };
  }).filter(x => x.s > 0 && !excludeIds.has(x.d.id) && !seen.has(x.d.id) && seen.add(x.d.id))
    .sort((a, b) => b.s - a.s || b.d.score - a.d.score).slice(0, 6).map(x => x.d);
}

/* =========================================================
   Rendering
   ========================================================= */
const inStash = id => stash.some(s => s.id === id);
function favicon(host) {
  return host ? `<img src="https://icons.duckduckgo.com/ip3/${esc(host)}.ico" alt="" loading="lazy" onerror="this.remove()">` : '';
}
function timeAgo(t) {
  const ms = Date.now() - (typeof t === 'number' ? t : Date.parse(t));
  if (!isFinite(ms)) return '';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

function badgeHtml(d) {
  const lbl = discountLabel(d.discount);
  if (!lbl) return `<div class="badge plain" aria-hidden="true">${CAT_BY_ID[d.category]?.emoji || '🛍️'}</div>`;
  return lbl.small === 'UP TO'
    ? `<div class="badge"><small>UP TO</small><b>${esc(lbl.big)}</b></div>`
    : `<div class="badge"><b>${esc(lbl.big)}</b><small>${esc(lbl.small)}</small></div>`;
}
function codesHtml(d) {
  if (!d.codes?.length) return '';
  return `<div class="codes">${d.codes.map(c => `<button class="code" data-copy="${esc(c)}" aria-label="Copy code ${esc(c)}">${esc(c)} <span class="cp">tap to copy</span></button>`).join('')}</div>`;
}
function metaHtml(d) {
  const cat = CAT_BY_ID[d.category] || CAT_BY_ID.other;
  const host = hostOf(d.url);
  return `<div class="meta">
    <span class="src">${favicon(host)}${esc(d.source || host)}</span>
    <span class="tag">${cat.emoji} ${esc(cat.name)}</span>
    ${d.discount?.freeShip ? '<span class="tag">🚚 Free ship</span>' : ''}
    ${d.codes?.length ? '<span class="tag hot">🎟️ Code</span>' : ''}
    ${d.date ? `<span>${esc(timeAgo(d.date))}</span>` : ''}
  </div>`;
}

function dealCard(d, i = 0) {
  known.set(d.id, d);
  const saved = inStash(d.id);
  return `<article class="card" style="--i:${Math.min(i, 12)}">
    ${badgeHtml(d)}
    <div class="card-body">
      <h4>${esc(d.title)}</h4>
      ${metaHtml(d)}
      ${d.snippet ? `<p class="snippet">${esc(d.snippet)}</p>` : ''}
      ${codesHtml(d)}
      <div class="actions">
        <button class="act ${saved ? 'saved' : ''}" data-save="${d.id}">${saved ? '⭐ Saved' : '☆ Save'}</button>
        ${d.url ? `<a class="act" href="${esc(d.url)}" target="_blank" rel="noopener">Open ↗</a>` : ''}
      </div>
    </div>
  </article>`;
}

function section(title, deals, note = '') {
  if (!deals.length) return '';
  return `<h3 class="section-title">${title} <span class="count">${deals.length}</span></h3>
    ${note ? `<p class="section-note">${note}</p>` : ''}
    <div class="cards">${deals.map(dealCard).join('')}</div>`;
}

function updateStashCount() {
  const el = $('#stash-count');
  const n = stash.filter(s => !s.used).length;
  if (el.textContent !== String(n)) {
    el.textContent = n;
    const b = $('.stash-bubble'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
}

/* =========================================================
   Search flow
   ========================================================= */
let searchSeq = 0;
async function runSearch(q) {
  q = q.trim();
  if (!q) return;
  const seq = ++searchSeq;
  $('#q').value = q;
  recent = [q, ...recent.filter(r => r.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  store.set('recent', recent); renderRecent();

  const status = $('#search-status'), out = $('#search-results');
  status.className = 'status';
  status.innerHTML = `<span class="sniffer"><span class="paw">🐾</span> Sniffing around for “${esc(q)}” deals…</span>`;
  out.innerHTML = `<div class="cards">${'<div class="skeleton"></div>'.repeat(4)}</div>`;

  const simQ = settings.similar ? similarQuery(q) : null;
  const jobs = [
    webSearch(q + ' promo code'),
    settings.slick ? searchSlick(q) : Promise.resolve([]),
    simQ ? webSearch(simQ + ' promo code') : Promise.resolve([]),
    simQ && settings.slick ? searchSlick(simQ) : Promise.resolve([]),
  ];
  const [web, slick, simWeb, simSlick] = await Promise.allSettled(jobs);
  if (seq !== searchSeq) return;

  const val = r => (r.status === 'fulfilled' ? r.value : []);
  const seen = new Set();
  const uniq = arr => arr.filter(d => !seen.has(d.id) && seen.add(d.id));
  const main = uniq([...val(slick), ...val(web)]);
  const similar = uniq([...val(simSlick), ...val(simWeb)]);

  const byScore = (a, b) => b.score - a.score;
  const withCodes = main.filter(d => d.codes.length).sort(byScore);
  const deals = main.filter(d => !d.codes.length && d.kind === 'deal').sort(byScore);
  const pages = main.filter(d => !d.codes.length && d.kind !== 'deal');
  const simSorted = [...similar.filter(d => d.codes.length).sort(byScore), ...similar.filter(d => !d.codes.length).sort(byScore)].slice(0, 8);
  const local = localMatches(q, seen);

  const failed = [web, slick].filter(r => r.status === 'rejected');
  const limited = [web, slick, simWeb, simSlick].some(r => r.status === 'rejected' && /rate/.test(r.reason?.message));

  if (!main.length && !similar.length && !local.length) {
    status.className = 'status err';
    status.textContent = failed.length
      ? (limited ? 'The free search sources need a breather 😮‍💨 Try again in a minute, or add a free key under Style → Search power.'
        : 'Couldn’t reach the search sources. Check your connection and try again.')
      : 'Nothing turned up. Try a simpler name (like the brand) or a store.';
    out.innerHTML = quickLinks(q);
    return;
  }

  const n = withCodes.length;
  status.textContent = n
    ? `🎉 Found ${n} possible code${n > 1 ? 's' : ''} and ${main.length - n} more deals for “${q}”.`
    : `No codes posted for “${q}” right now, but here are ${main.length} deals and coupon pages${similar.length ? ' plus similar items' : ''}.`;
  if (n) setTimeout(() => burst($('#search-status').getBoundingClientRect(), 50), 150);

  out.innerHTML =
    section('🎟️ Codes found', withCodes, 'Codes come from public posts. Tap one to copy it, then check it at checkout.') +
    section('🔥 Live deals', deals) +
    section('🌐 Coupon pages', pages, 'These sites list current codes for this item or store. Open one to see them.') +
    (simQ ? section(`🧭 Similar: ${esc(simQ)}`, simSorted) : '') +
    section('📌 From your stash & Hot list', local) +
    quickLinks(q);
}

function quickLinks(q) {
  const qq = enc(q);
  const links = [
    ['Google', `https://www.google.com/search?q=${qq}+promo+code`],
    ['Slickdeals', `https://slickdeals.net/newsearch.php?q=${qq}&searcharea=deals&searchin=first`],
    ['RetailMeNot', `https://duckduckgo.com/?q=${qq}+site%3Aretailmenot.com`],
    ['Reddit', `https://www.reddit.com/search/?q=${qq}%20promo%20code`],
    ['CouponFollow', `https://duckduckgo.com/?q=${qq}+site%3Acouponfollow.com`],
  ];
  return `<h3 class="section-title">🕵️ Dig deeper</h3>
    <div class="quick-links">${links.map(([n, u]) => `<a class="chip" href="${u}" target="_blank" rel="noopener">${n} ↗</a>`).join('')}</div>`;
}

const SUGGEST = ['airpods', 'nike shoes', 'instant pot', 'lego', 'sephora', 'ps5', 'doordash', 'hotels'];
function renderRecent() {
  const list = recent.length ? recent : SUGGEST;
  $('#recent-chips').innerHTML =
    `<span class="chip ghost" aria-hidden="true">${recent.length ? '🕘 Recent' : '💡 Try'}</span>` +
    list.map(r => `<button class="chip" data-search="${esc(r)}">${esc(r)}</button>`).join('') +
    (recent.length ? '<button class="chip ghost" data-clear-recent>✕ clear</button>' : '');
}

/* =========================================================
   Hot feed
   ========================================================= */
let hotLoading = false;
async function loadHot(force = false) {
  renderHot();
  const fresh = hot.updated && Date.now() - hot.updated < 3 * 3600e3;
  if ((fresh && !force) || hotLoading) return;
  hotLoading = true;
  $('#hot-refresh').classList.add('spin');
  try {
    let got = null;
    try {
      const r = await fetch('data/deals.json', { cache: 'no-cache' });
      if (r.ok) {
        const j = await r.json();
        const age = Date.now() - Date.parse(j.updated);
        if (j.deals?.length && age < 8 * 3600e3) got = { updated: Date.parse(j.updated), deals: j.deals };
      }
    } catch { /* fall through to live */ }
    if (!got || force) {
      try {
        const xml = await fetchText(JINA + 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', { headers: jinaHeaders({ 'X-Return-Format': 'html' }) });
        const deals = parseRssItems(xml).map(it => slickToDeal(it));
        if (deals.length) got = { updated: Date.now(), deals };
      } catch (e) { if (!got) throw e; }
    }
    if (got) { hot = got; store.set('hot', hot); }
  } catch {
    if (!hot.deals.length) toast('Couldn’t load hot deals. Try ↻ in a minute.');
  } finally {
    hotLoading = false;
    $('#hot-refresh').classList.remove('spin');
    renderHot();
  }
}

function renderHot() {
  const deals = hot.deals || [];
  $('#hot-sub').textContent = hot.updated ? `${deals.length} deals · updated ${timeAgo(hot.updated)}` : 'Loading fresh deals…';
  const counts = {};
  deals.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
  $('#hot-cats').innerHTML = `<button class="chip ${hotFilter === 'all' ? 'on' : ''}" data-hot-cat="all">✨ All<span class="n">${deals.length}</span></button>` +
    CATEGORIES.filter(c => counts[c.id]).map(c => `<button class="chip ${hotFilter === c.id ? 'on' : ''}" data-hot-cat="${c.id}">${c.emoji} ${c.name}<span class="n">${counts[c.id]}</span></button>`).join('');
  const sort = $('#hot-sort').value;
  let list = deals.filter(d => hotFilter === 'all' || d.category === hotFilter);
  if (sort === 'score') list = [...list].sort((a, b) => b.score - a.score);
  if (sort === 'new') list = [...list].sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));
  if (sort === 'code') list = [...list].sort((a, b) => (b.codes.length > 0) - (a.codes.length > 0) || b.score - a.score);
  $('#hot-list').innerHTML = list.length ? list.map(dealCard).join('')
    : (hotLoading || !hot.updated ? '<div class="skeleton"></div>'.repeat(4) : '<div class="empty"><span class="big">🙀</span>No deals in this category right now.</div>');
}

/* =========================================================
   Stash: categories + ranking
   ========================================================= */
function toggleSave(id, btn) {
  const i = stash.findIndex(s => s.id === id);
  if (i >= 0) {
    stash.splice(i, 1);
    toast('Removed from stash');
  } else {
    const d = known.get(id);
    if (!d) return;
    stash.push({ ...d, savedAt: Date.now(), used: false, notes: '' });
    const cat = CAT_BY_ID[d.category] || CAT_BY_ID.other;
    toast(`Stashed in ${cat.emoji} ${cat.name}!`);
    if (btn) burst(btn.getBoundingClientRect(), 28);
    buzz(12);
  }
  saveStash();
  $$(`[data-save="${id}"]`).forEach(b => { const s = inStash(id); b.classList.toggle('saved', s); b.textContent = s ? '⭐ Saved' : '☆ Save'; });
}

function renderStash() {
  const counts = {};
  stash.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
  if (stashFilter !== 'all' && !counts[stashFilter]) stashFilter = 'all';
  $('#stash-cats').innerHTML = `<button class="chip ${stashFilter === 'all' ? 'on' : ''}" data-stash-cat="all">✨ All<span class="n">${stash.length}</span></button>` +
    CATEGORIES.filter(c => counts[c.id]).map(c => `<button class="chip ${stashFilter === c.id ? 'on' : ''}" data-stash-cat="${c.id}">${c.emoji} ${c.name}<span class="n">${counts[c.id]}</span></button>`).join('');
  $('#toggle-used').textContent = hideUsed ? 'Show used' : 'Hide used';

  if (!stash.length) {
    $('#stash-list').innerHTML = `<div class="empty"><span class="big">🐱</span>
      <b>Your stash is empty.</b><br>Tap ☆ Save on any deal, or ＋ to add a code you found yourself.</div>`;
    return;
  }
  const cats = CATEGORIES.filter(c => counts[c.id] && (stashFilter === 'all' || stashFilter === c.id));
  $('#stash-list').innerHTML = cats.map(c => {
    const items = stash.filter(d => d.category === c.id && !(hideUsed && d.used));
    if (!items.length) return '';
    return `<div class="stash-group">
      <h3>${c.emoji} ${c.name} <span class="count">${items.length}</span></h3>
      <ol class="rank-list" data-cat="${c.id}">${items.map((d, i) => rankItem(d, i)).join('')}</ol>
    </div>`;
  }).join('') || '<div class="empty"><span class="big">✅</span>Everything here is marked used.</div>';
}

function rankItem(d, i) {
  known.set(d.id, d);
  const g = i < 3 ? ` g${i + 1}` : '';
  return `<li class="card rank-item ${d.used ? 'used' : ''}" data-id="${d.id}">
    <div class="rank-col">
      <span class="rank-num${g}" aria-label="Rank ${i + 1}">${i + 1}</span>
      <button class="handle" aria-label="Drag to reorder" title="Drag to reorder">⠿</button>
      <button class="mini" data-move="-1" aria-label="Move up">▲</button>
      <button class="mini" data-move="1" aria-label="Move down">▼</button>
    </div>
    ${badgeHtml(d)}
    <div class="card-body">
      <h4>${esc(d.title)}</h4>
      <div class="meta">
        <span class="src">${favicon(hostOf(d.url))}${esc(d.source || hostOf(d.url) || 'added by you')}</span>
        <select class="cat-select" data-recat="${d.id}" aria-label="Category">
          ${CATEGORIES.map(c => `<option value="${c.id}" ${c.id === d.category ? 'selected' : ''}>${c.emoji} ${c.name}</option>`).join('')}
        </select>
      </div>
      ${d.notes ? `<p class="notes">📝 ${esc(d.notes)}</p>` : ''}
      ${d.snippet ? `<p class="snippet">${esc(d.snippet)}</p>` : ''}
      ${codesHtml(d)}
      <div class="actions">
        ${d.url ? `<a class="act" href="${esc(d.url)}" target="_blank" rel="noopener">Open ↗</a>` : ''}
        <button class="act" data-used="${d.id}">${d.used ? '↺ Unuse' : '✓ Used it'}</button>
        <button class="act" data-edit="${d.id}">✎ Edit</button>
        <button class="act danger" data-remove="${d.id}">🗑</button>
      </div>
    </div>
  </li>`;
}

/** Re-order the stash so one category's items follow the order of `ids`. */
function applyCategoryOrder(cat, ids) {
  const byId = new Map(stash.map(d => [d.id, d]));
  const visible = ids.map(id => byId.get(id)).filter(Boolean);
  const hidden = stash.filter(d => d.category === cat && !ids.includes(d.id));
  const queue = [...visible, ...hidden];
  stash = stash.map(d => (d.category === cat ? queue.shift() : d));
  saveStash();
}

function renumber(list) {
  $$('.rank-item', list).forEach((li, i) => {
    const n = $('.rank-num', li);
    n.className = 'rank-num' + (i < 3 ? ` g${i + 1}` : '');
    n.textContent = i + 1;
    n.setAttribute('aria-label', 'Rank ' + (i + 1));
  });
}
function commitList(list) {
  applyCategoryOrder(list.dataset.cat, $$('.rank-item', list).map(li => li.dataset.id));
  renumber(list);
}

function startDrag(e, handle) {
  const li = handle.closest('.rank-item'), list = li.parentElement;
  const gap = parseFloat(getComputedStyle(list).rowGap) || 10;
  let lastY = e.clientY, offset = 0;
  e.preventDefault();
  handle.setPointerCapture(e.pointerId);
  li.classList.add('dragging');
  buzz(10);
  const move = ev => {
    ev.preventDefault();
    let dy = ev.clientY - lastY; lastY = ev.clientY;
    if (ev.clientY > innerHeight - 110) { scrollBy(0, 10); dy += 10; }
    else if (ev.clientY < 110) { scrollBy(0, -10); dy -= 10; }
    offset += dy;
    let next = li.nextElementSibling, prev = li.previousElementSibling;
    while (next && offset > next.offsetHeight / 2) {
      list.insertBefore(next, li); offset -= next.offsetHeight + gap; next = li.nextElementSibling; buzz(6);
    }
    while (prev && offset < -prev.offsetHeight / 2) {
      list.insertBefore(li, prev); offset += prev.offsetHeight + gap; prev = li.previousElementSibling; buzz(6);
    }
    li.style.transform = `translateY(${offset}px) scale(1.03) rotate(-1deg)`;
    renumber(list);
  };
  const up = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', up);
    li.style.transform = '';
    li.classList.remove('dragging');
    commitList(list);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}

function autoRank() {
  const cats = stashFilter === 'all' ? [...new Set(stash.map(d => d.category))] : [stashFilter];
  for (const cat of cats) {
    const sorted = stash.filter(d => d.category === cat)
      .sort((a, b) => (a.used - b.used) || (b.score - a.score) || ((b.codes?.length || 0) - (a.codes?.length || 0)));
    applyCategoryOrder(cat, sorted.map(d => d.id));
  }
  renderStash();
  toast('Ranked from biggest to smallest discount ✨');
  burst($('#auto-rank').getBoundingClientRect(), 40);
}

/* ---------- Add / edit dialog ---------- */
let editingId = null;
function openEditor(id = null) {
  editingId = id;
  const f = $('#edit-form'), d = id ? stash.find(s => s.id === id) : null;
  $('#edit-title').textContent = d ? 'Edit deal' : 'Add a deal';
  $('#edit-cat').innerHTML = '<option value="auto">🪄 Auto-detect</option>' + CATEGORIES.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
  f.title.value = d?.title || '';
  f.code.value = d?.codes?.join(' ') || '';
  f.discount.value = d?.discountText || (d ? (discountLabel(d.discount) ? `${discountLabel(d.discount).big} ${discountLabel(d.discount).small.toLowerCase()}` : '') : '');
  f.url.value = d?.url || '';
  f.category.value = d ? d.category : 'auto';
  f.notes.value = d?.notes || '';
  $('#edit-dialog').showModal();
}
function saveEditor() {
  const f = $('#edit-form');
  const title = f.title.value.trim();
  if (!title) return;
  const base = makeDeal({ title, url: f.url.value.trim(), snippet: '', kind: 'manual', source: hostOf(f.url.value.trim()) || 'added by you' });
  const discount = parseDiscount(f.discount.value + ' ' + title);
  const codes = f.code.value.toUpperCase().split(/[\s,]+/).filter(Boolean).slice(0, 3);
  const category = f.category.value === 'auto' ? classify(title, f.notes.value) : f.category.value;
  const patch = { title, url: f.url.value.trim(), source: base.source, codes: codes.length ? codes : base.codes, discount, score: discountScore(discount), category, notes: f.notes.value.trim(), discountText: f.discount.value.trim() };
  if (editingId) {
    const i = stash.findIndex(s => s.id === editingId);
    if (i >= 0) stash[i] = { ...stash[i], ...patch };
  } else {
    stash.push({ ...base, ...patch, id: base.id + Date.now().toString(36), savedAt: Date.now(), used: false });
    stashFilter = category;
  }
  saveStash(); renderStash();
  toast(editingId ? 'Updated ✓' : `Added to ${CAT_BY_ID[category].emoji} ${CAT_BY_ID[category].name}!`);
  if (!editingId) burst($('#add-item').getBoundingClientRect(), 50);
}

/* =========================================================
   Clipboard
   ========================================================= */
async function copyCode(code, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(code); ok = true; } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: code });
    ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  if (!ok) { toast('Couldn’t copy. Long-press the code instead.'); return; }
  btn.classList.add('copied');
  $('.cp', btn).textContent = 'copied!';
  setTimeout(() => { btn.classList.remove('copied'); $('.cp', btn).textContent = 'tap to copy'; }, 1800);
  toast(`Copied ${code}. Go pounce! 🐾`);
  burst(btn.getBoundingClientRect());
  buzz([10, 40, 20]);
}

/* =========================================================
   Wire-up
   ========================================================= */
let clearArmed = false;
document.addEventListener('click', e => {
  const t = e.target.closest('button, a, [data-search]');
  if (!t) return;
  const ds = t.dataset;
  if (ds.go) return go(ds.go);
  if (ds.copy) return copyCode(ds.copy, t);
  if (ds.save) return toggleSave(ds.save, t);
  if (ds.search) { go('search'); return runSearch(ds.search); }
  if ('clearRecent' in ds) { recent = []; store.set('recent', recent); return renderRecent(); }
  if (ds.hotCat) { hotFilter = ds.hotCat; buzz(6); return renderHot(); }
  if (ds.stashCat) { stashFilter = ds.stashCat; buzz(6); return renderStash(); }
  if (ds.used) { const d = stash.find(s => s.id === ds.used); if (d) { d.used = !d.used; saveStash(); renderStash(); if (d.used) toast('Nice savings! 🎉'); } return; }
  if (ds.edit) return openEditor(ds.edit);
  if (ds.remove) { stash = stash.filter(s => s.id !== ds.remove); saveStash(); renderStash(); return toast('Removed'); }
  if (ds.move) {
    const li = t.closest('.rank-item'), list = li.parentElement;
    const sib = +ds.move < 0 ? li.previousElementSibling : li.nextElementSibling;
    if (!sib) return;
    if (+ds.move < 0) list.insertBefore(li, sib); else list.insertBefore(sib, li);
    commitList(list); t.focus(); buzz(6);
  }
});

document.addEventListener('pointerdown', e => {
  const h = e.target.closest('.handle');
  if (h && (e.button === 0 || e.pointerType !== 'mouse')) startDrag(e, h);
});
document.addEventListener('change', e => {
  const s = e.target.closest('[data-recat]');
  if (!s) return;
  const d = stash.find(x => x.id === s.dataset.recat);
  if (!d) return;
  d.category = s.value;
  const others = stash.filter(x => x !== d);
  stash = [...others, d];   // lands at the bottom of its new category
  saveStash(); renderStash();
  toast(`Moved to ${CAT_BY_ID[d.category].emoji} ${CAT_BY_ID[d.category].name}`);
});

$('#search-form').addEventListener('submit', e => { e.preventDefault(); $('#q').blur(); runSearch($('#q').value); });
$('#hot-refresh').addEventListener('click', () => loadHot(true));
$('#hot-sort').addEventListener('change', renderHot);
$('#auto-rank').addEventListener('click', autoRank);
$('#toggle-used').addEventListener('click', () => { hideUsed = !hideUsed; renderStash(); });
$('#add-item').addEventListener('click', () => openEditor());
$('#edit-dialog').addEventListener('close', () => { if ($('#edit-dialog').returnValue === 'save') saveEditor(); });

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'promo-pounce', exported: new Date().toISOString(), stash }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'promo-pounce-stash.json' });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('#import').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const j = JSON.parse(await file.text());
    const items = Array.isArray(j) ? j : j.stash;
    if (!Array.isArray(items)) throw new Error('bad');
    const have = new Set(stash.map(s => s.id));
    const add = items.filter(d => d && d.id && d.title && !have.has(d.id))
      .map(d => ({ ...d, category: CAT_BY_ID[d.category] ? d.category : 'other', codes: Array.isArray(d.codes) ? d.codes : [], score: +d.score || 0 }));
    stash.push(...add); saveStash();
    toast(`Imported ${add.length} deal${add.length === 1 ? '' : 's'} ✓`);
  } catch { toast('That file isn’t a Promo Pounce export.'); }
  e.target.value = '';
});
$('#clear-stash').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!clearArmed) {
    clearArmed = true; b.textContent = 'Tap again to clear';
    setTimeout(() => { clearArmed = false; b.textContent = 'Clear stash'; }, 3000);
    return;
  }
  stash = []; saveStash(); clearArmed = false; b.textContent = 'Clear stash'; toast('Stash cleared');
});

/* ---------- Playful rotating text ---------- */
const TAGLINES = ['sniffing out savings…', 'no code left behind', 'pounce first, pay less', 'nine lives, zero full price', 'cat-like reflexes for coupons'];
const PLACEHOLDERS = ['airpods pro', 'nike running shoes', 'dyson vacuum', 'lego star wars', 'sephora', 'ninja air fryer', 'hotels in denver', 'ps5 controller'];
let tick = 0;
setInterval(() => {
  tick++;
  $('#tagline').textContent = TAGLINES[tick % TAGLINES.length];
  if (document.activeElement !== $('#q')) $('#q').placeholder = PLACEHOLDERS[tick % PLACEHOLDERS.length];
}, 3500);

/* ---------- Boot ---------- */
applySettings();
initSettingsUI();
renderRecent();
updateStashCount();
$('#stash-count').textContent = stash.filter(s => !s.used).length;
go((location.hash || '#search').slice(1), false);
addEventListener('hashchange', () => go((location.hash || '#search').slice(1), false));
loadHot();           // warm up the Hot list (also used for "similar" local matches)
const sp = new URLSearchParams(location.search).get('q');
if (sp) runSearch(sp);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}
