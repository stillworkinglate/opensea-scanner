export interface Deal {
  id: string;
  collection: string;
  tokenId: string;
  name?: string;
  askPrice: number;
  bestOffer: number;
  ratio: number;
  imageUrl: string;
  openseaUrl: string;
  contractAddress?: string;
  // USD conversions (when ETH price successfully fetched from Hyperliquid)
  askPriceUsd?: number;
  bestOfferUsd?: number;
}

export interface ScanRequest {
  slugs: string[];
  threshold: number;
  apiKey?: string;
}

export interface ScanResponse {
  deals: Deal[];
  scannedAt: string;
  errors: string[];
  totalListingsScanned: number;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number; // unix timestamp seconds
  };
  scanStats?: {
    listingsFetched: number;
    collectionBestOffer: number;
    candidates: number;
    refined: number;
    pagesListings?: number;
    pagesOffers?: number;
  };
  // ETH price used for this scan (from Hyperliquid allMids, for USD conversion transparency)
  ethPriceUsd?: number;

  // Transparency / debugging info (backend only for now)
  successfulCollections?: string[];
  skippedCollections?: Array<{ slug: string; reason: string }>;
}

export type RefreshInterval = "manual" | "30s" | "60s" | "5min";
