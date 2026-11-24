# 🐾 Promo Pounce

A playful, installable phone app that hunts the web for **promo codes, coupons and sales**.

**▶ Open the app:** https://chadant1.github.io/promo-pounce/

## Install it on your phone
- **iPhone (Safari):** open the link → Share button → **Add to Home Screen**
- **Android (Chrome):** open the link → ⋮ menu → **Install app** (or *Add to Home screen*)

It then launches full-screen from your home screen like any other app, and the app itself works offline.

## What it does
| Tab | What you get |
|---|---|
| 🔍 **Search** | Type any item or store. Searches the web (DuckDuckGo, or Google via Serper) **and** Slickdeals live deals, then pulls out codes (`use code SAVE20`), % off, $ off and sale prices. Results are grouped into **Codes found**, **Live deals**, **Coupon pages**, and **Similar items** (e.g. *AirPods → wireless earbuds*) so you still get a deal when the exact item has no code. |
| 🔥 **Hot** | A fresh list of trending deals, rebuilt every 3 hours by GitHub Actions. Filter by category and sort by biggest discount, newest, or codes first. |
| 🏆 **Stash** | Saved deals, **auto-sorted into categories** (Electronics, Fashion, Home, Beauty, Food, Travel, Toys, Sports, Pets, Health, Auto, Media). **Drag ⠿ to rank each category from greatest to least**, or tap ✨ *Auto-rank* to order by discount. Add your own codes with ＋, mark codes used, edit, and move items between categories. |
| 🎨 **Style** | 6 themes (Neon Arcade, Candy Pop, Sunset, Mint Fresh, Midnight, Paper), accent color wheel, text size, roundness, cozy/compact density, list/grid layout, and toggles for animations, floating blobs, confetti, haptics and descriptions. |

Tap any code to copy it (with confetti 🎉).

## Search sources
Works free with no setup. Optional keys (stored only on your device) under **Style → Search power**:
- **Serper.dev** key: Google results (free tier available at serper.dev)
- **Jina AI** key: higher limits for the free reader used to reach DuckDuckGo and Slickdeals

> Codes come from public posts and coupon sites. They can expire or have exclusions, so check the store's terms at checkout.

## How it's built
Plain HTML/CSS/JavaScript, with no build step and no dependencies.

```
index.html, styles.css      app shell + themes
js/app.js                   UI, search, stash/ranking, settings
js/deal-utils.js            categorizer, code & discount parsing (shared with the feed script)
sw.js, manifest.webmanifest offline support + installability
scripts/fetch-deals.mjs     builds data/deals.json for the Hot tab
.github/workflows/deploy.yml  refreshes deals every 3h and deploys to GitHub Pages
```

Run locally: `python3 -m http.server` in this folder, then open http://localhost:8000.

Want a true app-store build later? The app can be wrapped with [Capacitor](https://capacitorjs.com/) to produce Android/iOS packages.
