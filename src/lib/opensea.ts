import { Deal } from "./types";
import { getNftFallbackImage } from "./utils";

const OPENSEA_API_BASE = "https://api.opensea.io/api/v2";
const FETCH_TIMEOUT_MS = 15_000;
const IMAGE_ENRICH_CONCURRENCY = 4;
/** Max per-NFT /best lookups per collection (rate-limit budget). */
const REFINEMENT_CAP = 40;
const MAX_SANITY_RATIO = 5;
/** Loose pre-screen multiplier — cast a wide net, then verify every deal via /best. */
const PRESCREEN_THRESHOLD_FACTOR = 0.75;

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // seconds since epoch
}

interface PriceField {
  value?: string;
  currency?: string;
  decimals?: number;
  current?: { value?: string; currency?: string; decimals?: number };
}

interface ProtocolItem {
  itemType?: number;
  token?: string;
  identifierOrCriteria?: string;
  startAmount?: string;
}

interface OpenSeaOffer {
  price?: PriceField;
  protocol_data?: {
    parameters?: {
      offer?: ProtocolItem[];
      consideration?: ProtocolItem[];
    };
  };
  asset?: { identifier?: string };
  criteria?: { encoded_token_ids?: string };
}

interface OpenSeaSearchHit {
  type?: string;
  collection?: {
    collection: string;
    name?: string;
    image_url?: string;
    opensea_url?: string;
  };
}

interface Listing {
  order_hash?: string;
  chain?: string;
  type?: string;
  price?: PriceField;
  protocol_data?: {
    parameters?: {
      offer?: ProtocolItem[];
    };
  };
  asset?: {
    identifier?: string;
    contract?: string;
    collection?: string;
    name?: string;
    image_url?: string;
  };
  token?: {
    identifier?: string;
    collection?: string;
    contract?: string;
    name?: string;
    image_url?: string;
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) await fn(item);
      }
    }
  );
  await Promise.all(workers);
}

function priceToNumber(price?: PriceField | null): number {
  if (!price) return 0;

  const raw = price.current?.value ?? price.value;
  const decimals = price.current?.decimals ?? price.decimals ?? 18;

  if (!raw) return 0;
  const num = parseFloat(raw);
  if (isNaN(num)) return 0;
  return num / 10 ** decimals;
}

function netOfferAmount(offer: OpenSeaOffer): number {
  const params = offer?.protocol_data?.parameters;
  const offerItem = params?.offer?.[0];

  let gross = 0;
  if (offerItem?.startAmount) {
    const decimals = offer.price?.decimals ?? 18;
    gross = parseFloat(offerItem.startAmount) / 10 ** decimals;
  } else {
    gross = priceToNumber(offer.price);
  }

  if (gross <= 0) return 0;

  const decimals = offer.price?.decimals ?? 18;
  let fees = 0;
  for (const item of params?.consideration ?? []) {
    const itemType = item.itemType;
    if (itemType === 0 || itemType === 1) {
      if (item.startAmount) {
        fees += parseFloat(item.startAmount) / 10 ** decimals;
      }
    }
  }

  return Math.max(0, gross - fees);
}

function extractRateLimit(res: Response): RateLimitInfo | undefined {
  const limit = parseInt(res.headers.get("x-ratelimit-limit") || "0");
  const remaining = parseInt(res.headers.get("x-ratelimit-remaining") || "0");
  const reset = parseInt(res.headers.get("x-ratelimit-reset") || "0");
  if (limit > 0) {
    return {
      limit,
      remaining: isNaN(remaining) ? 0 : remaining,
      reset: isNaN(reset) ? 0 : reset,
    };
  }
  return undefined;
}

function mergeRateLimits(limits: RateLimitInfo[]): RateLimitInfo | undefined {
  if (limits.length === 0) return undefined;
  return {
    limit: Math.max(...limits.map((r) => r.limit)),
    remaining: Math.min(...limits.map((r) => r.remaining)),
    reset: Math.max(...limits.map((r) => r.reset)),
  };
}

function listingTokenId(listing: Listing): string {
  const fromAsset = listing.asset?.identifier ?? listing.token?.identifier;
  if (fromAsset) return String(fromAsset);

  const fromProtocol =
    listing.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria;
  return fromProtocol ? String(fromProtocol) : "";
}

function listingAskPrice(listing: Listing): number {
  return priceToNumber(listing.price);
}

function listingImageUrl(listing: Listing): string | undefined {
  const asset = listing.asset || listing.token;
  return asset?.image_url;
}

// Simple in-memory cache for ETH price from Hyperliquid (for USD conversion + transparency)
let ethPriceCache: { price: number; timestamp: number } | null = null;
const ETH_PRICE_TTL_MS = 30_000;

export async function fetchEthUsdPrice(): Promise<number> {
  const now = Date.now();
  if (ethPriceCache && now - ethPriceCache.timestamp < ETH_PRICE_TTL_MS) {
    return ethPriceCache.price;
  }

  try {
    const res = await fetchWithTimeout("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });

    if (!res.ok) throw new Error(`Hyperliquid ${res.status}`);

    const mids = await res.json();
    const price = parseFloat(mids?.ETH ?? "0");
    if (price > 0) {
      ethPriceCache = { price, timestamp: now };
      return price;
    }
  } catch {
    console.warn(
      "Hyperliquid ETH price fetch failed, using cache/fallback if available"
    );
  }

  return ethPriceCache?.price ?? 0;
}

async function fetchBestListings(
  slug: string,
  apiKey: string,
  max = 100
): Promise<{
  listings: Listing[];
  rateLimit?: RateLimitInfo;
  pages: number;
  error?: string;
}> {
  const allListings: Listing[] = [];
  let nextCursor: string | undefined;
  let lastRate: RateLimitInfo | undefined;
  let pages = 0;
  const pageSize = 100;

  while (allListings.length < max) {
    let url = `${OPENSEA_API_BASE}/listings/collection/${slug}/best?limit=${pageSize}`;
    if (nextCursor) url += `&next=${nextCursor}`;

    const res = await fetchWithTimeout(url, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });

    lastRate = extractRateLimit(res) || lastRate;

    if (res.status === 429) {
      return {
        listings: allListings,
        rateLimit: lastRate,
        pages,
        error: "Rate limited by OpenSea while fetching listings",
      };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        listings: allListings,
        rateLimit: lastRate,
        pages,
        error: `OpenSea listings ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
      };
    }

    const data = await res.json();
    const page: Listing[] = data.listings || data.results || [];
    allListings.push(...page);
    pages++;
    nextCursor = data.next;

    if (!nextCursor || page.length < pageSize || allListings.length >= max) break;

    await sleep(100);
  }

  return {
    listings: allListings.slice(0, max),
    rateLimit: lastRate,
    pages,
  };
}

const MIN_SIGNIFICANT_BID_ETH = 0.1;
/** Gap ratio that separates stale outlier clusters from the floor bid group. */
const OUTLIER_CLUSTER_RATIO = 1.35;
/** Top two bids within this ratio are considered the same cluster. */
const FLOOR_CLUSTER_TOLERANCE = 1.25;

function collectionBestNetBid(offers: OpenSeaOffer[]): number {
  let nets = offers
    .map(netOfferAmount)
    .filter((n) => n >= MIN_SIGNIFICANT_BID_ETH)
    .sort((a, b) => b - a);

  if (nets.length === 0) return 0;
  if (nets.length === 1) return nets[0];

  // Peel off stale high clusters until the top two bids sit in the same floor group.
  while (nets.length > 1) {
    if (nets[0] <= nets[1] * FLOOR_CLUSTER_TOLERANCE) {
      return nets[0];
    }

    const scanDepth = Math.min(nets.length - 1, 8);
    let cutAt = -1;
    for (let i = 0; i < scanDepth; i++) {
      if (nets[i] > nets[i + 1] * OUTLIER_CLUSTER_RATIO) {
        cutAt = i;
        break;
      }
    }
    if (cutAt < 0) return nets[0];
    nets = nets.slice(cutAt + 1);
  }

  return nets[0];
}

async function fetchCollectionBestOffer(
  slug: string,
  apiKey: string
): Promise<{
  bestOffer: number;
  rateLimit?: RateLimitInfo;
  pages: number;
  error?: string;
}> {
  const url = `${OPENSEA_API_BASE}/offers/collection/${slug}?limit=100`;
  const res = await fetchWithTimeout(url, {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
  });

  const rateLimit = extractRateLimit(res);

  if (res.status === 429) {
    return {
      bestOffer: 0,
      rateLimit,
      pages: 0,
      error: "Rate limited by OpenSea while fetching offers",
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      bestOffer: 0,
      rateLimit,
      pages: 0,
      error: `OpenSea offers ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
    };
  }

  const data = await res.json();
  const offers: OpenSeaOffer[] = data.offers || data.results || [];
  const bestOffer = collectionBestNetBid(offers);

  return { bestOffer, rateLimit, pages: 1 };
}

async function fetchNftBestOffer(
  slug: string,
  tokenId: string,
  apiKey: string
): Promise<{ bestOffer: number; rateLimit?: RateLimitInfo; error?: string }> {
  const url = `${OPENSEA_API_BASE}/offers/collection/${slug}/nfts/${tokenId}/best`;
  const res = await fetchWithTimeout(url, {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
  });

  const rateLimit = extractRateLimit(res);

  if (res.status === 429) {
    return {
      bestOffer: 0,
      rateLimit,
      error: "Rate limited while fetching NFT best offer",
    };
  }
  if (!res.ok) {
    return { bestOffer: 0, rateLimit };
  }

  const data = await res.json();
  const offer: OpenSeaOffer | undefined = data.offer ?? data;
  if (!offer || typeof offer !== "object") {
    return { bestOffer: 0, rateLimit };
  }

  return { bestOffer: netOfferAmount(offer), rateLimit };
}

export async function searchCollections(
  query: string,
  apiKey?: string,
  limit = 10
): Promise<
  Array<{
    slug: string;
    name: string;
    image_url?: string;
    opensea_url?: string;
  }>
> {
  if (!query || !query.trim()) return [];

  const url = `${OPENSEA_API_BASE}/search?query=${encodeURIComponent(query)}&limit=${Math.min(limit, 50)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;

  try {
    const res = await fetchWithTimeout(url, { headers });
    if (!res.ok) {
      console.error(`OpenSea search failed for "${query}": ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = data.results || [];

    return results
      .filter((r: OpenSeaSearchHit) => r?.type === "collection" && r.collection)
      .map((r: OpenSeaSearchHit) => {
        const c = r.collection!;
        return {
          slug: c.collection,
          name: c.name || c.collection,
          image_url: c.image_url,
          opensea_url: c.opensea_url,
        };
      });
  } catch (err) {
    console.error("Search collections error:", err);
    return [];
  }
}

async function enrichImages(deals: Deal[], apiKey: string) {
  const toEnrich = deals.slice(0, 30);
  await runWithConcurrency(toEnrich, IMAGE_ENRICH_CONCURRENCY, async (deal) => {
    if (!deal.contractAddress) return;
    try {
      const url = `${OPENSEA_API_BASE}/chain/ethereum/contract/${deal.contractAddress}/nfts/${deal.tokenId}`;
      const res = await fetchWithTimeout(url, {
        headers: { "x-api-key": apiKey, Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const img = data?.nft?.image_url || data?.nft?.display_image_url;
        if (img) {
          deal.imageUrl = img;
        }
      }
      await sleep(80);
    } catch {
      // ignore enrichment errors
    }
  });
}

interface DealCandidate {
  listing: Listing;
  tokenId: string;
  askPrice: number;
  bestOffer: number;
  ratio: number;
}

function buildDeal(
  candidate: DealCandidate,
  slug: string,
  ethUsd: number
): Deal {
  const { listing, tokenId, askPrice, bestOffer, ratio } = candidate;
  const asset = listing.asset || listing.token || {};
  const chain = (listing.chain || "ethereum").toLowerCase();
  const contract = asset.contract;
  const openseaUrl = contract
    ? `https://opensea.io/item/${chain}/${contract}/${tokenId}`
    : `https://opensea.io/item/${slug}/${tokenId}`;
  const imageUrl =
    listingImageUrl(listing) || getNftFallbackImage(tokenId, slug);

  return {
    id: `${slug}-${tokenId}`,
    collection: slug,
    tokenId,
    name: `#${tokenId}`,
    askPrice: Math.round(askPrice * 10000) / 10000,
    bestOffer: Math.round(bestOffer * 10000) / 10000,
    ratio: Math.round(ratio * 1000) / 1000,
    imageUrl,
    openseaUrl,
    contractAddress: contract,
    askPriceUsd:
      ethUsd > 0 ? Math.round(askPrice * ethUsd * 100) / 100 : undefined,
    bestOfferUsd:
      ethUsd > 0 ? Math.round(bestOffer * ethUsd * 100) / 100 : undefined,
  };
}

export async function fetchDealsForCollection(
  slug: string,
  apiKey: string,
  threshold: number,
  ethPriceUsd?: number,
  maxListings = 100
): Promise<{
  deals: Deal[];
  error?: string;
  listingsCount: number;
  rateLimit?: RateLimitInfo;
  scanStats?: {
    listingsFetched: number;
    collectionBestOffer: number;
    candidates: number;
    refined: number;
    pagesListings?: number;
    pagesOffers?: number;
  };
  ethPriceUsd?: number;
}> {
  const collectedRateLimits: RateLimitInfo[] = [];

  const emptyStats = {
    listingsFetched: 0,
    collectionBestOffer: 0,
    candidates: 0,
    refined: 0,
    pagesListings: 0,
    pagesOffers: 0,
  };

  try {
    const ethUsd = ethPriceUsd ?? (await fetchEthUsdPrice());

    const listingsResult = await fetchBestListings(slug, apiKey, maxListings);
    const listingsCount = listingsResult.listings.length;
    if (listingsResult.rateLimit) {
      collectedRateLimits.push(listingsResult.rateLimit);
    }
    if (listingsResult.error) {
      return {
        deals: [],
        error: listingsResult.error,
        listingsCount,
        rateLimit: listingsResult.rateLimit,
        scanStats: {
          ...emptyStats,
          listingsFetched: listingsCount,
          pagesListings: listingsResult.pages,
        },
        ethPriceUsd: ethUsd > 0 ? ethUsd : undefined,
      };
    }

    const offersResult = await fetchCollectionBestOffer(slug, apiKey);
    if (offersResult.rateLimit) {
      collectedRateLimits.push(offersResult.rateLimit);
    }
    if (offersResult.error) {
      return {
        deals: [],
        error: offersResult.error,
        listingsCount,
        rateLimit: mergeRateLimits(collectedRateLimits),
        scanStats: {
          ...emptyStats,
          listingsFetched: listingsCount,
          pagesListings: listingsResult.pages,
          pagesOffers: offersResult.pages,
        },
        ethPriceUsd: ethUsd > 0 ? ethUsd : undefined,
      };
    }

    const collectionBestOffer = offersResult.bestOffer;
    if (collectionBestOffer <= 0) {
      return {
        deals: [],
        listingsCount,
        rateLimit: mergeRateLimits(collectedRateLimits),
        scanStats: {
          listingsFetched: listingsCount,
          collectionBestOffer: 0,
          candidates: 0,
          refined: 0,
          pagesListings: listingsResult.pages,
          pagesOffers: offersResult.pages,
        },
        ethPriceUsd: ethUsd > 0 ? ethUsd : undefined,
      };
    }

    const candidates: DealCandidate[] = [];
    const seenTokenIds = new Set<string>();

    for (const listing of listingsResult.listings) {
      const tokenId = listingTokenId(listing);
      if (!tokenId || seenTokenIds.has(tokenId)) continue;
      seenTokenIds.add(tokenId);

      const askPrice = listingAskPrice(listing);
      if (askPrice <= 0) continue;

      const prescreenRatio = collectionBestOffer / askPrice;
      const prescreenMin = threshold * PRESCREEN_THRESHOLD_FACTOR;
      if (prescreenRatio >= prescreenMin && prescreenRatio <= MAX_SANITY_RATIO) {
        candidates.push({
          listing,
          tokenId,
          askPrice,
          bestOffer: collectionBestOffer,
          ratio: prescreenRatio,
        });
      }
    }

    // Cheapest asks first — prioritize floor items for the /best verification budget.
    candidates.sort(
      (a, b) =>
        a.askPrice - b.askPrice ||
        b.ratio - a.ratio ||
        a.tokenId.localeCompare(b.tokenId)
    );

    let refined = 0;
    const verified: DealCandidate[] = [];
    const toRefine = candidates.slice(0, REFINEMENT_CAP);

    for (const candidate of toRefine) {
      const refinedResult = await fetchNftBestOffer(
        slug,
        candidate.tokenId,
        apiKey
      );
      refined++;

      if (refinedResult.rateLimit) {
        collectedRateLimits.push(refinedResult.rateLimit);
      }
      if (refinedResult.error) {
        break;
      }

      if (refinedResult.bestOffer <= 0) continue;

      const ratio = refinedResult.bestOffer / candidate.askPrice;
      if (ratio >= threshold && ratio <= MAX_SANITY_RATIO) {
        verified.push({
          ...candidate,
          bestOffer: refinedResult.bestOffer,
          ratio,
        });
      }

      await sleep(90);
    }

    const deals = verified.map((c) => buildDeal(c, slug, ethUsd));

    deals.sort(
      (a, b) => b.ratio - a.ratio || a.tokenId.localeCompare(b.tokenId)
    );

    if (apiKey && deals.length > 0) {
      await enrichImages(deals, apiKey);
    }

    return {
      deals,
      listingsCount,
      rateLimit: mergeRateLimits(collectedRateLimits),
      scanStats: {
        listingsFetched: listingsCount,
        collectionBestOffer,
        candidates: candidates.length,
        refined,
        pagesListings: listingsResult.pages,
        pagesOffers: offersResult.pages,
      },
      ethPriceUsd: ethUsd > 0 ? ethUsd : undefined,
    };
  } catch (err: unknown) {
    return {
      deals: [],
      error: err instanceof Error ? err.message : String(err),
      listingsCount: 0,
      scanStats: emptyStats,
      ethPriceUsd: undefined,
    };
  }
}