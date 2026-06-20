import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "default" | "sm" | "xs" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)]/30 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985]";

    const variants = {
      default: "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)]",
      outline:
        "border border-[var(--border-strong)] bg-[var(--canvas)] hover:bg-[var(--subtle-hover)] text-[var(--ink)]",
      ghost: "hover:bg-[var(--subtle-hover)] text-[var(--ink)]",
      destructive: "bg-red-600 text-white hover:bg-red-500",
      secondary:
        "bg-[var(--canvas-soft)] text-[var(--ink)] hover:bg-[var(--surface-pressed)] border border-[var(--border)]",
    };

    // Uber style: pill (999px) for all interactive buttons.
    // Cards use rounded-xl separately. icon uses full for circular.
    const sizes = {
      default: "h-10 px-4 py-2 rounded-full",           // pill
      sm: "h-8 px-3 text-xs rounded-full",              // pill
      xs: "h-7 px-2 text-[10px] rounded-full",          // pill
      lg: "h-11 px-6 rounded-full",                     // pill (large)
      icon: "h-10 w-10 rounded-full",                   // circular pill
    };

    return (
      <button
        className={cn(base, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
