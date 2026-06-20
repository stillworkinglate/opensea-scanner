import { NextRequest } from "next/server";

type RateLimitEntry = { count: number; resetAt: number };

export function createRateLimiter(maxRequests: number, windowMs: number) {
  const map = new Map<string, RateLimitEntry>();

  return {
    check(ip: string): boolean {
      const now = Date.now();
      const entry = map.get(ip);

      if (!entry || now > entry.resetAt) {
        map.set(ip, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (entry.count >= maxRequests) return false;
      entry.count++;
      return true;
    },
  };
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}