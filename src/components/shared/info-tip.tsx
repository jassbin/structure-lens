"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/utils/utils";

/**
 * 通用注释气泡：一个 ? 图标，移动端点击展开、桌面悬停也展开，点击外部/再次点击关闭。
 * 纯自包含，无第三方依赖。
 */
export function InfoTip({
  content,
  label = "说明",
  className,
}: {
  content: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      data-el="info-tip"
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-primary",
          open && "text-primary",
        )}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-6 z-30 w-60 -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2 text-left text-xs font-normal leading-relaxed text-foreground shadow-[0_10px_30px_rgba(15,23,42,0.16)]"
        >
          <span
            aria-hidden
            className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-border bg-card"
          />
          {content}
        </span>
      )}
    </span>
  );
}
