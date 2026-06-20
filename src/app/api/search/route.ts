import { NextRequest, NextResponse } from "next/server";
import { searchCollections } from "@/lib/opensea";
import { resolveOpenSeaApiKey } from "@/lib/api-key";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const searchRateLimit = createRateLimiter(30, 60_000);

function parseLimit(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? "10"), 10);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 1), 25)
    : 10;
}

async function handleSearch(
  query: string,
  limit: number,
  apiKey?: string
) {
  if (!query) {
    return NextResponse.json({ results: [] });
  }
  if (query.length < 2) {
    return NextResponse.json(
      { results: [], error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }
  if (query.length > 100) {
    return NextResponse.json(
      { results: [], error: "Query too long" },
      { status: 400 }
    );
  }

  const resolvedKey = resolveOpenSeaApiKey(apiKey);
  if (!resolvedKey) {
    return NextResponse.json(
      {
        results: [],
        error:
          "OpenSea API key required. Set OPENSEA_API_KEY in .env or enter a key in the sidebar.",
      },
      { status: 401 }
    );
  }

  const results = await searchCollections(query, resolvedKey, limit);
  return NextResponse.json({ results });
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (!searchRateLimit.check(ip)) {
    return NextResponse.json(
      { results: [], error: "Too many search requests. Please wait a minute." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || searchParams.get("q") || "").trim();
  const limit = parseLimit(searchParams.get("limit"));

  return handleSearch(query, limit);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!searchRateLimit.check(ip)) {
    return NextResponse.json(
      { results: [], error: "Too many search requests. Please wait a minute." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const query = String(body.query || "").trim();
    const limit = parseLimit(body.limit);
    return handleSearch(query, limit, body.apiKey);
  } catch {
    return NextResponse.json(
      { results: [], error: "Invalid request body" },
      { status: 400 }
    );
  }
}