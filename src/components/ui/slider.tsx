"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min = 0.7,
  max = 1,
  step = 0.01,
  className,
}: SliderProps) {
  return (
    <div className={cn("relative w-full pt-1 pb-2", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label="Minimum offer-to-ask ratio"
        aria-valuetext={`${(value * 100).toFixed(0)}%`}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer accent-[var(--ink)]"
      />
      <div className="flex justify-between text-[10px] text-[var(--fg-muted)] mt-1 font-mono tabular-nums">
        <div>{min.toFixed(2)}</div>
        <div className="font-medium text-[var(--primary)]">{value.toFixed(2)}</div>
        <div>{max.toFixed(2)}</div>
      </div>
    </div>
  );
}
