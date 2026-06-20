import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "flip";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-[var(--card-subtle)] text-[var(--fg)] border border-[var(--border)]",
    secondary: "bg-[var(--card-subtle)] text-[var(--fg-muted)]",
    destructive: "bg-[var(--danger-soft)] text-red-600 dark:text-red-400 border border-red-500/30",
    outline: "border border-[var(--border-strong)] text-[var(--fg-muted)]",
    success: "bg-[var(--success-soft)] text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-medium",
    warning: "bg-[var(--warning-soft)] text-amber-700 dark:text-amber-400 border border-amber-500/30 font-medium",
    flip: "bg-[var(--success-soft)] text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 font-semibold",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
