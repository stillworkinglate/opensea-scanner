"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Download, RefreshCw } from "lucide-react";
import { formatCountdown, type QuotaState } from "@/lib/utils";

interface HeaderProps {
  lastScannedTime: string | null;
  quota: QuotaState | null;
  isScanning: boolean;
  onScan: () => void;
  canScan: boolean;
  onExport: () => void;
  canExport: boolean;
  autoRefresh?: boolean;
  autoRefreshPaused?: boolean;
  nextAutoScanSeconds?: number;
  scanProgress?: { current: number; total: number; currentCollection: string };
}

export function Header({
  lastScannedTime,
  quota,
  isScanning,
  onScan,
  canScan,
  onExport,
  canExport,
  autoRefresh = false,
  autoRefreshPaused = false,
  nextAutoScanSeconds = 0,
  scanProgress,
}: HeaderProps) {
  const quotaTone = quota?.isLimited
    ? "text-amber-600 dark:text-amber-400"
    : quota && quota.remainingPercent < 25
      ? "text-amber-600 dark:text-amber-400"
      : "text-[var(--fg-muted)]";

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur z-50 flex items-center px-4 shrink-0">
      <div className="flex w-full items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.svg"
            alt="OpenSea Scanner"
            className="h-6 w-6"
          />
          <div className="font-semibold tracking-tight">OpenSea Scanner</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {lastScannedTime && (
            <div
              className="hidden md:flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1 text-xs text-[var(--fg-muted)]"
              title="Last successful scan"
            >
              <span className="text-[10px] uppercase tracking-wide">Scanned</span>
              <span className="font-mono tabular-nums text-[var(--ink)]">
                {lastScannedTime}
              </span>
            </div>
          )}

          {quota && (
            <div
              className={`hidden sm:flex items-center gap-2 text-[10px] ${quotaTone}`}
              title="OpenSea API quota remaining in the current window"
            >
              <span className="font-medium">API</span>
              <div className="relative w-20 h-2 bg-[var(--bg-subtle)] rounded-full overflow-hidden border border-[var(--border)]">
                <div
                  className={`h-2 transition-all duration-500 ${
                    quota.isLimited
                      ? "bg-amber-500"
                      : quota.remainingPercent < 25
                        ? "bg-amber-500"
                        : "bg-[var(--ink)]"
                  }`}
                  style={{ width: `${quota.remainingPercent}%` }}
                />
              </div>
              <span className="font-mono tabular-nums">
                {quota.remaining}/{quota.limit}
              </span>
              {quota.isLimited && quota.cooldownSeconds > 0 && (
                <span className="font-mono tabular-nums">
                  · resets {formatCountdown(quota.cooldownSeconds)}
                </span>
              )}
              {quota.isRecovered && !isScanning && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  · ready
                </span>
              )}
            </div>
          )}

          {autoRefresh && !isScanning && (
            <div className="hidden lg:flex items-center gap-1 text-[10px] text-[var(--fg-muted)]">
              {autoRefreshPaused ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Auto paused
                  {quota?.cooldownSeconds
                    ? ` · ${formatCountdown(quota.cooldownSeconds)}`
                    : ""}
                </span>
              ) : nextAutoScanSeconds > 0 ? (
                <span className="font-mono tabular-nums">
                  Next auto {formatCountdown(nextAutoScanSeconds)}
                </span>
              ) : (
                <span className="font-medium text-[var(--ink)]">Auto on</span>
              )}
            </div>
          )}

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

          <Button onClick={onScan} disabled={!canScan} className="gap-2">
            <RefreshCw
              className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`}
            />
            {isScanning
              ? "SCANNING"
              : quota?.isLimited
                ? "WAIT"
                : "SCAN"}
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