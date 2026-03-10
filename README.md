# AffiliateHunter 🎯
### AI-Powered Affiliate Program Discovery, Auto-Join & Click Tracking

AffiliateHunter automatically finds affiliate programs for your niche, scores and prioritises them,
attempts to auto-join them, and gives you tracking links that forward clicks from your website
to affiliate destinations — logging every click in real time.

---

## Architecture

```
Your Website  ──────►  /c/:slug  ──────►  Affiliate Destination
                           │
                     (logs click)
                           │
                      Dashboard ◄──── WebSocket real-time updates
```

## Core Features

| Feature | Description |
|---|---|
| **Discover** | AI + web search finds affiliate programs for any keyword/niche |
| **Score**    | Each program scored 0–100 by commission, cookie, EPC, network |
| **Auto-Join**| Puppeteer fills signup forms on ShareASale, CJ, ClickBank, direct |
| **Track**    | Every `/c/slug` click logged with country, device, referrer |
| **Redirect** | Instant 302 forward to affiliate — visitor sees no difference |
| **Dashboard**| Real-time click feed, charts, per-program earnings |
| **Snippet**  | One JS snippet auto-replaces links on your site |
| **Postback** | Conversion tracking via standard postback URL |

---

## Quick Start (Docker)

```bash
git clone https://github.com/yourname/affiliatehunter
cd affiliatehunter
cp .env.example .env
# Edit .env — add GEMINI_API_KEY at minimum
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001
- Tracker:  http://localhost:3001/c/:slug

---

## Manual Setup

```bash
# Backend
cd backend && npm install
cp ../.env.example ../.env  # fill in your values
npm run dev

# Frontend (new terminal)
cd frontend && npm install
npm run dev
```

---

## How Click-Back Tracking Works

1. AffiliateHunter creates a tracking link: `https://yourtracker.com/c/product-name-xyz`
2. You put this link on your website instead of the raw affiliate link
3. Visitor clicks it → our server logs country + device + referrer → instantly redirects them
4. Affiliate sees a normal referral, you earn commission if they buy
5. Dashboard shows every click in real time

### Adding to your website manually

```html
<!-- Instead of: -->
<a href="https://affiliate.com/?ref=YOURCODE">Check this out</a>

<!-- Use: -->
<a href="https://yourtracker.com/c/affiliate-slug">Check this out</a>
```

### Auto snippet (replaces links automatically)

Add the snippet from the "Website Snippet" page to your site's `<head>`.
It auto-detects and replaces all matching affiliate links on page load.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `GEMINI_API_KEY` | Recommended | Google Gemini AI for program enrichment |
| `SERPAPI_KEY` | Optional | Better search results (falls back to DuckDuckGo) |
| `BACKEND_URL` | ✅ | Public URL of your backend (for tracking links) |
| `ADMIN_PASSWORD` | ✅ | Dashboard login password |

---

## API Overview

| Method | Path | Description |
|---|---|---|
| POST | /api/search | Start affiliate program search |
| GET  | /api/programs | List all programs (sorted by score) |
| POST | /api/join/:id | Auto-join a program |
| POST | /api/join/bulk | Auto-join multiple programs |
| GET  | /c/:slug | Click tracker + redirect |
| GET  | /c/postback | Conversion postback receiver |
| GET  | /api/analytics/summary | Dashboard stats |
| GET  | /api/settings/snippet | Get JS snippet for your website |

---

## Deploy to Render.com

1. Push to GitHub
2. New → Blueprint → select your repo
3. Render reads `render.yaml` and creates backend + frontend + DB
4. Set environment variables in Render dashboard
5. Update `BACKEND_URL` to your Render backend URL

**Important:** Set `BACKEND_URL` to your actual backend URL so tracking links point to the right place.
