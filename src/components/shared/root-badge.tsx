"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";
import type { RootStructure } from "@/lib/analysis/types";

const ROOT_STYLE: Record<RootStructure, string> = {
  extraction: "bg-primary/10 text-primary border-primary/25",
  delegation: "bg-secondary/10 text-secondary border-secondary/25",
  power: "border-[#6b5cff]/30 bg-[#6b5cff]/10 text-[#5647d6]",
};

/** 根结构徽章：三类根结构用不同色 */
export function RootBadge({
  root,
  className,
}: {
  root: RootStructure;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
        ROOT_STYLE[root],
        className,
      )}
      data-el="root-badge"
    >
      {t(`map.root.${root}`)}
    </span>
  );
}
