"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { StepBody } from "@/components/analysis/pipeline/step-body";
import { StepOverlays } from "@/components/analysis/pipeline/step-overlays";
import { DisagreeThread } from "@/components/analysis/pipeline/disagree-thread";
import { InfoTip } from "@/components/shared/info-tip";
import { recompute } from "@/lib/api/analysis";
import { AppAIClientUnavailableError } from "@/lib/api/app-ai-request";
import { STANCE_LABELS, STEP_LABELS, STEP_ORDER } from "@/lib/analysis/types";
import type { AnalysisResult, StepKind } from "@/lib/analysis/types";
import { cn } from "@/utils/utils";

/** 7 步竖向推理流水线 —— 逐步展开 + 每节「我不同意」人机辩论 + 下游增量 */
export function PipelineTimeline({
  result,
  onResult,
}: {
  result: AnalysisResult;
  onResult: (r: AnalysisResult) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of result.steps) init[s.kind] = true;
    return init;
  });
  const [busyKind, setBusyKind] = useState<StepKind | null>(null);

  const total = result.steps.length;

  async function submitDisagree(kind: StepKind, objection: string) {
    if (busyKind) return;
    setBusyKind(kind);
    try {
      const res = await recompute({ result, fromStepKind: kind, disagreement: objection });
      onResult(res.result);
      const stanceLabel =
        STANCE_LABELS[
          res.result.revisions?.[res.result.revisions.length - 1]?.stance ?? "hold"
        ].zh;
      toast.success(
        res.changeNote
          ? `${stanceLabel}｜${res.changeNote}`
          : `${stanceLabel}（v${res.result.version}）`,
      );
    } catch (error) {
      if (!(error instanceof AppAIClientUnavailableError)) {
        toast.error(t("pipeline.recomputeFailed"));
      }
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-el="pipeline-timeline">
      <div className="flex items-center justify-between px-0.5">
        <span className="flex items-center gap-1.5 font-heading text-sm font-extrabold text-foreground">
          {t("pipeline.title")}
          <InfoTip content={t("pipeline.tips.title")} />
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {total} {t("pipeline.steps")}
        </span>
      </div>

      <ol className="relative flex flex-col">
        {result.steps.map((step, idx) => {
          const isOpen = open[step.kind];
          const order = STEP_ORDER.indexOf(step.kind);
          const label = STEP_LABELS[step.kind]?.zh ?? step.title;
          const last = idx === result.steps.length - 1;
          const toggle = () =>
            setOpen((p) => ({ ...p, [step.kind]: !p[step.kind] }));
          return (
            <li key={step.kind} className="relative pl-9" data-el="pipeline-step">
              {!last && (
                <span className="absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px bg-border" />
              )}
              <span className="absolute left-0 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-sm">
                {order}
              </span>

              <div className="pb-3">
                <div className="flex w-full items-center justify-between gap-2 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggle}
                      className="text-left font-heading text-[15px] font-extrabold text-foreground"
                    >
                      {label}
                    </button>
                    <InfoTip content={t(`pipeline.tips.${step.kind}`)} />
                  </span>
                  <button type="button" aria-label={label} onClick={toggle}>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-1.5 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                    <StepBody step={step} verdict={result.verdict} />
                    <StepOverlays overlays={step.overlays} />
                    <DisagreeThread
                      debate={step.debate}
                      busy={busyKind === step.kind}
                      onSubmit={(objection) => submitDisagree(step.kind, objection)}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
