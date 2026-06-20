"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Download, RefreshCw } from "lucide-react";

interface HeaderProps {
  lastScannedLabel: string;
  lastRateLimit: { limit: number; remaining: number; reset: number } | null;
  isScanning: boolean;
  onScan: () => void;
  canScan: boolean;
  onExport: () => void;
  canExport: boolean;
  cooldownSeconds?: number;
  scanProgress?: { current: number; total: number; currentCollection: string };
  scanStats?: { listingsFetched: number; candidates: number; refined: number };
}

export function Header({
  lastScannedLabel,
  lastRateLimit,
  isScanning,
  onScan,
  canScan,
  onExport,
  canExport,
  cooldownSeconds = 0,
  scanProgress,
  scanStats,
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur z-50 flex items-center px-4 shrink-0">
      <div className="flex w-full items-center gap-3">
        {/* Logo + Title */}
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.svg"
            alt="OpenSea Scanner"
            className="h-6 w-6"
          />
          <div className="font-semibold tracking-tight">OpenSea Scanner</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Compact last scanned - hide when never */}
          {lastScannedLabel !== "never" && (
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-xs text-[var(--fg-muted)] font-mono">
              {lastScannedLabel}
            </div>
          )}

          {/* Live Rate Limit Bar + Cooldown (as calls fill the quota) */}
          {lastRateLimit && (
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-[var(--fg-muted)]">
              <span className="font-medium">Rate</span>
              <div className="relative w-20 h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border)]">
                {(() => {
                  const usage = Math.min(100, ((lastRateLimit.limit - lastRateLimit.remaining) / lastRateLimit.limit) * 100);
                  const color = (lastRateLimit.remaining < 8 || cooldownSeconds > 0) ? 'bg-red-500' : 'bg-[var(--ink)]';
                  return <div className={`h-2 transition-all ${color}`} style={{ width: `${usage}%` }} />;
                })()}
              </div>
              <span className="font-mono tabular-nums">{lastRateLimit.remaining}/{lastRateLimit.limit}</span>
              {cooldownSeconds > 0 && (
                <span className="font-mono text-amber-600 dark:text-amber-400 tabular-nums" title="Time until rate limit resets">
                  ~{Math.floor(cooldownSeconds / 60)}m {cooldownSeconds % 60}s
                </span>
              )}
            </div>
          )}

          {/* Scan progress */}
          {isScanning && scanProgress && scanProgress.total > 0 && (
            <div className="hidden md:flex items-center gap-2 text-[10px] text-[var(--fg-muted)] max-w-[200px]">
              <div className="relative w-16 h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border)] shrink-0">
                <div className="h-2 w-1/2 bg-[var(--ink)] animate-pulse rounded-full" />
              </div>
              <span className="truncate text-[var(--ink)] font-medium">
                {scanProgress.currentCollection ||
                  `Scanning ${scanProgress.total} collection${scanProgress.total === 1 ? "" : "s"}…`}
              </span>
            </div>
          )}

          {/* Post-scan stats */}
          {!isScanning && scanStats && scanStats.listingsFetched > 0 && (
            <div className="hidden lg:flex items-center gap-1 text-[10px] text-[var(--fg-muted)] font-mono">
              {scanStats.listingsFetched} listings · {scanStats.candidates} matched
            </div>
          )}

          {/* Primary actions - consistent default size */}
          <Button
            onClick={onScan}
            disabled={!canScan}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "SCANNING" : "SCAN"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!canExport}
            className="gap-1"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
