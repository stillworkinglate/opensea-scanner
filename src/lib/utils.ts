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

export function getNftFallbackImage(tokenId: string, collection?: string): string {
  const seed = collection ? `${collection}-${tokenId}` : tokenId;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/128/128`;
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function isValidCollectionSlug(slug: string): boolean {
  const cleaned = slug.trim().toLowerCase();
  return cleaned.length >= 1 && cleaned.length <= 64 && SLUG_PATTERN.test(cleaned);
}


