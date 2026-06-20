"use client";

import * as React from "react";
import { useScannerStore } from "@/store/useScannerStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshInterval } from "@/lib/types";
import { isValidCollectionSlug } from "@/lib/utils";
import { toast } from "sonner";
import { X, Plus, Play, Pause, ChevronDown, ChevronUp } from "lucide-react";

interface SearchResult {
  slug: string;
  name: string;
  image_url?: string;
  opensea_url?: string;
}

const INTERVAL_OPTIONS: { value: RefreshInterval; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "30s", label: "Every 30 seconds" },
  { value: "60s", label: "Every 60 seconds" },
  { value: "5min", label: "Every 5 minutes" },
];

interface SidebarProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  minPrice: number;
  setMinPrice: (v: number) => void;
}

export function Sidebar({
  apiKey,
  setApiKey,
  minPrice,
  setMinPrice,
}: SidebarProps) {
  const {
    collections,
    threshold,
    refreshInterval,
    autoRefresh,
    setThreshold,
    addCollection,
    removeCollection,
    setRefreshInterval,
    setAutoRefresh,
  } = useScannerStore();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);

  const [bulk, setBulk] = React.useState("");
  const [showBulk, setShowBulk] = React.useState(false);

  // Debounced collection search
  React.useEffect(() => {
    if (searchQuery.length < 2) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery,
            limit: 8,
            apiKey: apiKey || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setSearchResults([]);
            setShowDropdown(false);
            toast.error("API key required", {
              description:
                "Set OPENSEA_API_KEY in .env or enter a key in the sidebar.",
            });
            return;
          }
        }
        setSearchResults(data.results || []);
        setShowDropdown((data.results || []).length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, apiKey]);

  const handleAdd = () => {
    const val = searchQuery.trim().toLowerCase();
    if (!val) return;
    if (!isValidCollectionSlug(val)) {
      toast.error("Invalid collection slug", {
        description: "Use lowercase letters, numbers, and hyphens only.",
      });
      return;
    }
    const wasNew = !collections.includes(val);
    if (!addCollection(val)) {
      toast.error("Invalid collection slug");
      return;
    }
    if (wasNew) toast.success(`Added ${val}`);
    else toast.info(`${val} is already in your list`);
    setSearchQuery("");
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleBulkAdd = () => {
    const slugs = bulk
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    let added = 0;
    let skipped = 0;
    slugs.forEach((s) => {
      if (addCollection(s)) added++;
      else skipped++;
    });
    if (added > 0) toast.success(`Added ${added} collection${added === 1 ? "" : "s"}`);
    if (skipped > 0) toast.warning(`Skipped ${skipped} invalid or duplicate slug${skipped === 1 ? "" : "s"}`);
    setBulk("");
    setShowBulk(false);
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRefreshInterval(e.target.value as RefreshInterval);
  };

  return (
    <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--bg-subtle)] p-4 overflow-y-auto space-y-4 text-sm max-h-[42vh] md:max-h-none">
      {/* Collections */}
      <div>
        <div className="section-label mb-1.5">Collections</div>
        <div className="relative">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (value.trim().length < 2) {
                  setSearchResults([]);
                  setShowDropdown(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setShowDropdown(false);
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              onBlur={() => {
                // small delay so clicks on dropdown register
                setTimeout(() => setShowDropdown(false), 130);
              }}
              placeholder="Search collections (e.g. bored, azuki) or paste slug"
            />
            <Button size="sm" onClick={handleAdd} className="px-3 shrink-0" disabled={!searchQuery.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Search dropdown */}
          {searchQuery.length >= 2 && showDropdown && searchResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg max-h-64 overflow-auto text-xs">
              {searchResults.map((result) => (
                <div
                  key={result.slug}
                  onClick={() => {
                    const wasNew = !collections.includes(result.slug);
                    addCollection(result.slug);
                    if (wasNew) {
                      toast.success(`Added ${result.slug}`);
                    } else {
                      toast.info(`${result.slug} is already in your list`);
                    }
                    setSearchQuery("");
                    setShowDropdown(false);
                    setSearchResults([]);
                  }}
                  className="flex items-center gap-2 px-2.5 py-[6px] hover:bg-[var(--card-subtle)] cursor-pointer border-b border-[var(--border)] last:border-none"
                >
                  {result.image_url ? (
                    <img
                      src={result.image_url}
                      alt=""
                      className="w-5 h-5 rounded flex-shrink-0 border border-[var(--border)] object-cover"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                  ) : (
                    <div className="w-5 h-5 rounded bg-[var(--card-subtle)] flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[var(--fg)] truncate leading-tight">{result.name}</div>
                    <div className="text-[10px] text-[var(--fg-muted)] font-mono truncate leading-tight">{result.slug}</div>
                  </div>
                </div>
              ))}
              {isSearching && (
                <div className="px-2.5 py-1 text-[10px] text-[var(--fg-muted)]">Searching...</div>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {collections.length === 0 && (
            <div className="text-xs text-[var(--fg-muted)]">Add collections to scan</div>
          )}
          {collections.map((slug) => (
            <Badge key={slug} variant="outline" className="flex items-center gap-1 pr-1 text-xs">
              {slug}
              <button
                onClick={() => removeCollection(slug)}
                aria-label={`Remove ${slug}`}
                className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--card-subtle)]"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        {/* Bulk - collapsed by default for simplicity */}
        <button
          onClick={() => setShowBulk(!showBulk)}
          className="mt-2 flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          Bulk add {showBulk ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showBulk && (
          <div className="mt-1.5">
            <Textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder="azuki, doodles-official"
              className="h-16 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-1.5 w-full"
              onClick={handleBulkAdd}
              disabled={!bulk.trim()}
            >
              Add All
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Threshold */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <div className="tabular-nums text-xl font-semibold tracking-tighter">
                {(threshold * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-[var(--fg-muted)]">min ratio</div>
            </div>
            <Slider value={threshold} onChange={setThreshold} min={0.7} max={1} step={0.01} />
            <div className="mt-1 text-xs text-[var(--fg-muted)]">Best offer must meet or exceed this ratio of ask price</div>
          </div>

          {/* Min Price */}
          <div>
            <div className="section-label mb-1">Min ask price (ETH)</div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
              <span className="text-xs text-[var(--fg-muted)]">ETH</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scanning */}
      <Card>
        <CardHeader>
          <CardTitle>Scanning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label htmlFor="refresh-interval" className="section-label mb-1 block">
              Refresh interval
            </label>
            <select
              id="refresh-interval"
              value={refreshInterval}
              onChange={handleIntervalChange}
              className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? "outline" : "secondary"}
              size="sm"
              className="flex-1 gap-1.5"
              disabled={refreshInterval === "manual"}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoRefresh ? "Pause" : "Auto"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Key */}
      <div className="pt-1">
        <div className="section-label mb-1.5">OpenSea API Key</div>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="os_..."
          className="font-mono text-xs"
        />
        <div className="mt-1.5 text-[10px] text-[var(--fg-muted)]">
          Stored locally in your browser. Required unless OPENSEA_API_KEY is set on the server.
        </div>
      </div>
    </div>
  );
}
