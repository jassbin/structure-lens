"use client";

import { useTranslation } from "react-i18next";
import { Boxes } from "lucide-react";
import { RootBadge } from "@/components/shared/root-badge";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import type { StructureSkeleton } from "@/lib/analysis/types";

/** 结构骨架卡：主体→机制→被提取，诚实标注"结构假设 + 置信度" */
export function SkeletonCard({ skeleton }: { skeleton: StructureSkeleton }) {
  const { t } = useTranslation();
  const rows: Array<{ label: string; value: string }> = [
    { label: t("analysis.skeletonCard.subject"), value: skeleton.subject },
    { label: t("analysis.skeletonCard.mechanism"), value: skeleton.mechanism },
    { label: t("analysis.skeletonCard.extracted"), value: skeleton.extracted },
  ];

  return (
    <div
      className="rounded-2xl border border-secondary/30 bg-secondary/[0.04] p-4"
      data-el="skeleton-card"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-secondary" aria-hidden />
          <span className="font-heading text-sm font-extrabold text-foreground">
            {t("analysis.skeletonCard.title")}
          </span>
        </div>
        <span className="rounded-full border border-accent/50 bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-foreground">
          {t("analysis.skeletonCard.hypothesisTag")}
        </span>
      </div>

      <p className="mt-2.5 font-heading text-base font-black leading-snug text-secondary">
        {skeleton.name}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("analysis.skeletonCard.root")}
        </span>
        <RootBadge root={skeleton.root} />
      </div>

      <dl className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-2 text-sm">
            <dt className="w-14 shrink-0 font-bold text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 flex-1 text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>

      <ConfidenceBar
        className="mt-3"
        value={skeleton.confidence}
        label={t("analysis.confidence")}
      />
    </div>
  );
}
