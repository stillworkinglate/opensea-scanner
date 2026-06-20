# OpenSea Scanner

Find NFT listings on OpenSea where the best offer is unusually close to the asking price — a signal that a seller may be able to accept an offer near their list price, or that a buyer could flip instantly when the bid exceeds the ask.

Built with Next.js. Runs locally or deploys to any Node.js host.

## What it does

OpenSea Scanner watches the collections you choose and surfaces deals where:

```
offer-to-ask ratio ≥ your threshold   (default 90%)
```

For each match you get the collection, token, ask price, best offer (net of fees), ratio, and a direct link to the listing on OpenSea.

### How scanning works

The scanner compares **collection-level bids** against the **cheapest live listings** for each collection — roughly 2–12 OpenSea API calls per collection, deterministic and rate-limit friendly:

1. **Best listings** — fetch up to 100 cheapest live listings (`/listings/collection/{slug}/best`)
2. **Collection bid** — fetch collection-wide offers and take the representative top net bid (gross minus protocol fees)
3. **Match** — compute `ratio = bestOffer ÷ ask` for every listing; keep matches above your threshold
4. **Refine** — optionally verify the top candidates with the per-NFT `/best` endpoint (captures trait offers that beat the collection bid)
5. **Enrich** — fill in missing images from the NFT metadata endpoint (bounded concurrency)

ETH/USD conversion uses the [Hyperliquid](https://hyperliquid.xyz) public mid price API, cached for 30 seconds.

## Features

- Multi-collection batch scanning (up to 20 collections per request)
- Adjustable ratio threshold (70%–100%) and minimum ask price filter
- Collection search powered by the OpenSea API
- Auto-refresh on 30s / 60s / 5min intervals
- Rate-limit awareness with cooldown display
- Light / dark theme
- CSV export of filtered results
- Preferences saved in the browser (collections, threshold, refresh settings)

## Quick start

### Prerequisites

- Node.js 20.9+ (22 LTS recommended)
- An [OpenSea API key](https://docs.opensea.io/reference/api-overview)

### 1. Clone and install

```bash
git clone https://github.com/stillworkinglate/opensea-scanner.git
cd opensea-scanner
npm install
```

### 2. Configure your API key

```bash
cp .env.example .env
```

Add your key to `.env`:

```env
OPENSEA_API_KEY=your_key_here
```

> **Recommended for production:** keep the key server-side via `OPENSEA_API_KEY`. The app never exposes it in the client when configured this way.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. Add one or more collection slugs (search or paste, e.g. `azuki`)
2. Set your ratio threshold
3. Click **Scan**

## API key options

| Setup | Best for | How |
|-------|----------|-----|
| **Server env** | Production / self-hosted | Set `OPENSEA_API_KEY` in `.env` |
| **Sidebar key** | Local development | Enter key in the sidebar — stored in `localStorage` only |

The server env key takes precedence when both are present.

## Configuration

All scanner settings are available in the UI:

| Setting | Description |
|---------|-------------|
| **Collections** | OpenSea collection slugs to monitor (max 20 per scan) |
| **Ratio threshold** | Minimum `best offer ÷ ask price` to surface a deal |
| **Min ask price** | Client-side filter on listing price (ETH) |
| **Refresh interval** | Manual, 30s, 60s, or 5min |
| **Auto-refresh** | Automatically re-scan on the chosen interval |

Scanner preferences persist in `localStorage` under `opensea_scanner_prefs`.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── scan/route.ts      # POST — scan collections for deals
│   │   └── search/route.ts    # GET/POST — search OpenSea collections
│   ├── page.tsx               # Main dashboard
│   └── layout.tsx
├── components/                # UI components
├── lib/
│   ├── opensea.ts             # OpenSea API client + deal engine
│   ├── rate-limit.ts          # In-memory per-IP rate limiting
│   ├── api-key.ts             # Server/client key resolution
│   ├── types.ts
│   └── utils.ts
└── store/
    └── useScannerStore.ts     # Zustand scanner state
```

## API routes

### `POST /api/scan`

```json
{
  "slugs": ["azuki", "doodles-official"],
  "threshold": 0.9,
  "apiKey": "optional — only needed if OPENSEA_API_KEY is not set server-side"
}
```

Returns matching deals, scan stats, rate-limit headers, and per-collection errors.

### `POST /api/search`

```json
{
  "query": "bored ape",
  "limit": 8,
  "apiKey": "optional"
}
```

Returns matching OpenSea collections for the sidebar search dropdown.

## Rate limits

The app respects OpenSea's `x-ratelimit-*` response headers and applies its own per-IP limits on `/api/scan` (10/min) and `/api/search` (30/min) to prevent abuse.

When OpenSea quota is low, the UI shows a cooldown timer and pauses scans until the reset window passes.

> In-memory rate limits reset on server restart and are not shared across multiple serverless instances. For high-traffic public deployments, consider a shared store (Redis, Upstash, etc.).

## Deploy

Works on Vercel, Railway, Fly.io, or any platform that runs Next.js 16.

```bash
npm run build
npm start
```

Set `OPENSEA_API_KEY` as an environment variable in your hosting dashboard. Do not commit `.env` to version control.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Zustand](https://zustand.docs.pmnd.rs) — client state
- [TanStack Table](https://tanstack.com/table) — deal table
- [OpenSea API v2](https://docs.opensea.io/reference/api-overview)

## Contributing

Contributions are welcome. To propose a change:

1. Fork the repo
2. Create a branch (`git checkout -b fix/something`)
3. Commit your changes
4. Open a pull request

Please keep PRs focused and include a short description of what changed and why.

## Security

- Never commit API keys or `.env` files
- Prefer `OPENSEA_API_KEY` as a server environment variable in production
- A sidebar key is sent to your own `/api/*` routes over HTTPS — acceptable for local use, not ideal for multi-user public deployments

## License

[MIT](LICENSE)