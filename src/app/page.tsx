"use client";

import * as React from "react";
import { Deal, ScanResponse } from "@/lib/types";
import { useScannerStore } from "@/store/useScannerStore";
import { Sidebar } from "@/components/Sidebar";
import { DealTable } from "@/components/DealTable";
import { Header } from "@/components/Header";
import { FiltersBar } from "@/components/FiltersBar";
import { timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink } from "lucide-react";

const SORT_LABELS: Record<string, string> = {
  "highest-ratio": "Sorted by highest ratio",
  "lowest-delta": "Sorted by smallest ask–offer gap",
  "highest-ask": "Sorted by highest ask price",
};

export default function OpenSeaScannerDashboard() {
  const { collections, threshold, refreshInterval, autoRefresh, hydratePrefs } =
    useScannerStore();

  const [deals, setDeals] = React.useState<Deal[]>([]);
  const [lastScanned, setLastScanned] = React.useState<string | null>(null);
  const [hasScanned, setHasScanned] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [totalScanned, setTotalScanned] = React.useState(0);
  const [lastRateLimit, setLastRateLimit] = React.useState<{
    limit: number;
    remaining: number;
    reset: number;
  } | null>(null);
  const [lastScanStats, setLastScanStats] = React.useState<{
    listingsFetched: number;
    collectionBestOffer: number;
    candidates: number;
    refined: number;
  } | null>(null);

  const [cooldownSeconds, setCooldownSeconds] = React.useState(0);
  const [scanProgress, setScanProgress] = React.useState({
    current: 0,
    total: 0,
    currentCollection: "",
  });

  const [search, setSearch] = React.useState("");
  const [minPrice, setMinPrice] = React.useState(0);
  const [activeSort, setActiveSort] = React.useState<
    "highest-ratio" | "lowest-delta" | "highest-ask"
  >("highest-ratio");

  const [apiKey, setApiKey] = React.useState("");
  const [ethPriceUsd, setEthPriceUsd] = React.useState<number | null>(null);

  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isScanningRef = React.useRef(false);
  const lastRateLimitRef = React.useRef<{
    remaining: number;
    reset: number;
    limit: number;
  } | null>(null);

  const autoRefreshRef = React.useRef(autoRefresh);
  const collectionsRef = React.useRef(collections);
  const thresholdRef = React.useRef(threshold);
  const apiKeyRef = React.useRef(apiKey);

  React.useEffect(() => {
    autoRefreshRef.current = autoRefresh;
  }, [autoRefresh]);
  React.useEffect(() => {
    collectionsRef.current = collections;
  }, [collections]);
  React.useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);
  React.useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  React.useLayoutEffect(() => {
    hydratePrefs();
    const savedKey = localStorage.getItem("opensea_api_key") || "";
    setApiKey(savedKey); // eslint-disable-line react-hooks/set-state-in-effect
  }, [hydratePrefs]);

  const handleSetApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("opensea_api_key", key);
  };

  const filteredDeals = React.useMemo(() => {
    const filtered = deals.filter((d) => {
      const matchesSearch =
        !search ||
        d.collection.toLowerCase().includes(search.toLowerCase()) ||
        d.tokenId.includes(search) ||
        (d.name && d.name.toLowerCase().includes(search.toLowerCase()));
      const meetsMinPrice = d.askPrice >= minPrice;
      return matchesSearch && meetsMinPrice;
    });

    const sorted = [...filtered];
    if (activeSort === "highest-ratio") {
      sorted.sort(
        (a, b) =>
          b.ratio - a.ratio ||
          a.collection.localeCompare(b.collection) ||
          a.tokenId.localeCompare(b.tokenId)
      );
    } else if (activeSort === "lowest-delta") {
      sorted.sort(
        (a, b) =>
          a.askPrice - a.bestOffer - (b.askPrice - b.bestOffer) ||
          a.collection.localeCompare(b.collection) ||
          a.tokenId.localeCompare(b.tokenId)
      );
    } else if (activeSort === "highest-ask") {
      sorted.sort(
        (a, b) =>
          b.askPrice - a.askPrice ||
          a.collection.localeCompare(b.collection) ||
          a.tokenId.localeCompare(b.tokenId)
      );
    }

    return sorted;
  }, [deals, search, minPrice, activeSort]);

  const performScan = React.useCallback(async () => {
    const cols = collectionsRef.current;
    if (cols.length === 0) {
      toast.error("Add at least one collection slug");
      return;
    }
    if (isScanningRef.current) return;

    const rate = lastRateLimitRef.current;
    const nowSec = Math.floor(Date.now() / 1000);
    const stillInCooldown =
      rate && rate.remaining < 8 && nowSec < rate.reset;
    if (stillInCooldown) {
      const resetIn = Math.max(0, rate.reset - nowSec);
      toast.warning(
        `Rate limit buffer low (${rate.remaining} left). Waiting for reset.`,
        { description: `Resets in ~${Math.ceil(resetIn / 60)}m` }
      );
      return;
    }

    isScanningRef.current = true;
    setIsScanning(true);
    setDeals([]);
    setErrors([]);
    setLastScanStats(null);
    setHasScanned(true);
    setScanProgress({
      current: 0,
      total: cols.length,
      currentCollection: `Scanning ${cols.length} collection${cols.length === 1 ? "" : "s"}…`,
    });

    const accumulatedErrors: string[] = [];
    let dealCount = 0;
    let currentRate = lastRateLimitRef.current;
    let lastScannedAt: string | null = null;

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slugs: cols,
          threshold: thresholdRef.current,
          apiKey: apiKeyRef.current || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }

      const data: ScanResponse = await res.json();
      lastScannedAt = data.scannedAt;

      if (data.deals?.length) {
        dealCount = data.deals.length;
        setDeals(data.deals);
      }

      if (data.errors?.length) {
        accumulatedErrors.push(...data.errors);
      }

      if (data.rateLimit) {
        currentRate = data.rateLimit;
        setLastRateLimit(currentRate);
        lastRateLimitRef.current = currentRate;
        const now = Math.floor(Date.now() / 1000);
        setCooldownSeconds(
          currentRate.remaining < 8
            ? Math.max(0, currentRate.reset - now)
            : 0
        );
      }

      if (data.ethPriceUsd && data.ethPriceUsd > 0) {
        setEthPriceUsd(data.ethPriceUsd);
      }

      if (data.scanStats) {
        setLastScanStats({
          listingsFetched: data.scanStats.listingsFetched || 0,
          collectionBestOffer: data.scanStats.collectionBestOffer || 0,
          candidates: data.scanStats.candidates || 0,
          refined: data.scanStats.refined || 0,
        });
        setTotalScanned(data.scanStats.listingsFetched || 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      accumulatedErrors.push(msg);
    }

    if (lastScannedAt) {
      setLastScanned(lastScannedAt);
    }

    setErrors(accumulatedErrors);
    setScanProgress({
      current: cols.length,
      total: cols.length,
      currentCollection: "",
    });

    isScanningRef.current = false;
    setIsScanning(false);

    if (accumulatedErrors.length && dealCount > 0) {
      toast.warning(
        `Found ${dealCount} deals, but ${accumulatedErrors.length} collection${accumulatedErrors.length === 1 ? "" : "s"} had issues`
      );
    } else if (accumulatedErrors.length) {
      toast.error(`Scan failed: ${accumulatedErrors.length} issue(s)`);
    } else if (dealCount === 0) {
      toast.info("No matching deals found.");
    } else {
      toast.success(
        `Found ${dealCount} deal${dealCount === 1 ? "" : "s"} across ${cols.length} collection${cols.length === 1 ? "" : "s"}`
      );
    }
  }, []);

  React.useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!autoRefresh || refreshInterval === "manual") return;

    const getMs = () => {
      if (refreshInterval === "30s") return 30_000;
      if (refreshInterval === "60s") return 60_000;
      return 5 * 60 * 1000;
    };

    intervalRef.current = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const rate = lastRateLimitRef.current;
      const quotaLow =
        rate && rate.remaining < 8 && nowSec < rate.reset;
      if (!isScanningRef.current && !quotaLow) {
        performScan();
      }
    }, getMs());

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, performScan]);

  React.useEffect(() => {
    if (!lastRateLimit?.reset || lastRateLimit.remaining >= 8) return;
    const iv = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setCooldownSeconds(Math.max(0, lastRateLimit.reset - now));
    }, 1000);
    return () => clearInterval(iv);
  }, [lastRateLimit]);

  const exportCSV = () => {
    if (!filteredDeals.length) {
      toast.error("Nothing to export");
      return;
    }
    const headers = [
      "Collection",
      "Token ID",
      "Ask (ETH)",
      "Best Offer (ETH)",
      "Ratio",
      "Gap (ETH)",
      "Gap (USD)",
      "OpenSea URL",
    ];
    const rows = filteredDeals.map((d) => [
      d.collection,
      d.tokenId,
      d.askPrice,
      d.bestOffer,
      d.ratio,
      (d.askPrice - d.bestOffer).toFixed(4),
      d.askPriceUsd != null && d.bestOfferUsd != null
        ? (d.askPriceUsd - d.bestOfferUsd).toFixed(2)
        : "",
      d.openseaUrl,
    ]);

    const csvContent = [headers, ...rows]
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `opensea-deals-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredDeals.length} rows to CSV`);
  };

  const applySortPreset = (preset: string) => {
    setActiveSort(preset as "highest-ratio" | "lowest-delta" | "highest-ask");
  };

  const lastScannedLabel = lastScanned ? timeAgo(lastScanned) : "never";

  const quotaOk =
    !lastRateLimit || lastRateLimit.remaining >= 8 || cooldownSeconds <= 0;
  const canScan = !isScanning && collections.length > 0 && quotaOk;
  const canExport = filteredDeals.length > 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        lastScannedLabel={lastScannedLabel}
        lastRateLimit={lastRateLimit}
        isScanning={isScanning}
        onScan={performScan}
        canScan={canScan}
        onExport={exportCSV}
        canExport={canExport}
        cooldownSeconds={cooldownSeconds}
        scanProgress={scanProgress}
        scanStats={lastScanStats || undefined}
      />

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <Sidebar
          apiKey={apiKey}
          setApiKey={handleSetApiKey}
          minPrice={minPrice}
          setMinPrice={setMinPrice}
        />

        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <FiltersBar
            count={filteredDeals.length}
            totalScanned={totalScanned}
            search={search}
            onSearchChange={setSearch}
            onSort={applySortPreset}
            activeSort={activeSort}
          />

          {errors.length > 0 && (
            <div className="mx-4 mt-3 rounded-xl border border-red-500/30 bg-[var(--danger-soft)] px-3 py-2 text-sm flex gap-2 items-start text-red-600 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {errors.map((e, i) => (
                  <div key={`${i}-${e}`}>{e}</div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4 table-container">
            <DealTable
              data={filteredDeals}
              isLoading={isScanning}
              hasScanned={hasScanned}
              sortLabel={SORT_LABELS[activeSort]}
            />
          </div>

          <div className="shrink-0 border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--fg-muted)] flex items-center gap-3 bg-[var(--bg-subtle)]">
            <span>
              Threshold{" "}
              <span className="font-mono text-[var(--ink)]">
                {(threshold * 100).toFixed(0)}%
              </span>
            </span>
            <span>•</span>
            <span className="truncate">
              {collections.length
                ? `${collections.length} collection${collections.length === 1 ? "" : "s"}`
                : "No collections"}
            </span>
            {ethPriceUsd != null && (
              <>
                <span>•</span>
                <span className="font-mono">
                  ETH {ethPriceUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </>
            )}
            <a
              href="https://docs.opensea.io/reference/api-overview"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 hover:text-[var(--fg)]"
            >
              API docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}