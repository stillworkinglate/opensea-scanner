import { NextRequest, NextResponse } from "next/server";
import { fetchDealsForCollection, fetchEthUsdPrice } from "@/lib/opensea";
import { resolveOpenSeaApiKey } from "@/lib/api-key";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { Deal, ScanRequest, ScanResponse } from "@/lib/types";
import { isValidCollectionSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

const scanRateLimit = createRateLimiter(10, 60_000);
const MAX_SLUGS_PER_REQUEST = 20;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!scanRateLimit.check(ip)) {
      return NextResponse.json(
        { error: "Too many scans. Please wait a minute." },
        { status: 429 }
      );
    }

    const body: ScanRequest = await request.json();

    const rawSlugs = Array.isArray(body.slugs) ? body.slugs.filter(Boolean) : [];
    const slugs = rawSlugs
      .map((s) => String(s).trim().toLowerCase())
      .filter((s) => isValidCollectionSlug(s));

    const invalidSlugs = rawSlugs
      .map((s) => String(s).trim().toLowerCase())
      .filter((s) => s && !isValidCollectionSlug(s));

    const threshold = Number.isFinite(body.threshold) ? body.threshold : 0.9;
    const apiKey = resolveOpenSeaApiKey(body.apiKey);

    if (!slugs.length) {
      const message = invalidSlugs.length
        ? "No valid collection slugs provided"
        : "No collections provided";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (slugs.length > MAX_SLUGS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Maximum ${MAX_SLUGS_PER_REQUEST} collections per scan` },
        { status: 400 }
      );
    }
    if (threshold < 0.7 || threshold > 1) {
      return NextResponse.json(
        { error: "Threshold must be between 0.70 and 1.00" },
        { status: 400 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OpenSea API key required. Set OPENSEA_API_KEY in .env or enter a key in the sidebar.",
        },
        { status: 401 }
      );
    }

    const allDeals: Deal[] = [];
    const errors: string[] = [];
    if (invalidSlugs.length) {
      errors.push(`Invalid slugs skipped: ${invalidSlugs.join(", ")}`);
    }

    let totalListingsScanned = 0;
    const rateLimitsSeen: Array<NonNullable<ScanResponse["rateLimit"]>> = [];
    const successfulCollections: string[] = [];
    const skippedCollections: Array<{ slug: string; reason: string }> = [];
    const totalStats = {
      listingsFetched: 0,
      collectionBestOffer: 0,
      candidates: 0,
      refined: 0,
      pagesListings: 0,
      pagesOffers: 0,
    };

    let ethPriceUsd: number | undefined;
    try {
      const p = await fetchEthUsdPrice();
      if (p > 0) ethPriceUsd = p;
    } catch {
      // non-fatal
    }

    for (const slug of slugs) {
      const result = await fetchDealsForCollection(
        slug,
        apiKey,
        threshold,
        ethPriceUsd
      );

      totalListingsScanned += result.listingsCount || 0;

      if (result.rateLimit) {
        rateLimitsSeen.push(result.rateLimit);
      }

      const s = result.scanStats;
      if (s) {
        totalStats.listingsFetched += s.listingsFetched || 0;
        totalStats.candidates += s.candidates || 0;
        totalStats.refined += s.refined || 0;
        totalStats.collectionBestOffer = Math.max(
          totalStats.collectionBestOffer,
          s.collectionBestOffer || 0
        );
        totalStats.pagesListings += s.pagesListings || 0;
        totalStats.pagesOffers += s.pagesOffers || 0;
      }

      if (result.error) {
        errors.push(`${slug}: ${result.error}`);
        skippedCollections.push({ slug, reason: result.error });
        continue;
      }

      if (result.deals.length > 0) {
        allDeals.push(...result.deals);
        successfulCollections.push(slug);
      } else {
        skippedCollections.push({
          slug,
          reason: "no qualifying offers found",
        });
      }

      await new Promise((r) => setTimeout(r, 450));
    }

    allDeals.sort(
      (a, b) =>
        b.ratio - a.ratio ||
        a.collection.localeCompare(b.collection) ||
        a.tokenId.localeCompare(b.tokenId)
    );

    let rateLimit: ScanResponse["rateLimit"] | undefined;
    if (rateLimitsSeen.length > 0) {
      const minRem = Math.min(...rateLimitsSeen.map((r) => r.remaining));
      const latestReset = Math.max(...rateLimitsSeen.map((r) => r.reset));
      const maxLim = Math.max(...rateLimitsSeen.map((r) => r.limit));
      rateLimit = { limit: maxLim, remaining: minRem, reset: latestReset };
    }

    const response: ScanResponse = {
      deals: allDeals,
      scannedAt: new Date().toISOString(),
      errors,
      totalListingsScanned,
      rateLimit,
      scanStats: totalStats,
      ethPriceUsd,
      successfulCollections,
      skippedCollections,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}