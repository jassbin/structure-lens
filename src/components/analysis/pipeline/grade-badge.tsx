"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";
import type { SourceGrade } from "@/lib/analysis/types";

const STYLE: Record<SourceGrade, string> = {
  strong: "border-secondary/40 bg-secondary/10 text-secondary",
  medium: "border-primary/40 bg-primary/10 text-primary",
  weak: "border-accent/50 bg-accent/20 text-foreground",
  unverifiable:
    "border-destructive/40 bg-destructive/10 text-destructive",
};

/** 信源可信度徽章 —— 诚实标注的核心视觉 */
export function GradeBadge({
  grade,
  className,
}: {
  grade: SourceGrade;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none",
        STYLE[grade],
        className,
      )}
      data-el="grade-badge"
      data-grade={grade}
    >
      {t(`pipeline.grade.${grade}`)}
    </span>
  );
}
