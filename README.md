# ekoo

Find one thing to do this week. ekoo lets people **join a verified volunteering activity** or **help a neighbour within 3 km**, built from the ekoo research deck (UNV/GeoPoll 2026, CRY × Grant Thornton Bharat and others).

## What you get

- **Desktop web app** on laptops and larger screens (≥ 1024 px): side rail, editorial hero, split list and live map, detail drawers, two-pane Start a drive with a live WhatsApp preview.
- **Native-style mobile app** on phones and small tablets (< 1024 px): iOS-style push navigation with edge swipe-back, collapsing large titles, glass tab bar, draggable bottom sheets, pull-to-refresh, long-press menus, banner notifications and haptics.
- The view switches automatically and live as the window crosses 1024 px. The server guesses from the user agent first, so the right launch screen shows before the page measures the window.
- **No login.** Everything works as a guest: no account, OTP or email. Progress (joined activities, drives, requests, chats, settings) is kept on the device in `localStorage`, under a random guest id.
- Light and dark themes, English and Hindi, installable as a home-screen app (web manifest and icons).
- Deep links: `/?screen=detail`, `help`, `community`, `activity`, `me`, `chat`, `drive`, `ask`.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- UI engine in `src/engine/` (framework-free renderers for the two shells, sharing one state and data layer)
- Self-hosted variable fonts via Fontsource: Bricolage Grotesque, Golos Text, Noto Sans Devanagari

## API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/catalog` | GET | Activities, requests, groups and posts |
| `/api/activity` | POST | Guest activity log (`join`, `offer`, `drive`, `ask`, `feedback`) |
| `/api/health` | GET | Health check |

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Deploy

Import the GitHub repository in Vercel (New Project → Import Git Repository). Framework preset: Next.js. No environment variables are needed. Every push to `main` deploys to production.

## Project layout

```
src/app/            routes, layout, API, manifest, icons
src/components/     EkooApp: picks and mounts the desktop or mobile shell
src/engine/         core.js (state, data, actions), desktop.js, mobile.js, runtime.js
src/styles/         design tokens and shell styles
src/data/           catalog.json (sample data shown in the app)
```
