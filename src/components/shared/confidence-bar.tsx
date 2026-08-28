"use client";

import { cn } from "@/utils/utils";

/** 置信度/概率条：钴蓝填充 + 数字，克制明快 */
export function ConfidenceBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)} data-el="confidence-bar">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-foreground">
        {v}%
      </span>
    </div>
  );
}
