"use client";

import { useTranslation } from "react-i18next";
import { AlertTriangle, Plus } from "lucide-react";
import type { StepOverlay } from "@/lib/analysis/types";

/**
 * 下游增量展示：受影响步骤的原内容不覆盖，只在下面追加——
 * 标注"原内容因某次调整不再适用 + 原因"，再列出新增/修订内容。
 */
export function StepOverlays({ overlays }: { overlays?: StepOverlay[] }) {
  const { t } = useTranslation();
  if (!overlays || overlays.length === 0) return null;
  return (
    <div className="mt-3 space-y-2" data-el="step-overlays">
      {overlays.map((ov, i) => (
        <div
          key={i}
          className="rounded-xl border border-amber-400/40 bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20"
        >
          {ov.obsoleteReason && (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-bold">
                  {t("pipeline.overlay.obsolete")}（v{ov.version}）：
                </span>
                {ov.obsoleteReason}
              </span>
            </p>
          )}
          {ov.addendum.length > 0 && (
            <div className="mt-1.5">
              <p className="flex items-center gap-1 text-[11px] font-bold text-secondary">
                <Plus className="h-3 w-3" />
                {t("pipeline.overlay.addendum")}
              </p>
              <ul className="mt-1 space-y-1">
                {ov.addendum.map((a, j) => (
                  <li
                    key={j}
                    className="flex gap-1.5 text-[13px] leading-relaxed text-foreground"
                  >
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-secondary" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
