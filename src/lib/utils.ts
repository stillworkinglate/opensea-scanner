import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEth(price: number): string {
  return price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function formatRatio(ratio: number): string {
  return (ratio * 100).toFixed(1) + "%";
}

export function formatUsd(price: number): string {
  return price.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/** Fixed clock label for last scan — avoids a live counter that ticks every second. */
export function formatScanTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export interface QuotaSnapshot {
  limit: number;
  remaining: number;
  reset: number;
}

export interface QuotaState {
  limit: number;
  remaining: number;
  used: number;
  /** 0–100 share of quota still available (for the bar fill). */
  remainingPercent: number;
  isLimited: boolean;
  cooldownSeconds: number;
  canScan: boolean;
  /** OpenSea window has elapsed — display recovers until the next scan reports fresh headers. */
  isRecovered: boolean;
}

const DEFAULT_QUOTA_BUFFER = 8;

export function getQuotaState(
  rateLimit: QuotaSnapshot | null,
  nowSec: number,
  buffer = DEFAULT_QUOTA_BUFFER
): QuotaState | null {
  if (!rateLimit || rateLimit.limit <= 0) return null;

  const { limit, remaining, reset } = rateLimit;
  const isRecovered = nowSec >= reset;
  const displayRemaining = isRecovered ? limit : Math.max(0, remaining);
  const used = limit - displayRemaining;
  const remainingPercent = Math.min(
    100,
    Math.max(0, (displayRemaining / limit) * 100)
  );
  const cooldownSeconds = isRecovered ? 0 : Math.max(0, reset - nowSec);
  const isLimited = !isRecovered && remaining < buffer;
  const canScan = !isLimited;

  return {
    limit,
    remaining: displayRemaining,
    used,
    remainingPercent,
    isLimited,
    cooldownSeconds,
    canScan,
    isRecovered,
  };
}

export function getNftFallbackImage(tokenId: string, collection?: string): string {
  const seed = collection ? `${collection}-${tokenId}` : tokenId;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/128/128`;
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function isValidCollectionSlug(slug: string): boolean {
  const cleaned = slug.trim().toLowerCase();
  return cleaned.length >= 1 && cleaned.length <= 64 && SLUG_PATTERN.test(cleaned);
}


