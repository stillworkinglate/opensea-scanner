"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Deal } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatEth, formatRatio, formatUsd, getNftFallbackImage } from "@/lib/utils";
import { ArrowUpDown, ExternalLink } from "lucide-react";

interface DealTableProps {
  data: Deal[];
  isLoading?: boolean;
  hasScanned?: boolean;
  sortLabel?: string;
}

export function DealTable({
  data,
  isLoading,
  hasScanned = false,
  sortLabel = "Sorted by highest ratio",
}: DealTableProps) {
  const columns: ColumnDef<Deal>[] = React.useMemo(
    () => [
      {
        id: "image",
        header: "",
        cell: ({ row }) => (
          <div className="w-11 h-11 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-subtle)] shrink-0">
            <img
              src={row.original.imageUrl}
              alt={row.original.name || row.original.tokenId}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (!target.dataset.fallbackApplied) {
                  target.dataset.fallbackApplied = "true";
                  target.src = getNftFallbackImage(
                    row.original.tokenId,
                    row.original.collection
                  );
                }
              }}
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "collection",
        header: "Collection",
        cell: ({ row }) => (
          <div className="font-medium truncate max-w-[148px]">
            {row.getValue("collection")}
          </div>
        ),
      },
      {
        accessorKey: "tokenId",
        header: "Token ID",
        cell: ({ row }) => (
          <div className="font-mono text-[var(--fg-muted)] tabular-nums">
            {row.getValue("tokenId")}
          </div>
        ),
      },
      {
        accessorKey: "askPrice",
        header: "Ask (ETH)",
        cell: ({ row }) => {
          const deal = row.original;
          return (
            <div className="font-mono tabular-nums text-right">
              <div>{formatEth(deal.askPrice)}</div>
              {deal.askPriceUsd != null && (
                <div className="text-[10px] text-[var(--fg-muted)]">
                  {formatUsd(deal.askPriceUsd)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "bestOffer",
        header: "Best Offer (ETH)",
        cell: ({ row }) => {
          const deal = row.original;
          return (
            <div className="font-mono tabular-nums text-right text-[var(--ink)]">
              <div>{formatEth(deal.bestOffer)}</div>
              {deal.bestOfferUsd != null && (
                <div className="text-[10px] text-[var(--fg-muted)]">
                  {formatUsd(deal.bestOfferUsd)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "ratio",
        header: "Ratio",
        cell: ({ row }) => {
          const ratio = row.getValue<number>("ratio");
          const pct = ratio * 100;
          const variant =
            pct > 100 ? "flip" : pct >= 95 ? "success" : pct >= 90 ? "warning" : "default";
          return (
            <Badge variant={variant} className="tabular-nums font-semibold">
              {formatRatio(ratio)}
              {pct > 100 && <span className="ml-1 opacity-80">flip</span>}
            </Badge>
          );
        },
      },
      {
        id: "delta",
        header: "Gap (ETH)",
        cell: ({ row }) => {
          const deal = row.original;
          const delta = deal.askPrice - deal.bestOffer;
          const isFlip = delta < 0;
          const gapUsd =
            deal.askPriceUsd != null && deal.bestOfferUsd != null
              ? deal.askPriceUsd - deal.bestOfferUsd
              : null;
          return (
            <div
              className={`font-mono tabular-nums text-right ${
                isFlip
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              <div>
                {isFlip ? `+${formatEth(Math.abs(delta))}` : formatEth(delta)}
              </div>
              {gapUsd != null && (
                <div className="text-[10px] text-[var(--fg-muted)]">
                  {isFlip
                    ? `+${formatUsd(Math.abs(gapUsd))}`
                    : formatUsd(gapUsd)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const deal = row.original;
          return (
            <div className="flex items-center justify-end">
              <a
                href={deal.openseaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 text-xs hover:bg-[var(--card-subtle)]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View
              </a>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading && !data.length) {
    return (
      <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card)]">
        <div className="bg-[var(--bg-subtle)] px-4 py-3 text-sm font-medium text-[var(--fg-muted)] border-b border-[var(--border)]">
          Scanning collections…
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-3 animate-pulse"
          >
            <div className="w-11 h-11 rounded-lg bg-[var(--card-subtle)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 bg-[var(--card-subtle)] rounded" />
              <div className="h-3 w-20 bg-[var(--card-subtle)] rounded" />
            </div>
            <div className="h-4 w-16 bg-[var(--card-subtle)] rounded" />
            <div className="h-4 w-16 bg-[var(--card-subtle)] rounded" />
            <div className="h-6 w-14 bg-[var(--card-subtle)] rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="border border-[var(--border)] rounded-xl p-12 text-center bg-[var(--card)]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-subtle)]">
          <ArrowUpDown className="h-6 w-6 text-[var(--fg-muted)]" />
        </div>
        {!hasScanned ? (
          <>
            <p className="text-lg font-medium">No deals yet</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Add collections and run a scan to find offers near listing prices.
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">No deals match your filters</p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Try lowering the ratio threshold, reducing the min ask price, or
              adding more collections.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 bg-[var(--bg-subtle)]">
        <div className="text-sm text-[var(--fg-muted)]">
          {data.length} deals
          {isLoading && (
            <span className="ml-2 text-[var(--ink)]">· scanning…</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-[var(--border)] bg-[var(--bg-subtle)]"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left font-medium text-[var(--fg-muted)] first:pl-5 last:pr-5"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="group hover:bg-[var(--bg-subtle)] transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-2.5 align-middle first:pl-5 last:pr-5"
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-1.5 text-[11px] text-[var(--fg-muted)]">
        {sortLabel}
      </div>
    </div>
  );
}