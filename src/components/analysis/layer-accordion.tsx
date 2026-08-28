"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";
import { ConfidenceBar } from "@/components/shared/confidence-bar";
import type { AnalysisLayer } from "@/lib/analysis/types";

/** 逐层可折叠展开：骨架/下钻/暗黑/博弈/概率 */
export function LayerAccordion({ layers }: { layers: AnalysisLayer[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number>(0);

  return (
    <div className="flex flex-col gap-2.5" data-el="layer-accordion">
      {layers.map((layer, i) => {
        const isOpen = open === i;
        const confLabel =
          layer.kind === "probability"
            ? t("analysis.probability")
            : t("analysis.confidence");
        return (
          <div
            key={layer.kind}
            className={cn(
              "overflow-hidden rounded-2xl border bg-card transition-colors",
              isOpen ? "border-primary/40 shadow-sm" : "border-border",
            )}
            data-el="layer-item"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t(`analysis.layers.${layer.kind}`)}
                </span>
                <span className="block truncate text-sm font-semibold text-foreground">
                  {layer.title}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180 text-primary",
                )}
              />
            </button>
            {isOpen && (
              <div className="border-t border-border px-4 py-3">
                <ul className="space-y-2">
                  {layer.points.map((p, j) => (
                    <li key={j} className="flex gap-2 text-sm leading-relaxed text-foreground">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {p}
                    </li>
                  ))}
                </ul>
                <ConfidenceBar
                  className="mt-3"
                  value={layer.confidence}
                  label={confLabel}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
