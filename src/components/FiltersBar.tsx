"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface FiltersBarProps {
  count: number;
  totalScanned: number;
  search: string;
  onSearchChange: (value: string) => void;
  onSort: (preset: string) => void;
  activeSort: string;
}

const SORT_OPTIONS = [
  { key: "highest-ratio", label: "Highest ratio" },
  { key: "lowest-delta", label: "Lowest delta" },
  { key: "highest-ask", label: "Highest ask" },
] as const;

export function FiltersBar({
  count,
  totalScanned,
  search,
  onSearchChange,
  onSort,
  activeSort,
}: FiltersBarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-2.5 bg-[var(--bg-subtle)] shrink-0">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">Deals</span>
        <Badge variant="outline">{count}</Badge>
        {totalScanned > 0 && (
          <span className="text-xs text-[var(--fg-muted)]">
            from {totalScanned} listings
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by collection or token…"
          className="h-8 w-full sm:w-48 min-w-0"
        />

        {/* Sort segmented control — pill group */}
        <div
          role="group"
          aria-label="Sort deals"
          className="flex text-xs rounded-full border border-[var(--border)] overflow-hidden"
        >
          {SORT_OPTIONS.map((opt, idx) => {
            const isActive = activeSort === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSort(opt.key)}
                className={`px-3 py-1 transition-all ${
                  isActive 
                    ? "bg-[var(--canvas-soft)] text-[var(--ink)] font-medium" 
                    : "text-[var(--fg-muted)] hover:bg-[var(--subtle-hover)]"
                } ${idx > 0 ? "border-l border-[var(--border)]" : ""}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
